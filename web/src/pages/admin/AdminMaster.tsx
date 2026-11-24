import { Component, createSignal, createResource, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import {
  getCategories, getPaymentMethods,
  createCategory, updateCategory, deleteCategoryApi,
  createPaymentMethod, updatePaymentMethod, deletePaymentMethodApi,
} from '../../api';
import { ArrowLeftIcon, TagIcon, CreditCardIcon, EditIcon, TrashIcon, PlusIcon } from '../../components/Icons';

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

const AdminMaster: Component = () => {
  const [tab, setTab] = createSignal<'categories' | 'payment_methods'>('categories');
  const [categories, { refetch: refetchCats }] = createResource(getCategories);
  const [paymentMethods, { refetch: refetchPMs }] = createResource(getPaymentMethods);

  return (
    <div class="page">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
        <A href="/admin" class="btn-icon-subtle" aria-label="Kembali ke Admin Hub">
          <ArrowLeftIcon size={16} />
        </A>
        <div>
          <h2 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin: 0;">
            Master Data
          </h2>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">
            Kategori & Metode Pembayaran Sistem
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
    </div>
  );
};

export default AdminMaster;
