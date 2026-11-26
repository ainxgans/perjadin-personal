import { Component, createSignal, createResource, onMount, Show } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { createTrip, updateTrip, getTrip, getSBMRates, parseDocument, type SBMRate } from '../api';
import { ArrowLeftIcon, UploadIcon, FileTextIcon, TrashIcon, CheckIcon } from '../components/Icons';
import CreatableSelect from '../components/CreatableSelect';

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const TripForm: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const isEdit = !!params.id;

  const [sbmRates] = createResource(() => getSBMRates());

  const [nama, setNama] = createSignal('');
  const [tujuan, setTujuan] = createSignal('');
  const [selectedRate, setSelectedRate] = createSignal<SBMRate | undefined>();
  const [mulai, setMulai] = createSignal('');
  const [selesai, setSelesai] = createSignal('');
  const [uangDinas, setUangDinas] = createSignal('');
  const [nominalMonita, setNominalMonita] = createSignal('');
  const [estimasiTransport, setEstimasiTransport] = createSignal('');
  const [linkMonita, setLinkMonita] = createSignal('');
  const [dokumenUrl, setDokumenUrl] = createSignal<string | null>(null);
  const [dokumenNama, setDokumenNama] = createSignal<string | null>(null);
  const [parseLoading, setParseLoading] = createSignal(false);
  const [parseSuccessMsg, setParseSuccessMsg] = createSignal('');
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
      if (t.estimasi_transport != null) setEstimasiTransport(String(t.estimasi_transport));
      if (t.dokumen_url) setDokumenUrl(t.dokumen_url);
      if (t.dokumen_nama) setDokumenNama(t.dokumen_nama);
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
        (r.ibukota && dest.includes(r.ibukota.toLowerCase())) ||
        (r.kota && r.kota.some((k) => dest.includes(k.toLowerCase())))
    );
  };

  const estimatedUangHarian = () => {
    const r = matchedRate();
    const days = tripDays();
    if (!r || days <= 0) return null;
    return {
      rate: r,
      days,
      total: r.uang_harian * days,
    };
  };

  const transportVal = () => parseInt(estimasiTransport()) || 0;
  const totalPaguEstimasi = () => {
    const uh = estimatedUangHarian()?.total || 0;
    return uh + transportVal();
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Hanya file PDF yang didukung');
      return;
    }
    setParseLoading(true);
    setError('');
    setParseSuccessMsg('');
    try {
      const res = await parseDocument(file);
      if (res.nama) setNama(res.nama);
      if (res.tujuan) setTujuan(res.tujuan);
      if (res.tanggal_mulai) setMulai(res.tanggal_mulai);
      if (res.tanggal_selesai) setSelesai(res.tanggal_selesai);
      if (res.catatan) {
        setCatatan((prev) => (prev ? prev + '\n' + res.catatan : res.catatan));
      }
      if (res.dokumen_url) setDokumenUrl(res.dokumen_url);
      if (res.dokumen_nama) setDokumenNama(res.dokumen_nama);

      setParseSuccessMsg(
        `Berhasil membaca ${res.doc_type === 'surat_tugas' ? 'Surat Tugas' : 'Undangan'}: ${res.nomor_surat || file.name}`
      );
    } catch (err: any) {
      setError('Gagal membaca dokumen PDF: ' + err.message);
    } finally {
      setParseLoading(false);
    }
  };

  onMount(async () => {
    if (isEdit || !('caches' in window)) return;
    try {
      const cache = await caches.open('perjadin-share-target');
      const res = await cache.match('/_shared_pdf');
      if (!res) return;

      const blob = await res.blob();
      const rawName = res.headers.get('X-Shared-Filename');
      const decodedName = rawName ? decodeURIComponent(rawName) : 'dokumen.pdf';
      const filename = decodedName.toLowerCase().endsWith('.pdf') ? decodedName : `${decodedName}.pdf`;

      await cache.delete('/_shared_pdf');
      if (window.location.search.includes('shared=1')) {
        navigate('/trips/new', { replace: true });
      }

      const sharedFile = new File([blob], filename, { type: 'application/pdf' });
      await handleFileUpload(sharedFile);
    } catch {
      // Ignore cache access errors
    }
  });

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
      if (estimasiTransport()) {
        data.estimasi_transport = parseInt(estimasiTransport());
      } else if (isEdit) {
        data.estimasi_transport = null;
      }
      if (dokumenUrl()) {
        data.dokumen_url = dokumenUrl();
        data.dokumen_nama = dokumenNama();
      } else if (isEdit) {
        data.dokumen_url = null;
        data.dokumen_nama = null;
      }
      let normalizedLink = linkMonita().trim();
      if (normalizedLink && !/^https?:\/\//i.test(normalizedLink)) {
        normalizedLink = 'https://' + normalizedLink;
      }
      data.link_monita = normalizedLink;
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
        <h1 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin: 0;">
          {isEdit ? 'Edit Perjalanan' : 'Buat Perjalanan Baru'}
        </h1>
      </div>

      <div class="doppel-card">
        <div class="doppel-inner">
          <form onSubmit={handleSubmit}>
            {/* Import PDF Surat Tugas / Undangan */}
            <div style="margin-bottom: 1.25rem;">
              <input
                id="doc-upload-input"
                type="file"
                accept=".pdf,application/pdf"
                style="display: none;"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (f) handleFileUpload(f);
                  e.currentTarget.value = '';
                }}
              />

              <Show
                when={dokumenUrl()}
                fallback={
                  <div
                    id="dropzone-doc"
                    style={{
                      border: '1px dashed var(--border-subtle)',
                      'border-radius': '10px',
                      padding: '1rem',
                      'text-align': 'center',
                      background: 'rgba(255, 255, 255, 0.02)',
                      cursor: parseLoading() ? 'wait' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => !parseLoading() && document.getElementById('doc-upload-input')?.click()}
                  >
                    <Show when={parseLoading()} fallback={
                      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.375rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--sky); font-size: 0.8125rem; font-weight: 600;">
                          <UploadIcon size={16} />
                          <span>Import dari Surat Tugas / Undangan (PDF)</span>
                        </div>
                        <div style="font-size: 0.6875rem; color: var(--text-muted);">
                          Deteksi otomatis agenda, lokasi, dan tanggal dinas
                        </div>
                      </div>
                    }>
                      <div style="font-size: 0.8125rem; color: var(--sky); font-weight: 600;">
                        Sedang membaca dan menganalisis naskah dinas...
                      </div>
                    </Show>
                  </div>
                }
              >
                <div
                  style={{
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    'border-radius': '10px',
                    padding: '0.625rem 0.875rem',
                    background: 'rgba(56, 189, 248, 0.06)',
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content': 'space-between',
                    gap: '0.75rem',
                  }}
                >
                  <div style="display: flex; align-items: center; gap: 0.5rem; min-width: 0;">
                    <FileTextIcon size={16} class="text-sky" />
                    <div style="font-size: 0.8125rem; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      {dokumenNama() || 'Dokumen Terlampir (PDF)'}
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button
                      type="button"
                      class="btn btn-sm btn-ghost"
                      style="font-size: 0.6875rem; padding: 0.25rem 0.5rem;"
                      onClick={() => document.getElementById('doc-upload-input')?.click()}
                    >
                      Ganti
                    </button>
                    <button
                      type="button"
                      class="btn-icon-subtle"
                      style="color: var(--rose);"
                      onClick={() => {
                        setDokumenUrl(null);
                        setDokumenNama(null);
                        setParseSuccessMsg('');
                      }}
                      aria-label="Hapus Dokumen"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </div>
              </Show>

              <Show when={parseSuccessMsg()}>
                <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--emerald); display: flex; align-items: center; gap: 0.375rem;">
                  <CheckIcon size={14} />
                  <span>{parseSuccessMsg()}</span>
                </div>
              </Show>
            </div>

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
                  if (rate?.uang_transport && rate.uang_transport > 0 && (!isEdit || !estimasiTransport())) {
                    setEstimasiTransport(String(rate.uang_transport));
                  }
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

            {/* Kalkulator Pagu Monita (Uang Harian + Transport) */}
            <Show
              when={estimatedUangHarian()}
              fallback={
                <div class="form-group">
                  <label for="estimasiTransport">Estimasi Transport (Taksi / Tiket, Opsional)</label>
                  <input
                    id="estimasiTransport"
                    type="number"
                    class="form-control amount"
                    value={estimasiTransport()}
                    onInput={(e) => setEstimasiTransport(e.currentTarget.value)}
                    placeholder="0"
                    min="0"
                  />
                </div>
              }
            >
              {(est) => (
                <div
                  style={{
                    background: 'rgba(56, 189, 248, 0.05)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    'border-radius': '12px',
                    padding: '0.875rem 1rem',
                    'margin-bottom': '1rem',
                    display: 'flex',
                    'flex-direction': 'column',
                    gap: '0.625rem',
                  }}
                >
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; color: var(--sky); letter-spacing: 0.05em;">
                      Kalkulator Pagu Monita
                    </div>
                    <span style="font-size: 0.6875rem; color: var(--text-muted); font-weight: 600;">
                      {est().rate.provinsi}
                    </span>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 0.8125rem;">
                    <span style="color: var(--text-secondary);">
                      Uang Harian ({est().days} hari × {formatRp(est().rate.uang_harian)})
                    </span>
                    <strong class="amount text-emerald">{formatRp(est().total)}</strong>
                  </div>

                  <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
                      <label for="calc-transport" style="font-size: 0.8125rem; color: var(--text-secondary); margin: 0; flex: 1;">
                        Uang Transport PP (per perjalanan)
                      </label>
                      <input
                        id="calc-transport"
                        type="number"
                        class="form-control amount"
                        style="width: 150px; padding: 0.25rem 0.5rem; font-size: 0.8125rem; height: 34px; text-align: right;"
                        placeholder="0"
                        min="0"
                        value={estimasiTransport()}
                        onInput={(e) => setEstimasiTransport(e.currentTarget.value)}
                      />
                    </div>
                    <Show
                      when={est().rate.uang_transport > 0}
                      fallback={
                        <span style="font-size: 0.8125rem; color: var(--text-muted);">
                          Tarif master transport belum diatur (bisa diisi manual).
                        </span>
                      }
                    >
                      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8125rem; color: var(--text-muted);">
                        <span>Master PP: {formatRp(est().rate.uang_transport)}</span>
                        <Show when={Number(estimasiTransport() || 0) !== est().rate.uang_transport}>
                          <button
                            type="button"
                            class="btn btn-sm btn-outline"
                            style="min-height: 26px; padding: 0.125rem 0.5rem;"
                            onClick={() => setEstimasiTransport(String(est().rate.uang_transport))}
                          >
                            Pakai tarif master
                          </button>
                        </Show>
                      </div>
                    </Show>
                  </div>

                  <div style="border-top: 1px dashed var(--border-subtle); padding-top: 0.5rem; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                    <div>
                      <div style="font-size: 0.6875rem; color: var(--text-muted);">Total Pagu Estimasi:</div>
                      <div class="amount text-sky" style="font-size: 1rem; font-weight: 800;">
                        {formatRp(totalPaguEstimasi())}
                      </div>
                    </div>
                    <button
                      type="button"
                      class="btn btn-sm btn-primary"
                      style="font-size: 0.75rem; font-weight: 700; padding: 0.375rem 0.75rem;"
                      onClick={() => setNominalMonita(String(totalPaguEstimasi()))}
                    >
                      Gunakan sebagai Pagu Monita
                    </button>
                  </div>
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
                  <option value="berlangsung">Berlangsung (by date)</option>
                  <option value="selesai">Proses · Urus Berkas (Belum TTD)</option>
                  <option value="diajukan">Proses · Pembayaran (Sudah TTD)</option>
                  <option value="lunas">Selesai</option>
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
