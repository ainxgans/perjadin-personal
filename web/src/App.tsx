import { Component, createSignal, onMount, createEffect, Show } from 'solid-js';
import { Router, Route, useNavigate, type RouteSectionProps } from '@solidjs/router';
import { getMe, type User } from './api';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TripDetail from './pages/TripDetail';
import TripForm from './pages/TripForm';
import AdminHub from './pages/admin/AdminHub';
import AdminUsers from './pages/admin/AdminUsers';
import AdminMaster from './pages/admin/AdminMaster';

const [user, setUser] = createSignal<User | null>(null);
const [loading, setLoading] = createSignal(true);

const Protected: Component<{ children: any }> = (props) => {
  const navigate = useNavigate();

  createEffect(() => {
    if (!loading() && !user()) {
      navigate('/login', { replace: true });
    }
  });

  return (
    <Show when={!loading()} fallback={<div class="page"><p>Memuat...</p></div>}>
      <Show when={user()}>
        {props.children}
      </Show>
    </Show>
  );
};

const AdminProtected: Component<{ children: any }> = (props) => {
  const navigate = useNavigate();

  createEffect(() => {
    if (!loading()) {
      if (!user()) {
        navigate('/login', { replace: true });
      } else if (user()?.role !== 'admin') {
        navigate('/', { replace: true });
      }
    }
  });

  return (
    <Show when={!loading()} fallback={<div class="page"><p>Memuat...</p></div>}>
      <Show when={user() && user()?.role === 'admin'}>
        {props.children}
      </Show>
    </Show>
  );
};

const Layout: Component<RouteSectionProps> = (props) => {
  const handleLogout = () => {
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <>
      <Navbar user={user()} onLogout={handleLogout} />
      <main>
        {props.children}
      </main>
      <BottomNav user={user()} />
    </>
  );
};

const App: Component = () => {
  onMount(async () => {
    try {
      const u = await getMe();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  });

  return (
    <Router root={Layout}>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <Protected><Dashboard /></Protected>} />
      <Route path="/trips/new" component={() => <Protected><TripForm /></Protected>} />
      <Route path="/trips/:id" component={() => <Protected><TripDetail /></Protected>} />
      <Route path="/trips/:id/edit" component={() => <Protected><TripForm /></Protected>} />
      <Route path="/admin" component={() => <AdminProtected><AdminHub /></AdminProtected>} />
      <Route path="/admin/users" component={() => <AdminProtected><AdminUsers /></AdminProtected>} />
      <Route path="/admin/master" component={() => <AdminProtected><AdminMaster /></AdminProtected>} />
    </Router>
  );
};

export default App;
