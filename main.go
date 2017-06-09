package main

import (
	"io"
	"log"
	"errors"
	"net/http"

	"path"
	"path/filepath"

	"encoding/json"
	"github.com/go-redis/redis"
	"github.com/asaskevich/govalidator"
	"github.com/satori/go.uuid"

	"./dbreader"
	"./handler"
	"strings"
	"bufio"
	"os"
	"sort"
)

func decodeAndValidateJson(r io.Reader, target interface{}) error {
	dec := json.NewDecoder(r)

	if err := dec.Decode(target); err == io.EOF {
		return errors.New("JSON Empty")
	} else if err != nil {
		return errors.New("Could not decode JSON")
	}

	if result, err := govalidator.ValidateStruct(target); err != nil || result != true {
		return errors.New("Could not validate JSON")
	}

	return nil
}

type status string
type TicketResponse struct {
	Ticket uuid.UUID `json:"ticket"`
	Status status  `json:"status"`
}

type ParamsDisplay struct {
	Name string `json:"name"`
	Version string `json:"version"`
	Default bool `json:"default"`
	Order int `json:"order"`
}

type ByOrder []ParamsDisplay

func (d ByOrder) Len() int {
return len(d)
}
func (d ByOrder) Swap(i, j int) {
	d[i], d[j] = d[j], d[i]
}
func (d ByOrder) Less(i, j int) bool {
	return d[i].Order < d[j].Order
}

type ParamsMMseqs struct {
	Search string `json:"search"`
	Result2msa string `json:"result2msa"`
	Convertalis string `json:"convertalis"`
	Summarizeresult string `json:"summarizeresult"`
}

type Params struct {
	Display ParamsDisplay `json:"display"`
	Params ParamsMMseqs `json:"params"`
}

func main() {
	client := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	const dbpath = "asd"

	http.Handle("/databases/", handler.Handler{
		func (w http.ResponseWriter, req *http.Request) error {
			switch req.Method {
			case "GET":
				matches, err := filepath.Glob(filepath.Clean(dbpath) + "/*.params")
				if err != nil {
					return handler.StatusError{500, err}
				}

				var res []ParamsDisplay
				for _, value := range matches {
					base := filepath.Base(value)
					name := strings.TrimSuffix(base, filepath.Ext(base))
					f, err := os.Open(name)
					if err != nil {
						return handler.StatusError{500, err}
					}

					var params Params
					err = decodeAndValidateJson(bufio.NewReader(f), &params)
					if err != nil {
						return handler.StatusError{500, err}
					}
					res = append(res, params.Display)
				}

				sort.Sort(ByOrder(res))

				type DatabaseResponse struct {
					Databases ByOrder `json:"databases"`
				}

				err = json.NewEncoder(w).Encode(DatabaseResponse{res})
				if err != nil {
					return handler.StatusError{500, err}
				}

				return nil
			default:
				return handler.StatusError{500, errors.New("Invalid Method")}
			}
		}})

	http.Handle("/ticket/", handler.Handler{
	func(w http.ResponseWriter, req *http.Request) error {
		switch req.Method {
		case "POST":
			type TicketRequest struct {
				Query    string `json:"q",valid:"alphanum,required"`
				Database []string `json:"required"`
				Mode     string `json:"mode",valid:"in(accept,summary),required"`
				Email    string `json:"email",valid:"email,optional"`
			}

			var request TicketRequest
			if err := decodeAndValidateJson(req.Body, &request); err != nil {
				return handler.StatusError{401, err}
			}

			ticket := uuid.NewV4()

			_, err := client.ZAdd("mmseqs:pending", redis.Z{1, ticket.String() }).Result()
			if err != nil {
				return handler.StatusError{500, err}
			}

			_, err = client.Set("mmseqs:status:"+ticket.String(), "PENDING", 0).Result()
			if err != nil {
				return handler.StatusError{500, err}
			}

			err = json.NewEncoder(w).Encode(TicketResponse{ticket, "PENDING" })
			if err != nil {
				return handler.StatusError{500, err}
			}

			return nil
		case "GET":
			ticket, err := uuid.FromString(path.Base(req.URL.Path))
			if err != nil {
				return handler.StatusError{500, err}
			}

			res, err := client.Get("mmseqs:status:"+ticket.String()).Result()
			if err != nil {
				return handler.StatusError{500, err}
			}

			err = json.NewEncoder(w).Encode(TicketResponse{ticket, status(res) })
			if err != nil {
				return handler.StatusError{500, err}
			}
			return nil
		default:
			return handler.StatusError{500, errors.New("Invalid Method")}
		}
	}})

	http.Handle("/tickets/", handler.Handler{
		func(w http.ResponseWriter, req *http.Request) error {
			switch req.Method {
			case "POST":
				err := req.ParseForm()
				if err != nil {
					return handler.StatusError{500, err}
				}

				tickets := req.Form["tickets"]
				var res []string
				for _, value := range tickets {
					parsedUuid, err := uuid.FromString(value)
					if err != nil {
						return handler.StatusError{500, err}
					}
					res = append(res, parsedUuid.String());
				}
				r, err := client.MGet([]string(res)...).Result()
				if err != nil {
					return handler.StatusError{500, err}
				}

				var result []TicketResponse
				for i, item := range r {
					value, ok := item.(status)
					if !ok {
						return handler.StatusError{500, errors.New("Invalid Method")}
					}

					ticket, err := uuid.FromString(res[i])
					if err != nil {
						return handler.StatusError{500, err}
					}
					result = append(result, TicketResponse{ticket, value })
				}

				type TicketsResponse struct {
					Tickets []TicketResponse `json:"tickets"`
				}

				err = json.NewEncoder(w).Encode(TicketsResponse{result })
				if err != nil {
					return handler.StatusError{500, err}
				}
				return nil

			default:
				return handler.StatusError{500, errors.New("Invalid Method")}
			}
		}})

	asd := dbreader.Reader{}
	asd.Make("/Users/mirdita/tmp/pref", "/Users/mirdita/tmp/pref.index")
	defer asd.Delete()
	id := asd.Id(1)
	log.Print(id);
	log.Print(asd.Offset(id));
	log.Print(asd.Length(id));
	log.Print(asd.Key(id));
	log.Print(asd.Data(id));

	//http.Handle("/tickets/", handler.Handler{
	//	func(w http.ResponseWriter, req *http.Request) error {
	//		switch req.Method {
	//		case "POST":
	//			return nil
	//		default:
	//			return handler.StatusError{500, errors.New("Invalid Method")}
	//		}
	//	}})

	//log.Fatal(http.ListenAndServe(":3000", nil))
}