package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

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
	mux.HandleFunc("GET /auth/dev-login", auth.DevLoginHandler(cfg, database))
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

	// Admin — User Management & Stats
	mux.Handle("GET /api/admin/users", authMW(adminMW(http.HandlerFunc(handler.ListAdminUsers(database)))))
	mux.Handle("POST /api/admin/users", authMW(adminMW(http.HandlerFunc(handler.CreateAdminUser(database)))))
	mux.Handle("PUT /api/admin/users/{id}/role", authMW(adminMW(http.HandlerFunc(handler.UpdateUserRole(database)))))
	mux.Handle("GET /api/admin/stats", authMW(adminMW(http.HandlerFunc(handler.GetAdminStats(database)))))

	// User read — Master Data
	mux.Handle("GET /api/categories", authMW(http.HandlerFunc(handler.ListCategories(database))))
	mux.Handle("GET /api/payment-methods", authMW(http.HandlerFunc(handler.ListPaymentMethods(database))))
	mux.Handle("GET /api/sbm", authMW(http.HandlerFunc(handler.ListSBM(database))))

	// Admin — SBM Rates
	mux.Handle("POST /api/admin/sbm", authMW(adminMW(http.HandlerFunc(handler.CreateSBM(database)))))
	mux.Handle("PUT /api/admin/sbm/{id}", authMW(adminMW(http.HandlerFunc(handler.UpdateSBM(database)))))
	mux.Handle("DELETE /api/admin/sbm/{id}", authMW(adminMW(http.HandlerFunc(handler.DeleteSBM(database)))))

	// User search (for trip collaborators picker)
	mux.Handle("GET /api/users", authMW(http.HandlerFunc(handler.SearchUsers(database))))

	// Trips
	mux.Handle("GET /api/trips", authMW(http.HandlerFunc(handler.ListTrips(database))))
	mux.Handle("POST /api/trips", authMW(http.HandlerFunc(handler.CreateTrip(database))))
	mux.Handle("GET /api/trips/{id}", authMW(http.HandlerFunc(handler.GetTrip(database))))
	mux.Handle("PUT /api/trips/{id}", authMW(http.HandlerFunc(handler.UpdateTrip(database))))
	mux.Handle("DELETE /api/trips/{id}", authMW(http.HandlerFunc(handler.DeleteTrip(database))))

	// Trip Collaborators
	mux.Handle("GET /api/trips/{id}/members", authMW(http.HandlerFunc(handler.ListTripMembers(database))))
	mux.Handle("POST /api/trips/{id}/members", authMW(http.HandlerFunc(handler.AddTripMember(database))))
	mux.Handle("DELETE /api/trips/{id}/members/{userID}", authMW(http.HandlerFunc(handler.RemoveTripMember(database))))

	// Dashboard & Analytics
	mux.Handle("GET /api/dashboard", authMW(http.HandlerFunc(handler.GetDashboard(database))))
	mux.Handle("GET /api/analytics", authMW(http.HandlerFunc(handler.GetAnalytics(database))))

	// Expenses
	mux.Handle("GET /api/trips/{tripID}/expenses", authMW(http.HandlerFunc(handler.ListExpenses(database))))
	mux.Handle("POST /api/trips/{tripID}/expenses", authMW(http.HandlerFunc(handler.CreateExpense(database))))
	mux.Handle("PUT /api/expenses/{id}", authMW(http.HandlerFunc(handler.UpdateExpense(database))))
	mux.Handle("DELETE /api/expenses/{id}", authMW(http.HandlerFunc(handler.DeleteExpense(database))))

	// Serve static frontend (with SPA fallback)
	distDir := "web/dist"
	if _, err := os.Stat(distDir); err == nil {
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			// Don't intercept API/auth routes
			if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/auth/") {
				http.NotFound(w, r)
				return
			}
			path := filepath.Join(distDir, r.URL.Path)
			if fi, err := os.Stat(path); err == nil && !fi.IsDir() {
				http.ServeFile(w, r, path)
				return
			}
			// SPA fallback
			http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
		})
	}

	log.Printf("server starting on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Fatalf("server: %v", err)
	}
}
