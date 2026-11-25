package handler

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"
)

var (
	ErrWorkspaceNotFound     = errors.New("workspace tidak ditemukan")
	ErrWorkspaceUnauthorized = errors.New("akses workspace ditolak")
)

// GenerateRandomJoinCode creates a 6-character uppercase alphanumeric string.
func GenerateRandomJoinCode() string {
	b := make([]byte, 3)
	if _, err := rand.Read(b); err != nil {
		return "WSPACE"
	}
	return strings.ToUpper(hex.EncodeToString(b))
}

// EnsurePersonalWorkspace guarantees that the user has at least one workspace owned by them.
// If the user already owns a workspace, it returns the first one.
func EnsurePersonalWorkspace(db *sql.DB, userID, userName string) (string, error) {
	if db == nil {
		return "", errors.New("db is nil")
	}

	var existingID string
	err := db.QueryRow(`
		SELECT w.id
		FROM workspaces w
		WHERE w.owner_id = $1
		ORDER BY w.created_at ASC
		LIMIT 1
	`, userID).Scan(&existingID)
	if err == nil && existingID != "" {
		return existingID, nil
	}

	wsName := "Workspace " + strings.TrimSpace(userName)
	if strings.TrimSpace(userName) == "" {
		wsName = "Workspace Pribadi"
	}

	var wsID string
	var code string
	for attempts := 0; attempts < 5; attempts++ {
		code = GenerateRandomJoinCode()
		err = db.QueryRow(`
			INSERT INTO workspaces (nama, owner_id, join_code)
			VALUES ($1, $2, $3)
			RETURNING id
		`, wsName, userID, code).Scan(&wsID)
		if err == nil {
			break
		}
	}
	if err != nil {
		return "", fmt.Errorf("create personal workspace: %w", err)
	}

	_, err = db.Exec(`
		INSERT INTO workspace_members (workspace_id, user_id, role)
		VALUES ($1, $2, 'owner')
		ON CONFLICT (workspace_id, user_id) DO NOTHING
	`, wsID, userID)
	if err != nil {
		return "", fmt.Errorf("assign workspace owner: %w", err)
	}

	return wsID, nil
}

// ResolveWorkspaceID resolves the workspace context from X-Workspace-ID header or fallback.
func ResolveWorkspaceID(r *http.Request, db *sql.DB, userID string) (string, error) {
	if db == nil {
		return "", errors.New("db is nil")
	}

	headerWS := strings.TrimSpace(r.Header.Get("X-Workspace-ID"))

	if headerWS != "" {
		var memberCount int
		err := db.QueryRow(`
			SELECT COUNT(1)
			FROM workspace_members
			WHERE workspace_id = $1 AND user_id = $2
		`, headerWS, userID).Scan(&memberCount)
		if err != nil {
			return "", err
		}
		if memberCount == 0 {
			return "", ErrWorkspaceUnauthorized
		}
		return headerWS, nil
	}

	// Fallback to user's first workspace
	var defaultWS string
	err := db.QueryRow(`
		SELECT w.id
		FROM workspaces w
		JOIN workspace_members wm ON wm.workspace_id = w.id
		WHERE wm.user_id = $1
		ORDER BY wm.created_at ASC
		LIMIT 1
	`, userID).Scan(&defaultWS)
	if err == sql.ErrNoRows {
		// Auto-provision if none exists
		return EnsurePersonalWorkspace(db, userID, "")
	}
	if err != nil {
		return "", err
	}

	return defaultWS, nil
}
