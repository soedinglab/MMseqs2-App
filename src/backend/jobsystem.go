package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/gob"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"

	"github.com/go-redis/redis"
)

type JobRequest struct {
	Query    string   `json:"q" valid:"alphanum,required"`
	Database []string `json:"database" valid:"required"`
	Mode     string   `json:"mode" valid:"in(accept,summary),required"`
	Email    string   `json:"email" valid:"email,optional"`
}

func (r JobRequest) Hash() string {
	h := sha256.New224()
	h.Write([]byte(r.Query))
	h.Write([]byte(r.Mode))

	sort.Strings(r.Database)

	for _, value := range r.Database {
		h.Write([]byte(value))
	}

	bs := h.Sum(nil)
	return base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(bs)
}

func max(x, y int) int {
	if x > y {
		return x
	}
	return y
}

func (r JobRequest) Rank() float64 {
	return float64(max(strings.Count(r.Query, ">"), 1) * max(len(r.Database), 1))
}

type Id string
type Status string

const (
	StatusPending  Status = "PENDING"
	StatusComplete        = "COMPLETE"
	StatusError           = "ERROR"
	StatusUnknown         = "UNKNOWN"
)

type Ticket struct {
	Id        Id     `json:"id"`
	RawStatus Status `json:"status"`
	jobsystem JobSystem
}

var ValidId = regexp.MustCompile(`^[A-Za-z0-9-_=]{38}$`).MatchString

func (t *Ticket) SetStatus(status Status) error {
	err := t.jobsystem.SetStatus(t.Id, status)
	if err != nil {
		return err
	}

	t.RawStatus = Status(status)
	return nil
}

func (t *Ticket) Status() (Status, error) {
	res, err := t.jobsystem.Status(t.Id)
	if err != nil {
		return StatusError, err
	}

	t.RawStatus = Status(res)
	return t.RawStatus, nil
}

type Job struct {
	Database []string `json:"database"`
	Mode     string   `json:"mode"`
	Email    string   `json:"email"`
}

func IsIn(num string, params []string) int {
	for i, param := range params {
		if num == param {
			return i
		}
	}

	return -1
}

type InvalidTicket struct {
}

func (e *InvalidTicket) Error() string {
	return "Ticket is not valid!"
}

type JobSystem interface {
	SetStatus(Id, Status) error
	Status(Id) (Status, error)
	GetTicket(Id) (Ticket, error)
	NewJob(JobRequest, []ParamsDisplay, string) (Ticket, error)
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
	if !ValidId(string(id)) {
		return Ticket{}, errors.New("Invalid ID")
	}
	t := Ticket{id, StatusUnknown, j}
	_, err := t.Status()
	return t, err
}

func (j *RedisJobSystem) NewJob(request JobRequest, databases []ParamsDisplay, jobsbase string) (Ticket, error) {
	ids := make([]string, len(databases))
	for i, item := range databases {
		ids[i] = item.Path
	}

	paths := make([]string, len(request.Database))
	for i, item := range request.Database {
		idx := IsIn(item, ids)
		if idx == -1 {
			return Ticket{}, errors.New("Selected databases are not valid!")
		} else {
			paths[i] = databases[idx].Path
		}
	}

	s := StatusPending
	ticket := request.Hash()

	t := Ticket{Id(ticket), Status(s), j}

	res, err := t.Status()
	if err == nil && res == StatusComplete {
		return t, nil
	}

	err = j.Client.Watch(func(tx *redis.Tx) error {
		_, err := tx.ZAdd("mmseqs:pending", redis.Z{Score: request.Rank(), Member: ticket}).Result()
		if err != nil {
			return err
		}

		workdir := filepath.Join(jobsbase, ticket)

		err = os.Mkdir(workdir, 0755)
		if err != nil {
			s = StatusError
		}

		file, err := os.Create(filepath.Join(workdir, "job.json"))
		defer file.Close()
		if err != nil {
			s = StatusError
		} else {
			err = json.NewEncoder(file).Encode(Job{paths, request.Mode, request.Email})
			if err != nil {
				s = StatusError
			}

			err = ioutil.WriteFile(filepath.Join(workdir, "job.fasta"), []byte(request.Query), 0644)
			if err != nil {
				s = StatusError
			}
		}

		_, err = tx.Set("mmseqs:status:"+ticket, string(s), 0).Result()
		t.RawStatus = s
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return Ticket{}, err
	}

	return t, nil
}

func (j *RedisJobSystem) MultiStatus(ids []string) ([]Ticket, error) {
	if len(ids) == 0 {
		return make([]Ticket, 0), nil
	}

	var queries []string
	for _, value := range ids {
		if !ValidId(value) {
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
		result = append(result, Ticket{Id(ids[i]), Status(value), j})
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
	mutex  *sync.Mutex
	Queue  []Id
	Lookup map[Id]Status
}

func MakeLocalJobSystem() LocalJobSystem {
	jobsystem := LocalJobSystem{}
	jobsystem.mutex = &sync.Mutex{}
	jobsystem.Queue = make([]Id, 0)
	jobsystem.Lookup = make(map[Id]Status)
	return jobsystem
}

func (j *LocalJobSystem) SetStatus(id Id, status Status) error {
	j.Lookup[id] = status
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
	if !ValidId(string(id)) {
		return Ticket{}, errors.New("Invalid ID")
	}
	t := Ticket{id, StatusUnknown, j}
	_, err := t.Status()
	return t, err
}

func (j *LocalJobSystem) NewJob(request JobRequest, databases []ParamsDisplay, jobsbase string) (Ticket, error) {
	ids := make([]string, len(databases))
	for i, item := range databases {
		ids[i] = item.Path
	}

	paths := make([]string, len(request.Database))
	for i, item := range request.Database {
		idx := IsIn(item, ids)
		if idx == -1 {
			return Ticket{}, errors.New("Selected databases are not valid!")
		} else {
			paths[i] = databases[idx].Path
		}
	}

	s := StatusPending
	ticket := request.Hash()

	t := Ticket{Id(ticket), Status(s), j}

	res, err := t.Status()
	if err == nil && res == StatusComplete {
		return t, nil
	}

	workdir := filepath.Join(jobsbase, ticket)

	err = os.Mkdir(workdir, 0755)
	if err != nil {
		// TODO if already successful return complete
		s = StatusError
	}

	file, err := os.Create(filepath.Join(workdir, "job.json"))
	defer file.Close()
	if err != nil {
		s = StatusError
	} else {
		err = json.NewEncoder(file).Encode(Job{paths, request.Mode, request.Email})
		if err != nil {
			s = StatusError
		}

		err = ioutil.WriteFile(filepath.Join(workdir, "job.fasta"), []byte(request.Query), 0644)
		if err != nil {
			s = StatusError
		}
	}

	t.RawStatus = s

	j.mutex.Lock()
	j.Queue = append(j.Queue, Id(ticket))
	j.SetStatus(Id(ticket), s)
	j.mutex.Unlock()

	return t, nil
}

func (j *LocalJobSystem) MultiStatus(ids []string) ([]Ticket, error) {
	if len(ids) == 0 {
		return make([]Ticket, 0), nil
	}

	var result []Ticket
	for _, value := range ids {
		if !ValidId(value) {
			continue
		}
		res, ok := j.Lookup[Id(value)]
		if ok {
			result = append(result, Ticket{Id(value), Status(res), j})
		}
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

func (j *LocalJobSystem) Serialize(writer io.Writer) error {
	j.mutex.Lock()
	defer j.mutex.Unlock()
	encoder := gob.NewEncoder(writer)
	if err := encoder.Encode(j); err != nil {
		return err
	}

	return nil
}

func DeserializeLocalJobSystem(reader io.Reader) (LocalJobSystem, error) {
	jobsystem := LocalJobSystem{}
	decoder := gob.NewDecoder(reader)
	if err := decoder.Decode(jobsystem); err != nil {
		return jobsystem, err
	}
	jobsystem.mutex = &sync.Mutex{}

	return jobsystem, nil
}
