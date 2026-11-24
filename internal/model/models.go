package model

import "time"

type User struct {
	ID        string    `json:"id"`
	GoogleID  string    `json:"google_id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	AvatarURL string    `json:"avatar_url"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type Category struct {
	ID        string    `json:"id"`
	Nama      string    `json:"nama"`
	CreatedAt time.Time `json:"created_at"`
}

type PaymentMethod struct {
	ID        string    `json:"id"`
	Nama      string    `json:"nama"`
	CreatedAt time.Time `json:"created_at"`
}

type Trip struct {
	ID              string     `json:"id"`
	UserID          string     `json:"user_id"`
	Nama            string     `json:"nama"`
	Tujuan          string     `json:"tujuan"`
	TanggalMulai    time.Time  `json:"tanggal_mulai"`
	TanggalSelesai  time.Time  `json:"tanggal_selesai"`
	UangDinas       *int64     `json:"uang_dinas"`
	NominalMonita   *int64     `json:"nominal_monita"`
	TanggalDibayar  *time.Time `json:"tanggal_dibayar"`
	Catatan         string     `json:"catatan"`
	LinkMonita      string     `json:"link_monita"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// StatusAt returns trip status relative to given time.
// Exported for testing with controlled time.
func (t Trip) StatusAt(now time.Time) string {
	today := now.Truncate(24 * time.Hour)
	mulai := t.TanggalMulai.Truncate(24 * time.Hour)
	selesai := t.TanggalSelesai.Truncate(24 * time.Hour)

	if t.UangDinas != nil && t.TanggalDibayar != nil {
		return "selesai"
	}
	if !today.After(selesai) && !today.Before(mulai) {
		return "berlangsung"
	}
	return "urus_berkas"
}

// Status returns trip status relative to now.
func (t Trip) Status() string {
	return t.StatusAt(time.Now())
}

type Expense struct {
	ID              string    `json:"id"`
	TripID          string    `json:"trip_id"`
	CategoryID      string    `json:"category_id"`
	PaymentMethodID string    `json:"payment_method_id"`
	Deskripsi       string    `json:"deskripsi"`
	Jumlah          int64     `json:"jumlah"`
	Tanggal         time.Time `json:"tanggal"`
	CreatedAt       time.Time `json:"created_at"`
}
