package main

import (
	"net"
	"net/http"

	"github.com/didip/tollbooth/v6"
	"github.com/didip/tollbooth/v6/libstring"
	"github.com/didip/tollbooth/v6/limiter"
)

func parseCIDRs(cidrs []string) []*net.IPNet {
	allowlistedCIDRs := make([]*net.IPNet, len(cidrs))
	for i, cidr := range cidrs {
		_, network, err := net.ParseCIDR(cidr)
		if err != nil {
			panic(err)
		}
		// log.Printf("Allowlisting %s\n", network)
		allowlistedCIDRs[i] = network
	}
	return allowlistedCIDRs
}

// rateLimitAllows reports whether the request may proceed
func rateLimitAllows(w http.ResponseWriter, r *http.Request, allowlistedCIDRs []*net.IPNet, lmt *limiter.Limiter) bool {
	if lmt == nil {
		return true
	}

	remoteIP := libstring.RemoteIP(lmt.GetIPLookups(), lmt.GetForwardedForIndexFromBehind(), r)
	remoteIP = libstring.CanonicalizeIP(remoteIP)
	ip := net.ParseIP(remoteIP)

	for _, cidr := range allowlistedCIDRs {
		if cidr.Contains(ip) {
			// log.Printf("Allowlisted %s\n", remoteIP)
			return true
		}
	}

	if httpError := tollbooth.LimitByRequest(lmt, w, r); httpError != nil {
		// log.Printf("Ratelimiting %s\n", remoteIP)
		lmt.ExecOnLimitReached(w, r)
		w.Header().Add("Content-Type", lmt.GetMessageContentType())
		w.WriteHeader(httpError.StatusCode)
		w.Write([]byte(lmt.GetMessage()))
		return false
	}

	return true
}
