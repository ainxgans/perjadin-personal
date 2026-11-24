import { Component, createSignal, createResource, Show, For } from 'solid-js';
import { useParams, useNavigate, A } from '@solidjs/router';
import { getTrip, getExpenses, deleteTrip, deleteExpense, type Expense } from '../api';
import StatusBadge from '../components/StatusBadge';
import ExpenseForm from '../components/ExpenseForm';

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const getPaymentBadgeClass = (method: string) => {
  const m = (method || '').toLowerCase();
  if (m.includes('pribadi')) return 'badge badge-purple';
  if (m.includes('koperasi')) return 'badge badge-green';
  if (m.includes('talangan')) return 'badge badge-orange';
  return 'badge badge-gray';
};

const TripDetail: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [trip, { refetch: refetchTrip }] = createResource(() => params.id, getTrip);
  const [expenses, { refetch: refetchExpenses }] = createResource(() => params.id, getExpenses);
  const [showForm, setShowForm] = createSignal(false);
  const [editingExpense, setEditingExpense] = createSignal<Expense | null>(null);

  const handleDeleteTrip = async () => {
    if (!confirm('Hapus perjalanan dinas ini?')) return;
    if (!params.id) return;
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

  const groupedExpenses = () => {
    const exps = expenses() || [];
    const groups: Record<string, Expense[]> = {};
    for (const e of exps) {
      (groups[e.category_nama] ??= []).push(e);
    }
    return groups;
  };

  const getCategoryTotal = (exps: Expense[]) =>
    exps.reduce((sum, e) => sum + e.jumlah, 0);

  return (
    <div class="page">
      <Show when={trip()} fallback={<p style="text-align: center; padding: 2rem 0; color: var(--text-muted);">Memuat...</p>}>
        {(t) => (
          <>
            {/* Doppelrand Hero Header */}
            <div class="detail-hero-doppel">
              <div class="detail-hero-inner">
                <div class="detail-hero-top">
                  <div>
                    <div class="detail-hero-title">{t().nama}</div>
                    <div class="detail-hero-subtitle">
                      📍 {t().tujuan} · {t().tanggal_mulai} — {t().tanggal_selesai}
                    </div>
                  </div>
                  <StatusBadge status={t().status} />
                </div>

                <div class="detail-hero-stats">
                  <div>
                    <div class="detail-hero-stat-label">Uang Dinas</div>
                    <div class="detail-hero-stat-val amount">{t().uang_dinas != null ? formatRp(t().uang_dinas!) : '-'}</div>
                  </div>
                  <div>
                    <div class="detail-hero-stat-label">Pengeluaran</div>
                    <div class="detail-hero-stat-val amount">{formatRp(t().total_pengeluaran)}</div>
                  </div>
                  <div>
                    <div class="detail-hero-stat-label">Saldo</div>
                    <div class={`detail-hero-stat-val amount ${t().saldo >= 0 ? 'text-emerald' : 'text-rose'}`}>
                      {formatRp(t().saldo)}
                    </div>
                  </div>
                </div>

                <div class="detail-hero-actions">
                  <A href={`/trips/${params.id}/edit`} class="btn btn-sm btn-secondary">Edit</A>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline"
                    style="color: var(--rose); border-color: rgba(244, 63, 94, 0.3);"
                    onClick={handleDeleteTrip}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>

            {/* Expenses Header */}
            <div class="section-heading">
              <h2>Rincian Pengeluaran</h2>
              <button
                type="button"
                class="btn btn-sm btn-primary"
                onClick={() => { setEditingExpense(null); setShowForm(true); }}
              >
                + Tambah
              </button>
            </div>

            {/* Grouped Expenses List */}
            <Show when={expenses()} fallback={<p style="text-align: center; padding: 1.5rem 0; color: var(--text-muted);">Memuat...</p>}>
              <Show
                when={expenses()!.length > 0}
                fallback={
                  <div class="empty-state">
                    <div class="empty-state-icon">🧾</div>
                    <h3 style="color: #fff; font-size: 1.0625rem; margin-bottom: 0.25rem;">Belum ada pengeluaran</h3>
                    <p style="font-size: 0.8125rem; margin-bottom: 1.5rem;">Catat rincian nota dan pengeluaran dinas Anda sekarang.</p>
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      onClick={() => { setEditingExpense(null); setShowForm(true); }}
                    >
                      + Tambah Pengeluaran
                    </button>
                  </div>
                }
              >
                <For each={Object.entries(groupedExpenses())}>
                  {([category, exps]) => (
                    <div class="category-group-card">
                      <div class="category-group-inner">
                        <div class="category-group-header">
                          <span class="category-group-title">{category}</span>
                          <span class="category-group-total amount">{formatRp(getCategoryTotal(exps))}</span>
                        </div>
                        <For each={exps}>
                          {(exp) => (
                            <div class="expense-row-item">
                              <div class="expense-row-info">
                                <div class="expense-row-desc">{exp.deskripsi || '-'}</div>
                                <div class="expense-row-meta">
                                  <span>{exp.tanggal}</span>
                                  <span>·</span>
                                  <span class={getPaymentBadgeClass(exp.payment_method_nama)}>
                                    {exp.payment_method_nama}
                                  </span>
                                </div>
                              </div>
                              <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span class="expense-row-amount amount">{formatRp(exp.jumlah)}</span>
                                <button
                                  type="button"
                                  class="btn-icon-subtle"
                                  onClick={() => openEdit(exp)}
                                  title="Edit"
                                  aria-label="Edit pengeluaran"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  class="btn-icon-subtle"
                                  style="color: var(--rose);"
                                  onClick={() => handleDeleteExpense(exp.id)}
                                  title="Hapus"
                                  aria-label="Hapus pengeluaran"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </Show>
          </>
        )}
      </Show>

      {/* Modal Bottom Sheet */}
      <Show when={showForm()}>
        <ExpenseForm
          tripId={params.id!}
          expense={editingExpense()}
          onClose={() => { setShowForm(false); setEditingExpense(null); }}
          onSaved={handleExpenseSaved}
        />
      </Show>
    </div>
  );
};

export default TripDetail;
