package db

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMigrationFilesSyntax(t *testing.T) {
	files, err := filepath.Glob("migrations/*.sql")
	if err != nil {
		t.Fatalf("glob migrations: %v", err)
	}
	if len(files) == 0 {
		// try alternate relative path
		files, err = filepath.Glob("../../internal/db/migrations/*.sql")
		if err != nil || len(files) == 0 {
			t.Fatalf("no migration files found")
		}
	}

	found004 := false
	for _, f := range files {
		content, err := os.ReadFile(f)
		if err != nil {
			t.Errorf("read %s: %v", f, err)
			continue
		}
		s := string(content)
		if strings.TrimSpace(s) == "" {
			t.Errorf("migration %s is empty", f)
		}
		if filepath.Base(f) == "004_collab_and_sbm.sql" {
			found004 = true
			if !strings.Contains(s, "sbm_rates") {
				t.Errorf("004 missing sbm_rates table")
			}
			if !strings.Contains(s, "trip_members") {
				t.Errorf("004 missing trip_members table")
			}
			if !strings.Contains(s, "user_id UUID REFERENCES users") {
				t.Errorf("004 missing expenses.user_id reference")
			}
			if !strings.Contains(s, "DKI Jakarta") {
				t.Errorf("004 missing initial DKI Jakarta SBM rate")
			}
		}
	}

	if !found004 {
		t.Errorf("004_collab_and_sbm.sql not found in migrations")
	}
}
