package decoder

import (
	"encoding/json"
	"github.com/asaskevich/govalidator"
	"io"
)

func DecodeAndValidate(r io.Reader, target interface{}) error {
	dec := json.NewDecoder(r)

	err := dec.Decode(target)
	if err != nil {
		return err
	}

	if result, err := govalidator.ValidateStruct(target); err != nil || result != true {
		return err
	}

	return nil
}
