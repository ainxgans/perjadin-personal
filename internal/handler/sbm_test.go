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

func TestSBM_CreateUpsertAndList(t *testing.T) {
	if testDB == nil {
		t.Skip("skipping db test: no testDB")
	}
	cleanupTestData(t)

	adminID := createTestUser(t, "sbm-admin", "sbmadmin@example.com", "admin")
	cookie := authCookie(t, adminID, "admin")

	createHandler := CreateSBM(testDB)
	listHandler := ListSBM(testDB)

	// 1. Create SBM for "Kalimantan Selatan"
	rec := doRequest(t, createHandler, "POST", "/api/admin/sbm", `{"provinsi":"Kalimantan Selatan","ibukota":"Banjarmasin","uang_harian":380000}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// 2. Create again with different rate -> should UPSERT without error
	rec2 := doRequest(t, createHandler, "POST", "/api/admin/sbm", `{"provinsi":"kalimantan selatan","ibukota":"Banjarbaru","uang_harian":410000}`, cookie)
	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200 on upsert, got %d: %s", rec2.Code, rec2.Body.String())
	}

	// 3. List all rates -> should contain updated rate
	recList := doRequest(t, listHandler, "GET", "/api/sbm", "", cookie)
	if recList.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recList.Code, recList.Body.String())
	}
	resList := parseJSON(t, recList)
	list := resList["data"].([]interface{})
	found := false
	for _, item := range list {
		m := item.(map[string]interface{})
		if strings.EqualFold(m["provinsi"].(string), "Kalimantan Selatan") {
			found = true
			if int64(m["uang_harian"].(float64)) != 410000 {
				t.Errorf("expected updated uang_harian 410000, got %v", m["uang_harian"])
			}
		}
	}
	if !found {
		t.Errorf("expected to find Kalimantan Selatan in list")
	}
}
