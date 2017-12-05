package main

import (
	"fmt"

	"github.com/intel-go/cpuid"
)

func main() {
	if cpuid.HasFeature(cpuid.AVX2) {
		fmt.Printf("avx2")
	} else if cpuid.HasFeature(cpuid.SSE4_1) {
		fmt.Printf("sse4.1")
	} else {
		fmt.Printf("fail")
	}
}
