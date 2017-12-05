package main

import (
	"github.com/intel-go/cpuid"
)

func main() {
	if cpuid.HasExtendedFeature(cpuid.AVX2) {
		println("avx2")
	} else if cpuid.HasFeature(cpuid.SSE4_1) {
		println("sse4.1")
	} else {
		println("fail")
	}
}
