package handler

import (
	"net/http"
	"testing"

	"github.com/maulana/perjadin-personal/internal/auth"
)

func setupAdminUserRoutes() http.Handler {
	mux := http.NewServeMux()
	authMW := auth.AuthMiddleware(testJWTSecret)
	adminMW := auth.AdminMiddleware()

	mux.Handle("GET /api/admin/users", authMW(adminMW(http.HandlerFunc(ListAdminUsers(testDB)))))
	mux.Handle("PUT /api/admin/users/{id}/role", authMW(adminMW(http.HandlerFunc(UpdateUserRole(testDB)))))
	mux.Handle("GET /api/admin/stats", authMW(adminMW(http.HandlerFunc(GetAdminStats(testDB)))))
	return mux
}

func TestListAdminUsers_ForbiddenForRegularUser(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "user-reg", "reg@test.com", "user")
	cookie := authCookie(t, userID, "user")
	h := setupAdminUserRoutes()

	rec := doRequest(t, h, "GET", "/api/admin/users", "", cookie)
	if rec.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", rec.Code)
	}
}

func TestListAdminUsers_SuccessForAdmin(t *testing.T) {
	cleanupTestData(t)
	adminID := createTestUser(t, "admin-u", "admin@test.com", "admin")
	createTestUser(t, "user-2", "user2@test.com", "user")
	cookie := authCookie(t, adminID, "admin")
	h := setupAdminUserRoutes()

	rec := doRequest(t, h, "GET", "/api/admin/users", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	body := parseJSON(t, rec)
	users := body["data"].([]interface{})
	if len(users) != 2 {
		t.Errorf("expected 2 users, got %d", len(users))
	}
}

func TestUpdateUserRole_Success(t *testing.T) {
	cleanupTestData(t)
	adminID := createTestUser(t, "admin-u", "admin@test.com", "admin")
	targetID := createTestUser(t, "user-t", "target@test.com", "user")
	cookie := authCookie(t, adminID, "admin")
	h := setupAdminUserRoutes()

	rec := doRequest(t, h, "PUT", "/api/admin/users/"+targetID+"/role", `{"role": "admin"}`, cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var newRole string
	testDB.QueryRow("SELECT role FROM users WHERE id = $1", targetID).Scan(&newRole)
	if newRole != "admin" {
		t.Errorf("expected role admin, got %s", newRole)
	}
}

func TestUpdateUserRole_PreventSelfDemotionIfSoleAdmin(t *testing.T) {
	cleanupTestData(t)
	adminID := createTestUser(t, "admin-sole", "sole@test.com", "admin")
	cookie := authCookie(t, adminID, "admin")
	h := setupAdminUserRoutes()

	rec := doRequest(t, h, "PUT", "/api/admin/users/"+adminID+"/role", `{"role": "user"}`, cookie)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for sole admin demotion, got %d", rec.Code)
	}
}

func TestGetAdminStats(t *testing.T) {
	cleanupTestData(t)
	adminID := createTestUser(t, "admin-stat", "stat@test.com", "admin")
	cookie := authCookie(t, adminID, "admin")
	h := setupAdminUserRoutes()

	rec := doRequest(t, h, "GET", "/api/admin/stats", "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	body := parseJSON(t, rec)
	data := body["data"].(map[string]interface{})
	if data["total_users"] == nil || data["total_trips"] == nil {
		t.Errorf("expected stats keys, got %v", data)
	}
}
