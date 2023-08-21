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

func ratelimitWithAllowlistHandler(allowlistedCIDRs []*net.IPNet, lmt *limiter.Limiter, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		remoteIP := libstring.RemoteIP(lmt.GetIPLookups(), lmt.GetForwardedForIndexFromBehind(), r)
		remoteIP = libstring.CanonicalizeIP(remoteIP)
		ip := net.ParseIP(remoteIP)

		isAllowlisted := false
		for _, cidr := range allowlistedCIDRs {
			if cidr.Contains(ip) {
				isAllowlisted = true
				break
			}
		}

		if isAllowlisted {
			// log.Printf("Allowlisted %s\n", remoteIP)
			next.ServeHTTP(w, r)
		} else {
			// log.Printf("Ratelimiting %s\n", remoteIP)
			tollbooth.LimitFuncHandler(lmt, next).ServeHTTP(w, r)
		}
	}
}
