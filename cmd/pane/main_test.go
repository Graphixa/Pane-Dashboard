package main

import "testing"

func TestListenAddr(t *testing.T) {
	t.Setenv("PANE_LISTEN", "")
	if got := listenAddr(); got != "127.0.0.1:8080" {
		t.Fatalf("default listenAddr = %q, want 127.0.0.1:8080", got)
	}
	t.Setenv("PANE_LISTEN", ":8080")
	if got := listenAddr(); got != ":8080" {
		t.Fatalf("PANE_LISTEN override = %q, want :8080", got)
	}
}
