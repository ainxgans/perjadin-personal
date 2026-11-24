package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSBMHandler_Validation(t *testing.T) {
	// Test request with invalid input to verify bad request responses
	h := CreateSBM(nil)
	req := httptest.NewRequest("POST", "/api/admin/sbm", strings.NewReader(`{"provinsi":"","uang_harian":0}`))
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for empty provinsi/uang_harian, got %d", rec.Code)
	}
}

func TestUserSearchHandler_Empty(t *testing.T) {
	// If testDB is set, run DB query tests
	if testDB == nil {
		t.Skip("skipping db test: no testDB")
	}

	u1 := createTestUser(t, "sbm-u1", "u1@example.com", "user")
	u2 := createTestUser(t, "sbm-u2", "rekan@example.com", "user")

	cookie := authCookie(t, u1, "user")
	rec := doRequest(t, SearchUsers(testDB), "GET", "/api/users?q=rekan", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	res := parseJSON(t, rec)
	data, ok := res["data"].([]interface{})
	if !ok || len(data) == 0 {
		t.Errorf("expected at least 1 user matching 'rekan', got: %v", res)
	}
	_ = u2
}
