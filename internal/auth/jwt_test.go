package auth

import (
	"testing"
	"time"
)

func TestJWTRoundTrip(t *testing.T) {
	token, err := CreateToken("user-123", "admin", "test-secret", time.Hour)
	if err != nil {
		t.Fatalf("create token: %v", err)
	}

	userID, role, err := ValidateToken(token, "test-secret")
	if err != nil {
		t.Fatalf("validate token: %v", err)
	}
	if userID != "user-123" {
		t.Errorf("expected user-123, got %s", userID)
	}
	if role != "admin" {
		t.Errorf("expected admin, got %s", role)
	}
}

func TestJWTExpired(t *testing.T) {
	token, err := CreateToken("user-123", "user", "test-secret", -time.Hour)
	if err != nil {
		t.Fatalf("create token: %v", err)
	}

	_, _, err = ValidateToken(token, "test-secret")
	if err == nil {
		t.Error("expected error for expired token")
	}
}

func TestJWTInvalidSignature(t *testing.T) {
	token, err := CreateToken("user-123", "user", "secret-a", time.Hour)
	if err != nil {
		t.Fatalf("create token: %v", err)
	}

	_, _, err = ValidateToken(token, "secret-b")
	if err == nil {
		t.Error("expected error for wrong secret")
	}
}
