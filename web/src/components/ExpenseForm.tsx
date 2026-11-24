import { Component, createSignal, createResource, Show, For } from 'solid-js';
import { getCategories, getPaymentMethods, createExpense, updateExpense, type Expense } from '../api';

const ExpenseForm: Component<{
  tripId: string;
  expense: Expense | null;
  onClose: () => void;
  onSaved: () => void;
}> = (props) => {
  const isEdit = !!props.expense;
  const [categories] = createResource(getCategories);
  const [paymentMethods] = createResource(getPaymentMethods);

  const [categoryId, setCategoryId] = createSignal(props.expense?.category_id || '');
  const [pmId, setPmId] = createSignal(props.expense?.payment_method_id || '');
  const [deskripsi, setDeskripsi] = createSignal(props.expense?.deskripsi || '');
  const [jumlah, setJumlah] = createSignal(props.expense?.jumlah?.toString() || '');
  const [tanggal, setTanggal] = createSignal(props.expense?.tanggal || new Date().toISOString().slice(0, 10));
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    const amt = parseInt(jumlah());
    if (!amt || amt <= 0) {
      setError('Jumlah harus > 0');
      return;
    }
    setLoading(true);
    try {
      const data: any = {
        category_id: categoryId(),
        payment_method_id: pmId(),
        deskripsi: deskripsi(),
        jumlah: amt,
        tanggal: tanggal(),
      };
      if (isEdit) {
        await updateExpense(props.expense!.id, data);
      } else {
        await createExpense(props.tripId, data);
      }
      props.onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div class="modal-content">
        <div class="modal-handle" />
        <div class="modal-title">{isEdit ? 'Edit' : 'Tambah'} Pengeluaran</div>
        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label>Kategori</label>
            <Show when={categories()}>
              <select class="form-control" value={categoryId()} onInput={(e) => setCategoryId(e.currentTarget.value)} required>
                <option value="">Pilih kategori</option>
                <For each={categories()}>
                  {(cat) => <option value={cat.id}>{cat.nama}</option>}
                </For>
              </select>
            </Show>
          </div>
          <div class="form-group">
            <label>Metode Pembayaran</label>
            <Show when={paymentMethods()}>
              <select class="form-control" value={pmId()} onInput={(e) => setPmId(e.currentTarget.value)} required>
                <option value="">Pilih metode</option>
                <For each={paymentMethods()}>
                  {(pm) => <option value={pm.id}>{pm.nama}</option>}
                </For>
              </select>
            </Show>
          </div>
          <div class="form-group">
            <label>Deskripsi</label>
            <input class="form-control" value={deskripsi()} onInput={(e) => setDeskripsi(e.currentTarget.value)} placeholder="Makan siang" />
          </div>
          <div class="form-group">
            <label>Jumlah (Rp)</label>
            <input class="form-control num" type="number" value={jumlah()} onInput={(e) => setJumlah(e.currentTarget.value)} min="1" required />
          </div>
          <div class="form-group">
            <label>Tanggal</label>
            <input class="form-control" type="date" value={tanggal()} onInput={(e) => setTanggal(e.currentTarget.value)} required />
          </div>
          {error() && <p class="text-red" style="margin-bottom: 1rem">{error()}</p>}
          <div class="form-actions">
            <button type="button" class="btn btn-outline" onClick={props.onClose}>Batal</button>
            <button type="submit" class="btn" disabled={loading()}>
              {loading() ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseForm;
