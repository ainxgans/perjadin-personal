package handler

import (
	"net/http"
	"testing"

	"github.com/maulana/perjadin-personal/internal/auth"
)

func setupExpenseRoutes() http.Handler {
	mux := http.NewServeMux()
	authMW := auth.AuthMiddleware(testJWTSecret)

	mux.Handle("GET /api/trips/{tripID}/expenses", authMW(http.HandlerFunc(ListExpenses(testDB))))
	mux.Handle("POST /api/trips/{tripID}/expenses", authMW(http.HandlerFunc(CreateExpense(testDB))))
	mux.Handle("PUT /api/expenses/{id}", authMW(http.HandlerFunc(UpdateExpense(testDB))))
	mux.Handle("DELETE /api/expenses/{id}", authMW(http.HandlerFunc(DeleteExpense(testDB))))
	return mux
}

func TestCreateExpense(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupExpenseRoutes()

	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Trip', 'A', '2026-01-01', '2026-01-05') RETURNING id`, userID).Scan(&tripID)

	var catID, pmID string
	testDB.QueryRow("SELECT id FROM categories WHERE nama = 'Makan'").Scan(&catID)
	testDB.QueryRow("SELECT id FROM payment_methods WHERE nama = 'Pribadi'").Scan(&pmID)

	rec := doRequest(t, handler, "POST", "/api/trips/"+tripID+"/expenses", `{
		"category_id": "`+catID+`",
		"payment_method_id": "`+pmID+`",
		"deskripsi": "makan siang",
		"jumlah": 35000,
		"tanggal": "2026-01-02"
	}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	body := parseJSON(t, rec)
	data := body["data"].(map[string]interface{})
	if data["category_nama"] != "Makan" {
		t.Errorf("expected category_nama=Makan, got %v", data["category_nama"])
	}
}

func TestCreateExpense_ZeroAmount(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupExpenseRoutes()

	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Trip', 'A', '2026-01-01', '2026-01-05') RETURNING id`, userID).Scan(&tripID)

	var catID, pmID string
	testDB.QueryRow("SELECT id FROM categories WHERE nama = 'Makan'").Scan(&catID)
	testDB.QueryRow("SELECT id FROM payment_methods WHERE nama = 'Pribadi'").Scan(&pmID)

	rec := doRequest(t, handler, "POST", "/api/trips/"+tripID+"/expenses", `{
		"category_id": "`+catID+`",
		"payment_method_id": "`+pmID+`",
		"deskripsi": "test",
		"jumlah": 0,
		"tanggal": "2026-01-02"
	}`, cookie)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestCreateExpense_NegativeAmount(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupExpenseRoutes()

	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Trip', 'A', '2026-01-01', '2026-01-05') RETURNING id`, userID).Scan(&tripID)

	var catID, pmID string
	testDB.QueryRow("SELECT id FROM categories WHERE nama = 'Makan'").Scan(&catID)
	testDB.QueryRow("SELECT id FROM payment_methods WHERE nama = 'Pribadi'").Scan(&pmID)

	rec := doRequest(t, handler, "POST", "/api/trips/"+tripID+"/expenses", `{
		"category_id": "`+catID+`",
		"payment_method_id": "`+pmID+`",
		"deskripsi": "test",
		"jumlah": -1000,
		"tanggal": "2026-01-02"
	}`, cookie)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestCreateExpense_InvalidCategory(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupExpenseRoutes()

	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Trip', 'A', '2026-01-01', '2026-01-05') RETURNING id`, userID).Scan(&tripID)

	var pmID string
	testDB.QueryRow("SELECT id FROM payment_methods WHERE nama = 'Pribadi'").Scan(&pmID)

	rec := doRequest(t, handler, "POST", "/api/trips/"+tripID+"/expenses", `{
		"category_id": "00000000-0000-0000-0000-000000000000",
		"payment_method_id": "`+pmID+`",
		"deskripsi": "test",
		"jumlah": 1000,
		"tanggal": "2026-01-02"
	}`, cookie)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestCreateExpense_OtherUserTrip(t *testing.T) {
	cleanupTestData(t)
	createTestUser(t, "google-user", "user@test.com", "user")
	user2ID := createTestUser(t, "google-user2", "user2@test.com", "user")
	cookie := authCookie(t, user2ID, "user")
	handler := setupExpenseRoutes()

	// Trip belongs to user1
	var tripID string
	userID := createTestUser(t, "google-user3", "user3@test.com", "user")
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'NotMine', 'A', '2026-01-01', '2026-01-05') RETURNING id`, userID).Scan(&tripID)

	var catID, pmID string
	testDB.QueryRow("SELECT id FROM categories WHERE nama = 'Makan'").Scan(&catID)
	testDB.QueryRow("SELECT id FROM payment_methods WHERE nama = 'Pribadi'").Scan(&pmID)

	rec := doRequest(t, handler, "POST", "/api/trips/"+tripID+"/expenses", `{
		"category_id": "`+catID+`",
		"payment_method_id": "`+pmID+`",
		"deskripsi": "hack",
		"jumlah": 1000,
		"tanggal": "2026-01-02"
	}`, cookie)
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}

func TestListExpenses(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupExpenseRoutes()

	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Trip', 'A', '2026-01-01', '2026-01-05') RETURNING id`, userID).Scan(&tripID)

	var catID, pmID string
	testDB.QueryRow("SELECT id FROM categories WHERE nama = 'Makan'").Scan(&catID)
	testDB.QueryRow("SELECT id FROM payment_methods WHERE nama = 'Pribadi'").Scan(&pmID)
	testDB.Exec(`INSERT INTO expenses (trip_id, category_id, payment_method_id, deskripsi, jumlah, tanggal)
		VALUES ($1, $2, $3, 'test', 50000, '2026-01-02')`, tripID, catID, pmID)

	rec := doRequest(t, handler, "GET", "/api/trips/"+tripID+"/expenses", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	body := parseJSON(t, rec)
	data := body["data"].([]interface{})
	if len(data) != 1 {
		t.Errorf("expected 1 expense, got %d", len(data))
	}
}

func TestUpdateExpense(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupExpenseRoutes()

	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Trip', 'A', '2026-01-01', '2026-01-05') RETURNING id`, userID).Scan(&tripID)

	var catID, pmID, expID string
	testDB.QueryRow("SELECT id FROM categories WHERE nama = 'Makan'").Scan(&catID)
	testDB.QueryRow("SELECT id FROM payment_methods WHERE nama = 'Pribadi'").Scan(&pmID)
	testDB.QueryRow(`INSERT INTO expenses (trip_id, category_id, payment_method_id, deskripsi, jumlah, tanggal)
		VALUES ($1, $2, $3, 'old', 50000, '2026-01-02') RETURNING id`, tripID, catID, pmID).Scan(&expID)

	rec := doRequest(t, handler, "PUT", "/api/expenses/"+expID, `{"jumlah": 75000, "deskripsi": "updated"}`, cookie)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestUpdateExpense_OtherUser(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	user2ID := createTestUser(t, "google-user2", "user2@test.com", "user")
	cookie := authCookie(t, user2ID, "user")
	handler := setupExpenseRoutes()

	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Trip', 'A', '2026-01-01', '2026-01-05') RETURNING id`, userID).Scan(&tripID)

	var catID, pmID, expID string
	testDB.QueryRow("SELECT id FROM categories WHERE nama = 'Makan'").Scan(&catID)
	testDB.QueryRow("SELECT id FROM payment_methods WHERE nama = 'Pribadi'").Scan(&pmID)
	testDB.QueryRow(`INSERT INTO expenses (trip_id, category_id, payment_method_id, deskripsi, jumlah, tanggal)
		VALUES ($1, $2, $3, 'secret', 50000, '2026-01-02') RETURNING id`, tripID, catID, pmID).Scan(&expID)

	rec := doRequest(t, handler, "PUT", "/api/expenses/"+expID, `{"jumlah": 999}`, cookie)
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}

func TestDeleteExpense(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupExpenseRoutes()

	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Trip', 'A', '2026-01-01', '2026-01-05') RETURNING id`, userID).Scan(&tripID)

	var catID, pmID, expID string
	testDB.QueryRow("SELECT id FROM categories WHERE nama = 'Makan'").Scan(&catID)
	testDB.QueryRow("SELECT id FROM payment_methods WHERE nama = 'Pribadi'").Scan(&pmID)
	testDB.QueryRow(`INSERT INTO expenses (trip_id, category_id, payment_method_id, deskripsi, jumlah, tanggal)
		VALUES ($1, $2, $3, 'del', 50000, '2026-01-02') RETURNING id`, tripID, catID, pmID).Scan(&expID)

	rec := doRequest(t, handler, "DELETE", "/api/expenses/"+expID, "", cookie)
	if rec.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d", rec.Code)
	}
}
