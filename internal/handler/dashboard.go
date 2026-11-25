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

		var belumLunas int64
		db.QueryRow(`
			SELECT COALESCE(SUM(e.jumlah), 0)
			FROM expenses e
			JOIN trips t ON e.trip_id = t.id
			JOIN payment_methods pm ON e.payment_method_id = pm.id
			WHERE t.workspace_id = $1
				AND pm.nama = 'Pribadi'
				AND t.status != 'lunas'
		`, wsID).Scan(&belumLunas)

		var pemasukanBulanLalu int64
		db.QueryRow(`
			SELECT COALESCE(SUM(t.uang_dinas), 0)
			FROM trips t
			WHERE t.workspace_id = $1
				AND t.status = 'lunas'
				AND t.tanggal_dibayar IS NOT NULL
				AND date_trunc('month', t.tanggal_dibayar) = date_trunc('month', now() - interval '1 month')
		`, wsID).Scan(&pemasukanBulanLalu)

		var estimasiBelumCair int64
		db.QueryRow(`
			SELECT COALESCE(SUM(COALESCE(t.nominal_monita, t.uang_dinas, 0)), 0)
			FROM trips t
			WHERE t.workspace_id = $1
				AND t.status != 'lunas'
		`, wsID).Scan(&estimasiBelumCair)

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
