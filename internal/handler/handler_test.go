package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/maulana/perjadin-personal/internal/auth"
	"github.com/maulana/perjadin-personal/internal/db"
)

var testDB *sql.DB

func TestMain(m *testing.M) {
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		// Skip all handler tests if no test DB
		os.Exit(0)
	}

	var err error
	testDB, err = db.Connect(dbURL)
	if err != nil {
		panic("test db connect: " + err.Error())
	}
	defer testDB.Close()

	if err := db.Migrate(testDB, "../../internal/db/migrations"); err != nil {
		// Try alternate path
		if err2 := db.Migrate(testDB, "../db/migrations"); err2 != nil {
			panic("test db migrate: " + err.Error())
		}
	}

	os.Exit(m.Run())
}

const testJWTSecret = "test-secret"

func createTestUser(t *testing.T, googleID, email, role string) string {
	t.Helper()
	var id string
	err := testDB.QueryRow(`
		INSERT INTO users (google_id, email, name, role) VALUES ($1, $2, $3, $4)
		ON CONFLICT (google_id) DO UPDATE SET role = EXCLUDED.role
		RETURNING id
	`, googleID, email, email, role).Scan(&id)
	if err != nil {
		t.Fatalf("create test user: %v", err)
	}
	_, _ = EnsurePersonalWorkspace(testDB, id, email)
	return id
}

func createTestTripWithWorkspace(t *testing.T, userID, nama, tujuan, mulai, selesai string) string {
	t.Helper()
	wsID, err := EnsurePersonalWorkspace(testDB, userID, "User")
	if err != nil {
		t.Fatalf("ensure ws: %v", err)
	}
	var id string
	err = testDB.QueryRow(`
		INSERT INTO trips (workspace_id, user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, wsID, userID, nama, tujuan, mulai, selesai).Scan(&id)
	if err != nil {
		t.Fatalf("create trip: %v", err)
	}
	return id
}

func authCookie(t *testing.T, userID, role string) *http.Cookie {
	t.Helper()
	token, err := auth.CreateToken(userID, role, testJWTSecret, time.Hour)
	if err != nil {
		t.Fatalf("create token: %v", err)
	}
	return &http.Cookie{Name: "token", Value: token}
}

func doRequest(t *testing.T, handler http.Handler, method, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	var reqBody *strings.Reader
	if body != "" {
		reqBody = strings.NewReader(body)
	} else {
		reqBody = strings.NewReader("")
	}
	req := httptest.NewRequest(method, path, reqBody)
	req.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		req.AddCookie(cookie)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func parseJSON(t *testing.T, rec *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var result map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("parse json: %v\nbody: %s", err, rec.Body.String())
	}
	return result
}

func cleanupTestData(t *testing.T) {
	t.Helper()
	testDB.Exec("DELETE FROM expenses")
	testDB.Exec("DELETE FROM trips")
	testDB.Exec("DELETE FROM workspace_members")
	testDB.Exec("DELETE FROM workspaces")
	testDB.Exec("DELETE FROM users")
	// Don't delete seed categories/payment_methods
}
