package handler

import (
	"net/http"
	"testing"

	"github.com/maulana/perjadin-personal/internal/auth"
)

func setupAnalyticsRoutes() http.Handler {
	mux := http.NewServeMux()
	authMW := auth.AuthMiddleware(testJWTSecret)

	mux.Handle("GET /api/analytics", authMW(http.HandlerFunc(GetAnalytics(testDB))))
	return mux
}

func TestGetAnalytics_EmptyData(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "user-ana-empty", "anaempty@test.com", "user")
	cookie := authCookie(t, userID, "user")
	h := setupAnalyticsRoutes()

	rec := doRequest(t, h, "GET", "/api/analytics", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	body := parseJSON(t, rec)
	data := body["data"].(map[string]interface{})
	if data["total_expenses_rp"].(float64) != 0 {
		t.Errorf("expected 0 total expenses, got %v", data["total_expenses_rp"])
	}
}

func TestGetAnalytics_Success(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "user-ana", "ana@test.com", "user")
	cookie := authCookie(t, userID, "user")
	h := setupAnalyticsRoutes()

	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai, uang_dinas)
		VALUES ($1, 'Trip Ana', 'Bandung', '2026-02-01', '2026-02-05', 1000000) RETURNING id`, userID).Scan(&tripID)

	var catID, pmID string
	testDB.QueryRow("SELECT id FROM categories WHERE nama = 'Makan'").Scan(&catID)
	testDB.QueryRow("SELECT id FROM payment_methods WHERE nama = 'Pribadi'").Scan(&pmID)
	testDB.Exec(`INSERT INTO expenses (trip_id, category_id, payment_method_id, deskripsi, jumlah, tanggal)
		VALUES ($1, $2, $3, 'makan', 50000, '2026-02-02')`, tripID, catID, pmID)

	rec := doRequest(t, h, "GET", "/api/analytics", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := parseJSON(t, rec)
	data := body["data"].(map[string]interface{})
	if data["total_expenses_rp"].(float64) != 50000 {
		t.Errorf("expected 50000, got %v", data["total_expenses_rp"])
	}
}

func TestGetAnalytics_YearFilter(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "user-ana-yr", "anayr@test.com", "user")
	cookie := authCookie(t, userID, "user")
	h := setupAnalyticsRoutes()

	var catID, pmID string
	testDB.QueryRow("SELECT id FROM categories WHERE nama = 'Makan'").Scan(&catID)
	testDB.QueryRow("SELECT id FROM payment_methods WHERE nama = 'Pribadi'").Scan(&pmID)

	// Trip 1 in 2025: 500k expense
	var trip2025ID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai, uang_dinas, status)
		VALUES ($1, 'Trip 2025', 'Bogor', '2025-10-01', '2025-10-03', 1000000, 'lunas') RETURNING id`, userID).Scan(&trip2025ID)
	testDB.Exec(`INSERT INTO expenses (trip_id, user_id, category_id, payment_method_id, deskripsi, jumlah, tanggal)
		VALUES ($1, $2, $3, $4, 'exp 2025', 500000, '2025-10-02')`, trip2025ID, userID, catID, pmID)

	// Trip 2 in 2026: 1000k expense
	var trip2026ID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai, uang_dinas, status)
		VALUES ($1, 'Trip 2026', 'Bandung', '2026-05-01', '2026-05-03', 2000000, 'lunas') RETURNING id`, userID).Scan(&trip2026ID)
	testDB.Exec(`INSERT INTO expenses (trip_id, user_id, category_id, payment_method_id, deskripsi, jumlah, tanggal)
		VALUES ($1, $2, $3, $4, 'exp 2026', 1000000, '2026-05-02')`, trip2026ID, userID, catID, pmID)

	// Query year=2025
	rec2025 := doRequest(t, h, "GET", "/api/analytics?year=2025", "", cookie)
	if rec2025.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec2025.Code)
	}
	data2025 := parseJSON(t, rec2025)["data"].(map[string]interface{})
	if data2025["total_expenses_rp"].(float64) != 500000 {
		t.Errorf("expected 500000 for 2025, got %v", data2025["total_expenses_rp"])
	}
	if data2025["total_trips"].(float64) != 1 {
		t.Errorf("expected 1 trip for 2025, got %v", data2025["total_trips"])
	}

	// Query year=2026
	rec2026 := doRequest(t, h, "GET", "/api/analytics?year=2026", "", cookie)
	if rec2026.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec2026.Code)
	}
	data2026 := parseJSON(t, rec2026)["data"].(map[string]interface{})
	if data2026["total_expenses_rp"].(float64) != 1000000 {
		t.Errorf("expected 1000000 for 2026, got %v", data2026["total_expenses_rp"])
	}
	if data2026["total_trips"].(float64) != 1 {
		t.Errorf("expected 1 trip for 2026, got %v", data2026["total_trips"])
	}

	// Query unfiltered (all years)
	recAll := doRequest(t, h, "GET", "/api/analytics", "", cookie)
	if recAll.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recAll.Code)
	}
	dataAll := parseJSON(t, recAll)["data"].(map[string]interface{})
	if dataAll["total_trips"].(float64) != 2 {
		t.Errorf("expected 2 total trips, got %v", dataAll["total_trips"])
	}
	if dataAll["total_expenses_rp"].(float64) != 1500000 {
		t.Errorf("expected 1500000 for all, got %v", dataAll["total_expenses_rp"])
	}

	// Verify available_years contains 2026 and 2025
	yearsRaw, ok := dataAll["available_years"].([]interface{})
	if !ok || len(yearsRaw) < 2 {
		t.Fatalf("expected at least 2 available_years, got %v", dataAll["available_years"])
	}
	if yearsRaw[0].(float64) != 2026 || yearsRaw[1].(float64) != 2025 {
		t.Errorf("expected [2026, 2025], got %v", yearsRaw)
	}
}
