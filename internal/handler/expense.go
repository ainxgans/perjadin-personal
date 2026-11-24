package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/maulana/perjadin-personal/internal/auth"
)

type expenseResponse struct {
	ID                string    `json:"id"`
	TripID            string    `json:"trip_id"`
	CategoryID        string    `json:"category_id"`
	CategoryNama      string    `json:"category_nama"`
	PaymentMethodID   string    `json:"payment_method_id"`
	PaymentMethodNama string    `json:"payment_method_nama"`
	Deskripsi         string    `json:"deskripsi"`
	Jumlah            int64     `json:"jumlah"`
	Tanggal           string    `json:"tanggal"`
	CreatedAt         time.Time `json:"created_at"`
}

func ListExpenses(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		tripID := r.PathValue("tripID")

		// Verify trip ownership
		var exists bool
		db.QueryRow("SELECT EXISTS(SELECT 1 FROM trips WHERE id = $1 AND user_id = $2)", tripID, userID).Scan(&exists)
		if !exists {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "trip not found"})
			return
		}

		rows, err := db.Query(`
			SELECT e.id, e.trip_id, e.category_id, c.nama, e.payment_method_id, pm.nama,
				e.deskripsi, e.jumlah, e.tanggal, e.created_at
			FROM expenses e
			JOIN categories c ON e.category_id = c.id
			JOIN payment_methods pm ON e.payment_method_id = pm.id
			WHERE e.trip_id = $1
			ORDER BY e.tanggal DESC, e.created_at DESC
		`, tripID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		var expenses []expenseResponse
		for rows.Next() {
			var e expenseResponse
			var tanggal time.Time
			if err := rows.Scan(&e.ID, &e.TripID, &e.CategoryID, &e.CategoryNama,
				&e.PaymentMethodID, &e.PaymentMethodNama, &e.Deskripsi, &e.Jumlah,
				&tanggal, &e.CreatedAt); err != nil {
				continue
			}
			e.Tanggal = tanggal.Format("2006-01-02")
			expenses = append(expenses, e)
		}
		if expenses == nil {
			expenses = []expenseResponse{}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": expenses})
	}
}

func CreateExpense(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		tripID := r.PathValue("tripID")

		// Verify trip ownership
		var exists bool
		db.QueryRow("SELECT EXISTS(SELECT 1 FROM trips WHERE id = $1 AND user_id = $2)", tripID, userID).Scan(&exists)
		if !exists {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "trip not found"})
			return
		}

		var input struct {
			CategoryID      string `json:"category_id"`
			PaymentMethodID string `json:"payment_method_id"`
			Deskripsi       string `json:"deskripsi"`
			Jumlah          int64  `json:"jumlah"`
			Tanggal         string `json:"tanggal"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
			return
		}

		if input.Jumlah <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "jumlah must be > 0"})
			return
		}
		if input.CategoryID == "" || input.PaymentMethodID == "" || input.Tanggal == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "category_id, payment_method_id, tanggal required"})
			return
		}

		tanggal, err := time.Parse("2006-01-02", input.Tanggal)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid tanggal format"})
			return
		}

		// Verify category exists
		db.QueryRow("SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1)", input.CategoryID).Scan(&exists)
		if !exists {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid category_id"})
			return
		}

		// Verify payment method exists
		db.QueryRow("SELECT EXISTS(SELECT 1 FROM payment_methods WHERE id = $1)", input.PaymentMethodID).Scan(&exists)
		if !exists {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payment_method_id"})
			return
		}

		var e expenseResponse
		var catNama, pmNama string
		var tgl time.Time
		err = db.QueryRow(`
			INSERT INTO expenses (trip_id, category_id, payment_method_id, deskripsi, jumlah, tanggal)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id, trip_id, category_id, payment_method_id, deskripsi, jumlah, tanggal, created_at
		`, tripID, input.CategoryID, input.PaymentMethodID, input.Deskripsi, input.Jumlah, tanggal).
			Scan(&e.ID, &e.TripID, &e.CategoryID, &e.PaymentMethodID, &e.Deskripsi, &e.Jumlah, &tgl, &e.CreatedAt)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		e.Tanggal = tgl.Format("2006-01-02")

		db.QueryRow("SELECT nama FROM categories WHERE id = $1", e.CategoryID).Scan(&catNama)
		db.QueryRow("SELECT nama FROM payment_methods WHERE id = $1", e.PaymentMethodID).Scan(&pmNama)
		e.CategoryNama = catNama
		e.PaymentMethodNama = pmNama

		writeJSON(w, http.StatusCreated, map[string]interface{}{"data": e})
	}
}

func UpdateExpense(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		id := r.PathValue("id")

		// Verify expense ownership through trip
		var tripID string
		err := db.QueryRow(`
			SELECT e.trip_id FROM expenses e
			JOIN trips t ON e.trip_id = t.id
			WHERE e.id = $1 AND t.user_id = $2
		`, id, userID).Scan(&tripID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}

		var input struct {
			CategoryID      *string `json:"category_id"`
			PaymentMethodID *string `json:"payment_method_id"`
			Deskripsi       *string `json:"deskripsi"`
			Jumlah          *int64  `json:"jumlah"`
			Tanggal         *string `json:"tanggal"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
			return
		}

		if input.Jumlah != nil && *input.Jumlah <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "jumlah must be > 0"})
			return
		}

		// Build update
		var exists bool
		if input.CategoryID != nil {
			db.QueryRow("SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1)", *input.CategoryID).Scan(&exists)
			if !exists {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid category_id"})
				return
			}
		}
		if input.PaymentMethodID != nil {
			db.QueryRow("SELECT EXISTS(SELECT 1 FROM payment_methods WHERE id = $1)", *input.PaymentMethodID).Scan(&exists)
			if !exists {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payment_method_id"})
				return
			}
		}

		// Get current values
		var catID, pmID, deskripsi string
		var jumlah int64
		var tanggal time.Time
		db.QueryRow("SELECT category_id, payment_method_id, deskripsi, jumlah, tanggal FROM expenses WHERE id = $1", id).
			Scan(&catID, &pmID, &deskripsi, &jumlah, &tanggal)

		if input.CategoryID != nil {
			catID = *input.CategoryID
		}
		if input.PaymentMethodID != nil {
			pmID = *input.PaymentMethodID
		}
		if input.Deskripsi != nil {
			deskripsi = *input.Deskripsi
		}
		if input.Jumlah != nil {
			jumlah = *input.Jumlah
		}
		if input.Tanggal != nil {
			t, err := time.Parse("2006-01-02", *input.Tanggal)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid tanggal"})
				return
			}
			tanggal = t
		}

		db.Exec(`UPDATE expenses SET category_id=$1, payment_method_id=$2, deskripsi=$3, jumlah=$4, tanggal=$5 WHERE id=$6`,
			catID, pmID, deskripsi, jumlah, tanggal, id)

		// Return updated
		var e expenseResponse
		var tgl time.Time
		db.QueryRow(`
			SELECT e.id, e.trip_id, e.category_id, c.nama, e.payment_method_id, pm.nama,
				e.deskripsi, e.jumlah, e.tanggal, e.created_at
			FROM expenses e
			JOIN categories c ON e.category_id = c.id
			JOIN payment_methods pm ON e.payment_method_id = pm.id
			WHERE e.id = $1
		`, id).Scan(&e.ID, &e.TripID, &e.CategoryID, &e.CategoryNama,
			&e.PaymentMethodID, &e.PaymentMethodNama, &e.Deskripsi, &e.Jumlah,
			&tgl, &e.CreatedAt)
		e.Tanggal = tgl.Format("2006-01-02")
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": e})
	}
}

func DeleteExpense(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		id := r.PathValue("id")

		result, err := db.Exec(`
			DELETE FROM expenses WHERE id = $1
			AND trip_id IN (SELECT id FROM trips WHERE user_id = $2)
		`, id, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		rows, _ := result.RowsAffected()
		if rows == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
