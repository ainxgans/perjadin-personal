package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

func ListPaymentMethods(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query("SELECT id, nama, created_at FROM payment_methods ORDER BY nama")
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		var pms []map[string]interface{}
		for rows.Next() {
			var id, nama string
			var createdAt sql.NullTime
			if err := rows.Scan(&id, &nama, &createdAt); err != nil {
				continue
			}
			pms = append(pms, map[string]interface{}{"id": id, "nama": nama, "created_at": createdAt.Time})
		}
		if pms == nil {
			pms = []map[string]interface{}{}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": pms})
	}
}

func CreatePaymentMethod(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			Nama string `json:"nama"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Nama == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nama is required"})
			return
		}

		var id string
		var createdAt sql.NullTime
		err := db.QueryRow("INSERT INTO payment_methods (nama) VALUES ($1) RETURNING id, created_at", input.Nama).
			Scan(&id, &createdAt)
		if err != nil {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "payment method already exists"})
			return
		}
		writeJSON(w, http.StatusCreated, map[string]interface{}{
			"data": map[string]interface{}{"id": id, "nama": input.Nama, "created_at": createdAt.Time},
		})
	}
}

func UpdatePaymentMethod(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var input struct {
			Nama string `json:"nama"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Nama == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nama is required"})
			return
		}

		result, err := db.Exec("UPDATE payment_methods SET nama = $1 WHERE id = $2", input.Nama, id)
		if err != nil {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "name conflict"})
			return
		}
		rows, _ := result.RowsAffected()
		if rows == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"data": map[string]interface{}{"id": id, "nama": input.Nama},
		})
	}
}

func DeletePaymentMethod(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		var count int
		db.QueryRow("SELECT COUNT(*) FROM expenses WHERE payment_method_id = $1", id).Scan(&count)
		if count > 0 {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "payment method is in use"})
			return
		}

		result, err := db.Exec("DELETE FROM payment_methods WHERE id = $1", id)
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
