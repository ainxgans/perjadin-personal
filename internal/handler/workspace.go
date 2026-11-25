package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/maulana/perjadin-personal/internal/auth"
	"github.com/maulana/perjadin-personal/internal/model"
)

func ListWorkspaces(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())

		// Ensure user has at least personal workspace
		_, _ = EnsurePersonalWorkspace(db, userID, "")

		rows, err := db.Query(`
			SELECT w.id, w.nama, w.owner_id, wm.role,
				(SELECT COUNT(1) FROM workspace_members WHERE workspace_id = w.id) as member_count,
				w.created_at, w.updated_at
			FROM workspaces w
			JOIN workspace_members wm ON wm.workspace_id = w.id
			WHERE wm.user_id = $1
			ORDER BY wm.created_at ASC
		`, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		workspaces := []model.Workspace{}
		for rows.Next() {
			var ws model.Workspace
			if err := rows.Scan(&ws.ID, &ws.Nama, &ws.OwnerID, &ws.Role, &ws.MemberCount, &ws.CreatedAt, &ws.UpdatedAt); err != nil {
				continue
			}
			workspaces = append(workspaces, ws)
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{"data": workspaces})
	}
}

func CreateWorkspace(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())

		var input struct {
			Nama string `json:"nama"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || strings.TrimSpace(input.Nama) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nama workspace wajib diisi"})
			return
		}

		code := GenerateRandomJoinCode()
		var ws model.Workspace
		err := db.QueryRow(`
			INSERT INTO workspaces (nama, owner_id, join_code)
			VALUES ($1, $2, $3)
			RETURNING id, nama, owner_id, join_code, created_at, updated_at
		`, strings.TrimSpace(input.Nama), userID, code).
			Scan(&ws.ID, &ws.Nama, &ws.OwnerID, &ws.JoinCode, &ws.CreatedAt, &ws.UpdatedAt)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		_, err = db.Exec(`
			INSERT INTO workspace_members (workspace_id, user_id, role)
			VALUES ($1, $2, 'owner')
		`, ws.ID, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		ws.Role = "owner"
		ws.MemberCount = 1
		writeJSON(w, http.StatusCreated, map[string]interface{}{"data": ws})
	}
}

func GetCurrentWorkspace(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		role := auth.RoleFromContext(r.Context())

		wsID, err := ResolveWorkspaceID(r, db, userID)
		if err != nil {
			if errorsIs(err, ErrWorkspaceUnauthorized) {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "workspace tidak ditemukan"})
			return
		}

		var ws model.Workspace
		var userWsRole string
		err = db.QueryRow(`
			SELECT w.id, w.nama, w.owner_id, w.join_code, wm.role,
				(SELECT COUNT(1) FROM workspace_members WHERE workspace_id = w.id) as member_count,
				w.created_at, w.updated_at
			FROM workspaces w
			JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
			WHERE w.id = $1
		`, wsID, userID).
			Scan(&ws.ID, &ws.Nama, &ws.OwnerID, &ws.JoinCode, &userWsRole, &ws.MemberCount, &ws.CreatedAt, &ws.UpdatedAt)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "workspace tidak ditemukan"})
			return
		}

		ws.Role = userWsRole
		// Only owner or system admin can see join code
		if userWsRole != "owner" && role != "admin" {
			ws.JoinCode = ""
		}

		// Fetch members
		rows, err := db.Query(`
			SELECT wm.id, wm.workspace_id, wm.user_id, u.name, u.email, COALESCE(u.avatar_url, ''), wm.role, wm.created_at
			FROM workspace_members wm
			JOIN users u ON u.id = wm.user_id
			WHERE wm.workspace_id = $1
			ORDER BY wm.created_at ASC
		`, wsID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		members := []model.WorkspaceMember{}
		for rows.Next() {
			var m model.WorkspaceMember
			if err := rows.Scan(&m.ID, &m.WorkspaceID, &m.UserID, &m.Name, &m.Email, &m.AvatarURL, &m.Role, &m.CreatedAt); err != nil {
				continue
			}
			members = append(members, m)
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"data": map[string]interface{}{
				"workspace": ws,
				"members":   members,
				"join_code": ws.JoinCode,
			},
		})
	}
}

func JoinWorkspace(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())

		var input struct {
			Code string `json:"code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || strings.TrimSpace(input.Code) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "kode workspace diperlukan"})
			return
		}

		code := strings.ToUpper(strings.TrimSpace(input.Code))

		var ws model.Workspace
		err := db.QueryRow(`
			SELECT id, nama, owner_id, join_code, created_at, updated_at
			FROM workspaces
			WHERE UPPER(join_code) = $1
		`, code).Scan(&ws.ID, &ws.Nama, &ws.OwnerID, &ws.JoinCode, &ws.CreatedAt, &ws.UpdatedAt)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "kode workspace tidak valid"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// Insert member (idempotent)
		_, err = db.Exec(`
			INSERT INTO workspace_members (workspace_id, user_id, role)
			VALUES ($1, $2, 'member')
			ON CONFLICT (workspace_id, user_id) DO NOTHING
		`, ws.ID, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// Count members
		_ = db.QueryRow(`SELECT COUNT(1) FROM workspace_members WHERE workspace_id = $1`, ws.ID).Scan(&ws.MemberCount)
		ws.Role = "member"
		if ws.OwnerID == userID {
			ws.Role = "owner"
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{"data": ws})
	}
}

func RegenerateJoinCode(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		role := auth.RoleFromContext(r.Context())

		wsID, err := ResolveWorkspaceID(r, db, userID)
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}

		// Check owner or admin
		var wsRole string
		err = db.QueryRow(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, wsID, userID).Scan(&wsRole)
		if err != nil || (wsRole != "owner" && role != "admin") {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "hanya pemilik workspace yang dapat mereset kode"})
			return
		}

		newCode := GenerateRandomJoinCode()
		_, err = db.Exec(`UPDATE workspaces SET join_code = $1, updated_at = now() WHERE id = $2`, newCode, wsID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"data": map[string]string{"join_code": newCode},
		})
	}
}

func RemoveWorkspaceMember(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		requesterID := auth.UserIDFromContext(r.Context())
		role := auth.RoleFromContext(r.Context())
		wsID := r.PathValue("id")
		targetUserID := r.PathValue("userID")

		// Verify requester is owner or admin
		var wsRole string
		err := db.QueryRow(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, wsID, requesterID).Scan(&wsRole)
		if err != nil || (wsRole != "owner" && role != "admin") {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "hanya pemilik workspace yang dapat mengeluarkan anggota"})
			return
		}

		// Prevent removing owner
		var targetRole string
		_ = db.QueryRow(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, wsID, targetUserID).Scan(&targetRole)
		if targetRole == "owner" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "pemilik workspace tidak dapat dihapus"})
			return
		}

		_, err = db.Exec(`DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, wsID, targetUserID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"message": "anggota berhasil dikeluarkan"})
	}
}

func errorsIs(err, target error) bool {
	return err == target
}
