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
