package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCollaborator_Validation(t *testing.T) {
	h := AddTripMember(nil)
	req := httptest.NewRequest("POST", "/api/trips/test-id/members", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()

	// Calling directly without DB should handle bad input before DB calls
	h(rec, req)
	// When trip access check fails or bad JSON, returns 500 or 400
	if rec.Code == http.StatusOK {
		t.Errorf("expected error code for unauthenticated/empty call, got %d", rec.Code)
	}
}
