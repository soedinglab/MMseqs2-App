package main

// Adapted from https://raw.githubusercontent.com/dogenzaka/tsv/master/parser.go
// MIT License

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"errors"
	"io"
	"reflect"
	"strconv"
	"strings"

	"github.com/go-playground/validator/v10"
)

// Parser has information for parser
type Parser struct {
	Headers []string
	Reader  *csv.Reader
	Data    interface{}
	ref     reflect.Value
	indices []int // indices is field index list of header array
}

// NewTsvParser creates new TSV parser with given io.Reader
func NewTsvParser(reader io.Reader, data interface{}) *Parser {
	r := csv.NewReader(reader)
	r.Comma = '\t'
	r.LazyQuotes = true

	p := &Parser{
		Reader: r,
		Data:   data,
		ref:    reflect.ValueOf(data).Elem(),
	}

	return p
}

func (p *Parser) Next() (eof bool, err error) {
	var records []string

	for {
		// read until valid record
		records, err = p.Reader.Read()
		if err != nil {
			if err.Error() == "EOF" {
				return true, nil
			}
			return false, err
		}
		if len(records) > 0 {
			break
		}
	}

	// set up indices only once
	if len(p.indices) == 0 {
		t := reflect.TypeOf(p.ref.Interface())
		if t.Kind() == reflect.Ptr {
			// dereference to get struct type
			t = t.Elem()
		}
		numFields := t.NumField()
		p.indices = make([]int, numFields)

		recordIndex := 0
		for i := 0; i < numFields; i++ {
			field := t.Field(i)
			jsonTag := field.Tag.Get("json")
			if jsonTag == "-" {
				// skip
				p.indices[i] = -1
				continue
			}
			if recordIndex < len(records) {
				p.indices[i] = recordIndex
				recordIndex++
			} else {
				// skip
				p.indices[i] = -1
			}
		}
	}

	for i, idx := range p.indices {
		if idx == -1 {
			continue
		}
		if idx >= len(records) {
			continue
		}
		field := p.ref.Field(i)
		record := records[idx]

		switch field.Kind() {
		case reflect.String:
			if record == "-" {
				field.SetString("")
			} else {
				field.SetString(record)
			}
		case reflect.Bool:
			if record == "" || record == "-" {
				field.SetBool(false)
			} else {
				col, err := strconv.ParseBool(record)
				if err != nil {
					return false, err
				}
				field.SetBool(col)
			}
		case reflect.Float64, reflect.Float32:
			if record == "" || record == "-" {
				field.SetFloat(0)
			} else {
				col, err := strconv.ParseFloat(record, 64)
				if err != nil {
					return false, err
				}
				field.SetFloat(col)
			}
		case reflect.Int64, reflect.Int32, reflect.Int16, reflect.Int8, reflect.Int:
			if record == "" || record == "-" {
				field.SetInt(0)
			} else {
				col, err := strconv.ParseInt(record, 10, 64)
				if err != nil {
					return false, err
				}
				field.SetInt(col)
			}
		case reflect.Uint64, reflect.Uint32, reflect.Uint16, reflect.Uint8, reflect.Uint:
			if record == "" || record == "-" {
				field.SetUint(0)
			} else {
				col, err := strconv.ParseUint(record, 10, 64)
				if err != nil {
					return false, err
				}
				field.SetUint(col)
			}
		default:
			return false, errors.New("unsupported field type")
		}
	}

	return false, nil
}

// Adapted from https://github.com/DisposaBoy/JsonConfigReader/blob/master/reader.go
// MIT license

type state struct {
	r  io.Reader
	br *bytes.Reader
}

func isNL(c byte) bool {
	return c == '\n' || c == '\r'
}

func isWS(c byte) bool {
	return c == ' ' || c == '\t' || isNL(c)
}

func consumeComment(s []byte, i int) int {
	if i < len(s) && s[i] == '/' {
		s[i-1] = ' '
		for ; i < len(s) && !isNL(s[i]); i += 1 {
			s[i] = ' '
		}
		return i
	}

	if i < len(s) && s[i] == '*' {
		s[i-1] = ' '
		s[i] = ' '
		level := 1
		i++

		for i < len(s) && level > 0 {
			if s[i] == '/' && i+1 < len(s) && s[i+1] == '*' {
				s[i] = ' '
				s[i+1] = ' '
				level++
				i += 2
			} else if s[i] == '*' && i+1 < len(s) && s[i+1] == '/' {
				s[i] = ' '
				s[i+1] = ' '
				level--
				i += 2
			} else {
				s[i] = ' '
				i++
			}
		}
		return i
	}
	return i
}

func prep(r io.Reader) (s []byte, err error) {
	buf := &bytes.Buffer{}
	_, err = io.Copy(buf, r)
	s = buf.Bytes()
	if err != nil {
		return
	}

	i := 0
	for i < len(s) {
		switch s[i] {
		case '"':
			i += 1
			for i < len(s) {
				if s[i] == '"' {
					i += 1
					break
				} else if s[i] == '\\' {
					i += 1
				}
				i += 1
			}
		case '/':
			i = consumeComment(s, i+1)
		case ',':
			j := i
			for {
				i += 1
				if i >= len(s) {
					break
				} else if s[i] == '}' || s[i] == ']' {
					s[j] = ' '
					break
				} else if s[i] == '/' {
					i = consumeComment(s, i+1)
				} else if !isWS(s[i]) {
					break
				}
			}
		default:
			i += 1
		}
	}
	return
}

// Read acts as a proxy for the underlying reader and cleans p
// of comments and trailing commas preceeding ] and }
// comments are delimitted by // up until the end the line
func (st *state) Read(p []byte) (n int, err error) {
	if st.br == nil {
		var s []byte
		if s, err = prep(st.r); err != nil {
			return
		}
		st.br = bytes.NewReader(s)
	}
	return st.br.Read(p)
}

// New returns an io.Reader acting as proxy to r
func NewJsonCReader(r io.Reader) io.Reader {
	return &state{r: r}
}

func DecodeJsonAndValidate(r io.Reader, target interface{}) error {
	dec := json.NewDecoder(NewJsonCReader(r))

	err := dec.Decode(target)
	if err != nil {
		return err
	}

	validate := validator.New()

	validate.RegisterValidation("mode", func(fl validator.FieldLevel) bool {
		parts := strings.SplitN(fl.Param(), ";", 2)
		if len(parts) != 2 {
			return false
		}

		baseList := strings.Split(parts[0], " ")
		optList := []string{}
		if parts[1] != "" {
			optList = strings.Split(parts[1], " ")
		}

		_, _, err := ParseMode(fl.Field().String(), baseList, optList)
		return err == nil
	})

	if err := validate.Struct(target); err != nil {
		return err
	}

	return nil
}

func DecodeJson(r io.Reader, target interface{}) error {
	dec := json.NewDecoder(NewJsonCReader(r))

	err := dec.Decode(target)
	if err != nil {
		return err
	}

	return nil
}
