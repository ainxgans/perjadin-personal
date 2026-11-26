import { Component, createSignal, onMount, onCleanup, createEffect, Show } from 'solid-js';
import { Router, Route, useNavigate, useLocation, type RouteSectionProps } from '@solidjs/router';
import { getMe, type User } from './api';
import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TripDetail from './pages/TripDetail';
import TripForm from './pages/TripForm';
import Analytics from './pages/Analytics';
import AdminHub from './pages/admin/AdminHub';
import AdminUsers from './pages/admin/AdminUsers';
import AdminMaster from './pages/admin/AdminMaster';

export const [user, setUser] = createSignal<User | null>(null);
export const [loading, setLoading] = createSignal(true);

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

const getPageTitle = (pathname: string): string => {
  if (pathname === '/') return 'Beranda';
  if (pathname === '/analytics') return 'Analitik Keuangan';
  if (pathname === '/trips/new') return 'Perjalanan Baru';
  if (/^\/trips\/[^/]+\/edit$/.test(pathname)) return 'Edit Perjalanan';
  if (/^\/trips\/[^/]+$/.test(pathname)) return 'Detail Perjalanan';
  if (pathname === '/admin') return 'Admin Terminal';
  if (pathname === '/admin/users') return 'Kelola Pengguna';
  if (pathname === '/admin/master') return 'Data Master';
  return 'Perjadin';
};

const REACH_MAX_DROP = 180;
const REACH_SNAP_THRESHOLD = 56;
const REACH_REFRESH_THRESHOLD = REACH_MAX_DROP + 52;

const Layout: Component<RouteSectionProps> = (props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [reachOffset, setReachOffset] = createSignal(0);
  const [isDragging, setIsDragging] = createSignal(false);
  const [isExpanded, setIsExpanded] = createSignal(false);
  const [willRefresh, setWillRefresh] = createSignal(false);
  const [isRefreshing, setIsRefreshing] = createSignal(false);

  let mainRef: HTMLElement | undefined;
  let startY = 0;
  let startX = 0;
  let baseOffset = 0;
  let tracking = false;
  let gestureLocked: 'vertical' | 'horizontal' | null = null;

  // Reset reachability when navigating between pages
  createEffect(() => {
    location.pathname;
    setIsExpanded(false);
    setReachOffset(0);
  });

  // If user is logged in and there's a pending shared PDF from Android Share Sheet,
  // route straight to /trips/new?shared=1 so it gets parsed automatically.
  createEffect(() => {
    const u = user();
    if (!loading() && u && 'caches' in window && location.pathname !== '/trips/new') {
      caches.open('perjadin-share-target').then((cache) =>
        cache.match('/_shared_pdf').then((res) => {
          if (res) {
            navigate('/trips/new?shared=1', { replace: true });
          }
        })
      ).catch(() => {});
    }
  });

  onMount(() => {
    const el = mainRef;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (!user() || e.touches.length !== 1) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('.modal-overlay, input, textarea, select')) return;

      if (window.scrollY <= 2 || isExpanded()) {
        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
        baseOffset = isExpanded() ? REACH_MAX_DROP : 0;
        tracking = true;
        gestureLocked = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;

      if (!gestureLocked) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          gestureLocked = 'horizontal';
          tracking = false;
          return;
        }
        if (Math.abs(dy) > 8) {
          gestureLocked = 'vertical';
        } else {
          return;
        }
      }

      if (!isExpanded() && (dy <= 0 || window.scrollY > 2)) {
        tracking = false;
        return;
      }

      if (e.cancelable) e.preventDefault();
      setIsDragging(true);

      const raw = baseOffset + dy * 0.72;
      const maxPull = isExpanded() ? REACH_MAX_DROP + 84 : REACH_MAX_DROP + 36;
      const clamped = Math.max(0, Math.min(maxPull, raw));
      setReachOffset(clamped);
      setWillRefresh(isExpanded() && clamped >= REACH_REFRESH_THRESHOLD);
    };

    const onTouchEnd = () => {
      if (!tracking && !isDragging()) return;
      tracking = false;
      setIsDragging(false);

      const current = reachOffset();
      const shouldRefresh = isExpanded() && willRefresh();
      setWillRefresh(false);

      if (!isExpanded()) {
        if (current >= REACH_SNAP_THRESHOLD) {
          setIsExpanded(true);
          setReachOffset(REACH_MAX_DROP);
        } else {
          setIsExpanded(false);
          setReachOffset(0);
        }
      } else if (shouldRefresh) {
        setIsRefreshing(true);
        setReachOffset(REACH_MAX_DROP);
        window.location.reload();
      } else {
        if (current <= REACH_MAX_DROP - 44) {
          setIsExpanded(false);
          setReachOffset(0);
        } else {
          setIsExpanded(true);
          setReachOffset(REACH_MAX_DROP);
        }
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    onCleanup(() => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    });
  });

  const collapseReach = () => {
    setIsExpanded(false);
    setReachOffset(0);
  };

  const handleLogout = () => {
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <>
      <Navbar user={user()} onLogout={handleLogout} />
      <Show when={isExpanded() && reachOffset() > 40}>
        <div class="oneui-reach-space" onClick={collapseReach} role="button" aria-label="Tutup mode satu tangan">
          <div class="oneui-reach-title">{getPageTitle(location.pathname)}</div>
          <span
            class="oneui-reach-hint"
            style={willRefresh() || isRefreshing() ? 'color: var(--accent); border-color: var(--accent-border); background: var(--accent-tint);' : undefined}
          >
            {isRefreshing()
              ? 'Memuat ulang...'
              : willRefresh()
              ? 'Lepas untuk memuat ulang'
              : 'Ketuk untuk merapatkan · Tarik lagi untuk refresh'}
          </span>
        </div>
      </Show>
      <main
        ref={mainRef}
        class={`oneui-stage ${isDragging() ? '' : 'animating'}`}
        style={reachOffset() > 0 ? { transform: `translateY(${reachOffset()}px)` } : undefined}
      >
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
      <Route path="/analytics" component={() => <Protected><Analytics /></Protected>} />
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
