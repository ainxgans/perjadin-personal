import { Component } from 'solid-js';
import { PlaneIcon, ClockIcon, CheckIcon } from './Icons';

const statusConfig: Record<string, { label: string; class: string; icon: Component<any> }> = {
  berlangsung: { label: 'Berlangsung', class: 'badge badge-blue', icon: PlaneIcon },
  urus_berkas: { label: 'Urus Berkas', class: 'badge badge-orange', icon: ClockIcon },
  selesai: { label: 'Selesai', class: 'badge badge-green', icon: CheckIcon },
};

const StatusBadge: Component<{ status: string }> = (props) => {
  const cfg = () =>
    statusConfig[props.status] || {
      label: props.status,
      class: 'badge badge-gray',
      icon: ClockIcon,
    };

  const Icon = () => cfg().icon;

  return (
    <span class={cfg().class}>
      <Icon size={12} strokeWidth={2} />
      <span>{cfg().label}</span>
    </span>
  );
};

export default StatusBadge;
