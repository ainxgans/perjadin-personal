import { Component, createSignal, createResource, For, Show } from 'solid-js';
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
    if (!newName()) return;
    setError('');
    try {
      await props.onAdd(newName());
      setNewName('');
      props.refetch();
    } catch (e: any) { setError(e.message); }
  };

  const handleUpdate = async () => {
    if (!editName()) return;
    setError('');
    try {
      await props.onUpdate(editId(), editName());
      setEditId('');
      props.refetch();
    } catch (e: any) { setError(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus?')) return;
    setError('');
    try {
      await props.onDelete(id);
      props.refetch();
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div class="admin-section">
      <h3>{props.title}</h3>
      {error() && <p class="text-red" style="margin-bottom: 0.5rem; font-size: 0.8125rem">{error()}</p>}
      <Show when={props.items()}>
        <For each={props.items()}>
          {(item) => (
            <div class="admin-item">
              <Show when={editId() === item.id} fallback={
                <>
                  <span>{item.nama}</span>
                  <div style="display: flex; gap: 0.25rem">
                    <button class="btn-sm" onClick={() => { setEditId(item.id); setEditName(item.nama); }}>Edit</button>
                    <button class="btn-sm btn-danger" onClick={() => handleDelete(item.id)}>Hapus</button>
                  </div>
                </>
              }>
                <input value={editName()} onInput={(e) => setEditName(e.currentTarget.value)}
                  style="flex:1; min-height:36px; padding:0.375rem; border:1px solid var(--gray-200); border-radius:6px" />
                <div style="display: flex; gap: 0.25rem; margin-left: 0.5rem">
                  <button class="btn-sm" onClick={handleUpdate}>Simpan</button>
                  <button class="btn-sm btn-outline" onClick={() => setEditId('')}>Batal</button>
                </div>
              </Show>
            </div>
          )}
        </For>
      </Show>
      <div class="admin-add">
        <input value={newName()} onInput={(e) => setNewName(e.currentTarget.value)}
          placeholder={`Tambah ${props.title.toLowerCase()}`}
          style="min-height:44px; padding:0.625rem; border:1px solid var(--gray-200); border-radius:8px" />
        <button class="btn-sm" onClick={handleAdd}>+</button>
      </div>
    </div>
  );
};

const Admin: Component = () => {
  const [categories, { refetch: refetchCats }] = createResource(getCategories);
  const [paymentMethods, { refetch: refetchPMs }] = createResource(getPaymentMethods);

  return (
    <div class="page">
      <h2>Admin</h2>
      <br />
      <AdminSection
        title="Kategori"
        items={categories}
        onAdd={(n) => createCategory(n).then(() => {})}
        onUpdate={(id, n) => updateCategory(id, n).then(() => {})}
        onDelete={(id) => deleteCategoryApi(id).then(() => {})}
        refetch={refetchCats}
      />
      <AdminSection
        title="Metode Pembayaran"
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
