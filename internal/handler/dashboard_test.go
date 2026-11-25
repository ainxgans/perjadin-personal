package handler

import (
	"net/http"
	"testing"

	"github.com/maulana/perjadin-personal/internal/auth"
)

func setupDashboardRoutes() http.Handler {
	mux := http.NewServeMux()
	authMW := auth.AuthMiddleware(testJWTSecret)
	mux.Handle("GET /api/dashboard", authMW(http.HandlerFunc(GetDashboard(testDB))))
	return mux
}

func TestDashboard_BelumLunas(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupDashboardRoutes()

	// Create trip without payment
	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Trip', 'A', '2026-01-01', '2026-01-05') RETURNING id`, userID).Scan(&tripID)

	// Add expense with Pribadi
	var pmID string
	testDB.QueryRow("SELECT id FROM payment_methods WHERE nama = 'Pribadi'").Scan(&pmID)
	var catID string
	testDB.QueryRow("SELECT id FROM categories WHERE nama = 'Makan'").Scan(&catID)
	testDB.Exec(`INSERT INTO expenses (trip_id, category_id, payment_method_id, deskripsi, jumlah, tanggal)
		VALUES ($1, $2, $3, 'makan', 50000, '2026-01-02')`, tripID, catID, pmID)

	rec := doRequest(t, handler, "GET", "/api/dashboard", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	body := parseJSON(t, rec)
	data := body["data"].(map[string]interface{})
	belumLunas := int64(data["belum_lunas"].(float64))
	if belumLunas != 50000 {
		t.Errorf("expected belum_lunas=50000, got %d", belumLunas)
	}
}

func TestDashboard_PemasukanBulanLalu(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupDashboardRoutes()

	// Create selesai trip paid last month
	testDB.Exec(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai, status, uang_dinas, tanggal_dibayar)
		VALUES ($1, 'Done', 'A', '2026-10-01', '2026-10-05', 'lunas', 3000000,
			date_trunc('month', now() - interval '1 month') + interval '15 days')`, userID)

	rec := doRequest(t, handler, "GET", "/api/dashboard", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	body := parseJSON(t, rec)
	data := body["data"].(map[string]interface{})
	pemasukan := int64(data["pemasukan_bulan_lalu"].(float64))
	if pemasukan != 3000000 {
		t.Errorf("expected pemasukan_bulan_lalu=3000000, got %d", pemasukan)
	}
}
