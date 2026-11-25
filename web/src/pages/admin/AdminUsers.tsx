import { Component, createSignal, createResource, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { getAdminUsers, updateUserRole, createAdminUser, type AdminUser } from '../../api';
import { user as currentUser } from '../../App';
import { ArrowLeftIcon, SearchIcon, ShieldIcon, UserPlusIcon, XIcon } from '../../components/Icons';

const formatDate = (s: string) => {
  if (!s) return '-';
  const d = new Date(s);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const AdminUsers: Component = () => {
  const [users, { refetch }] = createResource(getAdminUsers);
  const [search, setSearch] = createSignal('');
  const [roleFilter, setRoleFilter] = createSignal<'all' | 'admin' | 'user'>('all');
  const [actionError, setActionError] = createSignal('');
  const [loadingId, setLoadingId] = createSignal<string | null>(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = createSignal(false);
  const [inviteEmail, setInviteEmail] = createSignal('');
  const [inviteName, setInviteName] = createSignal('');
  const [inviteRole, setInviteRole] = createSignal<'admin' | 'user'>('user');
  const [inviteError, setInviteError] = createSignal('');
  const [inviteLoading, setInviteLoading] = createSignal(false);

  const totalAdmins = () => (users() || []).filter((u) => u.role === 'admin').length;

  const filteredUsers = () => {
    let list = users() || [];
    const q = search().toLowerCase().trim();
    if (q) list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    if (roleFilter() !== 'all') list = list.filter((u) => u.role === roleFilter());
    return list;
  };

  const handleRoleToggle = async (u: AdminUser) => {
    const targetRole = u.role === 'admin' ? 'user' : 'admin';
    const actionLabel = targetRole === 'admin' ? 'menjadi ADMIN' : 'menjadi USER biasa';
    if (!confirm(`Ubah role ${u.name} (${u.email}) ${actionLabel}?`)) return;

    setActionError('');
    setLoadingId(u.id);
    try {
      await updateUserRole(u.id, targetRole);
      refetch();
    } catch (err: any) {
      setActionError(err.message || 'Gagal mengubah role user');
    } finally {
      setLoadingId(null);
    }
  };

  const openInviteModal = () => {
    setInviteEmail('');
    setInviteName('');
    setInviteRole('user');
    setInviteError('');
    setShowInviteModal(true);
  };

  const handleInviteSubmit = async (e: Event) => {
    e.preventDefault();
    setInviteError('');
    const email = inviteEmail().trim();
    const name = inviteName().trim();
    if (!email || !name) {
      setInviteError('Email dan nama wajib diisi');
      return;
    }
    setInviteLoading(true);
    try {
      await createAdminUser({ email, name, role: inviteRole() });
      setShowInviteModal(false);
      refetch();
    } catch (err: any) {
      setInviteError(err.message || 'Gagal menambahkan pengguna');
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div class="page" style="padding-bottom: 6rem;">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
        <A href="/admin" class="btn-icon-subtle" aria-label="Kembali ke Admin Hub">
          <ArrowLeftIcon size={16} />
        </A>
        <div style="flex: 1;">
          <h2 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin: 0;">
            Kelola Pengguna
          </h2>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">
            Direktori Akun & Penugasan Role
          </p>
        </div>
        <button
          type="button"
          class="btn btn-sm btn-primary"
          style="gap: 0.375rem;"
          onClick={openInviteModal}
        >
          <UserPlusIcon size={14} />
          Tambah
        </button>
      </div>

      {/* Stats Row */}
      <Show when={users()}>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.625rem; margin-bottom: 1rem;">
          <div class="doppel-card">
            <div class="doppel-inner" style="padding: 0.75rem;">
              <div style="font-size: 0.6875rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Total</div>
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">{(users() || []).length}</div>
            </div>
          </div>
          <div class="doppel-card">
            <div class="doppel-inner" style="padding: 0.75rem;">
              <div style="font-size: 0.6875rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Admin</div>
              <div class="text-amber" style="font-size: 1.25rem; font-weight: 800;">{totalAdmins()}</div>
            </div>
          </div>
          <div class="doppel-card">
            <div class="doppel-inner" style="padding: 0.75rem;">
              <div style="font-size: 0.6875rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">User</div>
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">{(users() || []).filter((u) => u.role === 'user').length}</div>
            </div>
          </div>
        </div>
      </Show>

      <Show when={actionError()}>
        <div style="background: var(--rose-bg); border: 1px solid var(--rose-border); border-radius: 12px; padding: 0.75rem 1rem; margin-bottom: 1rem; color: var(--rose); font-size: 0.8125rem;">
          {actionError()}
        </div>
      </Show>

      {/* Search + Role Filter */}
      <div class="search-input-wrap" style="margin-bottom: 0.75rem;">
        <span class="search-input-icon">
          <SearchIcon size={16} />
        </span>
        <input
          class="form-control"
          placeholder="Cari user berdasarkan nama atau email..."
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
        />
      </div>

      <div class="filter-chips" style="display: flex; gap: 0.375rem; margin-bottom: 1rem;">
        {(['all', 'admin', 'user'] as const).map((f) => (
          <button
            type="button"
            class={`filter-chip ${roleFilter() === f ? 'active' : ''}`}
            onClick={() => setRoleFilter(f)}
          >
            {f === 'all' ? 'Semua' : f === 'admin' ? 'Admin' : 'User'}
          </button>
        ))}
      </div>

      <div class="section-heading">
        <h2>Daftar Akun</h2>
        <span style="font-size: 0.75rem; color: var(--text-muted);">
          {filteredUsers().length} user
        </span>
      </div>

      {/* Users List */}
      <Show when={users()} fallback={<p style="text-align: center; color: var(--text-muted); padding: 2rem 0;">Memuat daftar user...</p>}>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <For each={filteredUsers()}>
            {(u) => {
              const isCurrentUser = () => currentUser()?.id === u.id;
              const isSoleAdmin = () => u.role === 'admin' && totalAdmins() <= 1;
              return (
                <div class="doppel-card">
                  <div class="doppel-inner" style="gap: 0.75rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                      <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <Show
                          when={u.avatar_url}
                          fallback={
                            <div style="width: 36px; height: 36px; border-radius: 9999px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--text-primary); font-size: 0.875rem; flex-shrink: 0;">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                          }
                        >
                          <img
                            src={u.avatar_url}
                            alt={u.name}
                            style="width: 36px; height: 36px; border-radius: 9999px; border: 1px solid var(--border-subtle); flex-shrink: 0;"
                          />
                        </Show>
                        <div>
                          <div style="display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap;">
                            <span style="font-size: 0.875rem; font-weight: 700; color: var(--text-primary);">{u.name}</span>
                            <Show when={isCurrentUser()}>
                              <span style="font-size: 0.6875rem; font-weight: 700; padding: 0.0625rem 0.375rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 4px; color: var(--text-muted);">Anda</span>
                            </Show>
                          </div>
                          <div style="font-size: 0.75rem; color: var(--text-muted);">{u.email}</div>
                        </div>
                      </div>

                      <span class={`badge ${u.role === 'admin' ? 'badge-amber' : 'badge-gray'}`}>
                        <Show when={u.role === 'admin'}>
                          <ShieldIcon size={12} strokeWidth={2} />
                        </Show>
                        {u.role.toUpperCase()}
                      </span>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 0.5rem; border-top: 1px solid var(--border-subtle); font-size: 0.75rem; color: var(--text-muted);">
                      <div>
                        <span>Perjalanan: </span>
                        <strong class="num" style="color: var(--text-primary);">{u.trip_count}</strong>
                        <span style="margin: 0 0.375rem;">·</span>
                        <span>Bergabung: {formatDate(u.created_at)}</span>
                      </div>

                      <button
                        type="button"
                        class="btn btn-sm btn-outline"
                        style={`font-size: 0.6875rem; padding: 0.2rem 0.625rem; min-height: 28px; ${isSoleAdmin() ? 'opacity: 0.4; cursor: not-allowed;' : ''}`}
                        disabled={loadingId() === u.id || isSoleAdmin()}
                        title={isSoleAdmin() ? 'Admin tunggal tidak dapat didemosi' : undefined}
                        onClick={() => !isSoleAdmin() && handleRoleToggle(u)}
                      >
                        {loadingId() === u.id ? '...' : u.role === 'admin' ? 'Jadikan User' : 'Jadikan Admin'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Invite Modal */}
      <Show when={showInviteModal()}>
        <div class="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <div class="modal-handle" />
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 class="modal-title" style="margin: 0;">Tambah / Undang Pengguna</h3>
              <button type="button" class="btn-icon-subtle" onClick={() => setShowInviteModal(false)} aria-label="Tutup">
                <XIcon size={18} />
              </button>
            </div>

            <Show when={inviteError()}>
              <div style="background: var(--rose-bg); border: 1px solid var(--rose-border); border-radius: 10px; padding: 0.625rem 0.875rem; margin-bottom: 0.875rem; color: var(--rose); font-size: 0.8125rem;">
                {inviteError()}
              </div>
            </Show>

            <form onSubmit={handleInviteSubmit}>
              <div class="form-group">
                <label for="invite-email">Email</label>
                <input
                  id="invite-email"
                  class="form-control"
                  type="email"
                  value={inviteEmail()}
                  onInput={(e) => setInviteEmail(e.currentTarget.value)}
                  placeholder="rekan@kantor.go.id"
                  required
                  autofocus
                />
              </div>

              <div class="form-group">
                <label for="invite-name">Nama Lengkap</label>
                <input
                  id="invite-name"
                  class="form-control"
                  value={inviteName()}
                  onInput={(e) => setInviteName(e.currentTarget.value)}
                  placeholder="Nama Rekan Kerja"
                  required
                />
              </div>

              <div class="form-group">
                <label for="invite-role">Role</label>
                <select
                  id="invite-role"
                  class="form-control"
                  value={inviteRole()}
                  onChange={(e) => setInviteRole(e.currentTarget.value as 'admin' | 'user')}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem; line-height: 1.4;">
                Pengguna akan langsung terdaftar dan dapat diundang ke perjalanan dinas. Saat mereka login pertama kali dengan Google menggunakan email ini, akun akan otomatis tertaut.
              </p>

              <button type="submit" class="btn btn-primary" style="width: 100%;" disabled={inviteLoading()}>
                {inviteLoading() ? 'Menyimpan...' : 'Tambah Pengguna'}
              </button>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default AdminUsers;
