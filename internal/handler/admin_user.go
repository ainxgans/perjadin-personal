package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/maulana/perjadin-personal/internal/auth"
)

type AdminUser struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	AvatarURL string    `json:"avatar_url"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	TripCount int       `json:"trip_count"`
}

type AdminStats struct {
	TotalUsers     int   `json:"total_users"`
	TotalTrips     int   `json:"total_trips"`
	TotalExpenses  int64 `json:"total_expenses_rp"`
	TotalUangDinas int64 `json:"total_uang_dinas_rp"`
}

func ListAdminUsers(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query(`
			SELECT u.id, u.email, u.name, COALESCE(u.avatar_url, ''), u.role, u.created_at,
			       COUNT(t.id) as trip_count
			FROM users u
			LEFT JOIN trips t ON t.user_id = u.id
			GROUP BY u.id
			ORDER BY u.created_at ASC
		`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
			return
		}
		defer rows.Close()

		users := []AdminUser{}
		for rows.Next() {
			var u AdminUser
			if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.Role, &u.CreatedAt, &u.TripCount); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "scan error"})
				return
			}
			users = append(users, u)
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{"data": users})
	}
}

func UpdateUserRole(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		targetID := r.PathValue("id")
		currentUserID := auth.UserIDFromContext(r.Context())

		var req struct {
			Role string `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}

		if req.Role != "admin" && req.Role != "user" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "role must be 'admin' or 'user'"})
			return
		}

		// Prevent sole admin demotion
		if req.Role == "user" {
			var adminCount int
			err := db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'").Scan(&adminCount)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
				return
			}

			// If target is an admin and only 1 admin exists
			var targetRole string
			err = db.QueryRow("SELECT role FROM users WHERE id = $1", targetID).Scan(&targetRole)
			if err != nil {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
				return
			}

			if targetRole == "admin" && adminCount <= 1 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot demote the sole admin"})
				return
			}

			// Also prevent self demotion if user is changing own role to user
			if targetID == currentUserID && adminCount <= 1 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot demote yourself as sole admin"})
				return
			}
		}

		res, err := db.Exec("UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2", req.Role, targetID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"data": map[string]string{"id": targetID, "role": req.Role},
		})
	}
}

func GetAdminStats(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var stats AdminStats

		_ = db.QueryRow("SELECT COUNT(*) FROM users").Scan(&stats.TotalUsers)
		_ = db.QueryRow("SELECT COUNT(*) FROM trips").Scan(&stats.TotalTrips)
		_ = db.QueryRow("SELECT COALESCE(SUM(jumlah), 0) FROM expenses").Scan(&stats.TotalExpenses)
		_ = db.QueryRow("SELECT COALESCE(SUM(uang_dinas), 0) FROM trips WHERE uang_dinas IS NOT NULL").Scan(&stats.TotalUangDinas)

		writeJSON(w, http.StatusOK, map[string]interface{}{"data": stats})
	}
}
