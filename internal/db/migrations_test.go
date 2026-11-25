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
	found005 := false
	found006 := false
	found007 := false
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
		if filepath.Base(f) == "005_sbm_multi_city.sql" {
			found005 = true
			if !strings.Contains(s, "kota TEXT[]") {
				t.Errorf("005 missing kota TEXT[] column")
			}
			if !strings.Contains(s, "Bogor") {
				t.Errorf("005 missing Bogor seed for Jawa Barat")
			}
		}
		if filepath.Base(f) == "006_users_pre_register.sql" {
			found006 = true
			if !strings.Contains(s, "ALTER COLUMN google_id DROP NOT NULL") {
				t.Errorf("006 missing ALTER COLUMN google_id DROP NOT NULL")
			}
		}
		if filepath.Base(f) == "007_add_estimasi_transport.sql" {
			found007 = true
			if !strings.Contains(s, "estimasi_transport BIGINT") {
				t.Errorf("007 missing estimasi_transport BIGINT")
			}
		}
	}

	if !found004 {
		t.Errorf("004_collab_and_sbm.sql not found in migrations")
	}
	if !found005 {
		t.Errorf("005_sbm_multi_city.sql not found in migrations")
	}
	if !found006 {
		t.Errorf("006_users_pre_register.sql not found in migrations")
	}
	if !found007 {
		t.Errorf("007_add_estimasi_transport.sql not found in migrations")
	}
}

func TestInsertReturningSyntax(t *testing.T) {
	// Ensure no INSERT INTO queries mistakenly use table alias in RETURNING clause
	files, err := filepath.Glob("../handler/*.go")
	if err != nil || len(files) == 0 {
		files, _ = filepath.Glob("../../internal/handler/*.go")
	}
	for _, f := range files {
		content, err := os.ReadFile(f)
		if err != nil {
			continue
		}
		s := string(content)
		if strings.Contains(s, "INSERT INTO trips") && strings.Contains(s, "RETURNING `+tripSelectCols+`") {
			t.Errorf("file %s has invalid INSERT INTO trips RETURNING `+tripSelectCols+` (uses 't.' alias)", f)
		}
	}
}
