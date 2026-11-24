import { Component, createSignal, createResource, Show, For } from 'solid-js';
import { useParams, useNavigate, A } from '@solidjs/router';
import { getTrip, getExpenses, deleteTrip, deleteExpense, type Expense } from '../api';
import StatusBadge from '../components/StatusBadge';
import ExpenseForm from '../components/ExpenseForm';
import { ArrowLeftIcon, EditIcon, TrashIcon, PlusIcon, ReceiptIcon, CalendarIcon, MapPinIcon } from '../components/Icons';

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const getPaymentBadgeClass = (method: string) => {
  const m = (method || '').toLowerCase();
  if (m.includes('pribadi')) return 'badge badge-gray';
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
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
        <A href="/" class="btn-icon-subtle" aria-label="Kembali ke Dashboard">
          <ArrowLeftIcon size={16} />
        </A>
        <span style="font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary);">
          Detail Perjalanan
        </span>
      </div>

      <Show when={trip()} fallback={<p style="text-align: center; padding: 2rem 0; color: var(--text-muted);">Memuat...</p>}>
        {(t) => (
          <>
            {/* Hero Header */}
            <div class="detail-hero-doppel">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem;">
                <div>
                  <div class="detail-hero-title">{t().nama}</div>
                  <div class="detail-hero-subtitle" style="display: flex; align-items: center; gap: 0.375rem;">
                    <MapPinIcon size={13} style="color: var(--text-muted);" />
                    <span>{t().tujuan}</span>
                    <span style="margin: 0 0.125rem;">·</span>
                    <CalendarIcon size={13} style="color: var(--text-muted);" />
                    <span>{t().tanggal_mulai} — {t().tanggal_selesai}</span>
                  </div>
                </div>
                <StatusBadge status={t().status} />
              </div>

              <div class="detail-hero-stats">
                <div>
                  <div class="detail-hero-stat-label">
                    {t().uang_dinas != null ? 'Uang Dinas' : 'Estimasi Monita'}
                  </div>
                  <div class="detail-hero-stat-val amount">
                    {t().uang_dinas != null
                      ? formatRp(t().uang_dinas!)
                      : t().nominal_monita != null
                      ? formatRp(t().nominal_monita!)
                      : '-'}
                  </div>
                </div>
                <div>
                  <div class="detail-hero-stat-label">Pengeluaran</div>
                  <div class="detail-hero-stat-val amount">{formatRp(t().total_pengeluaran)}</div>
                </div>
                <div>
                  <div class="detail-hero-stat-label">Saldo</div>
                  <div class={'detail-hero-stat-val amount ' + (t().saldo >= 0 ? 'text-emerald' : 'text-rose')}>
                    {formatRp(t().saldo)}
                  </div>
                </div>
              </div>

              <Show when={t().nominal_monita && t().uang_dinas != null && t().nominal_monita !== t().uang_dinas}>
                <div style="font-size: 0.6875rem; color: var(--text-muted); margin-bottom: 0.75rem; display: flex; justify-content: space-between;">
                  <span>Pagu Kotor Monita: <strong class="amount">{formatRp(t().nominal_monita!)}</strong></span>
                  <span>Potongan: <strong class="amount text-rose">{formatRp(t().nominal_monita! - t().uang_dinas!)}</strong></span>
                </div>
              </Show>

              <Show when={t().link_monita}>
                <div style="margin-bottom: 0.75rem;">
                  <a
                    href={t().link_monita}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-sm btn-outline"
                    style="width: 100%; font-size: 0.75rem; text-decoration: none;"
                  >
                    Buka Transaksi Monita ↗
                  </a>
                </div>
              </Show>

              <Show when={t().catatan}>
                <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 0.75rem; margin-bottom: 0.75rem; font-size: 0.8125rem; white-space: pre-wrap; color: var(--text-secondary); line-height: 1.4;">
                  <div style="font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.25rem;">
                    Catatan Perjalanan
                  </div>
                  {t().catatan}
                </div>
              </Show>

              <div class="detail-hero-actions">
                <A href={'/trips/' + params.id + '/edit'} class="btn btn-sm btn-secondary">
                  <EditIcon size={14} /> Edit
                </A>
                <button
                  type="button"
                  class="btn btn-sm btn-outline"
                  style="color: var(--rose);"
                  onClick={handleDeleteTrip}
                >
                  <TrashIcon size={14} /> Hapus
                </button>
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
                <PlusIcon size={14} /> Tambah
              </button>
            </div>

            {/* Grouped Expenses List */}
            <Show when={expenses()} fallback={<p style="text-align: center; padding: 1.5rem 0; color: var(--text-muted);">Memuat...</p>}>
              <Show
                when={expenses()!.length > 0}
                fallback={
                  <div class="empty-state">
                    <div class="empty-state-icon">
                      <ReceiptIcon size={22} />
                    </div>
                    <h3 style="font-size: 0.9375rem; margin-bottom: 0.25rem;">Belum ada pengeluaran</h3>
                    <p style="font-size: 0.8125rem; margin-bottom: 1.25rem;">Catat pengeluaran perjalanan dinas sekarang.</p>
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      onClick={() => { setEditingExpense(null); setShowForm(true); }}
                    >
                      <PlusIcon size={14} /> Tambah Pengeluaran
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
                              <div style="flex: 1; min-width: 0;">
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
                                  <EditIcon size={14} />
                                </button>
                                <button
                                  type="button"
                                  class="btn-icon-subtle"
                                  style="color: var(--rose);"
                                  onClick={() => handleDeleteExpense(exp.id)}
                                  title="Hapus"
                                  aria-label="Hapus pengeluaran"
                                >
                                  <TrashIcon size={14} />
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

      {/* Modal Expense Form */}
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
