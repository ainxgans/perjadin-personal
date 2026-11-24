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
	UserID            *string   `json:"user_id,omitempty"`
	UserName          string    `json:"user_name,omitempty"`
	UserAvatar        string    `json:"user_avatar,omitempty"`
	CategoryID        string    `json:"category_id"`
	CategoryNama      string    `json:"category_nama"`
	PaymentMethodID   string    `json:"payment_method_id"`
	PaymentMethodNama string    `json:"payment_method_nama"`
	Deskripsi         string    `json:"deskripsi"`
	Jumlah            int64     `json:"jumlah"`
	Tanggal           string    `json:"tanggal"`
	CanEdit           bool      `json:"can_edit"`
	CreatedAt         time.Time `json:"created_at"`
}

func ListExpenses(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		role := auth.RoleFromContext(r.Context())
		tripID := r.PathValue("tripID")

		// Verify access: caller must be trip owner, collaborator, or admin
		canAccess, isOwner, err := canAccessTrip(db, tripID, userID, role)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !canAccess {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "trip not found"})
			return
		}

		rows, err := db.Query(`
			SELECT e.id, e.trip_id, e.user_id, COALESCE(u.name, ''), COALESCE(u.avatar_url, ''),
				e.category_id, c.nama, e.payment_method_id, pm.nama,
				e.deskripsi, e.jumlah, e.tanggal, e.created_at
			FROM expenses e
			JOIN categories c ON e.category_id = c.id
			JOIN payment_methods pm ON e.payment_method_id = pm.id
			LEFT JOIN users u ON e.user_id = u.id
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
			var authorID sql.NullString
			if err := rows.Scan(&e.ID, &e.TripID, &authorID, &e.UserName, &e.UserAvatar,
				&e.CategoryID, &e.CategoryNama, &e.PaymentMethodID, &e.PaymentMethodNama,
				&e.Deskripsi, &e.Jumlah, &tanggal, &e.CreatedAt); err != nil {
				continue
			}
			if authorID.Valid {
				e.UserID = &authorID.String
			}
			e.Tanggal = tanggal.Format("2006-01-02")
			// CanEdit: owner, admin, or expense author
			isAuthor := (authorID.Valid && authorID.String == userID) || (!authorID.Valid && isOwner)
			e.CanEdit = isOwner || isAuthor || (role == "admin")

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
		role := auth.RoleFromContext(r.Context())
		tripID := r.PathValue("tripID")

		// Verify access: caller must be trip owner, collaborator, or admin
		canAccess, _, err := canAccessTrip(db, tripID, userID, role)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !canAccess {
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

		var exists bool
		db.QueryRow("SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1)", input.CategoryID).Scan(&exists)
		if !exists {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid category_id"})
			return
		}

		db.QueryRow("SELECT EXISTS(SELECT 1 FROM payment_methods WHERE id = $1)", input.PaymentMethodID).Scan(&exists)
		if !exists {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payment_method_id"})
			return
		}

		var e expenseResponse
		var catNama, pmNama, userName, userAvatar string
		var tgl time.Time
		err = db.QueryRow(`
			INSERT INTO expenses (trip_id, user_id, category_id, payment_method_id, deskripsi, jumlah, tanggal)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING id, trip_id, user_id, category_id, payment_method_id, deskripsi, jumlah, tanggal, created_at
		`, tripID, userID, input.CategoryID, input.PaymentMethodID, input.Deskripsi, input.Jumlah, tanggal).
			Scan(&e.ID, &e.TripID, &e.UserID, &e.CategoryID, &e.PaymentMethodID, &e.Deskripsi, &e.Jumlah, &tgl, &e.CreatedAt)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		e.Tanggal = tgl.Format("2006-01-02")
		e.CanEdit = true

		db.QueryRow("SELECT nama FROM categories WHERE id = $1", e.CategoryID).Scan(&catNama)
		db.QueryRow("SELECT nama FROM payment_methods WHERE id = $1", e.PaymentMethodID).Scan(&pmNama)
		db.QueryRow("SELECT name, COALESCE(avatar_url, '') FROM users WHERE id = $1", userID).Scan(&userName, &userAvatar)
		e.CategoryNama = catNama
		e.PaymentMethodNama = pmNama
		e.UserName = userName
		e.UserAvatar = userAvatar

		writeJSON(w, http.StatusCreated, map[string]interface{}{"data": e})
	}
}

func UpdateExpense(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		role := auth.RoleFromContext(r.Context())
		id := r.PathValue("id")

		// Verify expense exists and caller has authority (author, trip owner, or admin)
		var tripID string
		var expenseUserID sql.NullString
		var tripOwnerID string
		err := db.QueryRow(`
			SELECT e.trip_id, e.user_id, t.user_id
			FROM expenses e
			JOIN trips t ON e.trip_id = t.id
			WHERE e.id = $1
		`, id).Scan(&tripID, &expenseUserID, &tripOwnerID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		canEdit := (tripOwnerID == userID) || (role == "admin") || (expenseUserID.Valid && expenseUserID.String == userID)
		if !canEdit {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "hanya pencatat pengeluaran, pemilik trip, atau admin yang dapat mengedit"})
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

		var e expenseResponse
		var tgl time.Time
		var authorID sql.NullString
		db.QueryRow(`
			SELECT e.id, e.trip_id, e.user_id, COALESCE(u.name, ''), COALESCE(u.avatar_url, ''),
				e.category_id, c.nama, e.payment_method_id, pm.nama,
				e.deskripsi, e.jumlah, e.tanggal, e.created_at
			FROM expenses e
			JOIN categories c ON e.category_id = c.id
			JOIN payment_methods pm ON e.payment_method_id = pm.id
			LEFT JOIN users u ON e.user_id = u.id
			WHERE e.id = $1
		`, id).Scan(&e.ID, &e.TripID, &authorID, &e.UserName, &e.UserAvatar,
			&e.CategoryID, &e.CategoryNama, &e.PaymentMethodID, &e.PaymentMethodNama,
			&e.Deskripsi, &e.Jumlah, &tgl, &e.CreatedAt)
		if authorID.Valid {
			e.UserID = &authorID.String
		}
		e.Tanggal = tgl.Format("2006-01-02")
		e.CanEdit = true

		writeJSON(w, http.StatusOK, map[string]interface{}{"data": e})
	}
}

func DeleteExpense(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		role := auth.RoleFromContext(r.Context())
		id := r.PathValue("id")

		var expenseUserID sql.NullString
		var tripOwnerID string
		err := db.QueryRow(`
			SELECT e.user_id, t.user_id
			FROM expenses e
			JOIN trips t ON e.trip_id = t.id
			WHERE e.id = $1
		`, id).Scan(&expenseUserID, &tripOwnerID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		canDelete := (tripOwnerID == userID) || (role == "admin") || (expenseUserID.Valid && expenseUserID.String == userID)
		if !canDelete {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "hanya pencatat pengeluaran, pemilik trip, atau admin yang dapat menghapus"})
			return
		}

		_, err = db.Exec("DELETE FROM expenses WHERE id = $1", id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
