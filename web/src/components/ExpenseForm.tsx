import { Component, createSignal, createResource, Show, For, onMount, onCleanup } from 'solid-js';
import { getCategories, getPaymentMethods, createExpense, updateExpense, type Expense } from '../api';
import { XIcon } from './Icons';

const formatThousands = (raw: string) => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '0';
  return new Intl.NumberFormat('id-ID').format(parseInt(digits, 10));
};

const ExpenseForm: Component<{
  tripId: string;
  expense: Expense | null;
  defaultDate?: string;
  onClose: () => void;
  onSaved: () => void;
}> = (props) => {
  const isEdit = !!props.expense;
  const [categories] = createResource(getCategories);
  const [paymentMethods] = createResource(getPaymentMethods);

  const [categoryId, setCategoryId] = createSignal(props.expense?.category_id || '');
  const [pmId, setPmId] = createSignal(props.expense?.payment_method_id || '');
  const [deskripsi, setDeskripsi] = createSignal(props.expense?.deskripsi || '');
  const [jumlah, setJumlah] = createSignal(
    props.expense?.jumlah != null ? String(props.expense.jumlah) : '0'
  );
  const [tanggal, setTanggal] = createSignal(props.expense?.tanggal || props.defaultDate || new Date().toISOString().slice(0, 10));
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  onMount(() => {
    document.body.style.overflow = 'hidden';
  });
  onCleanup(() => {
    document.body.style.overflow = '';
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    const amt = jumlah() === '' ? 0 : parseInt(jumlah());
    if (isNaN(amt) || amt < 0) {
      setError('Jumlah harus >= 0');
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
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 class="modal-title" style="margin: 0;">{isEdit ? 'Edit Pengeluaran' : 'Catat Pengeluaran Baru'}</h3>
          <button
            type="button"
            class="btn-icon-subtle"
            onClick={props.onClose}
            aria-label="Tutup"
          >
            <XIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} class="modal-form-body">
          <div class="form-group">
            <label>Kategori</label>
            <select
              class="form-control"
              value={categoryId()}
              onInput={(e) => setCategoryId(e.currentTarget.value)}
              disabled={categories.loading}
              required
            >
              <option value="">
                {categories.loading ? 'Memuat kategori...' : categories.error ? 'Gagal memuat kategori' : 'Pilih kategori...'}
              </option>
              <For each={categories() || []}>
                {(cat) => <option value={cat.id}>{cat.nama}</option>}
              </For>
            </select>
          </div>

          <div class="form-group">
            <label>Metode Pembayaran</label>
            <select
              class="form-control"
              value={pmId()}
              onInput={(e) => setPmId(e.currentTarget.value)}
              disabled={paymentMethods.loading}
              required
            >
              <option value="">
                {paymentMethods.loading ? 'Memuat metode...' : paymentMethods.error ? 'Gagal memuat metode' : 'Pilih metode...'}
              </option>
              <For each={paymentMethods() || []}>
                {(pm) => <option value={pm.id}>{pm.nama}</option>}
              </For>
            </select>
          </div>

          <div class="form-group">
            <label>Deskripsi (Opsional)</label>
            <input
              class="form-control"
              value={deskripsi()}
              onInput={(e) => setDeskripsi(e.currentTarget.value)}
              placeholder="Contoh: Tiket Kereta / Makan Malam"
            />
          </div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.375rem;">
              <label style="margin-bottom: 0;">Jumlah Nominal</label>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Default 0 (belum pasti)</span>
            </div>
            <div style="position: relative; display: flex; align-items: center;">
              <span style="position: absolute; left: 0.875rem; font-size: 1rem; font-weight: 700; color: var(--text-muted); pointer-events: none;">
                Rp
              </span>
              <input
                class="form-control amount"
                type="text"
                inputMode="numeric"
                value={formatThousands(jumlah())}
                onInput={(e) => {
                  const digits = e.currentTarget.value.replace(/\D/g, '');
                  const normalized = digits.replace(/^0+(?=\d)/, '');
                  const next = normalized || '0';
                  setJumlah(next);
                  e.currentTarget.value = formatThousands(next);
                }}
                placeholder="0"
                style="padding-left: 2.75rem; font-size: 1.125rem; font-weight: 700;"
              />
            </div>
          </div>

          <div class="form-group">
            <label>Tanggal Transaksi</label>
            <input
              class="form-control"
              type="date"
              value={tanggal()}
              onInput={(e) => setTanggal(e.currentTarget.value)}
              required
            />
          </div>

          {error() && <p class="text-rose" style="margin-bottom: 1rem; font-size: 0.8125rem;">{error()}</p>}

          <div class="form-actions modal-form-actions">
            <button type="button" class="btn btn-outline" onClick={props.onClose}>Batal</button>
            <button type="submit" class="btn btn-primary" disabled={loading()}>
              {loading() ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseForm;
