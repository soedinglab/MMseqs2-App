package main

import (
    "os"
	"github.com/intel-go/cpuid"
)

func main() {
	if cpuid.HasExtendedFeature(cpuid.AVX2) {
        os.Stdout.WriteString("avx2")
	} else if cpuid.HasFeature(cpuid.SSE4_1) {
		os.Stdout.WriteString("sse4.1")
	} else {
		os.Stdout.WriteString("fail")
	}
}
