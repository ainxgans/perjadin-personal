package handler

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/maulana/perjadin-personal/internal/auth"
)

type CategorySpending struct {
	CategoryID   string `json:"category_id"`
	CategoryNama string `json:"category_nama"`
	Total        int64  `json:"total"`
	Percentage   int    `json:"percentage"`
}

type PaymentMethodSpending struct {
	PaymentMethodID   string `json:"payment_method_id"`
	PaymentMethodNama string `json:"payment_method_nama"`
	Total             int64  `json:"total"`
	Percentage        int    `json:"percentage"`
}

type AnalyticsData struct {
	TotalExpensesRp      int64                   `json:"total_expenses_rp"`
	TotalUangDinasRp     int64                   `json:"total_uang_dinas_rp"`
	AverageExpenseTrip   int64                   `json:"average_expense_trip"`
	TotalDays            int                     `json:"total_days"`
	TotalTrips           int                     `json:"total_trips"`
	DailyBurnRate        int64                   `json:"daily_burn_rate"`
	PersonalSharePct     int                     `json:"personal_share_pct"`
	BudgetRealizationPct int                     `json:"budget_realization_pct"`
	Categories           []CategorySpending      `json:"categories"`
	PaymentMethods       []PaymentMethodSpending `json:"payment_methods"`
	AvailableYears       []int                   `json:"available_years"`
}

func GetAnalytics(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.UserIDFromContext(r.Context())

		wsID, err := ResolveWorkspaceID(r, db, userID)
		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}

		year, _ := strconv.Atoi(r.URL.Query().Get("year"))
		if year < 1900 || year > 2100 {
			year = 0
		}

		data := AnalyticsData{
			Categories:     []CategorySpending{},
			PaymentMethods: []PaymentMethodSpending{},
			AvailableYears: []int{},
		}

		// 0. Available years in this workspace
		yRows, err := db.Query(`
			SELECT DISTINCT EXTRACT(YEAR FROM t.tanggal_mulai)::int AS y
			FROM trips t
			WHERE t.workspace_id = $1
			ORDER BY y DESC
		`, wsID)
		if err == nil {
			defer yRows.Close()
			for yRows.Next() {
				var y int
				if err := yRows.Scan(&y); err == nil {
					data.AvailableYears = append(data.AvailableYears, y)
				}
			}
		}

		// 1. Consolidated scalar metrics in a single query
		var tripCount int
		var personalExpense, lunasUangDinas, lunasExpenses int64
		_ = db.QueryRow(`
			WITH filtered_trips AS (
				SELECT id, status, uang_dinas, tanggal_mulai, tanggal_selesai
				FROM trips
				WHERE workspace_id = $1
					AND ($2 = 0 OR EXTRACT(YEAR FROM tanggal_mulai) = $2)
			),
			trip_stats AS (
				SELECT
					COUNT(*)::int AS total_trips,
					COALESCE(SUM(GREATEST(1, (tanggal_selesai - tanggal_mulai) + 1)), 0)::int AS total_days,
					COALESCE(SUM(uang_dinas) FILTER (WHERE uang_dinas IS NOT NULL), 0) AS total_uang_dinas,
					COALESCE(SUM(uang_dinas) FILTER (WHERE status = 'lunas' AND uang_dinas IS NOT NULL), 0) AS lunas_uang_dinas
				FROM filtered_trips
			),
			exp_stats AS (
				SELECT
					COALESCE(SUM(e.jumlah), 0) AS total_expenses,
					COALESCE(SUM(e.jumlah) FILTER (WHERE LOWER(COALESCE(pm.nama, '')) NOT LIKE '%koperasi%'), 0) AS personal_expenses,
					COALESCE(SUM(e.jumlah) FILTER (WHERE t.status = 'lunas' AND LOWER(COALESCE(pm.nama, '')) NOT LIKE '%koperasi%'), 0) AS lunas_expenses
				FROM expenses e
				JOIN filtered_trips t ON e.trip_id = t.id
				LEFT JOIN payment_methods pm ON e.payment_method_id = pm.id
			)
			SELECT
				ts.total_trips, ts.total_days, ts.total_uang_dinas, ts.lunas_uang_dinas,
				es.total_expenses, es.personal_expenses, es.lunas_expenses
			FROM trip_stats ts, exp_stats es
		`, wsID, year).Scan(
			&tripCount, &data.TotalDays, &data.TotalUangDinasRp, &lunasUangDinas,
			&data.TotalExpensesRp, &personalExpense, &lunasExpenses,
		)

		data.TotalTrips = tripCount
		if tripCount > 0 {
			data.AverageExpenseTrip = data.TotalExpensesRp / int64(tripCount)
		}
		if data.TotalDays > 0 {
			data.DailyBurnRate = data.TotalExpensesRp / int64(data.TotalDays)
		}
		if data.TotalExpensesRp > 0 {
			data.PersonalSharePct = int((personalExpense * 100) / data.TotalExpensesRp)
		}
		if lunasUangDinas > 0 {
			data.BudgetRealizationPct = int((lunasExpenses * 100) / lunasUangDinas)
		}

		// 2. Category & payment method breakdowns in a single query
		bdRows, err := db.Query(`
			WITH filtered_expenses AS (
				SELECT e.category_id, e.payment_method_id, e.jumlah
				FROM expenses e
				JOIN trips t ON e.trip_id = t.id
				WHERE t.workspace_id = $1
					AND ($2 = 0 OR EXTRACT(YEAR FROM t.tanggal_mulai) = $2)
			)
			SELECT 'cat' AS kind, c.id, c.nama, COALESCE(SUM(fe.jumlah), 0) AS total
			FROM filtered_expenses fe
			JOIN categories c ON fe.category_id = c.id
			GROUP BY c.id, c.nama
			UNION ALL
			SELECT 'pm' AS kind, p.id, p.nama, COALESCE(SUM(fe.jumlah), 0) AS total
			FROM filtered_expenses fe
			JOIN payment_methods p ON fe.payment_method_id = p.id
			GROUP BY p.id, p.nama
			ORDER BY kind ASC, total DESC
		`, wsID, year)
		if err == nil {
			defer bdRows.Close()
			for bdRows.Next() {
				var kind, id, nama string
				var total int64
				if err := bdRows.Scan(&kind, &id, &nama, &total); err == nil {
					pct := 0
					if data.TotalExpensesRp > 0 {
						pct = int((total * 100) / data.TotalExpensesRp)
					}
					if kind == "cat" {
						data.Categories = append(data.Categories, CategorySpending{
							CategoryID:   id,
							CategoryNama: nama,
							Total:        total,
							Percentage:   pct,
						})
					} else {
						data.PaymentMethods = append(data.PaymentMethods, PaymentMethodSpending{
							PaymentMethodID:   id,
							PaymentMethodNama: nama,
							Total:             total,
							Percentage:        pct,
						})
					}
				}
			}
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{"data": data})
	}
}
