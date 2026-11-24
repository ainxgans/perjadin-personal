package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/maulana/perjadin-personal/internal/auth"
	"github.com/maulana/perjadin-personal/internal/config"
	"github.com/maulana/perjadin-personal/internal/db"
)

func main() {
	cfg := config.Load()

	database, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer database.Close()

	if err := db.Migrate(database, "internal/db/migrations"); err != nil {
		log.Fatalf("db migrate: %v", err)
	}

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// Auth routes
	mux.HandleFunc("GET /auth/google", auth.GoogleLoginHandler(cfg))
	mux.HandleFunc("GET /auth/google/callback", auth.GoogleCallbackHandler(cfg, database))
	mux.Handle("GET /auth/me", auth.AuthMiddleware(cfg.JWTSecret)(http.HandlerFunc(auth.MeHandler(database))))
	mux.HandleFunc("POST /auth/logout", auth.LogoutHandler())

	log.Printf("server starting on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Fatalf("server: %v", err)
	}
}
