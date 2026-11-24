import { Component } from 'solid-js';

const statusConfig: Record<string, { label: string; class: string }> = {
  berlangsung: { label: 'Berlangsung', class: 'badge-blue' },
  urus_berkas: { label: 'Urus Berkas', class: 'badge-orange' },
  selesai: { label: 'Selesai', class: 'badge-green' },
};

const StatusBadge: Component<{ status: string }> = (props) => {
  const cfg = () => statusConfig[props.status] || { label: props.status, class: '' };
  return <span class={`badge ${cfg().class}`}>{cfg().label}</span>;
};

export default StatusBadge;
