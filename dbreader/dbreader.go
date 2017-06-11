package dbreader

//#include <dbreader.h>
import "C"
import "unsafe"

type Reader struct {
	handle unsafe.Pointer
}

func (d *Reader) Make(data string, index string) {
	d.handle = C.make_reader(C.CString(data), C.CString(index), 1)
}

func (d *Reader) Delete() {
	C.free_reader(d.handle)
}

func (d *Reader) Id(key uint32) int64 {
	return (int64)(C.reader_get_id(d.handle, (C.uint32_t)(key)))
}

func (d *Reader) Key(id int64) uint32 {
	return (uint32)(C.reader_get_key(d.handle, (C.int64_t)(id)))
}

func (d *Reader) Offset(id int64) int64 {
	return (int64)(C.reader_get_offset(d.handle, (C.int64_t)(id)))
}

func (d *Reader) Length(id int64) int64 {
	return (int64)(C.reader_get_length(d.handle, (C.int64_t)(id)))
}

func (d *Reader) Data(id int64) string {
	return C.GoString(C.reader_get_data(d.handle, (C.int64_t)(id)))
}
