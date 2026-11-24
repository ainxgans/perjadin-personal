import { Component, createResource, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { getDashboard, getTrips } from '../api';
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

  return (
    <div class="page">
      {/* Summary metrics */}
      <Show when={dashboard()}>
        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-label">Belum Lunas</span>
            <span class="metric-value amber num">{formatRp(dashboard()!.belum_lunas)}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Pemasukan Bulan Lalu</span>
            <span class="metric-value green num">{formatRp(dashboard()!.pemasukan_bulan_lalu)}</span>
          </div>
        </div>
      </Show>

      {/* Trip list header */}
      <div class="section-header">
        <h2>Daftar Perjalanan</h2>
      </div>

      {/* Trip list & empty state */}
      <Show when={trips()} fallback={<p>Memuat...</p>}>
        <Show
          when={trips()!.length > 0}
          fallback={
            <div class="empty-state">
              <div class="empty-state-icon">✈️</div>
              <h3>Belum ada perjalanan</h3>
              <p>Mulai catat perjalanan dinas dan pengeluaran kamu.</p>
              <A href="/trips/new" class="btn btn-sm">+ Tambah Perjalanan</A>
            </div>
          }
        >
          <div class="trip-list">
            <For each={trips()}>
              {(trip) => (
                <A href={`/trips/${trip.id}`} class="trip-card">
                  <div class="trip-card-header">
                    <span class="trip-card-title">{trip.nama}</span>
                    <StatusBadge status={trip.status} />
                  </div>
                  <div class="trip-card-route">
                    <span class="trip-card-route-icon">📍</span>
                    <span>{trip.tujuan} · {formatDates(trip.tanggal_mulai, trip.tanggal_selesai)}</span>
                  </div>
                  <div class="trip-card-divider" />
                  <div class="trip-card-footer">
                    <div class="trip-stat-block">
                      <span class="trip-stat-label">Pengeluaran</span>
                      <span class="trip-stat-val num">{formatRp(trip.total_pengeluaran)}</span>
                    </div>
                    <div class="trip-stat-block" style="text-align: right">
                      <span class="trip-stat-label">Saldo</span>
                      <span class={`trip-stat-val num ${trip.saldo >= 0 ? 'text-green' : 'text-red'}`}>
                        {formatRp(trip.saldo)}
                      </span>
                    </div>
                  </div>
                </A>
              )}
            </For>
          </div>
        </Show>
      </Show>

      <A href="/trips/new" class="fab">+</A>
    </div>
  );
};

export default Dashboard;
