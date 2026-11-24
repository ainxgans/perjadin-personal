package handler

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/maulana/perjadin-personal/internal/auth"
)

type userSearchResponse struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
	Role      string `json:"role"`
}

func SearchUsers(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		currentUserID := auth.UserIDFromContext(r.Context())
		q := strings.TrimSpace(r.URL.Query().Get("q"))

		var rows *sql.Rows
		var err error

		if q != "" {
			rows, err = db.Query(`
				SELECT id, email, name, COALESCE(avatar_url, ''), role
				FROM users
				WHERE id != $1 AND (name ILIKE '%' || $2 || '%' OR email ILIKE '%' || $2 || '%')
				ORDER BY name ASC
				LIMIT 20
			`, currentUserID, q)
		} else {
			rows, err = db.Query(`
				SELECT id, email, name, COALESCE(avatar_url, ''), role
				FROM users
				WHERE id != $1
				ORDER BY name ASC
				LIMIT 20
			`, currentUserID)
		}

		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		var users []userSearchResponse
		for rows.Next() {
			var u userSearchResponse
			if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.Role); err != nil {
				continue
			}
			users = append(users, u)
		}
		if users == nil {
			users = []userSearchResponse{}
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{"data": users})
	}
}
