import { Component, Show } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { logout, type User } from '../api';
import { PlaneIcon, LogoutIcon } from './Icons';
import WorkspaceSwitcher from './WorkspaceSwitcher';

const Navbar: Component<{ user: User | null; onLogout: () => void }> = (props) => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' || location.pathname.startsWith('/trips');
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await logout();
    props.onLogout();
  };

  return (
    <Show when={props.user}>
      <header class="navbar-wrapper">
        <nav class="navbar" aria-label="Navigasi utama">
          <div style="display: flex; align-items: center; gap: 1.5rem;">
            <A href="/" class="nav-brand">
              <div class="nav-brand-glyph">
                <PlaneIcon size={16} strokeWidth={2.2} />
              </div>
              <span>Perjadin</span>
            </A>

            <div class="nav-links-desktop">
              <A href="/" class={`nav-link-item ${isActive('/') ? 'active' : ''}`}>
                Perjalanan
              </A>
              <A href="/analytics" class={`nav-link-item ${isActive('/analytics') ? 'active' : ''}`}>
                Analitik
              </A>
              <Show when={props.user?.role === 'admin'}>
                <A href="/admin" class={`nav-link-item ${isActive('/admin') ? 'active' : ''}`}>
                  Admin
                </A>
              </Show>
            </div>
          </div>

          <div class="nav-right">
            <WorkspaceSwitcher />
            <span class="nav-user-pill">{props.user!.name}</span>
            <button
              type="button"
              onClick={handleLogout}
              class="btn-icon-subtle"
              title="Keluar"
              aria-label="Keluar dari akun"
            >
              <LogoutIcon size={16} />
            </button>
          </div>
        </nav>
      </header>
    </Show>
  );
};

export default Navbar;
