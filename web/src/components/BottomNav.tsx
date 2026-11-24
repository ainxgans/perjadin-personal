import { Component, Show } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import type { User } from '../api';
import { PlaneIcon, BarChartIcon, SettingsIcon } from './Icons';

const BottomNav: Component<{ user: User | null }> = (props) => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <Show when={props.user}>
      <div class="bottom-dock-wrapper">
        <nav class="bottom-dock" aria-label="Navigasi Utama">
          <A href="/" class={`dock-item ${isActive('/') ? 'active' : ''}`}>
            <span class="dock-icon">
              <PlaneIcon size={18} strokeWidth={isActive('/') ? 2 : 1.75} />
            </span>
            <span>Perjalanan</span>
          </A>

          <A href="/analytics" class={`dock-item ${isActive('/analytics') ? 'active' : ''}`}>
            <span class="dock-icon">
              <BarChartIcon size={18} strokeWidth={isActive('/analytics') ? 2 : 1.75} />
            </span>
            <span>Analitik</span>
          </A>

          <Show when={props.user?.role === 'admin'}>
            <A href="/admin" class={`dock-item ${isActive('/admin') ? 'active' : ''}`}>
              <span class="dock-icon">
                <SettingsIcon size={18} strokeWidth={isActive('/admin') ? 2 : 1.75} />
              </span>
              <span>Admin</span>
            </A>
          </Show>
        </nav>
      </div>
    </Show>
  );
};

export default BottomNav;
