import { Component, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { logout, type User } from '../api';

const Navbar: Component<{ user: User | null; onLogout: () => void }> = (props) => {
  const handleLogout = async () => {
    await logout();
    props.onLogout();
  };

  return (
    <div class="navbar-wrapper">
      <nav class="navbar">
        <A href="/" class="nav-brand">
          <div class="nav-brand-glyph">✈</div>
          <span>Perjadin</span>
        </A>
        <Show when={props.user}>
          <div class="nav-right">
            <Show when={props.user!.role === 'admin'}>
              <A href="/admin" class="nav-link">Admin</A>
            </Show>
            <span class="nav-user-pill">{props.user!.name}</span>
            <button onClick={handleLogout} class="btn-sm btn-outline">Keluar</button>
          </div>
        </Show>
      </nav>
    </div>
  );
};

export default Navbar;
