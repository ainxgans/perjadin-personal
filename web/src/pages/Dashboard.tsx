import { Component, createSignal, createResource, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { getDashboard, getTrips, type Trip } from '../api';
import StatusBadge from '../components/StatusBadge';

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const formatDate = (s: string) => {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDates = (start: string, end: string) => {
  if (!start) return '';
  if (!end || start === end) return formatDate(start);
  return `${formatDate(start)} — ${formatDate(end)}`;
};

const Dashboard: Component = () => {
  const [dashboard] = createResource(getDashboard);
  const [trips] = createResource(getTrips);

  const [searchQuery, setSearchQuery] = createSignal('');
  const [statusFilter, setStatusFilter] = createSignal<string>('all');

  const filteredTrips = () => {
    const list = trips() || [];
    const query = searchQuery().toLowerCase().trim();
    const status = statusFilter();

    return list.filter((t) => {
      const matchSearch =
        !query ||
        t.nama.toLowerCase().includes(query) ||
        t.tujuan.toLowerCase().includes(query);

      const matchStatus = status === 'all' || t.status === status;

      return matchSearch && matchStatus;
    });
  };

  const getBurnDownPercent = (trip: Trip) => {
    if (!trip.uang_dinas || trip.uang_dinas <= 0) return null;
    const p = Math.round((trip.total_pengeluaran * 100) / trip.uang_dinas);
    return Math.min(p, 100);
  };

  const getBurnDownColor = (trip: Trip) => {
    if (!trip.uang_dinas) return 'var(--indigo)';
    const ratio = trip.total_pengeluaran / trip.uang_dinas;
    if (ratio > 1) return 'var(--rose)';
    if (ratio > 0.8) return 'var(--amber)';
    return 'var(--emerald)';
  };

  return (
    <div class="page">
      {/* Top balance overview */}
      <Show when={dashboard()}>
        <div class="ledger-hero">
          <div class="ledger-hero-inner">
            <div class="ledger-hero-badge">
              <span class="beacon-dot" style="background:#10b981;box-shadow:0 0 8px #10b981;"></span> OVERVIEW KEUANGAN
            </div>
            <div class="ledger-stat-row">
              <div class="ledger-stat-box">
                <span class="label">Belum Lunas</span>
                <span class="val text-amber amount">{formatRp(dashboard()!.belum_lunas)}</span>
              </div>
              <div class="ledger-stat-box" style="text-align: right">
                <span class="label">Pemasukan Bulan Lalu</span>
                <span class="val text-emerald amount">{formatRp(dashboard()!.pemasukan_bulan_lalu)}</span>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Search & Status Filters */}
      <div class="search-filter-box">
        <div class="search-input-wrap">
          <span class="search-input-icon">🔍</span>
          <input
            class="form-control"
            placeholder="Cari perjalanan atau kota tujuan..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </div>

        <div class="filter-chips-row">
          <button
            type="button"
            class={`filter-chip ${statusFilter() === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            Semua ({trips()?.length || 0})
          </button>
          <button
            type="button"
            class={`filter-chip ${statusFilter() === 'berlangsung' ? 'active' : ''}`}
            onClick={() => setStatusFilter('berlangsung')}
          >
            Berlangsung
          </button>
          <button
            type="button"
            class={`filter-chip ${statusFilter() === 'urus_berkas' ? 'active' : ''}`}
            onClick={() => setStatusFilter('urus_berkas')}
          >
            Urus Berkas
          </button>
          <button
            type="button"
            class={`filter-chip ${statusFilter() === 'selesai' ? 'active' : ''}`}
            onClick={() => setStatusFilter('selesai')}
          >
            Selesai
          </button>
        </div>
      </div>

      {/* Heading */}
      <div class="section-heading">
        <h2>Daftar Perjalanan</h2>
        <span style="font-size: 0.75rem; color: var(--text-subtle);">
          {filteredTrips().length} ditemukan
        </span>
      </div>

      {/* Boarding pass / ticket list & empty state */}
      <Show when={trips()} fallback={<p style="text-align: center; color: var(--text-muted); padding: 2rem 0;">Memuat...</p>}>
        <Show
          when={filteredTrips().length > 0}
          fallback={
            <div class="empty-state">
              <div class="empty-state-icon">✈️</div>
              <h3 style="color: #fff; font-size: 1rem; margin-bottom: 0.25rem;">
                {searchQuery() || statusFilter() !== 'all' ? 'Tidak ada hasil yang cocok' : 'Belum ada perjalanan'}
              </h3>
              <p style="font-size: 0.8125rem; margin-bottom: 1.25rem;">
                {searchQuery() || statusFilter() !== 'all'
                  ? 'Coba ganti kata kunci atau pilih filter status lain.'
                  : 'Mulai catat perjalanan dinas dan pengeluaran kamu.'}
              </p>
              <Show when={!searchQuery() && statusFilter() === 'all'}>
                <A href="/trips/new" class="btn btn-primary btn-sm">+ Buat Perjalanan</A>
              </Show>
            </div>
          }
        >
          <div>
            <For each={filteredTrips()}>
              {(trip) => {
                const burnPercent = () => getBurnDownPercent(trip);
                const burnColor = () => getBurnDownColor(trip);

                return (
                  <A href={'/trips/' + trip.id} class="ticket-card">
                    <div class="ticket-inner">
                      <div class="ticket-header">
                        <span class="ticket-title">{trip.nama}</span>
                        <StatusBadge status={trip.status} />
                      </div>

                      <div class="ticket-route">
                        <span class="ticket-route-badge">ROUTE</span>
                        <span>📍 {trip.tujuan} · {formatDates(trip.tanggal_mulai, trip.tanggal_selesai)}</span>
                      </div>

                      {/* Burn-down mini bar if budget exists */}
                      <Show when={burnPercent() !== null}>
                        <div style="margin: 0.25rem 0 0.5rem 0;">
                          <div style="display: flex; justify-content: space-between; font-size: 0.6875rem; color: var(--text-subtle);">
                            <span>Pemakaian Anggaran</span>
                            <span class="amount">{burnPercent()}%</span>
                          </div>
                          <div class="burn-down-track">
                            <div
                              class="burn-down-fill"
                              style={{
                                width: `${burnPercent()}%`,
                                background: burnColor(),
                              }}
                            />
                          </div>
                        </div>
                      </Show>

                      <div class="ticket-perforation">
                        <div class="ticket-notch-left"></div>
                        <div class="ticket-perforation-line"></div>
                        <div class="ticket-notch-right"></div>
                      </div>

                      <div class="ticket-footer">
                        <div class="ticket-metric">
                          <span class="ticket-metric-label">PENGELUARAN</span>
                          <span class="ticket-metric-val amount">{formatRp(trip.total_pengeluaran)}</span>
                        </div>
                        <div class="ticket-metric" style="text-align: right">
                          <span class="ticket-metric-label">SALDO</span>
                          <span class={'ticket-metric-val amount ' + (trip.saldo >= 0 ? 'text-emerald' : 'text-rose')}>
                            {formatRp(trip.saldo)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </A>
                );
              }}
            </For>
          </div>
        </Show>
      </Show>

      {/* FAB */}
      <A href="/trips/new" class="fab" aria-label="Tambah Perjalanan">+</A>
    </div>
  );
};

export default Dashboard;
