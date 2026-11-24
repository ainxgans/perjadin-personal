-- Explicit status column matching Laravel flow: berlangsung → selesai → diajukan → lunas
ALTER TABLE trips ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'berlangsung';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS settlement_note TEXT NOT NULL DEFAULT '';

-- Backfill existing rows
UPDATE trips SET status = CASE
    WHEN uang_dinas IS NOT NULL AND tanggal_dibayar IS NOT NULL THEN 'lunas'
    WHEN tanggal_selesai < CURRENT_DATE THEN 'selesai'
    ELSE 'berlangsung'
END
WHERE status = 'berlangsung';

CREATE INDEX IF NOT EXISTS idx_trips_status ON trips (status);
