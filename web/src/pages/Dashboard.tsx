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
  return `${formatDate(start)} - ${formatDate(end)}`;
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

      const matchStatus =
        status === 'all'
          ? true
          : status === 'belum_lunas'
          ? t.status !== 'lunas'
          : t.status === status;

      return matchSearch && matchStatus;
    });
  };

  const getPersonalExpense = (trip: Trip) =>
    trip.pengeluaran_pribadi ?? trip.total_pengeluaran;

  const getBurnDownPercent = (trip: Trip) => {
    if (!trip.uang_dinas || trip.uang_dinas <= 0) return null;
    const p = Math.round((getPersonalExpense(trip) * 100) / trip.uang_dinas);
    return Math.min(p, 100);
  };

  const getBurnDownColor = (trip: Trip) => {
    if (!trip.uang_dinas) return 'var(--sky)';
    const ratio = getPersonalExpense(trip) / trip.uang_dinas;
    if (ratio > 1) return 'var(--rose)';
    if (ratio > 0.8) return 'var(--amber)';
    return 'var(--emerald)';
  };

  return (
    <div class="page">
      {/* Top Financial Overview */}
      <Show when={dashboard()}>
        <div class="ledger-summary-band">
          <div class="ledger-metric-cell">
            <span class="ledger-metric-label">Estimasi belum cair</span>
            <span class="ledger-metric-val text-sky amount">{formatRp(dashboard()!.estimasi_belum_cair)}</span>
          </div>
          <div
            class="ledger-metric-cell"
            role="button"
            tabIndex={0}
            style="cursor: pointer;"
            title="Ketuk untuk lihat perjalanan yang belum lunas"
            onClick={() => {
              setStatusFilter('belum_lunas');
              document.getElementById('trip-list-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <span class="ledger-metric-label">Talangan belum lunas ↗</span>
            <span class="ledger-metric-val text-amber amount">{formatRp(dashboard()!.belum_lunas)}</span>
          </div>
          <div class="ledger-metric-cell">
            <span class="ledger-metric-label">Pemasukan bulan lalu</span>
            <span class="ledger-metric-val text-emerald amount">{formatRp(dashboard()!.pemasukan_bulan_lalu)}</span>
          </div>
        </div>
      </Show>

      {/* Search & Connected Segmented Status Filter */}
      <div id="trip-list-section" class="search-filter-box">
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

        <div class="segmented-filter" role="tablist" aria-label="Filter status perjalanan">
          <button
            type="button"
            class={`segmented-filter-btn ${statusFilter() === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            Semua ({trips()?.length || 0})
          </button>
          <button
            type="button"
            class={`segmented-filter-btn ${statusFilter() === 'berlangsung' ? 'active' : ''}`}
            onClick={() => setStatusFilter('berlangsung')}
          >
            Berlangsung
          </button>
          <button
            type="button"
            class={`segmented-filter-btn ${statusFilter() === 'selesai' ? 'active' : ''}`}
            onClick={() => setStatusFilter('selesai')}
          >
            Selesai
          </button>
          <button
            type="button"
            class={`segmented-filter-btn ${statusFilter() === 'diajukan' ? 'active' : ''}`}
            onClick={() => setStatusFilter('diajukan')}
          >
            Diajukan
          </button>
          <button
            type="button"
            class={`segmented-filter-btn ${statusFilter() === 'belum_lunas' ? 'active' : ''}`}
            onClick={() => setStatusFilter('belum_lunas')}
          >
            Belum Lunas
          </button>
          <button
            type="button"
            class={`segmented-filter-btn ${statusFilter() === 'lunas' ? 'active' : ''}`}
            onClick={() => setStatusFilter('lunas')}
          >
            Lunas
          </button>
        </div>
      </div>

      {/* Heading */}
      <div class="section-heading">
        <div>
          <h2 style="margin: 0;">Daftar perjalanan</h2>
          <span style="font-size: 0.8125rem; color: var(--text-muted);">
            {filteredTrips().length} perjalanan ditemukan
          </span>
        </div>
        <A href="/trips/new" class="btn btn-primary btn-sm">
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
              <h3 style="margin-bottom: 0.25rem;">
                {searchQuery() || statusFilter() !== 'all' ? 'Tidak ada hasil yang cocok' : 'Belum ada perjalanan'}
              </h3>
              <p style="font-size: 0.8125rem; margin: 0 auto 1.25rem auto;">
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
          <div class="trips-grid">
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
                            <span style="display: block; font-size: 0.8125rem; color: var(--text-muted); margin-top: 0.125rem;">
                              Kolaborator · {trip.owner_name}
                            </span>
                          </Show>
                        </div>
                        <StatusBadge status={trip.status} />
                      </div>

                      <div class="ticket-route">
                        <MapPinIcon size={14} style="color: var(--text-muted); flex-shrink: 0;" />
                        <span>{trip.tujuan}</span>
                        <span style="color: var(--border-hover);">·</span>
                        <CalendarIcon size={14} style="color: var(--text-muted); flex-shrink: 0;" />
                        <span>{formatDates(trip.tanggal_mulai, trip.tanggal_selesai)}</span>
                      </div>

                      {/* Burn-down bar */}
                      <Show when={burnPercent() !== null}>
                        <div style="margin: 0.25rem 0 0.75rem 0;">
                          <div style="display: flex; justify-content: space-between; font-size: 0.8125rem; color: var(--text-muted);">
                            <span>Pemakaian anggaran</span>
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
                          <span class="ticket-metric-label">Pengeluaran sendiri</span>
                          <span class="ticket-metric-val amount">{formatRp(getPersonalExpense(trip))}</span>
                          <Show when={(trip.talangan_koperasi ?? 0) > 0}>
                            <span style="font-size: 0.8125rem; color: var(--text-muted);">
                              + {formatRp(trip.talangan_koperasi!)} Koperasi
                            </span>
                          </Show>
                        </div>
                        <div class="ticket-metric" style="text-align: right;">
                          <Show
                            when={trip.uang_dinas != null}
                            fallback={
                              <Show
                                when={trip.nominal_monita}
                                fallback={
                                  <div>
                                    <span class="ticket-metric-label">Status kas</span>
                                    <span class="ticket-metric-val" style="color: var(--text-muted);">Menunggu SP2D</span>
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
