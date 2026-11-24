import { Component, Show } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import type { User } from '../api';

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
            <span class="dock-icon">🛫</span>
            <span class="dock-label">Perjalanan</span>
          </A>

          <A href="/analytics" class={`dock-item ${isActive('/analytics') ? 'active' : ''}`}>
            <span class="dock-icon">📊</span>
            <span class="dock-label">Analitik</span>
          </A>

          <Show when={props.user?.role === 'admin'}>
            <A href="/admin" class={`dock-item ${isActive('/admin') ? 'active' : ''}`}>
              <span class="dock-icon">⚙️</span>
              <span class="dock-label">Admin</span>
            </A>
          </Show>
        </nav>
      </div>
    </Show>
  );
};

export default BottomNav;
