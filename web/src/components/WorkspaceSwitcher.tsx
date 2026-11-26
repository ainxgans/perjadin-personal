import { Component, createSignal, Show, For, onMount, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import {
  workspaces,
  activeWorkspace,
  activeWorkspaceId,
  currentWorkspaceData,
  isWorkspaceOwner,
  refreshWorkspaces,
  switchWorkspace,
  createNewWorkspace,
  joinWorkspaceByCode,
  regenerateCode,
  removeMember,
} from '../store/workspace';
import {
  BriefcaseIcon,
  ChevronDownIcon,
  CheckIcon,
  PlusIcon,
  UsersIcon,
  SettingsIcon,
  XIcon,
  CopyIcon,
} from './Icons';

const WorkspaceSwitcher: Component = () => {
  const [dropdownOpen, setDropdownOpen] = createSignal(false);
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [showJoinModal, setShowJoinModal] = createSignal(false);
  const [showSettingsModal, setShowSettingsModal] = createSignal(false);

  const [newWsName, setNewWsName] = createSignal('');
  const [joinCodeInput, setJoinCodeInput] = createSignal('');
  const [joinError, setJoinError] = createSignal('');
  const [createError, setCreateError] = createSignal('');
  const [copiedCode, setCopiedCode] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  let dropdownRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
      setDropdownOpen(false);
    }
  };

  onMount(() => {
    refreshWorkspaces();
    document.addEventListener('click', handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  const handleSelectWorkspace = async (id: string) => {
    if (id === activeWorkspaceId()) {
      setDropdownOpen(false);
      return;
    }
    setDropdownOpen(false);
    await switchWorkspace(id);
    window.location.reload();
  };

  const handleCreateSubmit = async (e: Event) => {
    e.preventDefault();
    const name = newWsName().trim();
    if (!name) return;
    setIsSubmitting(true);
    setCreateError('');
    try {
      await createNewWorkspace(name);
      setShowCreateModal(false);
      setNewWsName('');
      window.location.reload();
    } catch (err: any) {
      setCreateError(err.message || 'Gagal membuat ruang kerja');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinSubmit = async (e: Event) => {
    e.preventDefault();
    const code = joinCodeInput().trim();
    if (!code) return;
    setIsSubmitting(true);
    setJoinError('');
    try {
      await joinWorkspaceByCode(code);
      setShowJoinModal(false);
      setJoinCodeInput('');
      window.location.reload();
    } catch (err: any) {
      setJoinError(err.message || 'Kode ruang kerja tidak valid');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    const code = currentWorkspaceData()?.join_code;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleRegenCode = async () => {
    if (!confirm('Yakin ingin membuat kode baru? Kode lama tidak akan berlaku lagi.')) return;
    try {
      await regenerateCode();
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui kode');
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!confirm(`Hapus ${name} dari ruang kerja ini?`)) return;
    try {
      await removeMember(userId);
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus anggota');
    }
  };

  return (
    <div style="position: relative;" ref={dropdownRef}>
      <button
        type="button"
        class="workspace-switcher-btn"
        onClick={() => setDropdownOpen(!dropdownOpen())}
        title="Pilih Ruang Kerja"
      >
        <BriefcaseIcon size={14} />
        <span class="workspace-name-truncate">
          {activeWorkspace()?.nama || 'Ruang Kerja'}
        </span>
        <ChevronDownIcon size={12} />
      </button>

      {/* Dropdown Menu */}
      <Show when={dropdownOpen()}>
        <div class="workspace-dropdown">
          <div class="workspace-dropdown-header">
            <span>Ruang Kerja Saya</span>
          </div>

          <div class="workspace-dropdown-list">
            <For each={workspaces()}>
              {(w) => {
                const isActive = () => w.id === activeWorkspaceId();
                return (
                  <button
                    type="button"
                    class={`workspace-dropdown-item ${isActive() ? 'active' : ''}`}
                    onClick={() => handleSelectWorkspace(w.id)}
                  >
                    <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                      <span class="workspace-item-bullet" />
                      <span style="font-weight: 500; font-size: 0.8125rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        {w.nama}
                      </span>
                      <Show when={w.role === 'owner'}>
                        <span class="badge badge-subtle" style="font-size: 0.625rem; padding: 0.125rem 0.375rem;">
                          Pemilik
                        </span>
                      </Show>
                    </div>
                    <Show when={isActive()}>
                      <CheckIcon size={14} class="text-emerald" />
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>

          <div class="workspace-dropdown-divider" />

          <button
            type="button"
            class="workspace-dropdown-action"
            onClick={() => {
              setDropdownOpen(false);
              setShowCreateModal(true);
            }}
          >
            <PlusIcon size={14} />
            <span>Buat Ruang Kerja Baru</span>
          </button>

          <button
            type="button"
            class="workspace-dropdown-action"
            onClick={() => {
              setDropdownOpen(false);
              setShowJoinModal(true);
            }}
          >
            <UsersIcon size={14} />
            <span>Gabung via Kode</span>
          </button>

          <button
            type="button"
            class="workspace-dropdown-action"
            onClick={() => {
              setDropdownOpen(false);
              setShowSettingsModal(true);
            }}
          >
            <SettingsIcon size={14} />
            <span>Kelola Anggota & Kode</span>
          </button>
        </div>
      </Show>

      {/* Modal Buat Workspace */}
      <Show when={showCreateModal()}>
        <Portal>
          <div class="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div class="modal-content" onClick={(e) => e.stopPropagation()}>
              <div class="modal-handle" />
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 class="modal-title" style="margin: 0;">Buat Ruang Kerja Baru</h3>
                <button
                  type="button"
                  class="btn-icon-subtle"
                  onClick={() => setShowCreateModal(false)}
                >
                  <XIcon size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit}>
                <div style="margin-bottom: 1rem;">
                  <label class="form-label" style="font-size: 0.75rem;">Nama Ruang Kerja</label>
                  <input
                    type="text"
                    class="form-control"
                    placeholder="Misal: Tim Pengawasan BBM 2026"
                    value={newWsName()}
                    onInput={(e) => setNewWsName(e.currentTarget.value)}
                    autofocus
                    required
                  />
                </div>

                <Show when={createError()}>
                  <p class="text-rose" style="font-size: 0.75rem; margin-bottom: 0.75rem;">
                    {createError()}
                  </p>
                </Show>

                <div class="modal-form-actions">
                  <button
                    type="button"
                    class="btn btn-secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    class="btn btn-primary"
                    disabled={isSubmitting() || !newWsName().trim()}
                  >
                    {isSubmitting() ? 'Membuat...' : 'Buat Ruang Kerja'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      </Show>

      {/* Modal Gabung Workspace */}
      <Show when={showJoinModal()}>
        <Portal>
          <div class="modal-overlay" onClick={() => setShowJoinModal(false)}>
            <div class="modal-content" onClick={(e) => e.stopPropagation()}>
              <div class="modal-handle" />
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 class="modal-title" style="margin: 0;">Gabung Ruang Kerja</h3>
                <button
                  type="button"
                  class="btn-icon-subtle"
                  onClick={() => setShowJoinModal(false)}
                >
                  <XIcon size={18} />
                </button>
              </div>

              <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-bottom: 1rem;">
                Masukkan 6 digit kode undangan yang diberikan oleh rekan Anda untuk mengakses perjalanan bersama.
              </p>

              <form onSubmit={handleJoinSubmit}>
                <div style="margin-bottom: 1rem;">
                  <input
                    type="text"
                    class="form-control"
                    style="text-align: center; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.25em; text-transform: uppercase;"
                    placeholder="ABC123"
                    maxLength={12}
                    value={joinCodeInput()}
                    onInput={(e) => setJoinCodeInput(e.currentTarget.value.toUpperCase())}
                    autofocus
                    required
                  />
                </div>

                <Show when={joinError()}>
                  <p class="text-rose" style="font-size: 0.75rem; margin-bottom: 0.75rem; text-align: center;">
                    {joinError()}
                  </p>
                </Show>

                <div class="modal-form-actions">
                  <button
                    type="button"
                    class="btn btn-secondary"
                    onClick={() => setShowJoinModal(false)}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    class="btn btn-primary"
                    disabled={isSubmitting() || !joinCodeInput().trim()}
                  >
                    {isSubmitting() ? 'Memeriksa...' : 'Gabung'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      </Show>

      {/* Modal Kelola Anggota & Kode */}
      <Show when={showSettingsModal()}>
        <Portal>
          <div class="modal-overlay" onClick={() => setShowSettingsModal(false)}>
            <div class="modal-content" onClick={(e) => e.stopPropagation()}>
              <div class="modal-handle" />
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 class="modal-title" style="margin: 0;">Kelola Ruang Kerja</h3>
                <button
                  type="button"
                  class="btn-icon-subtle"
                  onClick={() => setShowSettingsModal(false)}
                >
                  <XIcon size={18} />
                </button>
              </div>

              <div style="margin-bottom: 1.25rem;">
                <div style="font-size: 0.875rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">
                  {activeWorkspace()?.nama}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">
                  {isWorkspaceOwner() ? 'Anda adalah pemilik ruang kerja ini' : 'Anda adalah anggota ruang kerja ini'}
                </div>
              </div>

              {/* Kode Undangan Box */}
              <div class="workspace-code-box">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <span style="font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary);">
                    Kode undangan gabung
                  </span>
                  <Show when={isWorkspaceOwner()}>
                    <button
                      type="button"
                      class="btn-icon-subtle"
                      style="font-size: 0.8125rem; width: auto; padding: 0 0.5rem; color: var(--text-muted);"
                      onClick={handleRegenCode}
                    >
                      Reset Kode
                    </button>
                  </Show>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; background: var(--bg-surface); padding: 0.625rem 0.875rem; border-radius: 8px; border: 1px dashed var(--border-subtle);">
                  <span style="font-family: monospace; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.15em; color: var(--emerald);">
                    {currentWorkspaceData()?.join_code || '---'}
                  </span>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline"
                    onClick={handleCopyCode}
                    style="gap: 0.25rem;"
                  >
                    <Show when={copiedCode()} fallback={<><CopyIcon size={13} /> Salin</>}>
                      <CheckIcon size={13} class="text-emerald" /> Tersalin
                    </Show>
                  </button>
                </div>
              </div>

              {/* Daftar Anggota */}
              <div style="margin-top: 1.25rem;">
                <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.5rem;">
                  Anggota ({currentWorkspaceData()?.members.length || 0})
                </div>

                <div style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.375rem;">
                  <For each={currentWorkspaceData()?.members || []}>
                    {(m) => (
                      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.625rem; background: var(--bg-surface-elevated); border-radius: 8px; border: 1px solid var(--border-subtle);">
                        <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                          <Show
                            when={m.avatar_url}
                            fallback={<span class="collaborator-avatar" style="width: 24px; height: 24px; font-size: 0.6875rem;">{m.name.charAt(0).toUpperCase()}</span>}
                          >
                            <img src={m.avatar_url} alt={m.name} class="collaborator-avatar" style="width: 24px; height: 24px;" />
                          </Show>
                          <div style="overflow: hidden;">
                            <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-primary); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
                              {m.name}
                            </div>
                            <div style="font-size: 0.625rem; color: var(--text-muted); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
                              {m.email}
                            </div>
                          </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 0.375rem;">
                          <span class={`badge ${m.role === 'owner' ? 'badge-subtle' : 'badge-gray'}`} style="font-size: 0.625rem; padding: 0.125rem 0.375rem;">
                            {m.role === 'owner' ? 'Pemilik' : 'Anggota'}
                          </span>
                          <Show when={isWorkspaceOwner() && m.role !== 'owner'}>
                            <button
                              type="button"
                              class="btn-icon-subtle"
                              style="color: var(--rose); padding: 0.25rem;"
                              title="Keluarkan anggota"
                              onClick={() => handleRemoveMember(m.user_id, m.name)}
                            >
                              <XIcon size={12} />
                            </button>
                          </Show>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>

              <div class="modal-form-actions" style="margin-top: 1.25rem;">
                <button
                  type="button"
                  class="btn btn-secondary"
                  style="width: 100%;"
                  onClick={() => setShowSettingsModal(false)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  );
};

export default WorkspaceSwitcher;
