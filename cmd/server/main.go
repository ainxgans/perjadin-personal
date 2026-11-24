package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/maulana/perjadin-personal/internal/auth"
	"github.com/maulana/perjadin-personal/internal/config"
	"github.com/maulana/perjadin-personal/internal/db"
	"github.com/maulana/perjadin-personal/internal/handler"
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
	authMW := auth.AuthMiddleware(cfg.JWTSecret)
	adminMW := auth.AdminMiddleware()

	// Health check
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// Auth routes
	mux.HandleFunc("GET /auth/google", auth.GoogleLoginHandler(cfg))
	mux.HandleFunc("GET /auth/google/callback", auth.GoogleCallbackHandler(cfg, database))
	mux.Handle("GET /auth/me", authMW(http.HandlerFunc(auth.MeHandler(database))))
	mux.HandleFunc("POST /auth/logout", auth.LogoutHandler())

	// Admin — Categories
	mux.Handle("POST /api/admin/categories", authMW(adminMW(http.HandlerFunc(handler.CreateCategory(database)))))
	mux.Handle("PUT /api/admin/categories/{id}", authMW(adminMW(http.HandlerFunc(handler.UpdateCategory(database)))))
	mux.Handle("DELETE /api/admin/categories/{id}", authMW(adminMW(http.HandlerFunc(handler.DeleteCategory(database)))))

	// Admin — Payment Methods
	mux.Handle("POST /api/admin/payment-methods", authMW(adminMW(http.HandlerFunc(handler.CreatePaymentMethod(database)))))
	mux.Handle("PUT /api/admin/payment-methods/{id}", authMW(adminMW(http.HandlerFunc(handler.UpdatePaymentMethod(database)))))
	mux.Handle("DELETE /api/admin/payment-methods/{id}", authMW(adminMW(http.HandlerFunc(handler.DeletePaymentMethod(database)))))

	// User read — Master Data
	mux.Handle("GET /api/categories", authMW(http.HandlerFunc(handler.ListCategories(database))))
	mux.Handle("GET /api/payment-methods", authMW(http.HandlerFunc(handler.ListPaymentMethods(database))))

	// Trips
	mux.Handle("GET /api/trips", authMW(http.HandlerFunc(handler.ListTrips(database))))
	mux.Handle("POST /api/trips", authMW(http.HandlerFunc(handler.CreateTrip(database))))
	mux.Handle("GET /api/trips/{id}", authMW(http.HandlerFunc(handler.GetTrip(database))))
	mux.Handle("PUT /api/trips/{id}", authMW(http.HandlerFunc(handler.UpdateTrip(database))))
	mux.Handle("DELETE /api/trips/{id}", authMW(http.HandlerFunc(handler.DeleteTrip(database))))

	// Dashboard
	mux.Handle("GET /api/dashboard", authMW(http.HandlerFunc(handler.GetDashboard(database))))

	log.Printf("server starting on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Fatalf("server: %v", err)
	}
}
