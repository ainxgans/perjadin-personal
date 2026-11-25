package handler

import (
	"net/http"
	"strings"
	"testing"

	"github.com/maulana/perjadin-personal/internal/auth"
)

func setupTripRoutes() http.Handler {
	mux := http.NewServeMux()
	authMW := auth.AuthMiddleware(testJWTSecret)

	mux.Handle("GET /api/trips", authMW(http.HandlerFunc(ListTrips(testDB))))
	mux.Handle("POST /api/trips", authMW(http.HandlerFunc(CreateTrip(testDB))))
	mux.Handle("GET /api/trips/{id}", authMW(http.HandlerFunc(GetTrip(testDB))))
	mux.Handle("PUT /api/trips/{id}", authMW(http.HandlerFunc(UpdateTrip(testDB))))
	mux.Handle("DELETE /api/trips/{id}", authMW(http.HandlerFunc(DeleteTrip(testDB))))
	return mux
}

func TestCreateTrip(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	rec := doRequest(t, handler, "POST", "/api/trips", `{
		"nama": "Dinas Jakarta",
		"tujuan": "Jakarta",
		"tanggal_mulai": "2026-11-20",
		"tanggal_selesai": "2026-11-25"
	}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	body := parseJSON(t, rec)
	data := body["data"].(map[string]interface{})
	if data["nama"] != "Dinas Jakarta" {
		t.Errorf("expected nama=Dinas Jakarta, got %v", data["nama"])
	}
	if data["status"] == nil || data["status"] == "" {
		t.Error("expected status field")
	}
}

func TestCreateTrip_InvalidDates(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	rec := doRequest(t, handler, "POST", "/api/trips", `{
		"nama": "Bad",
		"tujuan": "X",
		"tanggal_mulai": "2026-11-25",
		"tanggal_selesai": "2026-11-20"
	}`, cookie)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestListTrips(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	user2ID := createTestUser(t, "google-user2", "user2@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	// Create trips for both users
	testDB.Exec(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Mine', 'A', '2026-01-01', '2026-01-05')`, userID)
	testDB.Exec(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'NotMine', 'B', '2026-01-01', '2026-01-05')`, user2ID)

	rec := doRequest(t, handler, "GET", "/api/trips", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	body := parseJSON(t, rec)
	data := body["data"].([]interface{})
	if len(data) != 1 {
		t.Errorf("expected 1 trip, got %d", len(data))
	}
	trip := data[0].(map[string]interface{})
	if trip["nama"] != "Mine" {
		t.Errorf("expected Mine, got %v", trip["nama"])
	}
}

func TestGetTrip_OtherUser(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	user2ID := createTestUser(t, "google-user2", "user2@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Secret', 'B', '2026-01-01', '2026-01-05') RETURNING id`, user2ID).Scan(&tripID)

	rec := doRequest(t, handler, "GET", "/api/trips/"+tripID, "", cookie)
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}

func TestUpdateTrip(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Old', 'A', '2026-01-01', '2026-01-05') RETURNING id`, userID).Scan(&tripID)

	rec := doRequest(t, handler, "PUT", "/api/trips/"+tripID, `{
		"nama": "Updated",
		"uang_dinas": 5000000,
		"tanggal_dibayar": "2026-02-01"
	}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := parseJSON(t, rec)
	data := body["data"].(map[string]interface{})
	if data["nama"] != "Updated" {
		t.Errorf("expected Updated, got %v", data["nama"])
	}
}

func TestDeleteTrip(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Delete', 'A', '2026-01-01', '2026-01-05') RETURNING id`, userID).Scan(&tripID)

	rec := doRequest(t, handler, "DELETE", "/api/trips/"+tripID, "", cookie)
	if rec.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d", rec.Code)
	}
}

func TestTripSQLConstants(t *testing.T) {
	if strings.Contains(tripInsertCols, "t.") {
		t.Errorf("tripInsertCols cannot contain 't.' table alias because it is used in INSERT RETURNING clauses")
	}
}

func TestTrip_EstimasiTransport(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupTripRoutes()

	// 1. Create trip with estimasi_transport
	rec := doRequest(t, handler, "POST", "/api/trips", `{
		"nama": "Dinas Bandung",
		"tujuan": "Bandung",
		"tanggal_mulai": "2026-11-20",
		"tanggal_selesai": "2026-11-22",
		"nominal_monita": 1830000,
		"estimasi_transport": 540000
	}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	body := parseJSON(t, rec)
	data := body["data"].(map[string]interface{})
	tripID := data["id"].(string)

	if data["estimasi_transport"] == nil {
		t.Fatalf("expected estimasi_transport in create response, got nil")
	}
	if val := int64(data["estimasi_transport"].(float64)); val != 540000 {
		t.Errorf("expected estimasi_transport 540000, got %d", val)
	}

	// 2. GetTrip must return estimasi_transport
	recGet := doRequest(t, handler, "GET", "/api/trips/"+tripID, "", cookie)
	if recGet.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recGet.Code, recGet.Body.String())
	}
	bodyGet := parseJSON(t, recGet)
	dataGet := bodyGet["data"].(map[string]interface{})
	if dataGet["estimasi_transport"] == nil {
		t.Fatalf("expected estimasi_transport in get response, got nil")
	}
	if val := int64(dataGet["estimasi_transport"].(float64)); val != 540000 {
		t.Errorf("expected estimasi_transport 540000, got %d", val)
	}

	// 3. Update estimasi_transport
	recPut := doRequest(t, handler, "PUT", "/api/trips/"+tripID, `{
		"estimasi_transport": 750000
	}`, cookie)
	if recPut.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recPut.Code, recPut.Body.String())
	}
	bodyPut := parseJSON(t, recPut)
	dataPut := bodyPut["data"].(map[string]interface{})
	if dataPut["estimasi_transport"] == nil {
		t.Fatalf("expected estimasi_transport in put response, got nil")
	}
	if val := int64(dataPut["estimasi_transport"].(float64)); val != 750000 {
		t.Errorf("expected estimasi_transport 750000, got %d", val)
	}
}
