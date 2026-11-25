package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/lib/pq"
	"github.com/maulana/perjadin-personal/internal/model"
)

func ListSBM(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		var rows *sql.Rows
		var err error

		if q != "" {
			rows, err = db.Query(`
				SELECT id, provinsi, ibukota, kota, uang_harian, created_at, updated_at
				FROM sbm_rates
				WHERE provinsi ILIKE '%' || $1 || '%' 
				   OR ibukota ILIKE '%' || $1 || '%'
				   OR EXISTS (SELECT 1 FROM unnest(kota) k WHERE k ILIKE '%' || $1 || '%')
				ORDER BY provinsi ASC
			`, q)
		} else {
			rows, err = db.Query(`
				SELECT id, provinsi, ibukota, kota, uang_harian, created_at, updated_at
				FROM sbm_rates
				ORDER BY provinsi ASC
			`)
		}

		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		var list []model.SBMRate
		for rows.Next() {
			var item model.SBMRate
			if err := rows.Scan(&item.ID, &item.Provinsi, &item.Ibukota, pq.Array(&item.Kota), &item.UangHarian, &item.CreatedAt, &item.UpdatedAt); err != nil {
				continue
			}
			if item.Kota == nil {
				item.Kota = []string{}
			}
			list = append(list, item)
		}
		if list == nil {
			list = []model.SBMRate{}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": list})
	}
}

func CreateSBM(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			Provinsi   string   `json:"provinsi"`
			Ibukota    string   `json:"ibukota"`
			Kota       []string `json:"kota"`
			UangHarian int64    `json:"uang_harian"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
			return
		}
		input.Provinsi = strings.TrimSpace(input.Provinsi)
		if input.Provinsi == "" || input.UangHarian <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "provinsi dan uang_harian > 0 required"})
			return
		}

		cleanKota := []string{}
		for _, k := range input.Kota {
			k = strings.TrimSpace(k)
			if k != "" {
				cleanKota = append(cleanKota, k)
			}
		}
		input.Kota = cleanKota

		if len(input.Kota) == 0 && strings.TrimSpace(input.Ibukota) != "" {
			input.Kota = []string{strings.TrimSpace(input.Ibukota)}
		} else if strings.TrimSpace(input.Ibukota) == "" && len(input.Kota) > 0 {
			input.Ibukota = input.Kota[0]
		}

		var item model.SBMRate
		err := db.QueryRow(`
			INSERT INTO sbm_rates (provinsi, ibukota, kota, uang_harian)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (LOWER(provinsi)) DO UPDATE
			SET ibukota = CASE WHEN EXCLUDED.ibukota <> '' THEN EXCLUDED.ibukota ELSE sbm_rates.ibukota END,
			    kota = CASE WHEN cardinality(EXCLUDED.kota) > 0 THEN EXCLUDED.kota ELSE sbm_rates.kota END,
			    uang_harian = EXCLUDED.uang_harian,
			    updated_at = now()
			RETURNING id, provinsi, ibukota, kota, uang_harian, created_at, updated_at
		`, input.Provinsi, strings.TrimSpace(input.Ibukota), pq.Array(input.Kota), input.UangHarian).
			Scan(&item.ID, &item.Provinsi, &item.Ibukota, pq.Array(&item.Kota), &item.UangHarian, &item.CreatedAt, &item.UpdatedAt)

		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if item.Kota == nil {
			item.Kota = []string{}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": item})
	}
}

func UpdateSBM(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var input struct {
			Provinsi   *string   `json:"provinsi"`
			Ibukota    *string   `json:"ibukota"`
			Kota       *[]string `json:"kota"`
			UangHarian *int64    `json:"uang_harian"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
			return
		}

		var item model.SBMRate
		err := db.QueryRow(`SELECT id, provinsi, ibukota, kota, uang_harian, created_at, updated_at FROM sbm_rates WHERE id = $1`, id).
			Scan(&item.ID, &item.Provinsi, &item.Ibukota, pq.Array(&item.Kota), &item.UangHarian, &item.CreatedAt, &item.UpdatedAt)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}

		if input.Provinsi != nil && strings.TrimSpace(*input.Provinsi) != "" {
			item.Provinsi = strings.TrimSpace(*input.Provinsi)
		}
		if input.Ibukota != nil {
			item.Ibukota = strings.TrimSpace(*input.Ibukota)
		}
		if input.Kota != nil {
			cleanKota := []string{}
			for _, k := range *input.Kota {
				k = strings.TrimSpace(k)
				if k != "" {
					cleanKota = append(cleanKota, k)
				}
			}
			item.Kota = cleanKota
			if item.Ibukota == "" && len(cleanKota) > 0 {
				item.Ibukota = cleanKota[0]
			}
		}
		if input.UangHarian != nil && *input.UangHarian > 0 {
			item.UangHarian = *input.UangHarian
		}

		_, err = db.Exec(`
			UPDATE sbm_rates SET provinsi = $1, ibukota = $2, kota = $3, uang_harian = $4, updated_at = now()
			WHERE id = $5
		`, item.Provinsi, item.Ibukota, pq.Array(item.Kota), item.UangHarian, id)
		if err != nil {
			writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
			return
		}

		if item.Kota == nil {
			item.Kota = []string{}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": item})
	}
}

func DeleteSBM(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		result, err := db.Exec("DELETE FROM sbm_rates WHERE id = $1", id)
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
