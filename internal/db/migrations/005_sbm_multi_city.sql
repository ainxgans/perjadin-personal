-- 1. Add kota array to sbm_rates
ALTER TABLE sbm_rates ADD COLUMN IF NOT EXISTS kota TEXT[] NOT NULL DEFAULT '{}';

-- 2. Populate existing kota from ibukota if empty
UPDATE sbm_rates 
SET kota = ARRAY[ibukota] 
WHERE ibukota <> '' AND (kota IS NULL OR kota = '{}');

-- 3. Seed popular cities for key provinces
UPDATE sbm_rates SET kota = ARRAY['Bandung', 'Bogor', 'Bekasi', 'Depok', 'Cirebon', 'Sukabumi', 'Tasikmalaya', 'Karawang', 'Cimahi']
WHERE LOWER(provinsi) = 'jawa barat';

UPDATE sbm_rates SET kota = ARRAY['Jakarta', 'Jakarta Pusat', 'Jakarta Selatan', 'Jakarta Barat', 'Jakarta Timur', 'Jakarta Utara', 'Kepulauan Seribu']
WHERE LOWER(provinsi) = 'dki jakarta';

UPDATE sbm_rates SET kota = ARRAY['Serang', 'Tangerang', 'Tangerang Selatan', 'Cilegon', 'Pandeglang', 'Lebak']
WHERE LOWER(provinsi) = 'banten';

UPDATE sbm_rates SET kota = ARRAY['Semarang', 'Surakarta (Solo)', 'Magelang', 'Purwokerto', 'Salatiga', 'Tegal', 'Pekalongan', 'Kudus']
WHERE LOWER(provinsi) = 'jawa tengah';

UPDATE sbm_rates SET kota = ARRAY['Yogyakarta', 'Sleman', 'Bantul', 'Kulon Progo', 'Gunungkidul']
WHERE LOWER(provinsi) = 'di yogyakarta';

UPDATE sbm_rates SET kota = ARRAY['Surabaya', 'Malang', 'Banyuwangi', 'Madiun', 'Kediri', 'Batu', 'Jember', 'Sidoarjo']
WHERE LOWER(provinsi) = 'jawa timur';

UPDATE sbm_rates SET kota = ARRAY['Denpasar', 'Badung', 'Gianyar', 'Ubud', 'Buleleng', 'Tabanan']
WHERE LOWER(provinsi) = 'bali';

UPDATE sbm_rates SET kota = ARRAY['Medan', 'Binjai', 'Pematangsiantar', 'Deli Serdang', 'Toba']
WHERE LOWER(provinsi) = 'sumatera utara';

UPDATE sbm_rates SET kota = ARRAY['Padang', 'Bukittinggi', 'Padang Panjang', 'Payakumbuh']
WHERE LOWER(provinsi) = 'sumatera barat';

UPDATE sbm_rates SET kota = ARRAY['Tanjung Pinang', 'Batam', 'Bintan']
WHERE LOWER(provinsi) = 'kepulauan riau';

UPDATE sbm_rates SET kota = ARRAY['Pekanbaru', 'Dumai']
WHERE LOWER(provinsi) = 'riau';

UPDATE sbm_rates SET kota = ARRAY['Makassar', 'Gowa', 'Maros', 'Parepare', 'Palopo']
WHERE LOWER(provinsi) = 'sulawesi selatan';

UPDATE sbm_rates SET kota = ARRAY['Banjarmasin', 'Banjarbaru', 'Martapura']
WHERE LOWER(provinsi) = 'kalimantan selatan';

UPDATE sbm_rates SET kota = ARRAY['Samarinda', 'Balikpapan', 'IKN Nusantara', 'Bontang']
WHERE LOWER(provinsi) = 'kalimantan timur';
