import { Component, createSignal, createResource, For, Show, onMount, onCleanup } from 'solid-js';
import { A } from '@solidjs/router';
import {
  getCategories,
  getPaymentMethods,
  getSBMRates,
  createCategory,
  updateCategory,
  deleteCategoryApi,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethodApi,
  createSBMRate,
  updateSBMRate,
  deleteSBMRate,
  type SBMRate,
} from '../../api';
import {
  ArrowLeftIcon,
  TagIcon,
  CreditCardIcon,
  MapPinIcon,
  EditIcon,
  TrashIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
  CheckIcon,
} from '../../components/Icons';
import ChipsInput from '../../components/ChipsInput';
import { formatRp } from '../../store/privacy';

const MasterListManager: Component<{
  title: string;
  items: () => { id: string; nama: string }[] | undefined;
  onAdd: (nama: string) => Promise<void>;
  onUpdate: (id: string, nama: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  refetch: () => void;
}> = (props) => {
  const [newName, setNewName] = createSignal('');
  const [editId, setEditId] = createSignal('');
  const [editName, setEditName] = createSignal('');
  const [error, setError] = createSignal('');

  const handleAdd = async () => {
    if (!newName().trim()) return;
    setError('');
    try {
      await props.onAdd(newName().trim());
      setNewName('');
      props.refetch();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdate = async () => {
    if (!editName().trim()) return;
    setError('');
    try {
      await props.onUpdate(editId(), editName().trim());
      setEditId('');
      props.refetch();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus item ini?')) return;
    setError('');
    try {
      await props.onDelete(id);
      props.refetch();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div class="doppel-card">
      <div class="doppel-inner">
        <h3 style="font-size: 0.9375rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.875rem;">
          {props.title}
        </h3>
        {error() && <p class="text-rose" style="margin-bottom: 0.75rem; font-size: 0.8125rem;">{error()}</p>}

        <div style="display: flex; flex-direction: column; margin-bottom: 1rem;">
          <Show when={props.items()} fallback={<p style="font-size: 0.8125rem; color: var(--text-muted); padding: 0.5rem 0;">Memuat...</p>}>
            <Show when={props.items()!.length > 0} fallback={<p style="font-size: 0.8125rem; color: var(--text-muted); padding: 0.5rem 0;">Belum ada data</p>}>
              <For each={props.items()}>
                {(item) => (
                  <div class="admin-item-row">
                    <Show when={editId() === item.id} fallback={
                      <>
                        <span class="badge badge-gray" style="font-size: 0.8125rem; font-weight: 500;">
                          {item.nama}
                        </span>
                        <div style="display: flex; gap: 0.375rem;">
                          <button
                            type="button"
                            class="btn-icon-subtle"
                            onClick={() => { setEditId(item.id); setEditName(item.nama); }}
                            title="Edit"
                            aria-label="Edit item"
                          >
                            <EditIcon size={14} />
                          </button>
                          <button
                            type="button"
                            class="btn-icon-subtle"
                            style="color: var(--rose);"
                            onClick={() => handleDelete(item.id)}
                            title="Hapus"
                            aria-label="Hapus item"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </>
                    }>
                      <input
                        class="form-control"
                        value={editName()}
                        onInput={(e) => setEditName(e.currentTarget.value)}
                        style="flex: 1; min-height: 36px; padding: 0.25rem 0.625rem; font-size: 0.8125rem;"
                      />
                      <div style="display: flex; gap: 0.375rem; margin-left: 0.5rem;">
                        <button type="button" class="btn btn-sm btn-primary" onClick={handleUpdate}>Simpan</button>
                        <button type="button" class="btn btn-sm btn-outline" onClick={() => setEditId('')}>Batal</button>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </Show>
          </Show>
        </div>

        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <input
            class="form-control"
            value={newName()}
            onInput={(e) => setNewName(e.currentTarget.value)}
            placeholder={`Tambah ${props.title.toLowerCase()}...`}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            style="flex: 1;"
          />
          <button type="button" class="btn btn-primary btn-sm" onClick={handleAdd} style="white-space: nowrap;">
            <PlusIcon size={14} /> Tambah
          </button>
        </div>
      </div>
    </div>
  );
};

const SBMRateManager: Component<{
  rates: () => SBMRate[] | undefined;
  refetch: () => void;
}> = (props) => {
  const [search, setSearch] = createSignal('');
  const [editingItem, setEditingItem] = createSignal<SBMRate | null>(null);
  const [isAdding, setIsAdding] = createSignal(false);

  // Form states
  const [formProvinsi, setFormProvinsi] = createSignal('');
  const [formKota, setFormKota] = createSignal<string[]>([]);
  const [formUangHarian, setFormUangHarian] = createSignal('');
  const [formUangTransport, setFormUangTransport] = createSignal('');
  const [error, setError] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [isProvOpen, setIsProvOpen] = createSignal(false);
  let provDropdownRef: HTMLDivElement | undefined;

  onMount(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (provDropdownRef && !provDropdownRef.contains(e.target as Node)) {
        setIsProvOpen(false);
      }
    };
    window.addEventListener('click', handleDocClick);
    onCleanup(() => window.removeEventListener('click', handleDocClick));
  });

  const filteredRates = () => {
    const q = search().toLowerCase().trim();
    if (!q) return props.rates() || [];
    return (props.rates() || []).filter(
      (r) =>
        r.provinsi.toLowerCase().includes(q) ||
        (r.ibukota && r.ibukota.toLowerCase().includes(q)) ||
        (r.kota && r.kota.some((k) => k.toLowerCase().includes(q)))
    );
  };

  const matchingProvinces = () => {
    const q = formProvinsi().toLowerCase().trim();
    const rates = props.rates() || [];
    if (!q) return rates;
    return rates.filter(
      (r) =>
        r.provinsi.toLowerCase().includes(q) ||
        (r.ibukota && r.ibukota.toLowerCase().includes(q)) ||
        (r.kota && r.kota.some((k) => k.toLowerCase().includes(q)))
    );
  };

  const existingRateForInput = () => {
    const q = formProvinsi().toLowerCase().trim();
    if (!q) return undefined;
    return (props.rates() || []).find((r) => r.provinsi.toLowerCase() === q);
  };

  const openAdd = () => {
    setEditingItem(null);
    setFormProvinsi('');
    setFormKota([]);
    setFormUangHarian('');
    setFormUangTransport('');
    setError('');
    setIsAdding(true);
    setIsProvOpen(false);
  };

  const openEdit = (rate: SBMRate) => {
    setIsAdding(false);
    setEditingItem(rate);
    setFormProvinsi(rate.provinsi);
    setFormKota(rate.kota && rate.kota.length > 0 ? [...rate.kota] : (rate.ibukota ? [rate.ibukota] : []));
    setFormUangHarian(String(rate.uang_harian));
    setFormUangTransport(rate.uang_transport ? String(rate.uang_transport) : '');
    setError('');
    setIsProvOpen(false);
  };

  const handleSelectProvince = (rate: SBMRate) => {
    setFormProvinsi(rate.provinsi);
    setFormKota(rate.kota && rate.kota.length > 0 ? [...rate.kota] : (rate.ibukota ? [rate.ibukota] : []));
    setFormUangHarian(String(rate.uang_harian));
    setFormUangTransport(rate.uang_transport ? String(rate.uang_transport) : '');
    setIsProvOpen(false);
  };

  const handleSave = async (e: Event) => {
    e.preventDefault();
    setError('');
    const prov = formProvinsi().trim();
    const uang = parseInt(formUangHarian());
    const uangTransport = parseInt(formUangTransport()) || 0;
    if (!prov || isNaN(uang) || uang <= 0) {
      setError('Provinsi dan uang harian (> 0) wajib diisi');
      return;
    }

    const parsedKota = formKota();

    setSubmitting(true);
    try {
      if (editingItem()) {
        await updateSBMRate(editingItem()!.id, {
          provinsi: prov,
          ibukota: parsedKota[0] || '',
          kota: parsedKota,
          uang_harian: uang,
          uang_transport: uangTransport,
        });
        setEditingItem(null);
      } else {
        const existing = (props.rates() || []).find(
          (r) => r.provinsi.toLowerCase() === prov.toLowerCase()
        );
        if (existing) {
          await updateSBMRate(existing.id, {
            provinsi: prov,
            ibukota: parsedKota[0] || '',
            kota: parsedKota,
            uang_harian: uang,
            uang_transport: uangTransport,
          });
        } else {
          await createSBMRate({
            provinsi: prov,
            ibukota: parsedKota[0] || '',
            kota: parsedKota,
            uang_harian: uang,
            uang_transport: uangTransport,
          });
        }
        setIsAdding(false);
      }
      setSearch('');
      props.refetch();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, prov: string) => {
    if (!confirm(`Hapus tarif uang harian untuk ${prov}?`)) return;
    try {
      await deleteSBMRate(id);
      props.refetch();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div class="doppel-card">
      <div class="doppel-inner">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.875rem;">
          <h3 style="font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin: 0;">
            Tarif Uang Harian Wilayah
          </h3>
          <button type="button" class="btn btn-primary btn-sm" onClick={openAdd}>
            <PlusIcon size={14} /> Tambah Tarif
          </button>
        </div>

        {/* Search */}
        <div class="search-input-wrap" style="margin-bottom: 0.75rem;">
          <span class="search-input-icon">
            <SearchIcon size={16} />
          </span>
          <input
            class="form-control"
            placeholder="Cari provinsi atau ibukota..."
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
        </div>

        {/* List of SBM Rates */}
        <div style="display: flex; flex-direction: column; max-height: 480px; overflow-y: auto;">
          <Show when={props.rates()} fallback={<p style="font-size: 0.8125rem; color: var(--text-muted); padding: 0.5rem 0;">Memuat tarif uang harian...</p>}>
            <Show when={filteredRates().length > 0} fallback={<p style="font-size: 0.8125rem; color: var(--text-muted); padding: 0.5rem 0;">Tidak ada data tarif uang harian</p>}>
              <For each={filteredRates()}>
                {(rate) => (
                  <div class="admin-item-row" style="padding: 0.75rem 0;">
                    <div>
                      <div style="font-size: 0.875rem; font-weight: 600; color: var(--text-primary);">
                        {rate.provinsi}
                      </div>
                      <div class="city-pills">
                        {(() => {
                          const cities = rate.kota && rate.kota.length > 0 ? rate.kota : (rate.ibukota ? [rate.ibukota] : []);
                          if (cities.length === 0) return <span class="city-pill">-</span>;
                          const show = cities.slice(0, 3);
                          const rest = cities.length - 3;
                          return <>
                            <For each={show}>{(c) => <span class="city-pill">{c}</span>}</For>
                            {rest > 0 && <span class="city-pill-more" title={cities.slice(3).join(', ')}>+{rest} lainnya</span>}
                          </>;
                        })()}
                      </div>
                      <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: baseline; margin-top: 0.25rem;">
                        <div class="amount text-emerald" style="font-size: 0.8125rem; font-weight: 700;">
                          {formatRp(rate.uang_harian)}{' '}
                          <span style="font-size: 0.8125rem; color: var(--text-muted); font-weight: 500;">
                            / hari
                          </span>
                        </div>
                        <div class="amount" style="font-size: 0.8125rem; font-weight: 600; color: var(--sky);">
                          {rate.uang_transport > 0 ? `${formatRp(rate.uang_transport)} PP / trip` : 'Transport PP belum diatur'}
                        </div>
                      </div>
                    </div>

                    <div style="display: flex; gap: 0.375rem;">
                      <button
                        type="button"
                        class="btn-icon-subtle"
                        onClick={() => openEdit(rate)}
                        title="Edit"
                        aria-label="Edit Tarif"
                      >
                        <EditIcon size={14} />
                      </button>
                      <button
                        type="button"
                        class="btn-icon-subtle"
                        style="color: var(--rose);"
                        onClick={() => handleDelete(rate.id, rate.provinsi)}
                        title="Hapus"
                        aria-label="Hapus Tarif"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </Show>
        </div>

        {/* Modal Add / Edit SBM */}
        <Show when={isAdding() || editingItem()}>
          <div class="modal-overlay" onClick={() => { setIsAdding(false); setEditingItem(null); }}>
            <div class="modal-content" onClick={(e) => e.stopPropagation()}>
              <div class="modal-handle" />
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 class="modal-title" style="margin: 0;">
                  {editingItem() ? 'Edit Tarif Uang Harian' : 'Tambah Tarif Uang Harian Baru'}
                </h3>
                <button
                  type="button"
                  class="btn-icon-subtle"
                  onClick={() => { setIsAdding(false); setEditingItem(null); }}
                  aria-label="Tutup"
                >
                  <XIcon size={18} />
                </button>
              </div>

              {error() && <p class="text-rose" style="font-size: 0.8125rem; margin-bottom: 0.75rem;">{error()}</p>}

              <form onSubmit={handleSave}>
                <div class="form-group" ref={provDropdownRef} style="position: relative;">
                  <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.375rem;">
                    <label for="provinsi" style="margin-bottom: 0;">Nama Provinsi</label>
                    <span style="font-size: 0.6875rem; color: var(--text-muted);">Pilih terdaftar atau buat baru</span>
                  </div>
                  <div style="position: relative;">
                    <input
                      id="provinsi"
                      class="form-control"
                      value={formProvinsi()}
                      onFocus={() => setIsProvOpen(true)}
                      onInput={(e) => {
                        setFormProvinsi(e.currentTarget.value);
                        setIsProvOpen(true);
                      }}
                      placeholder="Cari atau ketik provinsi (contoh: Jawa Timur)..."
                      autocomplete="off"
                      required
                    />
                    <Show when={formProvinsi().trim()}>
                      <button
                        type="button"
                        class="btn-icon-subtle"
                        style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); padding: 0.25rem;"
                        onClick={() => {
                          setFormProvinsi('');
                          setFormKota([]);
                          setFormUangHarian('');
                          setFormUangTransport('');
                          setIsProvOpen(true);
                        }}
                        title="Hapus"
                      >
                        <XIcon size={14} />
                      </button>
                    </Show>
                  </div>

                  {/* Dropdown Select-or-Create Options */}
                  <Show when={isProvOpen()}>
                    <div
                      style="position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 100; max-height: 220px; overflow-y: auto; background: var(--bg-surface-elevated); border: 1px solid var(--border-hover); border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,0.6);"
                    >
                      <Show when={formProvinsi().trim() && !existingRateForInput()}>
                        <button
                          type="button"
                          onClick={() => setIsProvOpen(false)}
                          style="width: 100%; text-align: left; padding: 0.625rem 0.875rem; background: var(--sky-bg); border: none; border-bottom: 1px solid var(--border-subtle); color: var(--sky); font-size: 0.8125rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.375rem;"
                        >
                          <PlusIcon size={14} />
                          <span>Gunakan sebagai provinsi baru: "{formProvinsi().trim()}"</span>
                        </button>
                      </Show>

                      <For
                        each={matchingProvinces()}
                        fallback={
                          <div style="padding: 0.75rem; font-size: 0.8125rem; color: var(--text-muted); text-align: center;">
                            Tidak ada provinsi cocok. Ketik untuk membuat baru.
                          </div>
                        }
                      >
                        {(rate) => (
                          <button
                            type="button"
                            onClick={() => handleSelectProvince(rate)}
                            style={`width: 100%; text-align: left; padding: 0.5rem 0.875rem; display: flex; justify-content: space-between; align-items: center; border: none; background: ${formProvinsi().toLowerCase().trim() === rate.provinsi.toLowerCase() ? 'rgba(56, 189, 248, 0.12)' : 'transparent'}; color: var(--text-primary); cursor: pointer; border-bottom: 1px solid var(--border-subtle);`}
                          >
                            <div>
                              <div style="font-size: 0.8125rem; font-weight: 600;">{rate.provinsi}</div>
                              <Show when={rate.ibukota}>
                                <div style="font-size: 0.6875rem; color: var(--text-muted);">{rate.ibukota}</div>
                              </Show>
                            </div>
                            <div class="amount text-emerald" style="font-size: 0.75rem; font-weight: 700;">
                              {formatRp(rate.uang_harian)}
                            </div>
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>

                  {/* Informational Hint Tag */}
                  <Show when={existingRateForInput()}>
                    {(rate) => (
                      <div style="font-size: 0.75rem; color: var(--sky); margin-top: 0.375rem; display: flex; align-items: center; gap: 0.25rem;">
                        <CheckIcon size={13} />
                        <span>Provinsi terdaftar — simpan untuk perbarui tarif ({formatRp(rate().uang_harian)}/hari)</span>
                      </div>
                    )}
                  </Show>
                  <Show when={formProvinsi().trim() && !existingRateForInput()}>
                    <div style="font-size: 0.75rem; color: var(--emerald); margin-top: 0.375rem; display: flex; align-items: center; gap: 0.25rem;">
                      <PlusIcon size={13} />
                      <span>Provinsi baru akan ditambahkan ke master tarif wilayah</span>
                    </div>
                  </Show>
                </div>

                <div class="form-group">
                  <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.375rem;">
                    <label for="kota" style="margin-bottom: 0;">Daftar Kota / Kabupaten</label>
                    <span style="font-size: 0.6875rem; color: var(--text-muted);">Ketik lalu tekan Enter</span>
                  </div>
                  <ChipsInput
                    values={formKota}
                    onChange={setFormKota}
                    placeholder="Contoh: Bandung, Bogor, Bekasi..."
                  />
                  <span style="font-size: 0.6875rem; color: var(--text-muted); display: block; margin-top: 0.25rem;">
                    Daftar kota/kabupaten yang berlaku tarif uang harian provinsi ini
                  </span>
                </div>

                <div class="form-group">
                  <label for="uangHarian">Tarif Uang Harian per Hari (Rp)</label>
                  <input
                    id="uangHarian"
                    type="number"
                    class="form-control amount"
                    value={formUangHarian()}
                    onInput={(e) => setFormUangHarian(e.currentTarget.value)}
                    placeholder="Contoh: 410000"
                    min="1"
                    required
                  />
                </div>

                <div class="form-group">
                  <label for="uangTransport">Tarif Uang Transport PP per Perjalanan (Rp, Opsional)</label>
                  <input
                    id="uangTransport"
                    type="number"
                    class="form-control amount"
                    value={formUangTransport()}
                    onInput={(e) => setFormUangTransport(e.currentTarget.value)}
                    placeholder="0 (kosongkan jika belum diketahui)"
                    min="0"
                  />
                  <span style="font-size: 0.8125rem; color: var(--text-muted); display: block; margin-top: 0.25rem;">
                    Lump sum pergi-pulang per perjalanan dinas (tidak dikalikan jumlah hari)
                  </span>
                </div>

                <div class="form-actions">
                  <button
                    type="button"
                    class="btn btn-outline"
                    onClick={() => { setIsAdding(false); setEditingItem(null); }}
                  >
                    Batal
                  </button>
                  <button type="submit" class="btn btn-primary" disabled={submitting()}>
                    {submitting() ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

const AdminMaster: Component = () => {
  const [tab, setTab] = createSignal<'categories' | 'payment_methods' | 'sbm'>('categories');
  const [categories, { refetch: refetchCats }] = createResource(getCategories);
  const [paymentMethods, { refetch: refetchPMs }] = createResource(getPaymentMethods);
  const [sbmRates, { refetch: refetchSBM }] = createResource(() => getSBMRates());

  return (
    <div class="page" style="padding-bottom: 6rem;">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
        <A href="/admin" class="btn-icon-subtle" aria-label="Kembali ke Admin Hub">
          <ArrowLeftIcon size={16} />
        </A>
        <div>
          <h2 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin: 0;">
            Master Data
          </h2>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">
            Kategori, Pembayaran & Tarif Uang Harian Wilayah
          </p>
        </div>
      </div>

      {/* Segment Tab Switcher */}
      <div class="segment-tabs">
        <button
          type="button"
          class={`segment-tab ${tab() === 'categories' ? 'active' : ''}`}
          onClick={() => setTab('categories')}
        >
          <TagIcon size={16} />
          <span>Kategori ({categories()?.length || 0})</span>
        </button>
        <button
          type="button"
          class={`segment-tab ${tab() === 'payment_methods' ? 'active' : ''}`}
          onClick={() => setTab('payment_methods')}
        >
          <CreditCardIcon size={16} />
          <span>Pembayaran ({paymentMethods()?.length || 0})</span>
        </button>
        <button
          type="button"
          class={`segment-tab ${tab() === 'sbm' ? 'active' : ''}`}
          onClick={() => setTab('sbm')}
        >
          <MapPinIcon size={16} />
          <span>Tarif SBM ({sbmRates()?.length || 0})</span>
        </button>
      </div>

      <Show when={tab() === 'categories'}>
        <MasterListManager
          title="Kategori Pengeluaran"
          items={categories}
          onAdd={(n) => createCategory(n).then(() => {})}
          onUpdate={(id, n) => updateCategory(id, n).then(() => {})}
          onDelete={(id) => deleteCategoryApi(id).then(() => {})}
          refetch={refetchCats}
        />
      </Show>

      <Show when={tab() === 'payment_methods'}>
        <MasterListManager
          title="Metode Pembayaran"
          items={paymentMethods}
          onAdd={(n) => createPaymentMethod(n).then(() => {})}
          onUpdate={(id, n) => updatePaymentMethod(id, n).then(() => {})}
          onDelete={(id) => deletePaymentMethodApi(id).then(() => {})}
          refetch={refetchPMs}
        />
      </Show>

      <Show when={tab() === 'sbm'}>
        <SBMRateManager rates={sbmRates} refetch={refetchSBM} />
      </Show>
    </div>
  );
};

export default AdminMaster;
