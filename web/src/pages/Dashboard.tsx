import { Component, createSignal, createResource, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { getDashboard, getTrips, type Trip } from '../api';
import StatusBadge from '../components/StatusBadge';
import { SearchIcon, MapPinIcon, CalendarIcon, PlusIcon, PlaneIcon } from '../components/Icons';

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
    if (!trip.uang_dinas) return 'var(--sky)';
    const ratio = trip.total_pengeluaran / trip.uang_dinas;
    if (ratio > 1) return 'var(--rose)';
    if (ratio > 0.8) return 'var(--amber)';
    return 'var(--emerald)';
  };

  return (
    <div class="page">
      {/* Top Financial Overview */}
      <Show when={dashboard()}>
        <div class="ledger-hero">
          <div class="ledger-hero-badge">
            Ringkasan Keuangan
          </div>
          <div class="ledger-stat-row">
            <div class="ledger-stat-box">
              <span class="label">Estimasi Belum Cair</span>
              <span class="val text-sky amount">{formatRp(dashboard()!.estimasi_belum_cair)}</span>
            </div>
            <div class="ledger-stat-box" style="text-align: right">
              <span class="label">Talangan Belum Lunas</span>
              <span class="val text-amber amount">{formatRp(dashboard()!.belum_lunas)}</span>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; padding-top: 0.625rem; border-top: 1px solid var(--border-subtle); font-size: 0.75rem;">
            <span style="color: var(--text-muted);">Pemasukan Bulan Lalu:</span>
            <span class="text-emerald amount" style="font-weight: 700;">{formatRp(dashboard()!.pemasukan_bulan_lalu)}</span>
          </div>
        </div>
      </Show>

      {/* Search & Status Filters */}
      <div class="search-filter-box">
        <div class="search-input-wrap">
          <span class="search-input-icon">
            <SearchIcon size={16} />
          </span>
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
            class={`filter-chip ${statusFilter() === 'selesai' ? 'active' : ''}`}
            onClick={() => setStatusFilter('selesai')}
          >
            Selesai
          </button>
          <button
            type="button"
            class={`filter-chip ${statusFilter() === 'diajukan' ? 'active' : ''}`}
            onClick={() => setStatusFilter('diajukan')}
          >
            Diajukan
          </button>
          <button
            type="button"
            class={`filter-chip ${statusFilter() === 'lunas' ? 'active' : ''}`}
            onClick={() => setStatusFilter('lunas')}
          >
            Lunas
          </button>
        </div>
      </div>

      {/* Heading */}
      <div class="section-heading" style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h2>Daftar Perjalanan</h2>
          <span style="font-size: 0.75rem; color: var(--text-muted);">
            {filteredTrips().length} ditemukan
          </span>
        </div>
        <A
          href="/trips/new"
          class="btn btn-primary btn-sm"
          style="font-size: 0.8125rem; padding: 0.375rem 0.75rem; display: inline-flex; align-items: center; gap: 0.375rem; text-decoration: none;"
        >
          <PlusIcon size={14} />
          <span>Perjalanan</span>
        </A>
      </div>

      {/* Trip List & Empty State */}
      <Show when={!trips.loading} fallback={<p style="text-align: center; color: var(--text-muted); padding: 2rem 0;">Memuat...</p>}>
        <Show
          when={filteredTrips().length > 0}
          fallback={
            <div class="empty-state">
              <div class="empty-state-icon">
                <PlaneIcon size={22} />
              </div>
              <h3 style="font-size: 0.9375rem; margin-bottom: 0.25rem;">
                {searchQuery() || statusFilter() !== 'all' ? 'Tidak ada hasil yang cocok' : 'Belum ada perjalanan'}
              </h3>
              <p style="font-size: 0.8125rem; margin-bottom: 1.25rem;">
                {searchQuery() || statusFilter() !== 'all'
                  ? 'Coba ubah kata kunci atau filter status.'
                  : 'Mulai catat perjalanan dinas dan pengeluaran kamu.'}
              </p>
              <Show when={!searchQuery() && statusFilter() === 'all'}>
                <A href="/trips/new" class="btn btn-primary btn-sm">
                  <PlusIcon size={14} /> Buat Perjalanan
                </A>
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
                        <div>
                          <span class="ticket-title">{trip.nama}</span>
                          <Show when={trip.is_owner === false}>
                            <span class="badge badge-gray" style="font-size: 0.625rem; margin-left: 0.375rem;">
                              Kolaborator ({trip.owner_name})
                            </span>
                          </Show>
                        </div>
                        <StatusBadge status={trip.status} />
                      </div>

                      <div class="ticket-route">
                        <MapPinIcon size={14} style="color: var(--text-muted); flex-shrink: 0;" />
                        <span>{trip.tujuan}</span>
                        <span style="color: var(--border-hover); margin: 0 0.125rem;">·</span>
                        <CalendarIcon size={13} style="color: var(--text-muted); flex-shrink: 0;" />
                        <span>{formatDates(trip.tanggal_mulai, trip.tanggal_selesai)}</span>
                      </div>

                      {/* Burn-down bar */}
                      <Show when={burnPercent() !== null}>
                        <div style="margin: 0.25rem 0 0.5rem 0;">
                          <div style="display: flex; justify-content: space-between; font-size: 0.6875rem; color: var(--text-muted);">
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

                      <div class="ticket-footer">
                        <div class="ticket-metric">
                          <span class="ticket-metric-label">Pengeluaran</span>
                          <span class="ticket-metric-val amount">{formatRp(trip.total_pengeluaran)}</span>
                        </div>
                        <div class="ticket-metric" style="text-align: right">
                          <Show
                            when={trip.uang_dinas != null}
                            fallback={
                              <Show
                                when={trip.nominal_monita}
                                fallback={
                                  <div>
                                    <span class="ticket-metric-label">Status Kas</span>
                                    <span class="ticket-metric-val" style="color: var(--text-muted); font-size: 0.75rem;">Menunggu SP2D</span>
                                  </div>
                                }
                              >
                                <span class="ticket-metric-label">Estimasi Monita</span>
                                <span class="ticket-metric-val amount text-sky">{formatRp(trip.nominal_monita!)}</span>
                              </Show>
                            }
                          >
                            <span class="ticket-metric-label">Saldo</span>
                            <span class={'ticket-metric-val amount ' + (trip.saldo >= 0 ? 'text-emerald' : 'text-rose')}>
                              {formatRp(trip.saldo)}
                            </span>
                          </Show>
                        </div>
                      </div>

                      <Show when={trip.status === 'berlangsung'}>
                        <div style="margin-top: 0.625rem; padding-top: 0.5rem; border-top: 1px solid rgba(255, 255, 255, 0.05); display: flex; justify-content: space-between; align-items: center;">
                          <span style="font-size: 0.6875rem; color: var(--emerald); font-weight: 600; display: flex; align-items: center; gap: 0.375rem;">
                            <span style="width: 6px; height: 6px; border-radius: 9999px; background: var(--emerald); display: inline-block;" />
                            Sedang Berlangsung
                          </span>
                          <span class="btn btn-sm btn-secondary" style="font-size: 0.6875rem; padding: 0.25rem 0.625rem; gap: 0.25rem;">
                            <PlusIcon size={12} /> Catat Pengeluaran
                          </span>
                        </div>
                      </Show>
                    </div>
                  </A>
                );
              }}
            </For>
          </div>
        </Show>
      </Show>

      {/* FAB */}
      <A href="/trips/new" class="fab" aria-label="Tambah Perjalanan">
        <PlusIcon size={20} strokeWidth={2.25} />
      </A>
    </div>
  );
};

export default Dashboard;
