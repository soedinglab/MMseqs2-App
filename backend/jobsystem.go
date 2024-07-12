package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sync"

	"github.com/go-playground/validator/v10"
	"github.com/go-redis/redis"
)

type JobType string

const (
	JobSearch          JobType = "search"
	JobIndex           JobType = "index"
	JobMsa             JobType = "msa"
	JobPair            JobType = "pair"
	JobStructureSearch JobType = "structuresearch"
	JobComplexSearch   JobType = "complexsearch"
)

type JobRequest struct {
	Id     Id          `json:"id" validate:"required"`
	Status Status      `json:"status" validate:"required"`
	Type   JobType     `json:"type" validate:"required"`
	Job    interface{} `json:"job" validate:"required"`
	Email  string      `json:"email" validate:"omitempty,email"`
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
	case JobStructureSearch:
		var j StructureSearchJob
		if err := json.Unmarshal(msg, &j); err != nil {
			return err
		}
		(*m).Job = j
		return nil
	case JobComplexSearch:
		var j ComplexSearchJob
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
	case JobMsa:
		var j MsaJob
		if err := json.Unmarshal(msg, &j); err != nil {
			return err
		}
		(*m).Job = j
		return nil
	case JobPair:
		var j PairJob
		if err := json.Unmarshal(msg, &j); err != nil {
			return err
		}
		(*m).Job = j
		return nil
	}

	return errors.New("invalid job type")
}

func (m *JobRequest) WriteSupportFiles(base string) error {
	switch m.Type {
	case JobSearch:
		if j, ok := m.Job.(SearchJob); ok {
			return j.WriteFasta(filepath.Join(base, "job.fasta"))
		}
		return errors.New("invalid job type")
	case JobStructureSearch:
		if j, ok := m.Job.(StructureSearchJob); ok {
			return j.WritePDB(filepath.Join(base, "job.pdb"))
		}
		return errors.New("invalid job type")
	case JobComplexSearch:
		if j, ok := m.Job.(ComplexSearchJob); ok {
			return j.WritePDB(filepath.Join(base, "job.pdb"))
		}
		return errors.New("invalid job type")
	case JobMsa:
		if j, ok := m.Job.(MsaJob); ok {
			return j.WriteFasta(filepath.Join(base, "job.fasta"))
		}
		return errors.New("invalid job type")
	case JobPair:
		if j, ok := m.Job.(PairJob); ok {
			return j.WriteFasta(filepath.Join(base, "job.fasta"))
		}
		return errors.New("invalid job type")
	case JobIndex:
		return nil
	}
	return nil
}

type Job interface {
	Hash() Id
	Rank() float64
}

type Id string
type Status string

const (
	StatusPending  Status = "PENDING"
	StatusRunning  Status = "RUNNING"
	StatusComplete Status = "COMPLETE"
	StatusError    Status = "ERROR"
	StatusUnknown  Status = "UNKNOWN"
)

func (e *Status) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	if s == "" {
		*e = StatusPending
	} else {
		*e = Status(s)
	}
	return nil
}

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
	NewJob(JobRequest, string, bool) (Ticket, error)
	MultiStatus([]string) ([]Ticket, error)
	Dequeue() (*Ticket, error)
	QueueLength() (int, error)
}

type BaseJobSystem struct {
	StatusMutex *sync.Mutex
	Results     string
}

type RedisJobSystem struct {
	BaseJobSystem
	Client *redis.Client
}

func MakeRedisJobSystem(config ConfigRedis, results string, checkOld bool) (*RedisJobSystem, error) {
	jobsystem := &RedisJobSystem{
		BaseJobSystem{},
		redis.NewClient(&redis.Options{
			Network:  config.Network,
			Addr:     config.Address,
			Password: config.Password,
			DB:       config.DbIndex,
		}),
	}
	jobsystem.StatusMutex = &sync.Mutex{}
	jobsystem.Results = results

	if !checkOld {
		return jobsystem, nil
	}

	dirs, err := os.ReadDir(filepath.Clean(results))
	if err != nil {
		return jobsystem, err
	}

	for _, dir := range dirs {
		if !dir.IsDir() {
			continue
		}
		file := filepath.Join(filepath.Clean(results), dir.Name(), "job.json")
		if _, err := os.Stat(file); err != nil {
			if os.IsNotExist(err) {
				continue
			}
		}
		job, err := getJobRequestFromFile(file)
		if err != nil {
			continue
		}
		if job.Status != StatusComplete {
			job.Status = StatusError
		}
		jobsystem.SetStatus(job.Id, job.Status)
	}

	return jobsystem, nil
}

func (j *RedisJobSystem) NewJob(request JobRequest, jobsbase string, allowResubmit bool) (Ticket, error) {
	id := request.Id
	res, err := j.Status(id)
	if err != nil {
		return Ticket{id, StatusError}, err
	}

	workdir := filepath.Join(jobsbase, string(id))

	switch res {
	case StatusComplete:
		if allowResubmit {
			os.RemoveAll(workdir)
			break
		} else {
			return Ticket{id, res}, nil
		}
	case StatusPending, StatusRunning:
		return Ticket{id, res}, nil
	case StatusError:
		os.RemoveAll(workdir)
	}

	if _, err := os.Stat(workdir); os.IsNotExist(err) {
		err = os.Mkdir(workdir, 0755)
		if err != nil {
			return Ticket{id, StatusError}, err
		}
	}

	job, ok := request.Job.(Job)
	if !ok {
		return Ticket{id, StatusError}, errors.New("invalid job")
	}

	t := Ticket{id, StatusPending}
	err = j.Client.Watch(func(tx *redis.Tx) error {
		err := request.WriteSupportFiles(workdir)
		if err != nil {
			return err
		}

		file, err := os.Create(filepath.Join(workdir, "job.json"))
		if err != nil {
			return err
		}
		err = json.NewEncoder(file).Encode(request)
		if err != nil {
			file.Close()
			return err
		}
		err = file.Close()
		if err != nil {
			return err
		}

		err = j.SetStatus(id, StatusPending)
		if err != nil {
			return err
		}

		_, err = tx.ZAdd("mmseqs:pending", redis.Z{Score: job.Rank(), Member: string(id)}).Result()
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		j.SetStatus(id, StatusError)
		return t, err
	}

	return t, nil
}

func (j *RedisJobSystem) Dequeue() (*Ticket, error) {
	pop, err := j.Client.ZPopMin("mmseqs:pending", 1).Result()
	if err != nil {
		if pop != nil {
			return nil, err
		}
		return nil, nil
	}

	if len(pop) == 0 {
		return nil, nil
	}

	var id Id
	switch vv := pop[0].Member.(type) {
	case nil:
		return nil, errors.New("invalid ticket id")
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

func (j *RedisJobSystem) QueueLength() (int, error) {
	length, err := j.Client.ZCount("mmseqs:pending", "-inf", "+inf").Result()
	if err != nil {
		return 0, err
	}
	return int(length), nil
}

type LocalJobSystem struct {
	BaseJobSystem
	QueueMutex *sync.Mutex
	Queue      []Id
	queued     int
}

func MakeLocalJobSystem(results string, CheckOld bool) (LocalJobSystem, error) {
	jobsystem := LocalJobSystem{}
	jobsystem.QueueMutex = &sync.Mutex{}
	jobsystem.Queue = make([]Id, 0)
	jobsystem.StatusMutex = &sync.Mutex{}
	jobsystem.Results = results
	jobsystem.queued = 0

	if !CheckOld {
		return jobsystem, nil
	}

	dirs, err := os.ReadDir(filepath.Clean(results))
	if err != nil {
		return jobsystem, err
	}

	for _, dir := range dirs {
		if !dir.IsDir() {
			continue
		}
		file := filepath.Join(filepath.Clean(results), dir.Name(), "job.json")
		if _, err := os.Stat(file); err != nil {
			if os.IsNotExist(err) {
				continue
			}
		}
		job, err := getJobRequestFromFile(file)
		if err != nil ||
			job.Status == StatusError ||
			job.Status == StatusUnknown {
			dir := path.Dir(file)
			// refuse deleting paths like /bin etc
			if len(dir) > 4 {
				os.RemoveAll(dir)
			}
			continue
		}

		if job.Status == StatusRunning {
			job.Status = StatusPending
			jobsystem.SetStatus(job.Id, StatusPending)
		}

		if job.Status == StatusPending {
			jobsystem.Queue = append(jobsystem.Queue, job.Id)
			jobsystem.queued += 1
		}
	}

	return jobsystem, nil
}

func (j *BaseJobSystem) getJobFileName(id Id) string {
	return filepath.Join(filepath.Clean(j.Results), string(id), "job.json")
}

func setStatusInJobFile(file string, status Status) error {
	f, err := os.OpenFile(file, os.O_CREATE|os.O_RDWR, 0644)
	if err != nil {
		return err
	}

	var job JobRequest
	err = DecodeJsonAndValidate(f, &job)
	if err != nil {
		f.Close()
		return err
	}

	job.Status = status

	f.Truncate(0)
	f.Seek(0, io.SeekStart)

	err = json.NewEncoder(f).Encode(job)
	if err != nil {
		f.Close()
		return err
	}
	err = f.Sync()
	if err != nil {
		f.Close()
		return err
	}

	err = f.Close()
	if err != nil {
		return err
	}

	return nil
}

func getStatusFromJobFile(file string) (Status, error) {
	f, err := os.OpenFile(file, os.O_RDONLY, 0644)
	if errors.Is(err, os.ErrNotExist) {
		return StatusUnknown, nil
	} else if err != nil {
		return StatusError, err
	}

	var job JobRequest
	err = DecodeJsonAndValidate(f, &job)
	if err != nil {
		f.Close()
		return StatusError, err
	}

	f.Close()
	return job.Status, nil
}

func getJobRequestFromFile(file string) (JobRequest, error) {
	f, err := os.Open(file)
	if err != nil {
		return JobRequest{}, err
	}
	defer f.Close()

	var job JobRequest
	err = DecodeJson(f, &job)
	if err != nil {
		return JobRequest{}, err
	}

	return job, nil
}

func (j *BaseJobSystem) SetStatus(id Id, status Status) error {
	file := j.getJobFileName(id)
	j.StatusMutex.Lock()
	err := setStatusInJobFile(file, status)
	j.StatusMutex.Unlock()
	if err != nil {
		return err
	}
	return nil
}

func (j *BaseJobSystem) Status(id Id) (Status, error) {
	file := j.getJobFileName(id)
	j.StatusMutex.Lock()
	res, err := getStatusFromJobFile(file)
	j.StatusMutex.Unlock()
	if err != nil {
		return StatusError, err
	}
	return res, nil
}

func (j *BaseJobSystem) GetTicket(id Id) (Ticket, error) {
	t := Ticket{id, StatusUnknown}
	if !t.Valid() {
		return t, errors.New("invalid ID")
	}
	res, err := j.Status(t.Id)
	t.RawStatus = res
	return t, err
}

func (j *LocalJobSystem) NewJob(request JobRequest, jobsbase string, allowResubmit bool) (Ticket, error) {
	id := request.Id
	res, err := j.Status(id)
	if err != nil {
		return Ticket{id, StatusError}, err
	}

	validate := validator.New()
	if err := validate.Struct(request); err != nil {
		return Ticket{id, StatusError}, err
	}

	workdir := filepath.Join(jobsbase, string(id))

	switch res {
	case StatusComplete:
		if allowResubmit {
			os.RemoveAll(workdir)
			break
		} else {
			return Ticket{id, res}, nil
		}
	case StatusPending, StatusRunning:
		return Ticket{id, res}, nil
	case StatusError:
		os.RemoveAll(workdir)
	}

	t := Ticket{id, StatusUnknown}

	if _, err := os.Stat(workdir); os.IsNotExist(err) {
		err = os.Mkdir(workdir, 0755)
		if err != nil {
			return Ticket{id, StatusError}, err
		}
	}

	err = request.WriteSupportFiles(workdir)
	if err != nil {
		return Ticket{id, StatusError}, err
	}

	file, err := os.Create(filepath.Join(workdir, "job.json"))
	if err != nil {
		return Ticket{id, StatusError}, err
	}

	err = json.NewEncoder(file).Encode(request)
	if err != nil {
		file.Close()
		return Ticket{id, StatusError}, err
	}

	err = file.Close()
	if err != nil {
		return Ticket{id, StatusError}, err
	}

	j.SetStatus(id, StatusPending)
	t.RawStatus = StatusPending

	j.QueueMutex.Lock()
	j.Queue = append(j.Queue, id)
	j.queued += 1
	j.QueueMutex.Unlock()

	return t, nil
}

func (j *BaseJobSystem) MultiStatus(ids []string) ([]Ticket, error) {
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
	j.QueueMutex.Lock()
	if len(j.Queue) == 0 {
		j.QueueMutex.Unlock()
		return nil, nil
	}
	// pop the tail of the queue
	id := j.Queue[len(j.Queue)-1]
	j.Queue = j.Queue[:len(j.Queue)-1]
	j.queued -= 1
	j.QueueMutex.Unlock()

	ticket, err := j.GetTicket(id)
	if err != nil {
		return nil, err
	}

	return &ticket, nil
}

func (j *LocalJobSystem) QueueLength() (int, error) {
	return j.queued, nil
}
