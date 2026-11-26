import { Component, createResource, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { getAdminStats } from '../../api';
import { ArrowLeftIcon, UsersIcon, TagIcon, ChevronRightIcon } from '../../components/Icons';
import { formatRp } from '../../store/privacy';

const AdminHub: Component = () => {
  const [stats] = createResource(getAdminStats);

  return (
    <div class="page">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
        <A href="/" class="btn-icon-subtle" aria-label="Kembali ke Dashboard">
          <ArrowLeftIcon size={16} />
        </A>
        <div>
          <h1 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin: 0;">
            Admin Terminal
          </h1>
          <p style="font-size: 0.8125rem; color: var(--text-muted); margin: 0;">
            Pusat kendali sistem &amp; konfigurasi
          </p>
        </div>
      </div>

      {/* System Metrics */}
      <Show when={stats()} fallback={<p style="text-align: center; color: var(--text-muted); padding: 2rem 0;">Memuat metrik sistem...</p>}>
        <div class="doppel-card" style="margin-bottom: 1.5rem;">
          <div class="doppel-inner">
            <h2 style="font-size: 0.9375rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
              Ringkasan sistem
            </h2>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
              <div style="background: var(--bg-canvas); padding: 0.875rem; border-radius: 10px; border: 1px solid var(--border-subtle);">
                <div style="font-size: 0.8125rem; color: var(--text-muted);">Total pengguna</div>
                <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin-top: 0.25rem;" class="num">
                  {stats()!.total_users}
                </div>
              </div>
              <div style="background: var(--bg-canvas); padding: 0.875rem; border-radius: 10px; border: 1px solid var(--border-subtle);">
                <div style="font-size: 0.8125rem; color: var(--text-muted);">Total perjalanan</div>
                <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin-top: 0.25rem;" class="num">
                  {stats()!.total_trips}
                </div>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <div style="display: flex; justify-content: space-between; font-size: 0.8125rem;">
                <span style="color: var(--text-secondary);">Akumulasi Pengeluaran:</span>
                <span class="amount text-rose" style="font-weight: 700;">{formatRp(stats()!.total_expenses_rp)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.8125rem;">
                <span style="color: var(--text-secondary);">Total Anggaran Dinas:</span>
                <span class="amount text-emerald" style="font-weight: 700;">{formatRp(stats()!.total_uang_dinas_rp)}</span>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Navigation Sub-Pages */}
      <div class="section-heading">
        <h2>Modul Pengelolaan</h2>
      </div>

      <A href="/admin/users" class="portal-card">
        <div style="display: flex; align-items: center;">
          <div class="portal-icon">
            <UsersIcon size={18} />
          </div>
          <div class="portal-info">
            <div class="portal-title">Kelola Pengguna</div>
            <div class="portal-desc">Daftar user, peran admin, dan riwayat perjalanan</div>
          </div>
        </div>
        <span class="portal-arrow">
          <ChevronRightIcon size={18} />
        </span>
      </A>

      <A href="/admin/master" class="portal-card">
        <div style="display: flex; align-items: center;">
          <div class="portal-icon">
            <TagIcon size={18} />
          </div>
          <div class="portal-info">
            <div class="portal-title">Master Data</div>
            <div class="portal-desc">Kategori pengeluaran & metode pembayaran</div>
          </div>
        </div>
        <span class="portal-arrow">
          <ChevronRightIcon size={18} />
        </span>
      </A>
    </div>
  );
};

export default AdminHub;
