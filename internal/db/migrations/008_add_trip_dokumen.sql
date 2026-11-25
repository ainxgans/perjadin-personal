-- 008_add_trip_dokumen.sql
-- Store official travel documents (Surat Tugas / Undangan PDF) path and original file name
ALTER TABLE trips ADD COLUMN IF NOT EXISTS dokumen_url TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS dokumen_nama TEXT;
