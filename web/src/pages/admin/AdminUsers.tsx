import { Component, createSignal, createResource, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { getAdminUsers, updateUserRole, type AdminUser } from '../../api';

const formatDate = (s: string) => {
  if (!s) return '-';
  const d = new Date(s);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const AdminUsers: Component = () => {
  const [users, { refetch }] = createResource(getAdminUsers);
  const [search, setSearch] = createSignal('');
  const [actionError, setActionError] = createSignal('');
  const [loadingId, setLoadingId] = createSignal<string | null>(null);

  const filteredUsers = () => {
    const list = users() || [];
    const q = search().toLowerCase().trim();
    if (!q) return list;
    return list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  };

  const handleRoleToggle = async (user: AdminUser) => {
    const targetRole = user.role === 'admin' ? 'user' : 'admin';
    const actionLabel = targetRole === 'admin' ? 'menjadi ADMIN' : 'menjadi USER biasa';
    if (!confirm(`Ubah role ${user.name} (${user.email}) ${actionLabel}?`)) return;

    setActionError('');
    setLoadingId(user.id);
    try {
      await updateUserRole(user.id, targetRole);
      refetch();
    } catch (err: any) {
      setActionError(err.message || 'Gagal mengubah role user');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div class="page">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
        <A href="/admin" class="btn-icon-subtle" aria-label="Kembali ke Admin Hub">
          ←
        </A>
        <div>
          <h2 style="font-size: 1.125rem; font-weight: 800; color: #fff; margin: 0;">
            Kelola Pengguna
          </h2>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">
            Direktori Akun & Penugasan Role
          </p>
        </div>
      </div>

      <Show when={actionError()}>
        <div style="background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 12px; padding: 0.75rem 1rem; margin-bottom: 1rem; color: var(--rose); font-size: 0.8125rem;">
          ⚠️ {actionError()}
        </div>
      </Show>

      {/* Search Bar */}
      <div class="search-input-wrap">
        <span class="search-input-icon">🔍</span>
        <input
          class="form-control"
          placeholder="Cari user berdasarkan nama atau email..."
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
        />
      </div>

      <div class="section-heading">
        <h2>Daftar Akun</h2>
        <span style="font-size: 0.75rem; color: var(--text-subtle);">
          {filteredUsers().length} user
        </span>
      </div>

      {/* Users List */}
      <Show when={users()} fallback={<p style="text-align: center; color: var(--text-muted); padding: 2rem 0;">Memuat daftar user...</p>}>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <For each={filteredUsers()}>
            {(u) => (
              <div class="doppel-card">
                <div class="doppel-inner" style="display: flex; flex-direction: column; gap: 0.75rem;">
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <Show
                        when={u.avatar_url}
                        fallback={
                          <div style="width: 38px; height: 38px; border-radius: 9999px; background: rgba(255, 255, 255, 0.08); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #fff;">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                        }
                      >
                        <img
                          src={u.avatar_url}
                          alt={u.name}
                          style="width: 38px; height: 38px; border-radius: 9999px; border: 1px solid rgba(255, 255, 255, 0.15);"
                        />
                      </Show>
                      <div>
                        <div style="font-size: 0.875rem; font-weight: 700; color: #fff;">{u.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">{u.email}</div>
                      </div>
                    </div>

                    <span class={`badge ${u.role === 'admin' ? 'badge-amber' : 'badge-gray'}`}>
                      {u.role.toUpperCase()}
                    </span>
                  </div>

                  <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 0.5rem; border-top: 1px solid rgba(255, 255, 255, 0.05); font-size: 0.75rem; color: var(--text-muted);">
                    <div>
                      <span>Perjalanan: </span>
                      <strong class="num" style="color: #fff;">{u.trip_count}</strong>
                      <span style="margin: 0 0.375rem;">•</span>
                      <span>Bergabung: {formatDate(u.created_at)}</span>
                    </div>

                    <button
                      type="button"
                      class="btn btn-sm btn-outline"
                      style="font-size: 0.6875rem; padding: 0.2rem 0.625rem; min-height: 28px;"
                      disabled={loadingId() === u.id}
                      onClick={() => handleRoleToggle(u)}
                    >
                      {loadingId() === u.id ? '...' : u.role === 'admin' ? 'Jadikan User' : 'Jadikan Admin'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default AdminUsers;
