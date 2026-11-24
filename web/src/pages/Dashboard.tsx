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
      {/* Top balance card */}
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
              <div class="ledger-stat-box">
                <span class="label">Pemasukan Bulan Lalu</span>
                <span class="val text-emerald amount">{formatRp(dashboard()!.pemasukan_bulan_lalu)}</span>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Heading */}
      <div class="section-heading">
        <h2>Perjalanan Dinas</h2>
      </div>

      {/* Boarding pass / ticket list & empty state */}
      <Show when={trips()} fallback={<p>Memuat...</p>}>
        <Show
          when={trips()!.length > 0}
          fallback={
            <div class="empty-state">
              <div class="empty-state-icon">✈️</div>
              <h3>Belum ada perjalanan</h3>
              <p>Mulai catat perjalanan dinas dan pengeluaran kamu.</p>
              <A href="/trips/new" class="btn btn-primary btn-sm">+ Buat Perjalanan</A>
            </div>
          }
        >
          <div>
            <For each={trips()}>
              {(trip) => (
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
              )}
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
