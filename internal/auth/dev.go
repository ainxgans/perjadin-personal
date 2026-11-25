package auth

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/maulana/perjadin-personal/internal/config"
)

func DevLoginHandler(cfg config.Config, db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		role := r.URL.Query().Get("role")
		if role != "user" {
			role = "admin"
		}
		email := "admin@local.test"
		name := "Dev Admin"
		if role == "user" {
			email = "user@local.test"
			name = "Dev User"
		}

		var userID string
		err := db.QueryRow(`
			INSERT INTO users (google_id, email, name, avatar_url, role)
			VALUES ($1, $2, $3, '', $4)
			ON CONFLICT (google_id) DO UPDATE SET role = EXCLUDED.role, email = EXCLUDED.email
			RETURNING id
		`, "dev-"+role+"-id", email, name, role).Scan(&userID)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"db error: %v"}`, err), http.StatusInternalServerError)
			return
		}

		token, err := CreateToken(userID, role, cfg.JWTSecret, tokenExpiry)
		if err != nil {
			http.Error(w, `{"error":"token creation failed"}`, http.StatusInternalServerError)
			return
		}

		http.SetCookie(w, &http.Cookie{
			Name:     cookieName,
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   int(tokenExpiry.Seconds()),
		})

		redirect := r.URL.Query().Get("redirect")
		if redirect == "" {
			redirect = "/"
		}
		http.Redirect(w, r, redirect, http.StatusTemporaryRedirect)
	}
}
