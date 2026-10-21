package main

import "testing"

func TestListenAddr(t *testing.T) {
	t.Setenv("PANE_LISTEN", "")
	if got := listenAddr(); got != "127.0.0.1:7775" {
		t.Fatalf("default listenAddr = %q, want 127.0.0.1:7775", got)
	}
	t.Setenv("PANE_LISTEN", ":7775")
	if got := listenAddr(); got != ":7775" {
		t.Fatalf("PANE_LISTEN override = %q, want :7775", got)
	}
}
