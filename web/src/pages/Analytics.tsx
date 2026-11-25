import { Component, createResource, createSignal, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { getAnalytics } from '../api';
import { ArrowLeftIcon, CalendarIcon, WalletIcon, ReceiptIcon, CreditCardIcon } from '../components/Icons';

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

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
  const [selectedYear, setSelectedYear] = createSignal<number | undefined>(undefined);
  const [data] = createResource(selectedYear, (yr) => getAnalytics(typeof yr === 'number' ? yr : undefined));

  return (
    <div class="page" style="padding-bottom: 6rem;">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
        <A href="/" class="btn-icon-subtle" aria-label="Kembali ke Dashboard">
          <ArrowLeftIcon size={16} />
        </A>
        <div>
          <h2 style="font-size: 1.125rem; font-weight: 800; color: var(--text-primary); margin: 0;">
            Analitik Keuangan
          </h2>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">
            Distribusi Pengeluaran & Arus Kas Dinas Pribadi
          </p>
        </div>
      </div>

      {/* Year Filter Chips */}
      <Show when={data()?.available_years && data()!.available_years!.length > 0}>
        <div class="filter-chips" style="display: flex; gap: 0.5rem; margin-bottom: 1.25rem; overflow-x: auto; padding-bottom: 0.25rem;">
          <button
            type="button"
            class={`filter-chip ${selectedYear() === undefined ? 'active' : ''}`}
            onClick={() => setSelectedYear(undefined)}
          >
            Semua Tahun
          </button>
          <For each={data()!.available_years}>
            {(yr) => (
              <button
                type="button"
                class={`filter-chip ${selectedYear() === yr ? 'active' : ''}`}
                onClick={() => setSelectedYear(yr)}
              >
                {yr}
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={data()} fallback={<p style="text-align: center; color: var(--text-muted); padding: 2rem 0;">Memuat analitik...</p>}>
        {/* Metric Cards: 2x3 Bento Grid */}
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem;">
          <div class="doppel-card">
            <div class="doppel-inner">
              <span style="font-size: 0.6875rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.05em;">
                Total Belanja
              </span>
              <div class="amount text-rose" style="font-size: 1.0625rem; font-weight: 700; margin-top: 0.25rem;">
                {formatRp(data()!.total_expenses_rp)}
              </div>
            </div>
          </div>

          <div class="doppel-card">
            <div class="doppel-inner">
              <span style="font-size: 0.6875rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.05em;">
                Rata-Rata / Trip
              </span>
              <div class="amount text-sky" style="font-size: 1.0625rem; font-weight: 700; margin-top: 0.25rem;">
                {formatRp(data()!.average_expense_trip)}
              </div>
            </div>
          </div>

          <div class="doppel-card">
            <div class="doppel-inner">
              <span style="font-size: 0.6875rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.05em;">
                Total Hari Dinas
              </span>
              <div class="amount text-emerald" style="font-size: 1.0625rem; font-weight: 700; margin-top: 0.25rem;">
                {data()!.total_days} <span style="font-size: 0.8125rem; font-weight: 500; color: var(--text-muted);">hari</span>
              </div>
            </div>
          </div>

          <div class="doppel-card">
            <div class="doppel-inner">
              <span style="font-size: 0.6875rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.05em;">
                Daily Burn Rate
              </span>
              <div class="amount text-amber" style="font-size: 1.0625rem; font-weight: 700; margin-top: 0.25rem;">
                {formatRp(data()!.daily_burn_rate)} <span style="font-size: 0.6875rem; font-weight: 500; color: var(--text-muted);">/hari</span>
              </div>
            </div>
          </div>

          <div class="doppel-card">
            <div class="doppel-inner">
              <span style="font-size: 0.6875rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.05em;">
                Porsi Talangan Pribadi
              </span>
              <div class="amount" style="font-size: 1.0625rem; font-weight: 700; margin-top: 0.25rem; color: var(--text-primary);">
                {data()!.personal_share_pct}%
              </div>
              <div style="font-size: 0.6875rem; color: var(--text-muted); margin-top: 0.125rem;">
                dari total belanja
              </div>
            </div>
          </div>

          <div class="doppel-card">
            <div class="doppel-inner">
              <span style="font-size: 0.6875rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.05em;">
                Realisasi Pagu Lunas
              </span>
              <div
                class={'amount ' + (data()!.budget_realization_pct <= 100 ? 'text-emerald' : 'text-rose')}
                style="font-size: 1.0625rem; font-weight: 700; margin-top: 0.25rem;"
              >
                {data()!.budget_realization_pct}%
              </div>
              <div style="font-size: 0.6875rem; color: var(--text-muted); margin-top: 0.125rem;">
                {data()!.budget_realization_pct <= 100 ? 'di bawah pagu' : 'melebihi pagu'}
              </div>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div class="doppel-card" style="margin-bottom: 1.25rem;">
          <div class="doppel-inner">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin: 0;">
                Pengeluaran per Kategori
              </h3>
              <span style="font-size: 0.75rem; color: var(--text-muted);">
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
              <h3 style="font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin: 0;">
                Metode Pembayaran
              </h3>
              <span style="font-size: 0.75rem; color: var(--text-muted);">
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
