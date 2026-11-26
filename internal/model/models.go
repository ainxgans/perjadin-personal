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
	WorkspaceID     string     `json:"workspace_id"`
	UserID          string     `json:"user_id"`
	Nama            string     `json:"nama"`
	Tujuan          string     `json:"tujuan"`
	LokasiAcara     string     `json:"lokasi_acara"`
	TanggalMulai    time.Time  `json:"tanggal_mulai"`
	TanggalSelesai  time.Time  `json:"tanggal_selesai"`
	Status          string     `json:"status"`
	UangDinas       *int64     `json:"uang_dinas"`
	NominalMonita   *int64     `json:"nominal_monita"`
	EstimasiTransport *int64   `json:"estimasi_transport,omitempty"`
	DokumenURL      *string    `json:"dokumen_url,omitempty"`
	DokumenNama     *string    `json:"dokumen_nama,omitempty"`
	TanggalDibayar  *time.Time `json:"tanggal_dibayar"`
	Catatan         string     `json:"catatan"`
	LinkMonita      string     `json:"link_monita"`
	SettlementNote  string     `json:"settlement_note"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type Workspace struct {
	ID          string    `json:"id"`
	Nama        string    `json:"nama"`
	OwnerID     string    `json:"owner_id"`
	JoinCode    string    `json:"join_code,omitempty"`
	Role        string    `json:"role,omitempty"`
	MemberCount int       `json:"member_count,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type WorkspaceMember struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	UserID      string    `json:"user_id"`
	Name        string    `json:"name"`
	Email       string    `json:"email"`
	AvatarURL   string    `json:"avatar_url"`
	Role        string    `json:"role"`
	CreatedAt   time.Time `json:"created_at"`
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
	ID            string    `json:"id"`
	Provinsi      string    `json:"provinsi"`
	Ibukota       string    `json:"ibukota"`
	Kota          []string  `json:"kota"`
	UangHarian    int64     `json:"uang_harian"`
	UangTransport int64     `json:"uang_transport"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
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
