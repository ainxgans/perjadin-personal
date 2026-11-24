import { Component, createSignal, createResource, Show } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { createTrip, updateTrip, getTrip, getSBMRates, type SBMRate } from '../api';
import { ArrowLeftIcon } from '../components/Icons';
import CreatableSelect from '../components/CreatableSelect';

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const TripForm: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const isEdit = !!params.id;

  const [sbmRates] = createResource(getSBMRates);

  const [nama, setNama] = createSignal('');
  const [tujuan, setTujuan] = createSignal('');
  const [selectedRate, setSelectedRate] = createSignal<SBMRate | undefined>();
  const [mulai, setMulai] = createSignal('');
  const [selesai, setSelesai] = createSignal('');
  const [uangDinas, setUangDinas] = createSignal('');
  const [nominalMonita, setNominalMonita] = createSignal('');
  const [linkMonita, setLinkMonita] = createSignal('');
  const [catatan, setCatatan] = createSignal('');
  const [status, setStatus] = createSignal('berlangsung');
  const [settlementNote, setSettlementNote] = createSignal('');
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
      if (t.status) setStatus(t.status);
      if (t.settlement_note) setSettlementNote(t.settlement_note);
    });
  }

  const tripDays = () => {
    if (!mulai() || !selesai()) return 0;
    const m = new Date(mulai()).getTime();
    const s = new Date(selesai()).getTime();
    if (isNaN(m) || isNaN(s) || s < m) return 0;
    return Math.round((s - m) / (1000 * 60 * 60 * 24)) + 1;
  };

  const matchedRate = () => {
    if (selectedRate()) return selectedRate();
    const dest = tujuan().toLowerCase();
    if (!dest) return undefined;
    return sbmRates()?.find(
      (r) =>
        dest.includes(r.provinsi.toLowerCase()) ||
        (r.ibukota && dest.includes(r.ibukota.toLowerCase()))
    );
  };

  const estimatedSBM = () => {
    const r = matchedRate();
    const days = tripDays();
    if (!r || days <= 0) return null;
    return {
      rate: r,
      days,
      total: r.uang_harian * days,
    };
  };

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
      data.settlement_note = settlementNote();
      if (isEdit) data.status = status();
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
              <label for="tujuan">Kota / Wilayah Tujuan</label>
              <CreatableSelect
                value={tujuan()}
                options={sbmRates() || []}
                placeholder="Pilih atau cari kota / provinsi..."
                onChange={(val, rate) => {
                  setTujuan(val);
                  setSelectedRate(rate);
                }}
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

            {/* SBM Auto-Estimation Chip/Banner */}
            <Show when={estimatedSBM()}>
              {(est) => (
                <div
                  style={{
                    background: 'rgba(52, 211, 153, 0.08)',
                    border: '1px solid rgba(52, 211, 153, 0.25)',
                    'border-radius': '12px',
                    padding: '0.75rem 1rem',
                    'margin-bottom': '1rem',
                    display: 'flex',
                    'justify-content': 'space-between',
                    'align-items': 'center',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <div style="font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; color: var(--emerald); letter-spacing: 0.05em;">
                      Estimasi SBM ({est().rate.provinsi})
                    </div>
                    <div style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 0.125rem;">
                      {est().days} hari × {formatRp(est().rate.uang_harian)} ={' '}
                      <strong class="amount text-emerald">{formatRp(est().total)}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn btn-sm"
                    style="background: var(--emerald); color: #000; font-size: 0.75rem; font-weight: 700; padding: 0.375rem 0.75rem;"
                    onClick={() => setNominalMonita(String(est().total))}
                  >
                    Gunakan
                  </button>
                </div>
              )}
            </Show>

            {isEdit && (
              <div class="form-group">
                <label for="status">Status</label>
                <select
                  id="status"
                  class="form-control"
                  value={status()}
                  onChange={(e) => setStatus(e.currentTarget.value)}
                >
                  <option value="berlangsung">Berlangsung</option>
                  <option value="selesai">Selesai</option>
                  <option value="diajukan">Diajukan Klaim</option>
                  <option value="lunas">Lunas</option>
                </select>
              </div>
            )}

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

            <div class="form-group">
              <label for="settlementNote">Catatan Pencairan / Klaim (Opsional)</label>
              <textarea
                id="settlementNote"
                class="form-control"
                rows="2"
                value={settlementNote()}
                onInput={(e) => setSettlementNote(e.currentTarget.value)}
                placeholder="Catatan terkait klaim atau pencairan..."
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
