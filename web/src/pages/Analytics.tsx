import { Component, createResource, createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { getAnalytics } from '../api';
import { ArrowLeftIcon, CalendarIcon, WalletIcon, ReceiptIcon, CreditCardIcon } from '../components/Icons';
import { formatRp } from '../store/privacy';

const COLORS = [
  '#38bdf8', // Sky
  '#34d399', // Emerald
  '#fbbf24', // Amber
  '#a78bfa', // Lavender
  '#f472b6', // Pink
  '#2dd4bf', // Teal
  '#fb7185', // Rose
];

const Analytics: Component = () => {
  const [selectedYear, setSelectedYear] = createSignal<number | null>(null);
  const [data, { refetch }] = createResource(
    () => ({ year: selectedYear() }),
    ({ year }) => getAnalytics(year || undefined)
  );

  onMount(() => {
    const onRefresh = () => refetch();
    window.addEventListener('perjadin:refresh', onRefresh);
    onCleanup(() => window.removeEventListener('perjadin:refresh', onRefresh));
  });

  return (
    <div class="page" style="padding-bottom: 6rem;">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
        <A href="/" class="btn-icon-subtle" aria-label="Kembali ke Dashboard">
          <ArrowLeftIcon size={16} />
        </A>
        <div>
          <h1 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin: 0;">
            Analitik Keuangan
          </h1>
          <p style="font-size: 0.8125rem; color: var(--text-muted); margin: 0;">
            Distribusi pengeluaran &amp; arus kas dinas
          </p>
        </div>
      </div>

      {/* Year Filter */}
      <Show when={data()?.available_years && data()!.available_years!.length > 0}>
        <div style="margin-bottom: 1.25rem;">
          <div class="segmented-filter" role="tablist" aria-label="Filter tahun">
            <button
              type="button"
              class={`segmented-filter-btn ${selectedYear() === null ? 'active' : ''}`}
              onClick={() => setSelectedYear(null)}
            >
              Semua Tahun
            </button>
            <For each={data()!.available_years}>
              {(yr) => (
                <button
                  type="button"
                  class={`segmented-filter-btn ${selectedYear() === yr ? 'active' : ''}`}
                  onClick={() => setSelectedYear(yr)}
                >
                  {yr}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      <Show when={data()} fallback={<p style="text-align: center; color: var(--text-muted); padding: 2rem 0;">Memuat analitik...</p>}>
        {/* Cashflow Summary Card */}
        <div class="doppel-card" style="margin-bottom: 1rem;">
          <div class="doppel-inner">
            <h2 style="font-size: 0.9375rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.875rem;">
              Ringkasan uang dinas &amp; belanja
            </h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <span style="font-size: 0.8125rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">
                  Total uang dinas diterima
                </span>
                <span class="amount text-emerald" style="font-size: 1.125rem; font-weight: 800; display: block;">
                  {formatRp(data()!.total_uang_dinas_rp)}
                </span>
              </div>
              <div>
                <span style="font-size: 0.8125rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">
                  Total pengeluaran dinas
                </span>
                <span class="amount text-rose" style="font-size: 1.125rem; font-weight: 800; display: block;">
                  {formatRp(data()!.total_expenses_rp)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div class="analytics-bento">
          <div class="doppel-card" style="margin-bottom: 0;">
            <div class="doppel-inner">
              <span style="font-size: 0.8125rem; color: var(--text-muted); font-weight: 600;">
                Total perjalanan
              </span>
              <div class="amount text-sky" style="font-size: 1.125rem; font-weight: 700; margin-top: 0.25rem;">
                {data()!.total_trips ?? '-'} <span style="font-size: 0.8125rem; font-weight: 500; color: var(--text-muted);">trip</span>
              </div>
            </div>
          </div>

          <div class="doppel-card" style="margin-bottom: 0;">
            <div class="doppel-inner">
              <span style="font-size: 0.8125rem; color: var(--text-muted); font-weight: 600;">
                Rata-rata per trip
              </span>
              <div class="amount" style="font-size: 1.125rem; font-weight: 700; margin-top: 0.25rem; color: var(--text-primary);">
                {formatRp(data()!.average_expense_trip)}
              </div>
            </div>
          </div>

          <div class="doppel-card" style="margin-bottom: 0;">
            <div class="doppel-inner">
              <span style="font-size: 0.8125rem; color: var(--text-muted); font-weight: 600;">
                Total hari dinas
              </span>
              <div class="amount text-emerald" style="font-size: 1.125rem; font-weight: 700; margin-top: 0.25rem;">
                {data()!.total_days} <span style="font-size: 0.8125rem; font-weight: 500; color: var(--text-muted);">hari</span>
              </div>
            </div>
          </div>

          <div class="doppel-card" style="margin-bottom: 0;">
            <div class="doppel-inner">
              <span style="font-size: 0.8125rem; color: var(--text-muted); font-weight: 600;">
                Belanja harian
              </span>
              <div class="amount text-amber" style="font-size: 1.125rem; font-weight: 700; margin-top: 0.25rem;">
                {formatRp(data()!.daily_burn_rate)} <span style="font-size: 0.8125rem; font-weight: 500; color: var(--text-muted);">/hari</span>
              </div>
            </div>
          </div>

          <div class="doppel-card" style="margin-bottom: 0;">
            <div class="doppel-inner">
              <span style="font-size: 0.8125rem; color: var(--text-muted); font-weight: 600;">
                Porsi talangan pribadi
              </span>
              <div class="amount" style="font-size: 1.125rem; font-weight: 700; margin-top: 0.25rem; color: var(--text-primary);">
                {data()!.personal_share_pct}%
              </div>
              <div style="font-size: 0.8125rem; color: var(--text-muted); margin-top: 0.125rem;">
                dari total belanja
              </div>
            </div>
          </div>

          <div class="doppel-card" style="margin-bottom: 0;">
            <div class="doppel-inner">
              <span style="font-size: 0.8125rem; color: var(--text-muted); font-weight: 600;">
                Realisasi pagu lunas
              </span>
              <div
                class={'amount ' + (data()!.budget_realization_pct <= 100 ? 'text-emerald' : 'text-rose')}
                style="font-size: 1.125rem; font-weight: 700; margin-top: 0.25rem;"
              >
                {data()!.budget_realization_pct}%
              </div>
              <div style="font-size: 0.8125rem; color: var(--text-muted); margin-top: 0.125rem;">
                {data()!.budget_realization_pct <= 100 ? 'di bawah pagu' : 'melebihi pagu'}
              </div>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div class="doppel-card" style="margin-bottom: 1rem;">
          <div class="doppel-inner">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h2 style="font-size: 0.9375rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                Pengeluaran per kategori
              </h2>
              <span style="font-size: 0.8125rem; color: var(--text-muted);">
                {data()!.categories.length} kategori
              </span>
            </div>

            <Show
              when={data()!.categories.length > 0}
              fallback={
                <p style="font-size: 0.8125rem; color: var(--text-muted); padding: 1rem 0; text-align: center;">
                  Belum ada data pengeluaran yang tercatat.
                </p>
              }
            >
              <div style="display: flex; flex-direction: column; gap: 0.875rem;">
                <For each={data()!.categories}>
                  {(cat, idx) => {
                    const color = COLORS[idx() % COLORS.length];
                    return (
                      <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8125rem; margin-bottom: 0.375rem;">
                          <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style={`width: 6px; height: 6px; border-radius: 9999px; background: ${color};`}></span>
                            <span style="color: var(--text-primary); font-weight: 600;">{cat.category_nama}</span>
                          </div>
                          <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="amount" style="color: var(--text-muted); font-size: 0.75rem;">
                              {cat.percentage}%
                            </span>
                            <span class="amount" style="color: var(--text-primary); font-weight: 700;">
                              {formatRp(cat.total)}
                            </span>
                          </div>
                        </div>

                        <div class="burn-down-track" style="margin: 0; height: 4px;">
                          <div
                            class="burn-down-fill"
                            style={{
                              width: `${cat.percentage}%`,
                              background: color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>
        </div>

        {/* Payment Methods Breakdown */}
        <div class="doppel-card">
          <div class="doppel-inner">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h2 style="font-size: 0.9375rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                Metode pembayaran
              </h2>
              <span style="font-size: 0.8125rem; color: var(--text-muted);">
                {data()!.payment_methods.length} metode
              </span>
            </div>

            <Show
              when={data()!.payment_methods.length > 0}
              fallback={
                <p style="font-size: 0.8125rem; color: var(--text-muted); padding: 1rem 0; text-align: center;">
                  Belum ada transaksi pembayaran.
                </p>
              }
            >
              <div style="display: flex; flex-direction: column; gap: 0.875rem;">
                <For each={data()!.payment_methods}>
                  {(pm, idx) => {
                    const color = COLORS[(idx() + 2) % COLORS.length];
                    return (
                      <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8125rem; margin-bottom: 0.375rem;">
                          <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style={`width: 6px; height: 6px; border-radius: 9999px; background: ${color};`}></span>
                            <span style="color: var(--text-primary); font-weight: 600;">{pm.payment_method_nama}</span>
                          </div>
                          <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="amount" style="color: var(--text-muted); font-size: 0.75rem;">
                              {pm.percentage}%
                            </span>
                            <span class="amount text-emerald" style="font-weight: 700;">
                              {formatRp(pm.total)}
                            </span>
                          </div>
                        </div>

                        <div class="burn-down-track" style="margin: 0; height: 4px;">
                          <div
                            class="burn-down-fill"
                            style={{
                              width: `${pm.percentage}%`,
                              background: color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default Analytics;
