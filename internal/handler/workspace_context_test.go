package handler

import (
	"net/http/httptest"
	"testing"
)

func TestEnsurePersonalWorkspace(t *testing.T) {
	cleanupTestData(t)
	userID := createTestUser(t, "user-ws-test", "ws@test.com", "user")

	wsID1, err := EnsurePersonalWorkspace(testDB, userID, "Test User")
	if err != nil {
		t.Fatalf("ensure ws err: %v", err)
	}
	if wsID1 == "" {
		t.Fatalf("expected non-empty wsID")
	}

	// Idempotent: should return the same workspace
	wsID2, err := EnsurePersonalWorkspace(testDB, userID, "Test User")
	if err != nil {
		t.Fatalf("ensure ws second call err: %v", err)
	}
	if wsID1 != wsID2 {
		t.Errorf("expected idempotent wsID %s, got %s", wsID1, wsID2)
	}
}

func TestResolveWorkspaceID(t *testing.T) {
	cleanupTestData(t)
	userA := createTestUser(t, "user-a", "usera@test.com", "user")
	userB := createTestUser(t, "user-b", "userb@test.com", "user")

	wsA, err := EnsurePersonalWorkspace(testDB, userA, "User A")
	if err != nil {
		t.Fatalf("ensure wsA err: %v", err)
	}
	wsB, err := EnsurePersonalWorkspace(testDB, userB, "User B")
	if err != nil {
		t.Fatalf("ensure wsB err: %v", err)
	}

	// 1. Default fallback: header empty -> returns userA's own workspace
	req1 := httptest.NewRequest("GET", "/api/trips", nil)
	resolved1, err := ResolveWorkspaceID(req1, testDB, userA)
	if err != nil {
		t.Fatalf("resolve default err: %v", err)
	}
	if resolved1 != wsA {
		t.Errorf("expected %s, got %s", wsA, resolved1)
	}

	// 2. Explicit header for own workspace
	req2 := httptest.NewRequest("GET", "/api/trips", nil)
	req2.Header.Set("X-Workspace-ID", wsA)
	resolved2, err := ResolveWorkspaceID(req2, testDB, userA)
	if err != nil {
		t.Fatalf("resolve explicit err: %v", err)
	}
	if resolved2 != wsA {
		t.Errorf("expected %s, got %s", wsA, resolved2)
	}

	// 3. Unauthorized header: userA requests userB's workspace
	req3 := httptest.NewRequest("GET", "/api/trips", nil)
	req3.Header.Set("X-Workspace-ID", wsB)
	_, err = ResolveWorkspaceID(req3, testDB, userA)
	if err == nil {
		t.Errorf("expected error for unauthorized workspace access, got nil")
	}
}
