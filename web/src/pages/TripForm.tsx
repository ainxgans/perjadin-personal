import { Component, createSignal } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { createTrip, updateTrip, getTrip } from '../api';
import { ArrowLeftIcon } from '../components/Icons';

const TripForm: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const isEdit = !!params.id;

  const [nama, setNama] = createSignal('');
  const [tujuan, setTujuan] = createSignal('');
  const [mulai, setMulai] = createSignal('');
  const [selesai, setSelesai] = createSignal('');
  const [uangDinas, setUangDinas] = createSignal('');
  const [nominalMonita, setNominalMonita] = createSignal('');
  const [linkMonita, setLinkMonita] = createSignal('');
  const [catatan, setCatatan] = createSignal('');
  const [dibayar, setDibayar] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  if (isEdit) {
    getTrip(params.id!).then((t) => {
      setNama(t.nama);
      setTujuan(t.tujuan);
      setMulai(t.tanggal_mulai);
      setSelesai(t.tanggal_selesai);
      if (t.uang_dinas != null) setUangDinas(String(t.uang_dinas));
      if (t.nominal_monita != null) setNominalMonita(String(t.nominal_monita));
      if (t.link_monita) setLinkMonita(t.link_monita);
      if (t.catatan) setCatatan(t.catatan);
      if (t.tanggal_dibayar) setDibayar(t.tanggal_dibayar);
    });
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    if (selesai() < mulai()) {
      setError('Tanggal selesai harus >= tanggal mulai');
      return;
    }
    setLoading(true);
    try {
      const data: any = {
        nama: nama(),
        tujuan: tujuan(),
        tanggal_mulai: mulai(),
        tanggal_selesai: selesai(),
      };
      if (uangDinas()) data.uang_dinas = parseInt(uangDinas());
      if (nominalMonita()) data.nominal_monita = parseInt(nominalMonita());
      data.link_monita = linkMonita();
      data.catatan = catatan();
      if (dibayar()) data.tanggal_dibayar = dibayar();

      if (isEdit) {
        await updateTrip(params.id!, data);
        navigate(`/trips/${params.id}`);
      } else {
        const trip = await createTrip(data);
        navigate(`/trips/${trip.id}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="page">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
        <button
          type="button"
          class="btn-icon-subtle"
          onClick={() => navigate(-1)}
          aria-label="Kembali"
        >
          <ArrowLeftIcon size={16} />
        </button>
        <h2 style="font-size: 1.125rem; font-weight: 800; color: #fff; margin: 0;">
          {isEdit ? 'Edit Perjalanan' : 'Buat Perjalanan Baru'}
        </h2>
      </div>

      <div class="doppel-card">
        <div class="doppel-inner">
          <form onSubmit={handleSubmit}>
            <div class="form-group">
              <label for="nama">Nama Perjalanan</label>
              <input
                id="nama"
                class="form-control"
                value={nama()}
                onInput={(e) => setNama(e.currentTarget.value)}
                placeholder="Contoh: Raker Yogyakarta Q1"
                required
              />
            </div>

            <div class="form-group">
              <label for="tujuan">Kota Tujuan</label>
              <input
                id="tujuan"
                class="form-control"
                value={tujuan()}
                onInput={(e) => setTujuan(e.currentTarget.value)}
                placeholder="Contoh: Yogyakarta"
                required
              />
            </div>

            <div class="form-group">
              <label for="mulai">Tanggal Mulai</label>
              <input
                id="mulai"
                type="date"
                class="form-control"
                value={mulai()}
                onInput={(e) => setMulai(e.currentTarget.value)}
                required
              />
            </div>

            <div class="form-group">
              <label for="selesai">Tanggal Selesai</label>
              <input
                id="selesai"
                type="date"
                class="form-control"
                value={selesai()}
                onInput={(e) => setSelesai(e.currentTarget.value)}
                required
              />
            </div>

            <div class="form-group">
              <label for="nominalMonita">Nominal Monita (Pagu Kotor / Estimasi, Opsional)</label>
              <input
                id="nominalMonita"
                type="number"
                class="form-control amount"
                value={nominalMonita()}
                onInput={(e) => setNominalMonita(e.currentTarget.value)}
                placeholder="0"
                min="0"
              />
            </div>

            <div class="form-group">
              <label for="uangDinas">Uang Dinas Diterima (Pagu Bersih Masuk Rekening, Opsional)</label>
              <input
                id="uangDinas"
                type="number"
                class="form-control amount"
                value={uangDinas()}
                onInput={(e) => setUangDinas(e.currentTarget.value)}
                placeholder="0"
                min="0"
              />
            </div>

            <div class="form-group">
              <label for="dibayar">Tanggal Pencairan / Dibayar (Opsional)</label>
              <input
                id="dibayar"
                type="date"
                class="form-control"
                value={dibayar()}
                onInput={(e) => setDibayar(e.currentTarget.value)}
              />
            </div>

            <div class="form-group">
              <label for="linkMonita">Link Monita (Opsional)</label>
              <input
                id="linkMonita"
                type="url"
                class="form-control"
                value={linkMonita()}
                onInput={(e) => setLinkMonita(e.currentTarget.value)}
                placeholder="https://monita.bphmigas.com/..."
              />
            </div>

            <div class="form-group">
              <label for="catatan">Catatan Perjalanan (Rekan, Agenda, Kendaraan, Opsional)</label>
              <textarea
                id="catatan"
                class="form-control"
                rows="3"
                value={catatan()}
                onInput={(e) => setCatatan(e.currentTarget.value)}
                placeholder="Catatan tim, detail whoosh/taksi, atau agenda..."
                style="resize: vertical;"
              />
            </div>

            {error() && <p class="text-rose" style="margin-bottom: 1rem; font-size: 0.8125rem;">{error()}</p>}

            <div class="form-actions">
              <button type="button" class="btn btn-outline" onClick={() => navigate(-1)}>
                Batal
              </button>
              <button type="submit" class="btn btn-primary" disabled={loading()}>
                {loading() ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TripForm;
