import { Component, createSignal, createResource, Show, For } from 'solid-js';
import { useParams, useNavigate, A } from '@solidjs/router';
import {
  getTrip,
  getExpenses,
  deleteTrip,
  deleteExpense,
  getTripMembers,
  addTripMember,
  removeTripMember,
  searchUsers,
  type Expense,
  type UserSearchItem,
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
  UserPlusIcon,
  XIcon,
  SearchIcon,
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
  const [members, { refetch: refetchMembers }] = createResource(() => params.id, getTripMembers);

  const [showForm, setShowForm] = createSignal(false);
  const [editingExpense, setEditingExpense] = createSignal<Expense | null>(null);

  // Collaborator invite modal state
  const [showMemberModal, setShowMemberModal] = createSignal(false);
  const [memberSearchQuery, setMemberSearchQuery] = createSignal('');
  const [searchResults, setSearchResults] = createSignal<UserSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = createSignal(false);
  const [inviteError, setInviteError] = createSignal('');

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

  const handleSearchUsers = async (q: string) => {
    setMemberSearchQuery(q);
    setInviteError('');
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await searchUsers(q);
      // Filter out existing members
      const existingUserIds = new Set((members() || []).map((m) => m.user_id));
      setSearchResults(res.filter((u) => !existingUserIds.has(u.id)));
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleInviteUser = async (user: UserSearchItem) => {
    setInviteError('');
    try {
      await addTripMember(params.id!, { user_id: user.id });
      setMemberSearchQuery('');
      setSearchResults([]);
      setShowMemberModal(false);
      refetchMembers();
      refetchTrip();
    } catch (err: any) {
      setInviteError(err.message);
    }
  };

  const handleInviteByEmail = async () => {
    const email = memberSearchQuery().trim();
    if (!email) return;
    setInviteError('');
    try {
      await addTripMember(params.id!, { email });
      setMemberSearchQuery('');
      setSearchResults([]);
      setShowMemberModal(false);
      refetchMembers();
      refetchTrip();
    } catch (err: any) {
      setInviteError(err.message);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Hapus rekan ini dari perjalanan?')) return;
    try {
      await removeTripMember(params.id!, userId);
      refetchMembers();
      refetchTrip();
    } catch (err: any) {
      alert(err.message);
    }
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

              <Show when={t().settlement_note}>
                <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 0.75rem; margin-bottom: 0.75rem; font-size: 0.8125rem; white-space: pre-wrap; color: var(--text-secondary); line-height: 1.4;">
                  <div style="font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.25rem;">
                    Catatan Pencairan / Klaim
                  </div>
                  {t().settlement_note}
                </div>
              </Show>

              <div class="detail-hero-actions">
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

            {/* Collaborators Roster Section */}
            <div class="collaborator-section">
              <div class="collaborator-header">
                <div class="collaborator-title">
                  <UsersIcon size={16} />
                  <span>Tim & Kolaborator</span>
                </div>
                <Show when={t().is_owner}>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline"
                    style="font-size: 0.75rem; padding: 0.25rem 0.625rem; gap: 0.25rem;"
                    onClick={() => {
                      setShowMemberModal(true);
                      setMemberSearchQuery('');
                      setSearchResults([]);
                    }}
                  >
                    <UserPlusIcon size={14} /> + Undang Rekan
                  </button>
                </Show>
              </div>

              <div class="collaborator-pills">
                <For each={members() || []}>
                  {(m) => (
                    <div class="collaborator-pill">
                      <Show
                        when={m.avatar_url}
                        fallback={<span class="collaborator-avatar">{m.name.charAt(0).toUpperCase()}</span>}
                      >
                        <img src={m.avatar_url} alt={m.name} class="collaborator-avatar" />
                      </Show>
                      <span style="font-weight: 600;">{m.name}</span>
                      <span class={`collaborator-role-tag ${m.role === 'owner' ? 'role-owner' : 'role-member'}`}>
                        {m.role === 'owner' ? 'Pemilik' : 'Rekan'}
                      </span>
                      <Show when={t().is_owner && m.role !== 'owner'}>
                        <button
                          type="button"
                          class="btn-remove-collab"
                          title="Hapus kolaborator"
                          onClick={() => handleRemoveMember(m.user_id)}
                        >
                          <XIcon size={12} />
                        </button>
                      </Show>
                    </div>
                  )}
                </For>
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
                                <span class="expense-row-amount amount">{formatRp(exp.jumlah)}</span>
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
          onClose={() => { setShowForm(false); setEditingExpense(null); }}
          onSaved={handleExpenseSaved}
        />
      </Show>

      {/* Modal Invite Collaborator */}
      <Show when={showMemberModal()}>
        <div class="modal-overlay" onClick={() => setShowMemberModal(false)}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <div class="modal-handle" />
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 class="modal-title" style="margin: 0;">Undang Rekan ke Perjalanan</h3>
              <button
                type="button"
                class="btn-icon-subtle"
                onClick={() => setShowMemberModal(false)}
                aria-label="Tutup"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div class="search-input-wrap" style="margin-bottom: 0.75rem;">
              <span class="search-input-icon">
                <SearchIcon size={16} />
              </span>
              <input
                type="text"
                class="form-control"
                placeholder="Cari nama atau email rekan..."
                value={memberSearchQuery()}
                onInput={(e) => handleSearchUsers(e.currentTarget.value)}
                autofocus
              />
            </div>

            <Show when={inviteError()}>
              <p class="text-rose" style="font-size: 0.75rem; margin-bottom: 0.75rem;">
                {inviteError()}
              </p>
            </Show>

            <div style="max-height: 200px; overflow-y: auto; margin-bottom: 1rem;">
              <Show when={searchLoading()}>
                <p style="text-align: center; color: var(--text-muted); font-size: 0.75rem; padding: 1rem;">
                  Mencari...
                </p>
              </Show>

              <Show when={!searchLoading() && searchResults().length > 0}>
                <For each={searchResults()}>
                  {(user) => (
                    <div
                      style={{
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'space-between',
                        padding: '0.625rem 0.75rem',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        'border-radius': '10px',
                        'margin-bottom': '0.375rem',
                      }}
                    >
                      <div style="display: flex; align-items: center; gap: 0.625rem;">
                        <Show
                          when={user.avatar_url}
                          fallback={
                            <span class="collaborator-avatar">{user.name.charAt(0).toUpperCase()}</span>
                          }
                        >
                          <img src={user.avatar_url} alt={user.name} class="collaborator-avatar" />
                        </Show>
                        <div>
                          <div style="font-size: 0.8125rem; font-weight: 600; color: var(--text-primary);">
                            {user.name}
                          </div>
                          <div style="font-size: 0.6875rem; color: var(--text-muted);">{user.email}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        class="btn btn-sm btn-primary"
                        style="padding: 0.25rem 0.625rem; font-size: 0.75rem;"
                        onClick={() => handleInviteUser(user)}
                      >
                        Pilih
                      </button>
                    </div>
                  )}
                </For>
              </Show>

              <Show
                when={
                  !searchLoading() &&
                  memberSearchQuery().trim() &&
                  searchResults().length === 0
                }
              >
                <div style="text-align: center; padding: 1rem; color: var(--text-muted); font-size: 0.75rem;">
                  Tidak ada pengguna ditemukan dengan kata kunci ini.
                </div>
              </Show>
            </div>

            <Show when={memberSearchQuery().includes('@')}>
              <div style="padding-top: 0.5rem; border-top: 1px solid var(--border-subtle);">
                <button
                  type="button"
                  class="btn btn-secondary"
                  style="width: 100%; font-size: 0.8125rem;"
                  onClick={handleInviteByEmail}
                >
                  Undang lewat email: {memberSearchQuery().trim()}
                </button>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default TripDetail;
