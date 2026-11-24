import { Component, createResource, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { getAdminStats } from '../../api';

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const AdminHub: Component = () => {
  const [stats] = createResource(getAdminStats);

  return (
    <div class="page">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
        <A href="/" class="btn-icon-subtle" aria-label="Kembali ke Dashboard">
          ←
        </A>
        <div>
          <h2 style="font-size: 1.125rem; font-weight: 800; color: #fff; margin: 0;">
            Admin Terminal
          </h2>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">
            Pusat Kendali Sistem & Konfigurasi
          </p>
        </div>
      </div>

      {/* System Metrics Overview */}
      <Show when={stats()} fallback={<p style="text-align: center; color: var(--text-muted); padding: 2rem 0;">Memuat metrik sistem...</p>}>
        <div class="doppel-card" style="margin-bottom: 1.5rem;">
          <div class="doppel-inner">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
              <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted);">
                RINGKASAN SISTEM
              </span>
              <span class="beacon-dot" style="background: var(--emerald); box-shadow: 0 0 8px var(--emerald);"></span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.875rem; margin-bottom: 1rem;">
              <div style="background: rgba(255, 255, 255, 0.03); padding: 0.75rem; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="font-size: 0.6875rem; color: var(--text-muted); text-transform: uppercase;">Total Pengguna</div>
                <div style="font-size: 1.25rem; font-weight: 800; color: #fff; margin-top: 0.25rem;" class="num">
                  {stats()!.total_users}
                </div>
              </div>
              <div style="background: rgba(255, 255, 255, 0.03); padding: 0.75rem; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="font-size: 0.6875rem; color: var(--text-muted); text-transform: uppercase;">Total Perjalanan</div>
                <div style="font-size: 1.25rem; font-weight: 800; color: #fff; margin-top: 0.25rem;" class="num">
                  {stats()!.total_trips}
                </div>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.625rem;">
              <div style="display: flex; justify-content: space-between; font-size: 0.8125rem;">
                <span style="color: var(--text-muted);">Akumulasi Pengeluaran:</span>
                <span class="amount text-rose" style="font-weight: 700;">{formatRp(stats()!.total_expenses_rp)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.8125rem;">
                <span style="color: var(--text-muted);">Total Anggaran Dinas:</span>
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
          <div class="portal-icon">👥</div>
          <div class="portal-info">
            <div class="portal-title">Kelola Pengguna</div>
            <div class="portal-desc">Daftar user, peran admin, dan riwayat perjalanan</div>
          </div>
        </div>
        <span class="portal-arrow">→</span>
      </A>

      <A href="/admin/master" class="portal-card">
        <div style="display: flex; align-items: center;">
          <div class="portal-icon">🏷️</div>
          <div class="portal-info">
            <div class="portal-title">Master Data</div>
            <div class="portal-desc">Kategori pengeluaran & metode pembayaran</div>
          </div>
        </div>
        <span class="portal-arrow">→</span>
      </A>
    </div>
  );
};

export default AdminHub;
