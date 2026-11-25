package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/maulana/perjadin-personal/internal/auth"
)

type collaboratorResponse struct {
	ID         string    `json:"id"`
	TripID     string    `json:"trip_id"`
	UserID     string    `json:"user_id"`
	Role       string    `json:"role"`
	Name       string    `json:"name"`
	Email      string    `json:"email"`
	AvatarURL  string    `json:"avatar_url"`
	CreatedAt  time.Time `json:"created_at"`
}

func canAccessTrip(db *sql.DB, tripID, userID, role string) (bool, bool, error) {
	if db == nil {
		return false, false, sql.ErrConnDone
	}
	var ownerID string
	err := db.QueryRow("SELECT user_id FROM trips WHERE id = $1", tripID).Scan(&ownerID)
	if err == sql.ErrNoRows {
		return false, false, nil
	}
	if err != nil {
		return false, false, err
	}

	isOwner := (ownerID == userID) || (role == "admin")
	if isOwner {
		return true, true, nil
	}

	var isMember bool
	err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2)", tripID, userID).Scan(&isMember)
	if err != nil {
		return false, false, err
	}

	return isMember, false, nil
}

func ListTripMembers(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		currentUserID := auth.UserIDFromContext(r.Context())
		role := auth.RoleFromContext(r.Context())
		tripID := r.PathValue("id")

		canAccess, _, err := canAccessTrip(db, tripID, currentUserID, role)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !canAccess {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "trip not found"})
			return
		}

		// First get owner details
		var owner collaboratorResponse
		err = db.QueryRow(`
			SELECT t.id, t.user_id, 'owner', u.name, u.email, COALESCE(u.avatar_url, ''), t.created_at
			FROM trips t
			JOIN users u ON t.user_id = u.id
			WHERE t.id = $1
		`, tripID).Scan(&owner.TripID, &owner.UserID, &owner.Role, &owner.Name, &owner.Email, &owner.AvatarURL, &owner.CreatedAt)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		owner.ID = "owner-" + owner.UserID

		members := []collaboratorResponse{owner}

		// Then get members
		rows, err := db.Query(`
			SELECT tm.id, tm.trip_id, tm.user_id, tm.role, u.name, u.email, COALESCE(u.avatar_url, ''), tm.created_at
			FROM trip_members tm
			JOIN users u ON tm.user_id = u.id
			WHERE tm.trip_id = $1
			ORDER BY tm.created_at ASC
		`, tripID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		for rows.Next() {
			var m collaboratorResponse
			if err := rows.Scan(&m.ID, &m.TripID, &m.UserID, &m.Role, &m.Name, &m.Email, &m.AvatarURL, &m.CreatedAt); err != nil {
				continue
			}
			members = append(members, m)
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{"data": members})
	}
}

func AddTripMember(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		currentUserID := auth.UserIDFromContext(r.Context())
		role := auth.RoleFromContext(r.Context())
		tripID := r.PathValue("id")

		_, isOwner, err := canAccessTrip(db, tripID, currentUserID, role)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !isOwner {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "hanya pemilik trip atau admin yang dapat mengundang rekan"})
			return
		}

		var input struct {
			UserID string `json:"user_id"`
			Email  string `json:"email"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
			return
		}

		targetUserID := strings.TrimSpace(input.UserID)
		targetEmail := strings.TrimSpace(input.Email)

		if targetUserID == "" && targetEmail == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id atau email diperlukan"})
			return
		}

		var targetUser struct {
			ID        string
			Name      string
			Email     string
			AvatarURL string
		}

		if targetUserID != "" {
			err = db.QueryRow("SELECT id, name, email, COALESCE(avatar_url, '') FROM users WHERE id = $1", targetUserID).
				Scan(&targetUser.ID, &targetUser.Name, &targetUser.Email, &targetUser.AvatarURL)
		} else {
			err = db.QueryRow("SELECT id, name, email, COALESCE(avatar_url, '') FROM users WHERE email ILIKE $1", targetEmail).
				Scan(&targetUser.ID, &targetUser.Name, &targetUser.Email, &targetUser.AvatarURL)
		}

		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user tidak ditemukan di sistem"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// Don't add owner as member
		var tripOwnerID string
		db.QueryRow("SELECT user_id FROM trips WHERE id = $1", tripID).Scan(&tripOwnerID)
		if tripOwnerID == targetUser.ID {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user ini adalah pemilik perjalanan"})
			return
		}

		var memberID string
		var createdAt time.Time
		err = db.QueryRow(`
			INSERT INTO trip_members (trip_id, user_id, role)
			VALUES ($1, $2, 'member')
			ON CONFLICT (trip_id, user_id) DO UPDATE SET role = EXCLUDED.role
			RETURNING id, created_at
		`, tripID, targetUser.ID).Scan(&memberID, &createdAt)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusCreated, map[string]interface{}{
			"data": collaboratorResponse{
				ID:        memberID,
				TripID:    tripID,
				UserID:    targetUser.ID,
				Role:      "member",
				Name:      targetUser.Name,
				Email:     targetUser.Email,
				AvatarURL: targetUser.AvatarURL,
				CreatedAt: createdAt,
			},
		})
	}
}

func RemoveTripMember(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		currentUserID := auth.UserIDFromContext(r.Context())
		role := auth.RoleFromContext(r.Context())
		tripID := r.PathValue("id")
		targetUserID := r.PathValue("userID")

		_, isOwner, err := canAccessTrip(db, tripID, currentUserID, role)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		// A user can also remove themselves from a trip
		if !isOwner && currentUserID != targetUserID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "tidak memiliki akses untuk menghapus kolaborator"})
			return
		}

		result, err := db.Exec("DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2", tripID, targetUserID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		rows, _ := result.RowsAffected()
		if rows == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "kolaborator tidak ditemukan"})
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
