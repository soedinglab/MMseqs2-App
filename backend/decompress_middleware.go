// From: https://raw.githubusercontent.com/labstack/echo/b437ee3879f21e973be85ff827754343a34fbe35/middleware/decompress.go
// LICENSE: MIT

package main

import (
	"compress/gzip"
	"io"
	"net/http"
	"sync"
)

type (
	// DecompressConfig defines the config for Decompress middleware.
	DecompressConfig struct {
		// GzipDecompressPool defines an interface to provide the sync.Pool used to create/store Gzip readers
		GzipDecompressPool Decompressor
	}
)

// GZIPEncoding content-encoding header if set to "gzip", decompress body contents.
const GZIPEncoding string = "gzip"

// Decompressor is used to get the sync.Pool used by the middleware to get Gzip readers
type Decompressor interface {
	gzipDecompressPool() sync.Pool
}

var (
	//DefaultDecompressConfig defines the config for decompress middleware
	DefaultDecompressConfig = DecompressConfig{
		GzipDecompressPool: &DefaultGzipDecompressPool{},
	}
)

// DefaultGzipDecompressPool is the default implementation of Decompressor interface
type DefaultGzipDecompressPool struct {
}

func (d *DefaultGzipDecompressPool) gzipDecompressPool() sync.Pool {
	return sync.Pool{New: func() interface{} { return new(gzip.Reader) }}
}

// Decompress decompresses request body based if content encoding type is set to "gzip" with default config
func Decompress(next http.Handler) http.Handler {
	return DecompressWithConfig(DefaultDecompressConfig, next)
}

// DecompressWithConfig decompresses request body based if content encoding type is set to "gzip" with config
func DecompressWithConfig(config DecompressConfig, next http.Handler) http.Handler {
	if config.GzipDecompressPool == nil {
		config.GzipDecompressPool = DefaultDecompressConfig.GzipDecompressPool
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pool := config.GzipDecompressPool.gzipDecompressPool()

		if r.Header.Get("Content-Encoding") != "gzip" {
			next.ServeHTTP(w, r)
			return
		}

		i := pool.Get()
		gr, ok := i.(*gzip.Reader)
		if !ok || gr == nil {
			http.Error(w, i.(error).Error(), http.StatusInternalServerError)
			return
		}
		defer pool.Put(gr)

		b := r.Body
		defer b.Close()

		if err := gr.Reset(b); err != nil {
			if err == io.EOF { //ignore if body is empty
				next.ServeHTTP(w, r)
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// only Close gzip reader if it was set to a proper gzip source otherwise it will panic on close.
		defer gr.Close()

		r.Body = gr

		next.ServeHTTP(w, r)
	})
}
