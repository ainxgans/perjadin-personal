package auth

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/maulana/perjadin-personal/internal/config"
)

const (
	googleAuthURL    = "https://accounts.google.com/o/oauth2/v2/auth"
	googleTokenURL   = "https://oauth2.googleapis.com/token"
	googleUserURL    = "https://www.googleapis.com/oauth2/v2/userinfo"
	cookieName       = "token"
	tokenExpiry      = 72 * time.Hour
)

func GoogleLoginHandler(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, _ := url.Parse(googleAuthURL)
		q := u.Query()
		q.Set("client_id", cfg.GoogleClientID)
		q.Set("redirect_uri", cfg.GoogleRedirectURL)
		q.Set("response_type", "code")
		q.Set("scope", "email profile")
		q.Set("access_type", "offline")
		u.RawQuery = q.Encode()
		http.Redirect(w, r, u.String(), http.StatusTemporaryRedirect)
	}
}

type googleUserInfo struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

func GoogleCallbackHandler(cfg config.Config, db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, `{"error":"missing code"}`, http.StatusBadRequest)
			return
		}

		// Exchange code for token
		resp, err := http.PostForm(googleTokenURL, url.Values{
			"code":          {code},
			"client_id":     {cfg.GoogleClientID},
			"client_secret": {cfg.GoogleClientSecret},
			"redirect_uri":  {cfg.GoogleRedirectURL},
			"grant_type":    {"authorization_code"},
		})
		if err != nil {
			http.Error(w, `{"error":"token exchange failed"}`, http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		var tokenResp struct {
			AccessToken string `json:"access_token"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil || tokenResp.AccessToken == "" {
			http.Error(w, `{"error":"invalid token response"}`, http.StatusInternalServerError)
			return
		}

		// Fetch user info
		userInfo, err := fetchGoogleUser(tokenResp.AccessToken)
		if err != nil {
			http.Error(w, `{"error":"failed to fetch user info"}`, http.StatusInternalServerError)
			return
		}

		// Upsert user, first user = admin
		var userID, role string
		err = db.QueryRow(`
			INSERT INTO users (google_id, email, name, avatar_url, role)
			VALUES ($1, $2, $3, $4,
				CASE WHEN (SELECT count(*) FROM users) = 0 THEN 'admin' ELSE 'user' END
			)
			ON CONFLICT (google_id) DO UPDATE SET
				email = EXCLUDED.email,
				name = EXCLUDED.name,
				avatar_url = EXCLUDED.avatar_url
			RETURNING id, role
		`, userInfo.ID, userInfo.Email, userInfo.Name, userInfo.Picture).Scan(&userID, &role)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"db upsert: %v"}`, err), http.StatusInternalServerError)
			return
		}

		// Create JWT
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

		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
	}
}

func MeHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := UserIDFromContext(r.Context())
		var user struct {
			ID        string `json:"id"`
			Email     string `json:"email"`
			Name      string `json:"name"`
			AvatarURL string `json:"avatar_url"`
			Role      string `json:"role"`
		}
		err := db.QueryRow(`SELECT id, email, name, avatar_url, role FROM users WHERE id = $1`, userID).
			Scan(&user.ID, &user.Email, &user.Name, &user.AvatarURL, &user.Role)
		if err != nil {
			http.Error(w, `{"error":"user not found"}`, http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"data": user})
	}
}

func LogoutHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.SetCookie(w, &http.Cookie{
			Name:     cookieName,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			MaxAge:   -1,
		})
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

func fetchGoogleUser(accessToken string) (*googleUserInfo, error) {
	req, _ := http.NewRequest("GET", googleUserURL, nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var info googleUserInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, err
	}
	return &info, nil
}
