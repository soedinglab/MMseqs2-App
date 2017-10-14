// +build !cgo

package dbreader

import (
	"github.com/milot-mirdita/mmseqs-web-backend/tsv"

	"bufio"
	"io"
	"math"
	"os"
	"sort"
)

type Entry struct {
	Key    uint32
	Offset uint64
	Length uint64
}

type Reader struct {
	Index []Entry
	file  *os.File
}

func (d *Reader) Make(data string, index string) {
	file, err := os.Open(data)
	if err != nil {
		return
	}
	d.file = file

	f, err := os.Open(index)
	if err != nil {
		return
	}
	defer f.Close()

	entry := Entry{}
	parser := tsv.NewParser(bufio.NewReader(f), &entry)
	for {
		eof, err := parser.Next()
		if eof {
			break
		}
		if err != nil {
			return
		}
		d.Index = append(d.Index, entry)
	}
}

func (d *Reader) Delete() {
	d.file.Close()
}

func (d *Reader) Id(key uint32) int64 {
	return int64(sort.Search(d.Size(), func(i int) bool {
		return int(d.Index[i].Key) >= int(key)
	}))
}

func (d *Reader) Key(id int64) uint32 {
	if id < 0 || id >= int64(d.Size()) {
		return math.MaxUint32
	}
	return d.Index[id].Key
}

func (d *Reader) Offset(id int64) uint64 {
	if id < 0 || id >= int64(d.Size()) {
		return math.MaxUint64
	}
	return d.Index[id].Offset
}

func (d *Reader) Length(id int64) uint64 {
	if id < 0 || id >= int64(d.Size()) {
		return math.MaxUint64
	}
	return d.Index[id].Length
}

func (d *Reader) Data(id int64) string {
	if id < 0 || id >= int64(d.Size()) {
		return ""
	}
	d.file.Seek(int64(d.Index[id].Offset), io.SeekStart)
	length := d.Index[id].Length
	buffer := make([]byte, length)
	d.file.Read(buffer)
	return string(buffer[:length])
}

func (d *Reader) Size() int {
	return len(d.Index)
}
