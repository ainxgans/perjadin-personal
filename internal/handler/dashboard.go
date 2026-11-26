package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/maulana/perjadin-personal/internal/auth"
)

func GetDashboard(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())

		wsID, err := ResolveWorkspaceID(r, db, userID)
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}

		var belumLunas, pemasukanBulanLalu, estimasiBelumCair int64
		err = db.QueryRow(`
			WITH ws_trips AS (
				SELECT id, status, uang_dinas, nominal_monita, tanggal_dibayar
				FROM trips
				WHERE workspace_id = $1
			)
			SELECT
				COALESCE((
					SELECT SUM(e.jumlah)
					FROM expenses e
					JOIN ws_trips t ON e.trip_id = t.id
					JOIN payment_methods pm ON e.payment_method_id = pm.id
					WHERE LOWER(pm.nama) LIKE '%talangan%' AND t.status != 'lunas'
				), 0),
				COALESCE((
					SELECT SUM(uang_dinas)
					FROM ws_trips
					WHERE status = 'lunas'
						AND tanggal_dibayar IS NOT NULL
						AND date_trunc('month', tanggal_dibayar) = date_trunc('month', now() - interval '1 month')
				), 0),
				COALESCE((
					SELECT SUM(COALESCE(nominal_monita, uang_dinas, 0))
					FROM ws_trips
					WHERE status != 'lunas'
				), 0)
		`, wsID).Scan(&belumLunas, &pemasukanBulanLalu, &estimasiBelumCair)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"data": map[string]interface{}{
				"belum_lunas":          belumLunas,
				"pemasukan_bulan_lalu": pemasukanBulanLalu,
				"estimasi_belum_cair":  estimasiBelumCair,
			},
		})
	}
}
