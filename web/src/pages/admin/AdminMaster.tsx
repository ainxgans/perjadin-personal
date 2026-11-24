import { Component, createSignal, createResource, For, Show } from 'solid-js';
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
} from '../../components/Icons';

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

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
        <h3 style="font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 0.875rem;">
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
  const [formIbukota, setFormIbukota] = createSignal('');
  const [formUangHarian, setFormUangHarian] = createSignal('');
  const [error, setError] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);

  const filteredRates = () => {
    const q = search().toLowerCase().trim();
    if (!q) return props.rates() || [];
    return (props.rates() || []).filter(
      (r) =>
        r.provinsi.toLowerCase().includes(q) ||
        (r.ibukota && r.ibukota.toLowerCase().includes(q))
    );
  };

  const openAdd = () => {
    setEditingItem(null);
    setFormProvinsi('');
    setFormIbukota('');
    setFormUangHarian('');
    setError('');
    setIsAdding(true);
  };

  const openEdit = (rate: SBMRate) => {
    setIsAdding(false);
    setEditingItem(rate);
    setFormProvinsi(rate.provinsi);
    setFormIbukota(rate.ibukota || '');
    setFormUangHarian(String(rate.uang_harian));
    setError('');
  };

  const handleSave = async (e: Event) => {
    e.preventDefault();
    setError('');
    const prov = formProvinsi().trim();
    const uang = parseInt(formUangHarian());
    if (!prov || isNaN(uang) || uang <= 0) {
      setError('Provinsi dan uang harian (> 0) wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      if (editingItem()) {
        await updateSBMRate(editingItem()!.id, {
          provinsi: prov,
          ibukota: formIbukota().trim(),
          uang_harian: uang,
        });
        setEditingItem(null);
      } else {
        await createSBMRate({
          provinsi: prov,
          ibukota: formIbukota().trim(),
          uang_harian: uang,
        });
        setIsAdding(false);
      }
      props.refetch();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, prov: string) => {
    if (!confirm(`Hapus tarif SBM untuk ${prov}?`)) return;
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
            Standar Biaya Masukan (Uang Harian)
          </h3>
          <button type="button" class="btn btn-primary btn-sm" onClick={openAdd}>
            <PlusIcon size={14} /> Tambah SBM
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
          <Show when={props.rates()} fallback={<p style="font-size: 0.8125rem; color: var(--text-muted); padding: 0.5rem 0;">Memuat SBM...</p>}>
            <Show when={filteredRates().length > 0} fallback={<p style="font-size: 0.8125rem; color: var(--text-muted); padding: 0.5rem 0;">Tidak ada data tarif SBM</p>}>
              <For each={filteredRates()}>
                {(rate) => (
                  <div class="admin-item-row" style="padding: 0.75rem 0;">
                    <div>
                      <div style="font-size: 0.875rem; font-weight: 600; color: var(--text-primary);">
                        {rate.provinsi}
                        {rate.ibukota ? (
                          <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.375rem;">
                            ({rate.ibukota})
                          </span>
                        ) : null}
                      </div>
                      <div class="amount text-emerald" style="font-size: 0.8125rem; font-weight: 700; margin-top: 0.125rem;">
                        {formatRp(rate.uang_harian)}{' '}
                        <span style="font-size: 0.6875rem; color: var(--text-muted); font-weight: 500;">
                          / hari
                        </span>
                      </div>
                    </div>

                    <div style="display: flex; gap: 0.375rem;">
                      <button
                        type="button"
                        class="btn-icon-subtle"
                        onClick={() => openEdit(rate)}
                        title="Edit"
                        aria-label="Edit SBM"
                      >
                        <EditIcon size={14} />
                      </button>
                      <button
                        type="button"
                        class="btn-icon-subtle"
                        style="color: var(--rose);"
                        onClick={() => handleDelete(rate.id, rate.provinsi)}
                        title="Hapus"
                        aria-label="Hapus SBM"
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
                  {editingItem() ? 'Edit Tarif SBM' : 'Tambah Tarif SBM Baru'}
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
                <div class="form-group">
                  <label for="provinsi">Nama Provinsi</label>
                  <input
                    id="provinsi"
                    class="form-control"
                    value={formProvinsi()}
                    onInput={(e) => setFormProvinsi(e.currentTarget.value)}
                    placeholder="Contoh: Jawa Timur"
                    required
                  />
                </div>

                <div class="form-group">
                  <label for="ibukota">Ibukota / Wilayah Pusat (Opsional)</label>
                  <input
                    id="ibukota"
                    class="form-control"
                    value={formIbukota()}
                    onInput={(e) => setFormIbukota(e.currentTarget.value)}
                    placeholder="Contoh: Surabaya"
                  />
                </div>

                <div class="form-group">
                  <label for="uangHarian">Tarif Uang Harian (Rp)</label>
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
  const [sbmRates, { refetch: refetchSBM }] = createResource(getSBMRates);

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
            Kategori, Pembayaran & Tarif Standar Biaya Masukan
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
          <TagIcon size={14} />
          <span>Kategori ({categories()?.length || 0})</span>
        </button>
        <button
          type="button"
          class={`segment-tab ${tab() === 'payment_methods' ? 'active' : ''}`}
          onClick={() => setTab('payment_methods')}
        >
          <CreditCardIcon size={14} />
          <span>Pembayaran ({paymentMethods()?.length || 0})</span>
        </button>
        <button
          type="button"
          class={`segment-tab ${tab() === 'sbm' ? 'active' : ''}`}
          onClick={() => setTab('sbm')}
        >
          <MapPinIcon size={14} />
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
