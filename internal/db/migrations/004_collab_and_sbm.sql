-- 1. Master SBM Rates
CREATE TABLE IF NOT EXISTS sbm_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provinsi TEXT NOT NULL,
    ibukota TEXT NOT NULL DEFAULT '',
    uang_harian BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sbm_provinsi ON sbm_rates (LOWER(provinsi));

-- 2. Trip Collaborators / Members
CREATE TABLE IF NOT EXISTS trip_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_trip_member UNIQUE(trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_members_user ON trip_members (user_id);
CREATE INDEX IF NOT EXISTS idx_trip_members_trip ON trip_members (trip_id);

-- 3. Track expense recorder
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 4. Initial Seed 38 Provinces SBM (PMK Standar Biaya Masukan Luar Kota)
INSERT INTO sbm_rates (provinsi, ibukota, uang_harian) VALUES
('Aceh', 'Banda Aceh', 360000),
('Sumatera Utara', 'Medan', 370000),
('Riau', 'Pekanbaru', 370000),
('Kepulauan Riau', 'Tanjung Pinang', 370000),
('Jambi', 'Jambi', 370000),
('Sumatera Barat', 'Padang', 380000),
('Sumatera Selatan', 'Palembang', 380000),
('Lampung', 'Bandar Lampung', 380000),
('Bengkulu', 'Bengkulu', 380000),
('Bangka Belitung', 'Pangkal Pinang', 410000),
('Banten', 'Serang', 370000),
('Jawa Barat', 'Bandung', 430000),
('DKI Jakarta', 'Jakarta', 530000),
('Jawa Tengah', 'Semarang', 370000),
('DI Yogyakarta', 'Yogyakarta', 420000),
('Jawa Timur', 'Surabaya', 410000),
('Bali', 'Denpasar', 480000),
('Nusa Tenggara Barat', 'Mataram', 440000),
('Nusa Tenggara Timur', 'Kupang', 430000),
('Kalimantan Barat', 'Pontianak', 380000),
('Kalimantan Tengah', 'Palangka Raya', 360000),
('Kalimantan Selatan', 'Banjarmasin', 380000),
('Kalimantan Timur', 'Samarinda', 430000),
('Kalimantan Utara', 'Tanjung Selor', 430000),
('Sulawesi Utara', 'Manado', 370000),
('Gorontalo', 'Gorontalo', 370000),
('Sulawesi Barat', 'Mamuju', 340000),
('Sulawesi Selatan', 'Makassar', 430000),
('Sulawesi Tengah', 'Palu', 370000),
('Sulawesi Tenggara', 'Kendari', 380000),
('Maluku', 'Ambon', 380000),
('Maluku Utara', 'Sofifi', 430000),
('Papua', 'Jayapura', 580000),
('Papua Barat', 'Manokwari', 480000),
('Papua Selatan', 'Merauke', 580000),
('Papua Tengah', 'Nabire', 580000),
('Papua Pegunungan', 'Wamena', 580000),
('Papua Barat Daya', 'Sorong', 480000)
ON CONFLICT (LOWER(provinsi)) DO UPDATE SET
    ibukota = EXCLUDED.ibukota,
    uang_harian = EXCLUDED.uang_harian;
