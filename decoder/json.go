package decoder

import (
	"io"
	"encoding/json"
	"errors"
	"github.com/asaskevich/govalidator"
)

func DecodeAndValidate(r io.Reader, target interface{}) error {
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