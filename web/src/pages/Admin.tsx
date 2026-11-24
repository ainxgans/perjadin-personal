import { Component, createSignal, createResource, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import {
  getCategories, getPaymentMethods,
  createCategory, updateCategory, deleteCategoryApi,
  createPaymentMethod, updatePaymentMethod, deletePaymentMethodApi,
} from '../api';

const AdminSection: Component<{
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
    if (!confirm('Hapus?')) return;
    setError('');
    try {
      await props.onDelete(id);
      props.refetch();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div class="card" style="margin-bottom: 1.25rem;">
      <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.875rem;">
        {props.title}
      </h3>
      {error() && <p class="text-red" style="margin-bottom: 0.75rem; font-size: 0.8125rem;">{error()}</p>}

      <div style="display: flex; flex-direction: column; margin-bottom: 1rem;">
        <Show when={props.items()} fallback={<p style="font-size: 0.8125rem; color: var(--text-muted); padding: 0.5rem 0;">Memuat...</p>}>
          <Show when={props.items()!.length > 0} fallback={<p style="font-size: 0.8125rem; color: var(--text-muted); padding: 0.5rem 0;">Belum ada data</p>}>
            <For each={props.items()}>
              {(item) => (
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle); gap: 0.5rem;">
                  <Show when={editId() === item.id} fallback={
                    <>
                      <span class="badge badge-gray" style="font-size: 0.8125rem; font-weight: 600; text-transform: none; padding: 0.25rem 0.625rem; color: var(--text-main);">
                        {item.nama}
                      </span>
                      <div style="display: flex; gap: 0.375rem;">
                        <button class="btn-sm btn-outline" onClick={() => { setEditId(item.id); setEditName(item.nama); }}>
                          Edit
                        </button>
                        <button class="btn-sm btn-danger" onClick={() => handleDelete(item.id)}>
                          Hapus
                        </button>
                      </div>
                    </>
                  }>
                    <input
                      class="form-control"
                      value={editName()}
                      onInput={(e) => setEditName(e.currentTarget.value)}
                      style="flex: 1; min-height: 34px; padding: 0.25rem 0.5rem; font-size: 0.875rem;"
                    />
                    <div style="display: flex; gap: 0.375rem; margin-left: 0.5rem;">
                      <button class="btn-sm" onClick={handleUpdate}>Simpan</button>
                      <button class="btn-sm btn-outline" onClick={() => setEditId('')}>Batal</button>
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
          placeholder={`Tambah ${props.title.replace('Kelola ', '').toLowerCase()}...`}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          style="flex: 1;"
        />
        <button class="btn btn-sm" onClick={handleAdd} style="white-space: nowrap; height: 46px;">
          + Tambah
        </button>
      </div>
    </div>
  );
};

const Admin: Component = () => {
  const [categories, { refetch: refetchCats }] = createResource(getCategories);
  const [paymentMethods, { refetch: refetchPMs }] = createResource(getPaymentMethods);

  return (
    <div class="page">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
        <A
          href="/"
          class="btn-sm btn-outline"
          aria-label="Kembali ke Dashboard"
          style="display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; padding: 0; text-decoration: none; border-radius: var(--radius-sm);"
        >
          ←
        </A>
        <h2 style="font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em; color: var(--text-main); margin: 0;">
          Admin
        </h2>
      </div>

      <AdminSection
        title="Kelola Kategori"
        items={categories}
        onAdd={(n) => createCategory(n).then(() => {})}
        onUpdate={(id, n) => updateCategory(id, n).then(() => {})}
        onDelete={(id) => deleteCategoryApi(id).then(() => {})}
        refetch={refetchCats}
      />
      <AdminSection
        title="Kelola Metode Pembayaran"
        items={paymentMethods}
        onAdd={(n) => createPaymentMethod(n).then(() => {})}
        onUpdate={(id, n) => updatePaymentMethod(id, n).then(() => {})}
        onDelete={(id) => deletePaymentMethodApi(id).then(() => {})}
        refetch={refetchPMs}
      />
    </div>
  );
};

export default Admin;
