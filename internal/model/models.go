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

// Trip status flow: berlangsung → selesai → diajukan → lunas
// Matches Laravel perjadin_pribadi: ongoing → completed → claimed → paid
const (
	StatusBerlangsung = "berlangsung"
	StatusSelesai     = "selesai"
	StatusDiajukan    = "diajukan"
	StatusLunas       = "lunas"
)

var ValidStatuses = map[string]bool{
	StatusBerlangsung: true,
	StatusSelesai:     true,
	StatusDiajukan:    true,
	StatusLunas:       true,
}

type Trip struct {
	ID              string     `json:"id"`
	UserID          string     `json:"user_id"`
	Nama            string     `json:"nama"`
	Tujuan          string     `json:"tujuan"`
	TanggalMulai    time.Time  `json:"tanggal_mulai"`
	TanggalSelesai  time.Time  `json:"tanggal_selesai"`
	Status          string     `json:"status"`
	UangDinas       *int64     `json:"uang_dinas"`
	NominalMonita   *int64     `json:"nominal_monita"`
	TanggalDibayar  *time.Time `json:"tanggal_dibayar"`
	Catatan         string     `json:"catatan"`
	LinkMonita      string     `json:"link_monita"`
	SettlementNote  string     `json:"settlement_note"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type Expense struct {
	ID              string    `json:"id"`
	TripID          string    `json:"trip_id"`
	UserID          *string   `json:"user_id,omitempty"`
	CategoryID      string    `json:"category_id"`
	PaymentMethodID string    `json:"payment_method_id"`
	Deskripsi       string    `json:"deskripsi"`
	Jumlah          int64     `json:"jumlah"`
	Tanggal         time.Time `json:"tanggal"`
	CreatedAt       time.Time `json:"created_at"`
}

type SBMRate struct {
	ID         string    `json:"id"`
	Provinsi   string    `json:"provinsi"`
	Ibukota    string    `json:"ibukota"`
	UangHarian int64     `json:"uang_harian"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type TripMember struct {
	ID         string    `json:"id"`
	TripID     string    `json:"trip_id"`
	UserID     string    `json:"user_id"`
	Role       string    `json:"role"`
	UserName   string    `json:"user_name,omitempty"`
	UserEmail  string    `json:"user_email,omitempty"`
	UserAvatar string    `json:"user_avatar,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}
