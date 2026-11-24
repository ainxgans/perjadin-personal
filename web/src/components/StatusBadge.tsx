import { Component } from 'solid-js';
import { PlaneIcon, CheckIcon, ClockIcon, WalletIcon } from './Icons';

const statusConfig: Record<string, { label: string; class: string; icon: Component<any> }> = {
  berlangsung: { label: 'Berlangsung', class: 'badge badge-blue', icon: PlaneIcon },
  selesai: { label: 'Selesai', class: 'badge badge-orange', icon: ClockIcon },
  diajukan: { label: 'Diajukan', class: 'badge badge-amber', icon: ClockIcon },
  lunas: { label: 'Lunas', class: 'badge badge-green', icon: CheckIcon },
  // ponytail: legacy fallback for urus_berkas
  urus_berkas: { label: 'Urus Berkas', class: 'badge badge-orange', icon: ClockIcon },
};

const StatusBadge: Component<{ status: string }> = (props) => {
  const cfg = () =>
    statusConfig[props.status] || {
      label: props.status,
      class: 'badge badge-gray',
      icon: ClockIcon,
    };

  return (
    <span class={cfg().class}>
      <span style="display: flex; align-items: center;">
        {(() => { const I = cfg().icon; return <I size={12} strokeWidth={2} />; })()}
      </span>
      <span>{cfg().label}</span>
    </span>
  );
};

export default StatusBadge;
