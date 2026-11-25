package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/maulana/perjadin-personal/internal/auth"
)

func setupWorkspaceRoutes() http.Handler {
	mux := http.NewServeMux()
	authMW := auth.AuthMiddleware(testJWTSecret)

	mux.Handle("GET /api/workspaces", authMW(http.HandlerFunc(ListWorkspaces(testDB))))
	mux.Handle("POST /api/workspaces", authMW(http.HandlerFunc(CreateWorkspace(testDB))))
	mux.Handle("GET /api/workspaces/current", authMW(http.HandlerFunc(GetCurrentWorkspace(testDB))))
	mux.Handle("POST /api/workspaces/join", authMW(http.HandlerFunc(JoinWorkspace(testDB))))
	mux.Handle("POST /api/workspaces/regenerate-code", authMW(http.HandlerFunc(RegenerateJoinCode(testDB))))
	mux.Handle("DELETE /api/workspaces/{id}/members/{userID}", authMW(http.HandlerFunc(RemoveWorkspaceMember(testDB))))
	return mux
}

func TestWorkspace_CRUD_And_Join(t *testing.T) {
	cleanupTestData(t)
	handler := setupWorkspaceRoutes()

	userA := createTestUser(t, "user-a", "a@test.com", "user")
	cookieA := authCookie(t, userA, "user")

	userB := createTestUser(t, "user-b", "b@test.com", "user")
	cookieB := authCookie(t, userB, "user")

	// 1. User A lists workspaces: should auto-provision personal workspace
	recListA := doRequest(t, handler, "GET", "/api/workspaces", "", cookieA)
	if recListA.Code != http.StatusOK {
		t.Fatalf("list A expected 200, got %d: %s", recListA.Code, recListA.Body.String())
	}
	bodyListA := parseJSON(t, recListA)
	workspacesA := bodyListA["data"].([]interface{})
	if len(workspacesA) != 1 {
		t.Fatalf("expected 1 workspace for user A, got %d", len(workspacesA))
	}
	wsA := workspacesA[0].(map[string]interface{})
	wsAID := wsA["id"].(string)

	// 2. User A gets current workspace
	recCurrentA := doRequest(t, handler, "GET", "/api/workspaces/current", "", cookieA)
	if recCurrentA.Code != http.StatusOK {
		t.Fatalf("current A expected 200, got %d: %s", recCurrentA.Code, recCurrentA.Body.String())
	}
	currentAData := parseJSON(t, recCurrentA)["data"].(map[string]interface{})
	joinCodeA := currentAData["join_code"].(string)
	if len(joinCodeA) != 6 {
		t.Fatalf("expected 6-char join code, got %s", joinCodeA)
	}

	// 3. User B joins User A's workspace using lowercase code (testing case-insensitivity)
	recJoinB := doRequest(t, handler, "POST", "/api/workspaces/join", `{"code": "`+strings.ToLower(joinCodeA)+`"}`, cookieB)
	if recJoinB.Code != http.StatusOK {
		t.Fatalf("join B expected 200, got %d: %s", recJoinB.Code, recJoinB.Body.String())
	}
	joinBData := parseJSON(t, recJoinB)["data"].(map[string]interface{})
	if joinBData["id"] != wsAID {
		t.Errorf("expected joined workspace id %s, got %v", wsAID, joinBData["id"])
	}

	// 4. User B joins again -> Idempotent, returns 200
	recJoinAgain := doRequest(t, handler, "POST", "/api/workspaces/join", `{"code": "`+joinCodeA+`"}`, cookieB)
	if recJoinAgain.Code != http.StatusOK {
		t.Fatalf("idempotent join expected 200, got %d: %s", recJoinAgain.Code, recJoinAgain.Body.String())
	}

	// 5. User B joins non-existent code -> 404
	recJoinInvalid := doRequest(t, handler, "POST", "/api/workspaces/join", `{"code": "NONONO"}`, cookieB)
	if recJoinInvalid.Code != http.StatusNotFound {
		t.Fatalf("invalid code expected 404, got %d", recJoinInvalid.Code)
	}

	// 6. User B lists workspaces -> now has 2 (own personal workspace + joined wsA)
	recListB := doRequest(t, handler, "GET", "/api/workspaces", "", cookieB)
	if recListB.Code != http.StatusOK {
		t.Fatalf("list B expected 200, got %d: %s", recListB.Code, recListB.Body.String())
	}
	workspacesB := parseJSON(t, recListB)["data"].([]interface{})
	if len(workspacesB) != 2 {
		t.Fatalf("expected 2 workspaces for user B, got %d", len(workspacesB))
	}

	// 7. User A creates custom team workspace
	recCreate := doRequest(t, handler, "POST", "/api/workspaces", `{"nama": "Tim Operasi BBM"}`, cookieA)
	if recCreate.Code != http.StatusCreated {
		t.Fatalf("create expected 201, got %d: %s", recCreate.Code, recCreate.Body.String())
	}
	createData := parseJSON(t, recCreate)["data"].(map[string]interface{})
	if createData["nama"] != "Tim Operasi BBM" {
		t.Errorf("expected Tim Operasi BBM, got %v", createData["nama"])
	}

	// 8. User A regenerates join code for wsA
	reqRegen, _ := http.NewRequest("POST", "/api/workspaces/regenerate-code", nil)
	reqRegen.Header.Set("X-Workspace-ID", wsAID)
	reqRegen.AddCookie(cookieA)
	recRegen := httptest.NewRecorder()
	handler.ServeHTTP(recRegen, reqRegen)
	if recRegen.Code != http.StatusOK {
		t.Fatalf("regen expected 200, got %d: %s", recRegen.Code, recRegen.Body.String())
	}
	newCode := parseJSON(t, recRegen)["data"].(map[string]interface{})["join_code"].(string)
	if newCode == joinCodeA {
		t.Errorf("expected new join code, got same %s", newCode)
	}
}
