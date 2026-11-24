package handler

import (
	"net/http"
	"testing"

	"github.com/maulana/perjadin-personal/internal/auth"
)

func setupPaymentMethodRoutes() http.Handler {
	mux := http.NewServeMux()
	authMW := auth.AuthMiddleware(testJWTSecret)
	adminMW := auth.AdminMiddleware()

	mux.Handle("GET /api/payment-methods", authMW(http.HandlerFunc(ListPaymentMethods(testDB))))
	mux.Handle("POST /api/admin/payment-methods", authMW(adminMW(http.HandlerFunc(CreatePaymentMethod(testDB)))))
	mux.Handle("PUT /api/admin/payment-methods/{id}", authMW(adminMW(http.HandlerFunc(UpdatePaymentMethod(testDB)))))
	mux.Handle("DELETE /api/admin/payment-methods/{id}", authMW(adminMW(http.HandlerFunc(DeletePaymentMethod(testDB)))))
	return mux
}

func TestAdminCreatePaymentMethod(t *testing.T) {
	cleanupTestData(t)
	adminID := createTestUser(t, "google-admin", "admin@test.com", "admin")
	cookie := authCookie(t, adminID, "admin")
	handler := setupPaymentMethodRoutes()

	rec := doRequest(t, handler, "POST", "/api/admin/payment-methods", `{"nama":"Transfer"}`, cookie)
	if rec.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	testDB.Exec("DELETE FROM payment_methods WHERE nama = 'Transfer'")
}

func TestUserCreatePaymentMethod_Forbidden(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupPaymentMethodRoutes()

	rec := doRequest(t, handler, "POST", "/api/admin/payment-methods", `{"nama":"Nope"}`, cookie)
	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", rec.Code)
	}
}

func TestListPaymentMethods(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "google-user", "user@test.com", "user")
	cookie := authCookie(t, userID, "user")
	handler := setupPaymentMethodRoutes()

	rec := doRequest(t, handler, "GET", "/api/payment-methods", "", cookie)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
	body := parseJSON(t, rec)
	data := body["data"].([]interface{})
	if len(data) < 3 {
		t.Errorf("expected at least 3 seed payment methods, got %d", len(data))
	}
}
