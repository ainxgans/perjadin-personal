package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

func ListCategories(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := db.Query("SELECT id, nama, created_at FROM categories ORDER BY nama")
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		var cats []map[string]interface{}
		for rows.Next() {
			var id, nama string
			var createdAt sql.NullTime
			if err := rows.Scan(&id, &nama, &createdAt); err != nil {
				continue
			}
			cats = append(cats, map[string]interface{}{"id": id, "nama": nama, "created_at": createdAt.Time})
		}
		if cats == nil {
			cats = []map[string]interface{}{}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": cats})
	}
}

func CreateCategory(db *sql.DB) http.HandlerFunc {
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
		err := db.QueryRow("INSERT INTO categories (nama) VALUES ($1) RETURNING id, created_at", input.Nama).
			Scan(&id, &createdAt)
		if err != nil {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "category already exists"})
			return
		}
		writeJSON(w, http.StatusCreated, map[string]interface{}{
			"data": map[string]interface{}{"id": id, "nama": input.Nama, "created_at": createdAt.Time},
		})
	}
}

func UpdateCategory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var input struct {
			Nama string `json:"nama"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Nama == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nama is required"})
			return
		}

		result, err := db.Exec("UPDATE categories SET nama = $1 WHERE id = $2", input.Nama, id)
		if err != nil {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "category name conflict"})
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

func DeleteCategory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")

		// Check if in use
		var count int
		db.QueryRow("SELECT COUNT(*) FROM expenses WHERE category_id = $1", id).Scan(&count)
		if count > 0 {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "category is in use"})
			return
		}

		result, err := db.Exec("DELETE FROM categories WHERE id = $1", id)
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

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
