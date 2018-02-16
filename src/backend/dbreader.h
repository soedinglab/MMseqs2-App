#ifndef DBREADER_H
#define DBREADER_H

// reader.h written by Milot Mirdita milot@mirdita.de
// reader.h is a low latency version of the mmseqs db access library
// Original Implementation from MMseqs
// Written by Martin Steinegger & Maria Hauser

#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdbool.h>

static const int DB_READER_USE_DATA = 1;
static const int DB_READER_NO_CACHE = 2;

void* make_reader(const char *data_name, const char *index_name, int32_t data_mode);
void free_reader(void *reader);

int64_t reader_get_id(void *reader, uint32_t key);
const char* reader_get_data(void *reader, int64_t id);
uint32_t reader_get_key(void *reader, int64_t id);
int64_t reader_get_length(void *reader, int64_t id);
int64_t reader_get_offset(void *reader, int64_t id);
int64_t reader_get_size(void *r);

#endif
