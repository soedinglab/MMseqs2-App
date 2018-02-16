#include "dbreader.h"

#include <stdlib.h>
#include <string.h>

#include <sys/mman.h>
#include <sys/stat.h>

struct reader_index_s {
    uint32_t id;
    int64_t length;
    int64_t offset;
};
typedef struct reader_index_s reader_index;

struct DBReader_s {
    reader_index* index;
    int64_t size;

    char* data;
    int64_t data_size;

    int dataMode;

    bool cache;
};
typedef struct DBReader_s DBReader;

char *file_map(FILE *file, ssize_t *size);
ssize_t file_count_lines(const char *name);
int compare_by_id(const void *a, const void *b);
bool read_index(DBReader *reader, const char *name);
DBReader* load_cache(const char *name);
bool save_cache(DBReader *reader, const char *name);

void* make_reader(const char *data_name, const char *index_name, int32_t data_mode) {
    char *data = NULL;
    ssize_t data_size = 0;
    if (data_mode & DB_READER_USE_DATA) {
        FILE* file = fopen(data_name, "r");
        if (file == NULL) {
            return NULL;
        }
        data = file_map(file, &data_size);
        fclose(file);
    }

    char cache_name[FILENAME_MAX];
    if ((data_mode & DB_READER_NO_CACHE) == 0) {
        sprintf(cache_name, "%s.cache.%d", index_name, data_mode);

        struct stat st;
        if (stat(cache_name, &st) == 0) {
            DBReader* reader = load_cache(cache_name);
            reader->data = data;
            reader->data_size = data_size;
            reader->dataMode = data_mode;
            reader->cache = true;
            return (void*) reader;
        }
    }

    DBReader* reader = (DBReader*)malloc(sizeof(DBReader));
    reader->size = file_count_lines(index_name);
	reader->index = (reader_index*)malloc(sizeof(reader_index) * reader->size);
	reader->data = data;
	reader->data_size = data_size;
	reader->dataMode = data_mode;
	reader->cache = false;
	if (!read_index(reader, index_name)) {
        free_reader(reader);
        return NULL;
    }
    qsort(reader->index, (size_t) reader->size, sizeof(reader_index), compare_by_id);

    if ((data_mode & DB_READER_NO_CACHE) == 0) {
        save_cache(reader, cache_name);
    }

    return (void *)reader;
}

void free_reader(void *r) {
    DBReader *reader = (DBReader*)r;
    if (reader == NULL) {
        return;
    }

    if (reader->dataMode & DB_READER_USE_DATA) {
        munmap(reader->data, (size_t)(reader->data_size));
    }

    if (reader->cache) {
        munmap(reader->index, (size_t)(reader->size) * sizeof(reader_index));
    } else {
        free(reader->index);
    }

    free(reader);
}

int64_t reader_get_id(void *r, uint32_t key) {
    DBReader *reader = (DBReader*)r;
    if (reader == NULL) {
        return -1;
    }

    reader_index val;
    val.id = key;

    size_t id = (reader_index*)bsearch(&val, reader->index, (size_t) reader->size, sizeof(reader_index), compare_by_id) - reader->index;

    if (id < reader->size && reader->index[id].id == key) {
        return (int64_t) id;
    } else {
        return -1;
    }
}

const char* reader_get_data(void *r, int64_t id) {
    DBReader *reader = (DBReader*)r;
    if (reader == NULL || id < 0 || id >= reader->size) {
        return NULL;
    }

    if ((size_t) (reader->index[id].offset) >= reader->data_size) {
        return NULL;
    }

    return reader->data + reader->index[id].offset;
}

uint32_t reader_get_key(void *r, int64_t id) {
    DBReader *reader = (DBReader*)r;
    if (reader == NULL || id < 0 || id >= reader->size) {
        return -1;
    }
    return reader->index[id].id;
}

int64_t reader_get_length(void *r, int64_t id) {
    DBReader *reader = (DBReader*)r;
    if (reader == NULL || id < 0 || id >= reader->size) {
        return -1;
    }
    return reader->index[id].length;
}

int64_t reader_get_offset(void *r, int64_t id) {
    DBReader *reader = (DBReader*)r;
    if (reader == NULL || id < 0 || id >= reader->size) {
        return -1;
    }
    return reader->index[id].offset;
}

int64_t reader_get_size(void *r) {
    DBReader *reader = (DBReader*)r;
    if (reader == NULL) {
        return -1;
    }
    return reader->size;
}


char *file_map(FILE *file, ssize_t *size) {
    struct stat sb;
    fstat(fileno(file), &sb);
    *size = sb.st_size;

    int fd = fileno(file);
    return (char *)mmap(NULL, (size_t)(*size), PROT_READ, MAP_PRIVATE, fd, 0);
}

ssize_t file_count_lines(const char *name) {
    FILE *file = fopen(name, "rb");
    if (file == NULL) {
        return -1;
    }

    size_t cnt = 0;
    ssize_t size;
    char* data = file_map(file, &size);
    for (ssize_t i = 0; i < size; ++i) {
        if (data[i] == '\n') {
            cnt++;
        }
    }

    munmap(data, (size_t)size);
    fclose(file);

    return cnt;
}

int compare_by_id(const void *a, const void *b) {
    const reader_index* lhs = (reader_index*)a;
    const reader_index* rhs = (reader_index*)b;
    if (lhs->id > rhs->id) return 1;
    if (lhs->id < rhs->id) return -1;
    return 0;
}


size_t skipWhitespace(char * data) {
    size_t counter = 0;
    while ((data[counter] == ' ' || data[counter] == '\t') == true ) {
        counter++;
    }
    return counter;
}

size_t skipNoneWhitespace(char * data) {
    size_t counter = 0;
    while ((data[counter] == ' ' || data[counter] == '\t'
            || data[counter] == '\n' || data[counter] == '\0') == false ) {
        counter++;
    }
    return counter;
}

char* skipLine(char *data) {
     while (*data !='\n') {
        data++;
    }
    return (data+1);
}
size_t getWordsOfLine(char * data, char ** words, size_t maxElement ){
    size_t elementCounter = 0;
    while (*data != '\n' && *data != '\0'){
        data += skipWhitespace(data);
        words[elementCounter] = data;
        elementCounter++;
        if (elementCounter >= maxElement) {
            return elementCounter;
        }
        data += skipNoneWhitespace(data);
    }

    if(elementCounter < maxElement) {
        words[elementCounter] = data;
    }

    return elementCounter;
}

bool read_index(DBReader *reader, const char *name) {
    FILE *file = fopen(name, "rb");
    if (file == NULL) {
        return false;
    }

    bool status = true;
    char *save;
    size_t i = 0;
    ssize_t size;
    char* data = file_map(file, &size);

    char *entry[255];
    while (i < reader->size) {
        const size_t columns = getWordsOfLine(data, entry, 255);

        if (columns > 3) {
            status = false;
            goto cleanup;
        }

        reader->index[i].id = (uint32_t)strtoul(entry[0], NULL, 10);
        int64_t offset = strtoull(entry[1], NULL, 10);
        int64_t length = strtoull(entry[2], NULL, 10);

        reader->index[i].length = length;

        if (reader->dataMode & DB_READER_USE_DATA) {
            reader->index[i].offset = offset;
        } else {
            reader->index[i].offset = 0;
        }

        i++;
        data = skipLine(data);
    }

cleanup:
    munmap(data, (size_t)size);
    fclose(file);

    return status;
}

DBReader* load_cache(const char *name) {
    FILE *file = fopen(name, "rb");
    if (file != NULL) {
        DBReader *reader = (DBReader*) malloc(sizeof(DBReader));
        ssize_t size;
        reader->index = (reader_index *) file_map(file, &size);
        reader->size = size / sizeof(reader_index);
        fclose(file);
        return reader;
    } else {
        return NULL;
    }
}

bool save_cache(DBReader *reader, const char *name) {
    FILE *file = fopen(name, "w+b");
    if (file != NULL) {
        fwrite(reader->index, sizeof(reader_index), (size_t)reader->size, file);
        fclose(file);
        return true;
    } else {
        return false;
    }
}
//
//int main(int argc, const char** argv) {
//    void* handle = make_reader("/Users/mirdita/tmp/pref", "/Users/mirdita/tmp/pref.index", 1);
//    int64_t id = reader_get_id(handle, 500);
//    printf("%lld\n", id);
//    printf("%s\n", reader_get_data(handle, id));
//    printf("%lld\n", reader_get_length(handle, id));
//    printf("%lld\n", reader_get_offset(handle, id));
//    free_reader(handle);
//}
