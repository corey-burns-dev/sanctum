package database

import (
	"strings"
	"testing"
)

func TestValidateAppliedVersions_AllKnown(t *testing.T) {
	registered := []Migration{
		{Version: 1, Name: "baseline"},
		{Version: 2, Name: "posts_poll_fields"},
	}
	applied := []int{1, 2}

	if err := validateAppliedVersions(applied, registered); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestValidateAppliedVersions_UnknownVersion(t *testing.T) {
	registered := []Migration{
		{Version: 1, Name: "baseline"},
		{Version: 2, Name: "posts_poll_fields"},
	}
	applied := []int{1, 3, 2, 99}

	err := validateAppliedVersions(applied, registered)
	if err == nil {
		t.Fatal("expected unknown migration error")
	}
	msg := err.Error()
	if !strings.Contains(msg, "000003") || !strings.Contains(msg, "000099") {
		t.Fatalf("expected unknown versions in error, got %q", msg)
	}
}
