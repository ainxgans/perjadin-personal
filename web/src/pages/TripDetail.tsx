import { Component, createSignal, createResource, Show, For } from 'solid-js';
import { useParams, useNavigate, A } from '@solidjs/router';
import { getTrip, getExpenses, deleteTrip, deleteExpense, type Expense } from '../api';
import StatusBadge from '../components/StatusBadge';
import ExpenseForm from '../components/ExpenseForm';

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const TripDetail: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [trip, { refetch: refetchTrip }] = createResource(() => params.id, getTrip);
  const [expenses, { refetch: refetchExpenses }] = createResource(() => params.id, getExpenses);
  const [showForm, setShowForm] = createSignal(false);
  const [editingExpense, setEditingExpense] = createSignal<Expense | null>(null);

  const handleDeleteTrip = async () => {
    if (!confirm('Hapus perjalanan dinas ini?')) return;
    await deleteTrip(params.id);
    navigate('/');
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Hapus pengeluaran ini?')) return;
    await deleteExpense(id);
    refetchExpenses();
    refetchTrip();
  };

  const handleExpenseSaved = () => {
    setShowForm(false);
    setEditingExpense(null);
    refetchExpenses();
    refetchTrip();
  };

  const openEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setShowForm(true);
  };

  // Group expenses by category
  const groupedExpenses = () => {
    const exps = expenses() || [];
    const groups: Record<string, Expense[]> = {};
    for (const e of exps) {
      (groups[e.category_nama] ??= []).push(e);
    }
    return groups;
  };

  return (
    <div class="page">
      <Show when={trip()} fallback={<p>Memuat...</p>}>
        {(t) => (
          <>
            <div class="detail-header">
              <div style="display: flex; justify-content: space-between; align-items: start">
                <div>
                  <div class="detail-title">{t().nama}</div>
                  <div class="detail-meta">
                    {t().tujuan} · {t().tanggal_mulai} — {t().tanggal_selesai}
                  </div>
                </div>
                <StatusBadge status={t().status} />
              </div>

              <div class="detail-summary">
                <div>
                  <div class="detail-stat-label">Uang Dinas</div>
                  <div class="detail-stat-value">{t().uang_dinas != null ? formatRp(t().uang_dinas!) : '-'}</div>
                </div>
                <div>
                  <div class="detail-stat-label">Pengeluaran</div>
                  <div class="detail-stat-value">{formatRp(t().total_pengeluaran)}</div>
                </div>
                <div>
                  <div class="detail-stat-label">Saldo</div>
                  <div class={`detail-stat-value ${t().saldo >= 0 ? 'text-green' : 'text-red'}`}>
                    {formatRp(t().saldo)}
                  </div>
                </div>
              </div>

              <div class="detail-actions">
                <A href={`/trips/${params.id}/edit`} class="btn btn-sm">Edit</A>
                <button class="btn-sm btn-danger" onClick={handleDeleteTrip}>Hapus</button>
              </div>
            </div>

            {/* Expenses */}
            <div class="section-header">
              <h3>Pengeluaran</h3>
              <button class="btn-sm" onClick={() => { setEditingExpense(null); setShowForm(true); }}>+ Tambah</button>
            </div>

            <Show when={expenses()} fallback={<p>Memuat...</p>}>
              <Show when={expenses()!.length > 0} fallback={<p class="empty">Belum ada pengeluaran</p>}>
                <For each={Object.entries(groupedExpenses())}>
                  {([category, exps]) => (
                    <div class="expense-group">
                      <div class="expense-group-title">{category}</div>
                      <For each={exps}>
                        {(exp) => (
                          <div class="expense-row">
                            <div class="expense-info">
                              <div class="expense-desc">{exp.deskripsi || '-'}</div>
                              <div class="expense-meta">{exp.tanggal} · {exp.payment_method_nama}</div>
                            </div>
                            <div class="expense-amount">{formatRp(exp.jumlah)}</div>
                            <div class="expense-actions">
                              <button onClick={() => openEdit(exp)} title="Edit">✏️</button>
                              <button onClick={() => handleDeleteExpense(exp.id)} title="Hapus">🗑️</button>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  )}
                </For>
              </Show>
            </Show>
          </>
        )}
      </Show>

      <Show when={showForm()}>
        <ExpenseForm
          tripId={params.id}
          expense={editingExpense()}
          onClose={() => { setShowForm(false); setEditingExpense(null); }}
          onSaved={handleExpenseSaved}
        />
      </Show>
    </div>
  );
};

export default TripDetail;
