package main

import (
	"context"
	"net/http"
	"strconv"
	"strings"
)

type OtelTraceContext struct {
	Source      string `json:"source,omitempty"`
	Traceparent string `json:"traceparent,omitempty"`
	Tracestate  string `json:"tracestate,omitempty"`
	RequestID   string `json:"x_request_id,omitempty"`
}

func (t OtelTraceContext) Empty() bool {
	return t.Source == "" && t.Traceparent == "" && t.Tracestate == "" && t.RequestID == ""
}

func (t OtelTraceContext) String() string {
	var builder strings.Builder
	traceID, spanID := parseTraceparent(t.Traceparent)

	if t.Source != "" {
		builder.WriteString(" source=")
		builder.WriteString(strconv.Quote(t.Source))
	}
	if t.Traceparent != "" {
		builder.WriteString(" traceparent=")
		builder.WriteString(strconv.Quote(t.Traceparent))
	}
	if t.Tracestate != "" {
		builder.WriteString(" tracestate=")
		builder.WriteString(strconv.Quote(t.Tracestate))
	}
	if t.RequestID != "" {
		builder.WriteString(" x_request_id=")
		builder.WriteString(strconv.Quote(t.RequestID))
	}
	if traceID != "" {
		builder.WriteString(" trace_id=")
		builder.WriteString(strconv.Quote(traceID))
	}
	if spanID != "" {
		builder.WriteString(" span_id=")
		builder.WriteString(strconv.Quote(spanID))
	}

	return builder.String()
}

func (t OtelTraceContext) Ptr() *OtelTraceContext {
	if t.Empty() {
		return nil
	}
	trace := t
	return &trace
}

type otelTraceContextKey struct{}

func ContextWithOtelTrace(ctx context.Context, trace OtelTraceContext) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if trace.Empty() {
		return ctx
	}
	return context.WithValue(ctx, otelTraceContextKey{}, trace)
}

func OtelTraceFromContext(ctx context.Context) OtelTraceContext {
	if ctx == nil {
		return OtelTraceContext{}
	}
	if trace, ok := ctx.Value(otelTraceContextKey{}).(OtelTraceContext); ok {
		return trace
	}
	return OtelTraceContext{}
}

func TraceStr(ctx context.Context) string {
	return OtelTraceFromContext(ctx).String()
}

func CollectRequestTrace(req *http.Request) OtelTraceContext {
	source := req.Method
	if req.URL != nil && req.URL.Path != "" {
		source += " " + req.URL.Path
	}

	return OtelTraceContext{
		Source:      source,
		Traceparent: strings.TrimSpace(req.Header.Get("traceparent")),
		Tracestate:  strings.TrimSpace(req.Header.Get("tracestate")),
		RequestID:   strings.TrimSpace(req.Header.Get("X-Request-Id")),
	}
}

func parseTraceparent(traceparent string) (string, string) {
	parts := strings.Split(strings.TrimSpace(traceparent), "-")
	if len(parts) != 4 {
		return "", ""
	}

	traceID := strings.TrimSpace(parts[1])
	spanID := strings.TrimSpace(parts[2])
	if len(traceID) != 32 || len(spanID) != 16 {
		return "", ""
	}

	return traceID, spanID
}
