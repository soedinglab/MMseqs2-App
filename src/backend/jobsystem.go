package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sync"

	"github.com/go-redis/redis"
)

type JobType string

const (
	JobSearch JobType = "search"
	JobIndex          = "index"
)

type JobRequest struct {
	Id     Id          `json:"id" valid:"required"`
	Status Status      `json:"status" valid:"required"`
	Type   JobType     `json:"type" valid:"required"`
	Job    interface{} `json:"job" valid:"required"`
	Email  string      `json:"email" valid:"email,optional"`
}

type jobRequest JobRequest

func (m *JobRequest) UnmarshalJSON(b []byte) error {
	var msg json.RawMessage
	var jr jobRequest
	jr.Job = &msg
	if err := json.Unmarshal(b, &jr); err != nil {
		return err
	}
	*m = JobRequest(jr)

	switch jr.Type {
	case JobSearch:
		var j SearchJob
		if err := json.Unmarshal(msg, &j); err != nil {
			return err
		}
		(*m).Job = j
		return nil
	case JobIndex:
		var j IndexJob
		if err := json.Unmarshal(msg, &j); err != nil {
			return err
		}
		(*m).Job = j
		return nil
	}

	return errors.New("Invalid Job Type")
}

type Job interface {
	Hash() Id
	Rank() float64
}

type Id string
type Status string

const (
	StatusPending  Status = "PENDING"
	StatusRunning         = "RUNNING"
	StatusComplete        = "COMPLETE"
	StatusError           = "ERROR"
	StatusUnknown         = "UNKNOWN"
)

type Ticket struct {
	Id        Id     `json:"id"`
	RawStatus Status `json:"status"`
}

var validId = regexp.MustCompile(`^[A-Za-z0-9-_=]{38}$`).MatchString

func (t Ticket) Valid() bool {
	return validId(string(t.Id))
}

type JobSystem interface {
	SetStatus(Id, Status) error
	Status(Id) (Status, error)
	GetTicket(Id) (Ticket, error)
	NewJob(JobRequest, string) (Ticket, error)
	MultiStatus([]string) ([]Ticket, error)
	Dequeue() (*Ticket, error)
}

type RedisJobSystem struct {
	Client *redis.Client
}

func MakeRedisJobSystem(config ConfigRedis) *RedisJobSystem {
	return &RedisJobSystem{redis.NewClient(&redis.Options{
		Network:  config.Network,
		Addr:     config.Address,
		Password: config.Password,
		DB:       config.DbIndex,
	})}
}

func (j *RedisJobSystem) SetStatus(id Id, status Status) error {
	_, err := j.Client.Set("mmseqs:status:"+string(id), string(status), 0).Result()
	if err != nil {
		return err
	}

	return nil
}

func (j *RedisJobSystem) Status(id Id) (Status, error) {
	res, err := j.Client.Get("mmseqs:status:" + string(id)).Result()
	if err != nil {
		if err == redis.Nil {
			return StatusUnknown, nil
		}
		return StatusError, err
	}

	return Status(res), nil
}

func (j *RedisJobSystem) GetTicket(id Id) (Ticket, error) {
	t := Ticket{id, StatusUnknown}
	if t.Valid() == false {
		return t, errors.New("Invalid ID")
	}
	s, err := j.Status(t.Id)
	t.RawStatus = s
	return t, err
}

func (j *RedisJobSystem) NewJob(request JobRequest, jobsbase string) (Ticket, error) {
	id := request.Id
	res, err := j.Status(id)
	if err != nil {
		return Ticket{id, StatusError}, err
	}

	workdir := filepath.Join(jobsbase, string(id))

	switch res {
	case StatusComplete, StatusPending, StatusRunning:
		return Ticket{id, res}, nil
	case StatusError:
		os.RemoveAll(workdir)
		break
	}

	if _, err := os.Stat(workdir); os.IsNotExist(err) {
		err = os.Mkdir(workdir, 0755)
		if err != nil {
			return Ticket{id, StatusError}, err
		}
	}

	job, ok := request.Job.(Job)
	if ok == false {
		return Ticket{id, StatusError}, errors.New("Invalid Job")
	}

	t := Ticket{id, StatusUnknown}
	err = j.Client.Watch(func(tx *redis.Tx) error {
		file, err := os.Create(filepath.Join(workdir, "job.json"))
		if err != nil {
			return err
		}
		defer file.Close()

		err = json.NewEncoder(file).Encode(request)
		if err != nil {
			return err
		}
		_, err = tx.Set("mmseqs:status:"+string(id), string(StatusPending), 0).Result()
		if err != nil {
			return err
		}
		t.RawStatus = StatusPending

		_, err = tx.ZAdd("mmseqs:pending", redis.Z{Score: job.Rank(), Member: string(id)}).Result()
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		t.RawStatus = StatusError
		_, errRedis := j.Client.Set("mmseqs:status:"+string(id), string(StatusError), 0).Result()
		if errRedis != nil {
			return t, errRedis
		}
		return t, err
	}

	return t, nil
}

func (j *RedisJobSystem) MultiStatus(ids []string) ([]Ticket, error) {
	if len(ids) == 0 {
		return make([]Ticket, 0), nil
	}

	var queries []string
	for _, value := range ids {
		if !validId(value) {
			continue
		}
		queries = append(queries, "mmseqs:status:"+value)
	}

	r, err := j.Client.MGet(queries...).Result()
	if err != nil {
		return nil, err
	}

	var result []Ticket
	for i, item := range r {
		var value string
		switch vv := item.(type) {
		case nil:
			value = StatusUnknown
		case []byte:
			value = string(vv)
		default:
			value = fmt.Sprint(vv)
		}
		result = append(result, Ticket{Id(ids[i]), Status(value)})
	}

	return result, nil
}

func (j *RedisJobSystem) Dequeue() (*Ticket, error) {
	Zpop := redis.NewScript(`
		local result = redis.call('zrange', KEYS[1], 0, 0)
		if result then
			result = result[1]
			redis.call('zremrangebyrank', KEYS[1], 0, 0)
		end
		return result
`)

	pop, err := Zpop.Run(j.Client, []string{"mmseqs:pending"}).Result()
	if err != nil {
		if pop != nil {
			return nil, err
		}
		return nil, nil
	}

	var id Id
	switch vv := pop.(type) {
	case nil:
		return nil, errors.New("Invalid ticket id!")
	case []byte:
		id = Id(string(vv))
	default:
		id = Id(fmt.Sprint(vv))
	}

	ticket, err := j.GetTicket(id)
	if err != nil {
		return nil, err
	}

	return &ticket, nil
}

type LocalJobSystem struct {
	mutex   *sync.Mutex
	Queue   []Id
	Lookup  map[Id]Status
	Results string
}

func MakeLocalJobSystem(results string) (LocalJobSystem, error) {
	jobsystem := LocalJobSystem{}
	jobsystem.mutex = &sync.Mutex{}
	jobsystem.Queue = make([]Id, 0)
	jobsystem.Lookup = make(map[Id]Status)
	jobsystem.Results = results

	files, err := filepath.Glob(filepath.Join(filepath.Clean(results), "*", "job.json"))
	if err != nil {
		return jobsystem, err
	}

	for _, file := range files {
		fmt.Println(file)
		job, err := getJobRequestFromFile(file)
		if err != nil {
			return jobsystem, err
		}
		if job.Status == StatusPending {
			jobsystem.Queue = append(jobsystem.Queue, job.Id)
		}

		jobsystem.Lookup[job.Id] = job.Status
		// TODO handle StatusRunning here
	}

	return jobsystem, nil
}

func (j *LocalJobSystem) getJobFileName(id Id) string {
	return filepath.Join(filepath.Clean(j.Results), string(id), "job.json")
}

func setStatusInJobFile(file string, status Status) error {
	f, err := os.OpenFile(file, os.O_CREATE|os.O_RDWR, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	var job JobRequest
	err = DecodeJsonAndValidate(f, &job)
	if err != nil {
		return err
	}

	job.Status = status

	f.Truncate(0)
	f.Seek(0, os.SEEK_SET)
	err = json.NewEncoder(f).Encode(job)
	if err != nil {
		return err
	}
	f.Sync()

	return nil
}

func getJobRequestFromFile(file string) (JobRequest, error) {
	f, err := os.Open(file)
	if err != nil {
		return JobRequest{}, err
	}
	defer f.Close()

	var job JobRequest
	err = DecodeJsonAndValidate(f, &job)
	if err != nil {
		return JobRequest{}, err
	}

	return job, nil
}

func (j *LocalJobSystem) SetStatus(id Id, status Status) error {
	j.Lookup[id] = status
	file := j.getJobFileName(id)
	err := setStatusInJobFile(file, status)
	if err != nil {
		return err
	}
	return nil
}

func (j *LocalJobSystem) Status(id Id) (Status, error) {
	res, ok := j.Lookup[id]
	if !ok {
		return StatusUnknown, nil
	}
	return res, nil
}

func (j *LocalJobSystem) GetTicket(id Id) (Ticket, error) {
	t := Ticket{id, StatusUnknown}
	if t.Valid() == false {
		return t, errors.New("Invalid ID")
	}
	res, err := j.Status(t.Id)
	t.RawStatus = res
	return t, err
}

func (j *LocalJobSystem) NewJob(request JobRequest, jobsbase string) (Ticket, error) {
	id := request.Id
	res, err := j.Status(id)
	if err != nil {
		return Ticket{id, StatusError}, err
	}

	workdir := filepath.Join(jobsbase, string(id))

	switch res {
	case StatusComplete, StatusPending, StatusRunning:
		return Ticket{id, res}, nil
	case StatusError:
		os.RemoveAll(workdir)
		break
	}

	t := Ticket{id, StatusUnknown}

	if _, err := os.Stat(workdir); os.IsNotExist(err) {
		err = os.Mkdir(workdir, 0755)
		if err != nil {
			return Ticket{id, StatusError}, err
		}
	}

	file, err := os.Create(filepath.Join(workdir, "job.json"))
	if err != nil {
		return Ticket{id, StatusError}, err
	}
	defer file.Close()

	err = json.NewEncoder(file).Encode(request)
	if err != nil {
		return Ticket{id, StatusError}, err
	}

	j.mutex.Lock()
	j.SetStatus(id, StatusPending)
	j.Queue = append(j.Queue, id)
	t.RawStatus = StatusPending
	j.mutex.Unlock()

	return t, nil
}

func (j *LocalJobSystem) MultiStatus(ids []string) ([]Ticket, error) {
	result := make([]Ticket, 0)

	if len(ids) == 0 {
		return result, nil
	}

	for _, value := range ids {
		if !validId(value) {
			continue
		}
		res, _ := j.Status(Id(value))
		result = append(result, Ticket{Id(value), res})

	}
	return result, nil
}

func (j *LocalJobSystem) Dequeue() (*Ticket, error) {
	// pop the tail of the queue
	if len(j.Queue) == 0 {
		return nil, nil
	}
	j.mutex.Lock()
	id := j.Queue[len(j.Queue)-1]
	j.Queue = j.Queue[:len(j.Queue)-1]
	j.mutex.Unlock()
	ticket, err := j.GetTicket(id)
	if err != nil {
		return nil, err
	}

	return &ticket, nil
}
