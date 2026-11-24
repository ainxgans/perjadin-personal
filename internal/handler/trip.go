package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/maulana/perjadin-personal/internal/auth"
	"github.com/maulana/perjadin-personal/internal/model"
)

type tripResponse struct {
	ID              string     `json:"id"`
	Nama            string     `json:"nama"`
	Tujuan          string     `json:"tujuan"`
	TanggalMulai    string     `json:"tanggal_mulai"`
	TanggalSelesai  string     `json:"tanggal_selesai"`
	UangDinas       *int64     `json:"uang_dinas"`
	NominalMonita   *int64     `json:"nominal_monita"`
	TanggalDibayar  *string    `json:"tanggal_dibayar"`
	Catatan         string     `json:"catatan"`
	LinkMonita      string     `json:"link_monita"`
	Status          string     `json:"status"`
	TotalPengeluaran int64     `json:"total_pengeluaran"`
	Saldo           int64      `json:"saldo"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func tripToResponse(t model.Trip, totalExpense int64) tripResponse {
	var dibayarStr *string
	if t.TanggalDibayar != nil {
		s := t.TanggalDibayar.Format("2006-01-02")
		dibayarStr = &s
	}
	var uangDinas int64
	if t.UangDinas != nil {
		uangDinas = *t.UangDinas
	}
	return tripResponse{
		ID:              t.ID,
		Nama:            t.Nama,
		Tujuan:          t.Tujuan,
		TanggalMulai:    t.TanggalMulai.Format("2006-01-02"),
		TanggalSelesai:  t.TanggalSelesai.Format("2006-01-02"),
		UangDinas:       t.UangDinas,
		NominalMonita:   t.NominalMonita,
		TanggalDibayar:  dibayarStr,
		Catatan:         t.Catatan,
		LinkMonita:      t.LinkMonita,
		Status:          t.Status(),
		TotalPengeluaran: totalExpense,
		Saldo:           uangDinas - totalExpense,
		CreatedAt:       t.CreatedAt,
		UpdatedAt:       t.UpdatedAt,
	}
}

func ListTrips(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		rows, err := db.Query(`
			SELECT t.id, t.nama, t.tujuan, t.tanggal_mulai, t.tanggal_selesai,
				t.uang_dinas, t.nominal_monita, t.tanggal_dibayar, COALESCE(t.catatan, ''), COALESCE(t.link_monita, ''),
				t.created_at, t.updated_at,
				COALESCE(SUM(e.jumlah), 0) as total_expense
			FROM trips t
			LEFT JOIN expenses e ON e.trip_id = t.id
			WHERE t.user_id = $1
			GROUP BY t.id
			ORDER BY t.tanggal_mulai DESC
		`, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		var trips []tripResponse
		for rows.Next() {
			var t model.Trip
			var totalExpense int64
			if err := rows.Scan(&t.ID, &t.Nama, &t.Tujuan, &t.TanggalMulai, &t.TanggalSelesai,
				&t.UangDinas, &t.NominalMonita, &t.TanggalDibayar, &t.Catatan, &t.LinkMonita,
				&t.CreatedAt, &t.UpdatedAt, &totalExpense); err != nil {
				continue
			}
			trips = append(trips, tripToResponse(t, totalExpense))
		}
		if trips == nil {
			trips = []tripResponse{}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": trips})
	}
}

func CreateTrip(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		var input struct {
			Nama           string  `json:"nama"`
			Tujuan         string  `json:"tujuan"`
			TanggalMulai   string  `json:"tanggal_mulai"`
			TanggalSelesai string  `json:"tanggal_selesai"`
			UangDinas      *int64  `json:"uang_dinas"`
			NominalMonita  *int64  `json:"nominal_monita"`
			TanggalDibayar *string `json:"tanggal_dibayar"`
			Catatan        string  `json:"catatan"`
			LinkMonita     string  `json:"link_monita"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
			return
		}
		if input.Nama == "" || input.Tujuan == "" || input.TanggalMulai == "" || input.TanggalSelesai == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "nama, tujuan, tanggal_mulai, tanggal_selesai required"})
			return
		}

		mulai, err1 := time.Parse("2006-01-02", input.TanggalMulai)
		selesai, err2 := time.Parse("2006-01-02", input.TanggalSelesai)
		if err1 != nil || err2 != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid date format, use YYYY-MM-DD"})
			return
		}
		if selesai.Before(mulai) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "tanggal_selesai must be >= tanggal_mulai"})
			return
		}

		var dibayar *time.Time
		if input.TanggalDibayar != nil {
			t, err := time.Parse("2006-01-02", *input.TanggalDibayar)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid tanggal_dibayar format"})
				return
			}
			dibayar = &t
		}

		var trip model.Trip
		err := db.QueryRow(`
			INSERT INTO trips (user_id, nama, tujuan, tanggal_mulai, tanggal_selesai, uang_dinas, nominal_monita, tanggal_dibayar, catatan, link_monita)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			RETURNING id, user_id, nama, tujuan, tanggal_mulai, tanggal_selesai, uang_dinas, nominal_monita, tanggal_dibayar, catatan, link_monita, created_at, updated_at
		`, userID, input.Nama, input.Tujuan, mulai, selesai, input.UangDinas, input.NominalMonita, dibayar, input.Catatan, input.LinkMonita).
			Scan(&trip.ID, &trip.UserID, &trip.Nama, &trip.Tujuan, &trip.TanggalMulai, &trip.TanggalSelesai,
				&trip.UangDinas, &trip.NominalMonita, &trip.TanggalDibayar, &trip.Catatan, &trip.LinkMonita, &trip.CreatedAt, &trip.UpdatedAt)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, map[string]interface{}{"data": tripToResponse(trip, 0)})
	}
}

func GetTrip(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		id := r.PathValue("id")

		var trip model.Trip
		var totalExpense int64
		err := db.QueryRow(`
			SELECT t.id, t.nama, t.tujuan, t.tanggal_mulai, t.tanggal_selesai,
				t.uang_dinas, t.nominal_monita, t.tanggal_dibayar, COALESCE(t.catatan, ''), COALESCE(t.link_monita, ''),
				t.created_at, t.updated_at,
				COALESCE(SUM(e.jumlah), 0)
			FROM trips t
			LEFT JOIN expenses e ON e.trip_id = t.id
			WHERE t.id = $1 AND t.user_id = $2
			GROUP BY t.id
		`, id, userID).Scan(&trip.ID, &trip.Nama, &trip.Tujuan, &trip.TanggalMulai, &trip.TanggalSelesai,
			&trip.UangDinas, &trip.NominalMonita, &trip.TanggalDibayar, &trip.Catatan, &trip.LinkMonita,
			&trip.CreatedAt, &trip.UpdatedAt, &totalExpense)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": tripToResponse(trip, totalExpense)})
	}
}

func UpdateTrip(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		id := r.PathValue("id")

		var input struct {
			Nama           *string `json:"nama"`
			Tujuan         *string `json:"tujuan"`
			TanggalMulai   *string `json:"tanggal_mulai"`
			TanggalSelesai *string `json:"tanggal_selesai"`
			UangDinas      *int64  `json:"uang_dinas"`
			NominalMonita  *int64  `json:"nominal_monita"`
			TanggalDibayar *string `json:"tanggal_dibayar"`
			Catatan        *string `json:"catatan"`
			LinkMonita     *string `json:"link_monita"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
			return
		}

		// Get current trip
		var trip model.Trip
		err := db.QueryRow(`SELECT id, nama, tujuan, tanggal_mulai, tanggal_selesai, uang_dinas, nominal_monita, tanggal_dibayar, COALESCE(catatan, ''), COALESCE(link_monita, ''), created_at, updated_at
			FROM trips WHERE id = $1 AND user_id = $2`, id, userID).
			Scan(&trip.ID, &trip.Nama, &trip.Tujuan, &trip.TanggalMulai, &trip.TanggalSelesai,
				&trip.UangDinas, &trip.NominalMonita, &trip.TanggalDibayar, &trip.Catatan, &trip.LinkMonita, &trip.CreatedAt, &trip.UpdatedAt)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}

		if input.Nama != nil {
			trip.Nama = *input.Nama
		}
		if input.Tujuan != nil {
			trip.Tujuan = *input.Tujuan
		}
		if input.TanggalMulai != nil {
			t, err := time.Parse("2006-01-02", *input.TanggalMulai)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid tanggal_mulai"})
				return
			}
			trip.TanggalMulai = t
		}
		if input.TanggalSelesai != nil {
			t, err := time.Parse("2006-01-02", *input.TanggalSelesai)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid tanggal_selesai"})
				return
			}
			trip.TanggalSelesai = t
		}
		if trip.TanggalSelesai.Before(trip.TanggalMulai) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "tanggal_selesai must be >= tanggal_mulai"})
			return
		}
		if input.UangDinas != nil {
			trip.UangDinas = input.UangDinas
		}
		if input.NominalMonita != nil {
			trip.NominalMonita = input.NominalMonita
		}
		if input.TanggalDibayar != nil {
			t, err := time.Parse("2006-01-02", *input.TanggalDibayar)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid tanggal_dibayar"})
				return
			}
			trip.TanggalDibayar = &t
		}
		if input.Catatan != nil {
			trip.Catatan = *input.Catatan
		}
		if input.LinkMonita != nil {
			trip.LinkMonita = *input.LinkMonita
		}

		_, err = db.Exec(`
			UPDATE trips SET nama=$1, tujuan=$2, tanggal_mulai=$3, tanggal_selesai=$4,
				uang_dinas=$5, nominal_monita=$6, tanggal_dibayar=$7, catatan=$8, link_monita=$9, updated_at=now()
			WHERE id=$10 AND user_id=$11
		`, trip.Nama, trip.Tujuan, trip.TanggalMulai, trip.TanggalSelesai,
			trip.UangDinas, trip.NominalMonita, trip.TanggalDibayar, trip.Catatan, trip.LinkMonita, id, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		// Re-fetch with totals
		var totalExpense int64
		db.QueryRow("SELECT COALESCE(SUM(jumlah), 0) FROM expenses WHERE trip_id = $1", id).Scan(&totalExpense)
		db.QueryRow("SELECT updated_at FROM trips WHERE id = $1", id).Scan(&trip.UpdatedAt)
		writeJSON(w, http.StatusOK, map[string]interface{}{"data": tripToResponse(trip, totalExpense)})
	}
}

func DeleteTrip(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())
		id := r.PathValue("id")

		result, err := db.Exec("DELETE FROM trips WHERE id = $1 AND user_id = $2", id, userID)
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
