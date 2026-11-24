import { Component, createResource, For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { getDashboard, getTrips } from '../api';
import StatusBadge from '../components/StatusBadge';

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const Dashboard: Component = () => {
  const [dashboard] = createResource(getDashboard);
  const [trips] = createResource(getTrips);

  return (
    <div class="page">
      {/* Summary cards */}
      <Show when={dashboard()}>
        <div class="summary-cards">
          <div class="summary-card card-red">
            <div class="summary-label">Belum Lunas</div>
            <div class="summary-value">{formatRp(dashboard()!.belum_lunas)}</div>
          </div>
          <div class="summary-card card-green">
            <div class="summary-label">Pemasukan Bulan Lalu</div>
            <div class="summary-value">{formatRp(dashboard()!.pemasukan_bulan_lalu)}</div>
          </div>
        </div>
      </Show>

      {/* Trip list */}
      <div class="section-header">
        <h2>Perjalanan Dinas</h2>
      </div>

      <Show when={trips()} fallback={<p>Memuat...</p>}>
        <Show when={trips()!.length > 0} fallback={<p class="empty">Belum ada perjalanan dinas</p>}>
          <div class="trip-list">
            <For each={trips()}>
              {(trip) => (
                <A href={`/trips/${trip.id}`} class="trip-card">
                  <div class="trip-card-header">
                    <strong>{trip.nama}</strong>
                    <StatusBadge status={trip.status} />
                  </div>
                  <div class="trip-card-meta">
                    {trip.tujuan} · {trip.tanggal_mulai} — {trip.tanggal_selesai}
                  </div>
                  <div class="trip-card-footer">
                    <span>Pengeluaran: {formatRp(trip.total_pengeluaran)}</span>
                    <span class={trip.saldo >= 0 ? 'text-green' : 'text-red'}>
                      Saldo: {formatRp(trip.saldo)}
                    </span>
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
