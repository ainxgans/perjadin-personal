import { Component } from 'solid-js';

const statusConfig: Record<string, { label: string; class: string }> = {
  berlangsung: { label: 'Berlangsung', class: 'badge badge-blue' },
  urus_berkas: { label: 'Urus Berkas', class: 'badge badge-orange' },
  selesai: { label: 'Selesai', class: 'badge badge-green' },
};

const StatusBadge: Component<{ status: string }> = (props) => {
  const cfg = () => statusConfig[props.status] || { label: props.status, class: 'badge badge-gray' };
  return (
    <span class={cfg().class}>
      <span class="beacon-dot"></span>
      <span>{cfg().label}</span>
    </span>
  );
};

export default StatusBadge;
