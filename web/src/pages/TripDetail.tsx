import { Component, createSignal, createResource, Show, For } from 'solid-js';
import { useParams, useNavigate, A } from '@solidjs/router';
import {
  getTrip,
  getExpenses,
  updateTrip,
  deleteTrip,
  deleteExpense,
  type Expense,
} from '../api';
import StatusBadge from '../components/StatusBadge';
import ExpenseForm from '../components/ExpenseForm';
import {
  ArrowLeftIcon,
  EditIcon,
  TrashIcon,
  PlusIcon,
  ReceiptIcon,
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileTextIcon,
} from '../components/Icons';
import { formatDateIndo, formatTripDateIndo } from '../utils/date';

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
  const [copiedLink, setCopiedLink] = createSignal(false);
  const [markingLunas, setMarkingLunas] = createSignal(false);

  const handleMarkLunas = async () => {
    const t = trip();
    if (!t || markingLunas()) return;
    setMarkingLunas(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await updateTrip(t.id, {
        status: 'lunas',
        tanggal_dibayar: t.tanggal_dibayar || today,
      });
      refetchTrip();
    } finally {
      setMarkingLunas(false);
    }
  };

  const handleCopyLink = async (rawUrl: string) => {
    try {
      const url = normalizeUrl(rawUrl);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // fallback
    }
  };

  const normalizeUrl = (url: string) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  };

  const getInitialExpenseDate = () => {
    const today = new Date().toISOString().slice(0, 10);
    const tripData = trip();
    if (!tripData) return today;
    const start = tripData.tanggal_mulai;
    const end = tripData.tanggal_selesai || start;
    if (today >= start && today <= end) return today;
    return start;
  };

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
    <div class="page" style="padding-bottom: 7rem;">
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
                  <div class="detail-hero-subtitle" style="display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap;">
                    <span style="display: inline-flex; align-items: center; gap: 0.25rem;">
                      <MapPinIcon size={13} style="color: var(--text-muted);" />
                      <span>{t().tujuan}</span>
                    </span>
                    <span style="margin: 0 0.125rem;">·</span>
                    <span style="display: inline-flex; align-items: center; gap: 0.25rem;">
                      <CalendarIcon size={13} style="color: var(--text-muted);" />
                      <span>{formatTripDateIndo(t().tanggal_mulai, t().tanggal_selesai)}</span>
                    </span>
                  </div>
                </div>
                <StatusBadge status={t().status} />
              </div>

              <div class="detail-hero-stats">
                <div>
                  <div class="detail-hero-stat-label">
                    {t().uang_dinas != null ? 'Uang Dinas (Bersih)' : 'Estimasi Monita'}
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
                  <div class="detail-hero-stat-label">Pengeluaran Sendiri</div>
                  <div class="detail-hero-stat-val amount">{formatRp(t().pengeluaran_pribadi ?? t().total_pengeluaran)}</div>
                </div>
                <div>
                  <div class="detail-hero-stat-label">Saldo</div>
                  <div class={'detail-hero-stat-val amount ' + (t().saldo >= 0 ? 'text-emerald' : 'text-rose')}>
                    {formatRp(t().saldo)}
                  </div>
                </div>
              </div>

              <Show when={(t().talangan_koperasi ?? 0) > 0}>
                <div style="font-size: 0.8125rem; color: var(--text-secondary); margin-bottom: 0.75rem; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.25rem; background: var(--bg-canvas); padding: 0.5rem 0.75rem; border-radius: 8px; border: 1px solid var(--border-subtle);">
                  <span>Ditalangi Koperasi (sudah dipotong dari uang masuk)</span>
                  <strong class="amount">{formatRp(t().talangan_koperasi!)}</strong>
                </div>
              </Show>

              <Show when={t().nominal_monita && t().uang_dinas != null && t().nominal_monita !== t().uang_dinas}>
                <div style="font-size: 0.6875rem; color: var(--text-muted); margin-bottom: 0.75rem; display: flex; justify-content: space-between;">
                  <span>Pagu Kotor Monita: <strong class="amount">{formatRp(t().nominal_monita!)}</strong></span>
                  <span>Potongan: <strong class="amount text-rose">{formatRp(t().nominal_monita! - t().uang_dinas!)}</strong></span>
                </div>
              </Show>

              <Show when={t().estimasi_transport != null && t().estimasi_transport! > 0}>
                <div style="font-size: 0.6875rem; color: var(--text-muted); margin-bottom: 0.75rem; display: flex; justify-content: space-between; background: rgba(255, 255, 255, 0.03); padding: 0.375rem 0.625rem; border-radius: 6px; border: 1px solid var(--border-subtle);">
                  <span>Estimasi Transport: <strong class="amount text-sky">{formatRp(t().estimasi_transport!)}</strong></span>
                  <Show when={t().nominal_monita != null && t().nominal_monita! >= t().estimasi_transport!}>
                    <span>Porsi Uang Harian: <strong class="amount text-emerald">{formatRp(t().nominal_monita! - t().estimasi_transport!)}</strong></span>
                  </Show>
                </div>
              </Show>

              <Show when={t().tujuan}>
                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
                  <a
                    href="gojek://goride"
                    class="btn btn-sm btn-outline"
                    style="flex: 1; min-width: 90px; font-size: 0.75rem; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; border-color: rgba(0, 170, 19, 0.35); color: #00880f; background: rgba(0, 170, 19, 0.05);"
                  >
                    <ExternalLinkIcon size={13} />
                    <span>Gojek</span>
                  </a>
                  <a
                    href={`grab://open?screenType=BOOKING&dropOffAddress=${encodeURIComponent(t().tujuan)}`}
                    class="btn btn-sm btn-outline"
                    style="flex: 1; min-width: 90px; font-size: 0.75rem; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; border-color: rgba(0, 177, 79, 0.35); color: #009140; background: rgba(0, 177, 79, 0.05);"
                  >
                    <ExternalLinkIcon size={13} />
                    <span>Grab</span>
                  </a>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t().tujuan)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-sm btn-outline"
                    style="flex: 1; min-width: 90px; font-size: 0.75rem; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;"
                  >
                    <MapPinIcon size={13} />
                    <span>Maps</span>
                  </a>
                </div>
              </Show>

              <Show when={t().dokumen_url}>
                <div style="margin-bottom: 0.75rem;">
                  <a
                    href={`/api/trips/${t().id}/dokumen`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-sm btn-outline"
                    style="width: 100%; font-size: 0.75rem; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; border-color: rgba(56, 189, 248, 0.4); color: var(--sky);"
                  >
                    <FileTextIcon size={14} />
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      {t().dokumen_nama || 'Dokumen Surat Tugas / Undangan (PDF)'}
                    </span>
                  </a>
                </div>
              </Show>

              <Show when={t().link_monita}>
                <div style="margin-bottom: 0.75rem;">
                  <div style="display: flex; gap: 0.5rem; align-items: stretch;">
                    <a
                      href={normalizeUrl(t().link_monita)}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn btn-sm btn-outline"
                      style="flex: 1; font-size: 0.75rem; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;"
                    >
                      <ExternalLinkIcon size={14} />
                      <span>Buka Transaksi Monita</span>
                    </a>
                    <button
                      type="button"
                      class="btn btn-sm btn-secondary"
                      style="font-size: 0.75rem; display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.875rem;"
                      onClick={() => handleCopyLink(t().link_monita)}
                      title="Salin tautan Monita"
                    >
                      <Show when={copiedLink()} fallback={<><CopyIcon size={14} /><span>Salin</span></>}>
                        <CheckIcon size={14} style="color: var(--emerald);" />
                        <span class="text-emerald">Tersalin!</span>
                      </Show>
                    </button>
                  </div>
                </div>
              </Show>

              <Show when={t().catatan}>
                <div style="background: var(--bg-canvas); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 0.75rem; margin-bottom: 0.75rem; font-size: 0.8125rem; white-space: pre-wrap; color: var(--text-secondary); line-height: 1.45;">
                  <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">
                    Catatan perjalanan
                  </div>
                  {t().catatan}
                </div>
              </Show>

              <Show when={t().settlement_note}>
                <div style="background: var(--bg-canvas); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 0.75rem; margin-bottom: 0.75rem; font-size: 0.8125rem; white-space: pre-wrap; color: var(--text-secondary); line-height: 1.45;">
                  <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">
                    Catatan pencairan / klaim
                  </div>
                  {t().settlement_note}
                </div>
              </Show>

              <div class="detail-hero-actions" style="display: flex; gap: 0.5rem; align-items: center;">
                <Show
                  when={t().is_owner}
                  fallback={
                    <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.375rem;">
                      <span>Dibuat oleh <strong>{t().owner_name || 'Rekan'}</strong></span>
                      <span>· Mode Kolaborator</span>
                    </div>
                  }
                >
                  <A href={'/trips/' + params.id + '/edit'} class="btn btn-sm btn-secondary">
                    <EditIcon size={14} /> Edit
                  </A>
                  <Show when={t().status !== 'lunas'}>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline"
                      style="color: var(--emerald); border-color: var(--emerald-border); background: var(--emerald-bg);"
                      disabled={markingLunas()}
                      onClick={handleMarkLunas}
                    >
                      <CheckIcon size={14} /> {markingLunas() ? 'Menyimpan...' : 'Tandai Lunas'}
                    </button>
                  </Show>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline"
                    style="color: var(--rose);"
                    onClick={handleDeleteTrip}
                  >
                    <TrashIcon size={14} /> Hapus
                  </button>
                </Show>
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
                                  <span>{formatDateIndo(exp.tanggal)}</span>
                                  <span>·</span>
                                  <span class={getPaymentBadgeClass(exp.payment_method_nama)}>
                                    {exp.payment_method_nama}
                                  </span>
                                  <Show when={exp.user_name}>
                                    <span class="expense-author-tag">oleh {exp.user_name}</span>
                                  </Show>
                                </div>
                              </div>
                              <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <Show
                                  when={exp.jumlah > 0}
                                  fallback={<span class="badge badge-orange">Nominal belum pasti</span>}
                                >
                                  <span class="expense-row-amount amount">{formatRp(exp.jumlah)}</span>
                                </Show>
                                <Show when={exp.can_edit !== false}>
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
                                </Show>
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

      {/* Floating Action Dock (Elevated above bottom navigation dock) */}
      <div class="floating-action-dock">
        <button
          type="button"
          class="btn-floating-expense"
          onClick={() => { setEditingExpense(null); setShowForm(true); }}
        >
          <PlusIcon size={18} strokeWidth={2.5} />
          <span>Catat Pengeluaran</span>
        </button>
      </div>

      {/* Modal Expense Form */}
      <Show when={showForm()}>
        <ExpenseForm
          tripId={params.id!}
          expense={editingExpense()}
          defaultDate={getInitialExpenseDate()}
          onClose={() => { setShowForm(false); setEditingExpense(null); }}
          onSaved={handleExpenseSaved}
        />
      </Show>
    </div>
  );
};

export default TripDetail;
