package handler

import (
	"net/http"
	"testing"

	"github.com/maulana/perjadin-personal/internal/auth"
)

func setupCategoryRoutes() http.Handler {
	mux := http.NewServeMux()
	authMW := auth.AuthMiddleware(testJWTSecret)
	adminMW := auth.AdminMiddleware()

	mux.Handle("GET /api/categories", authMW(http.HandlerFunc(ListCategories(testDB))))
	mux.Handle("POST /api/admin/categories", authMW(adminMW(http.HandlerFunc(CreateCategory(testDB)))))
	mux.Handle("PUT /api/admin/categories/{id}", authMW(adminMW(http.HandlerFunc(UpdateCategory(testDB)))))
	mux.Handle("DELETE /api/admin/categories/{id}", authMW(adminMW(http.HandlerFunc(DeleteCategory(testDB)))))
	return mux
}

func TestAdminCreateCategory(t *testing.T) {
	cleanupTestData(t)
	adminID := createTestUser(t, "google-admin", "admin@test.com", "admin")
	cookie := authCookie(t, adminID, "admin")
	handler := setupCategoryRoutes()

	rec := doRequest(t, handler, "POST", "/api/admin/categories", `{"nama":"Parkir"}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	body := parseJSON(t, rec)
	data := body["data"].(map[string]interface{})
	if data["nama"] != "Parkir" {
		t.Errorf("expected nama=Parkir, got %v", data["nama"])
	}

	// Cleanup: delete the created category
	testDB.Exec("DELETE FROM categories WHERE nama = 'Parkir'")
}

func TestAdminUpdateCategory(t *testing.T) {
	cleanupTestData(t)
	adminID := createTestUser(t, "google-admin", "admin@test.com", "admin")
	cookie := authCookie(t, adminID, "admin")
	handler := setupCategoryRoutes()

	// Create one first
	var catID string
	testDB.QueryRow("INSERT INTO categories (nama) VALUES ('TempCat') RETURNING id").Scan(&catID)

	rec := doRequest(t, handler, "PUT", "/api/admin/categories/"+catID, `{"nama":"UpdatedCat"}`, cookie)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	testDB.Exec("DELETE FROM categories WHERE id = $1", catID)
}

func TestAdminDeleteCategory(t *testing.T) {
	cleanupTestData(t)
	adminID := createTestUser(t, "google-admin", "admin@test.com", "admin")
	cookie := authCookie(t, adminID, "admin")
	handler := setupCategoryRoutes()

	var catID string
	testDB.QueryRow("INSERT INTO categories (nama) VALUES ('ToDelete') RETURNING id").Scan(&catID)

	rec := doRequest(t, handler, "DELETE", "/api/admin/categories/"+catID, "", cookie)
	if rec.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestUserCreateCategory_Forbidden(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupCategoryRoutes()

	rec := doRequest(t, handler, "POST", "/api/admin/categories", `{"nama":"Nope"}`, cookie)
	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", rec.Code)
	}
}

func TestDeleteCategory_InUse(t *testing.T) {
	cleanupTestData(t)
	adminID := createTestUser(t, "google-admin", "admin@test.com", "admin")
	cookie := authCookie(t, adminID, "admin")
	handler := setupCategoryRoutes()

	// Get seed category ID
	var catID string
	testDB.QueryRow("SELECT id FROM categories WHERE nama = 'Makan' LIMIT 1").Scan(&catID)

	// Create trip + expense referencing it
	var tripID string
	testDB.QueryRow(`INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai)
		VALUES ($1, 'Test', 'Test', '2026-01-01', '2026-01-05') RETURNING id`, adminID).Scan(&tripID)
	var pmID string
	testDB.QueryRow("SELECT id FROM payment_methods WHERE nama = 'Pribadi' LIMIT 1").Scan(&pmID)
	testDB.Exec(`INSERT INTO expenses (trip_id, category_id, payment_method_id, deskripsi, jumlah, tanggal)
		VALUES ($1, $2, $3, 'test', 50000, '2026-01-02')`, tripID, catID, pmID)

	rec := doRequest(t, handler, "DELETE", "/api/admin/categories/"+catID, "", cookie)
	if rec.Code != http.StatusConflict {
		t.Errorf("expected 409, got %d: %s", rec.Code, rec.Body.String())
	}

	// Cleanup
	testDB.Exec("DELETE FROM expenses WHERE trip_id = $1", tripID)
	testDB.Exec("DELETE FROM trips WHERE id = $1", tripID)
}

func TestListCategories(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupCategoryRoutes()

	rec := doRequest(t, handler, "GET", "/api/categories", "", cookie)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
	body := parseJSON(t, rec)
	data := body["data"].([]interface{})
	if len(data) < 4 {
		t.Errorf("expected at least 4 seed categories, got %d", len(data))
	}
}
