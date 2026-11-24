import { Component, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { logout, type User } from '../api';
import { PlaneIcon, LogoutIcon } from './Icons';

const Navbar: Component<{ user: User | null; onLogout: () => void }> = (props) => {
  const handleLogout = async () => {
    await logout();
    props.onLogout();
  };

  return (
    <div class="navbar-wrapper">
      <nav class="navbar">
        <A href="/" class="nav-brand">
          <div class="nav-brand-glyph">
            <PlaneIcon size={16} strokeWidth={2} />
          </div>
          <span>Perjadin</span>
        </A>
        <Show when={props.user}>
          <div class="nav-right">
            <span class="nav-user-pill">{props.user!.name}</span>
            <button
              onClick={handleLogout}
              class="btn-icon-subtle"
              title="Keluar"
              aria-label="Keluar dari akun"
            >
              <LogoutIcon size={16} />
            </button>
          </div>
        </Show>
      </nav>
    </div>
  );
};

export default Navbar;
