package main

import (
	"bufio"
	"math"
	"os"
	"sort"
)

type Entry[V ~uint32 | string] struct {
	Key    V
	Offset uint64
	Length uint64
}

type EntryByKey[V ~uint32 | string] []Entry[V]

func (d EntryByKey[V]) Len() int {
	return len(d)
}
func (d EntryByKey[V]) Swap(i, j int) {
	d[i], d[j] = d[j], d[i]
}
func (d EntryByKey[V]) Less(i, j int) bool {
	return d[i].Key < d[j].Key
}

type Reader[V ~uint32 | string] struct {
	Index []Entry[V]
	file  *os.File
}

func (d *Reader[V]) Make(data string, index string) error {
	file, err := os.Open(data)
	if err != nil {
		return err
	}
	d.file = file

	f, err := os.Open(index)
	if err != nil {
		return err
	}
	defer f.Close()

	d.Index = make([]Entry[V], 0)
	entry := Entry[V]{}
	parser := NewTsvParser(bufio.NewReader(f), &entry)
	var prevKey V
	sorted := true
	for {
		eof, err := parser.Next()
		if eof {
			break
		}
		if err != nil {
			return err
		}
		sorted = sorted && (prevKey < entry.Key)
		d.Index = append(d.Index, entry)
	}

	if sorted == false {
		sort.Sort(EntryByKey[V](d.Index))
	}

	return nil
}

func (d *Reader[V]) Delete() {
	d.file.Close()
}

func (d *Reader[V]) Id(key V) (int64, bool) {
	i := int64(sort.Search(int(d.Size()), func(i int) bool {
		return d.Index[i].Key >= key
	}))
	return i, i < d.Size() && d.Index[i].Key == key
}

func (d *Reader[V]) Key(id int64) (V, bool) {
	if id < 0 || id >= d.Size() {
		var zero V
		return zero, false
	}
	return d.Index[id].Key, true
}

func (d *Reader[V]) Offset(id int64) uint64 {
	if id < 0 || id >= d.Size() {
		return math.MaxUint64
	}
	return d.Index[id].Offset
}

func (d *Reader[V]) Length(id int64) uint64 {
	if id < 0 || id >= d.Size() {
		return math.MaxUint64
	}
	return d.Index[id].Length
}

func (d *Reader[V]) Data(id int64) string {
	if id < 0 || id >= d.Size() {
		return ""
	}
	length := d.Index[id].Length - 1
	buffer := make([]byte, length)
	d.file.ReadAt(buffer, int64(d.Index[id].Offset))
	return string(buffer[:length])
}

func (d *Reader[V]) Size() int64 {
	return int64(len(d.Index))
}
