import { Component, createSignal, createResource, onMount } from 'solid-js';
import { Router, Route, useNavigate } from '@solidjs/router';
import { getMe, type User } from './api';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

const App: Component = () => {
  const [user, setUser] = createSignal<User | null>(null);
  const [loading, setLoading] = createSignal(true);

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

  const handleLogout = () => {
    setUser(null);
    window.location.href = '/login';
  };

  // Guard component
  const Protected: Component<{ children: any }> = (props) => {
    const navigate = useNavigate();
    if (!loading() && !user()) {
      navigate('/login', { replace: true });
      return null;
    }
    return props.children;
  };

  return (
    <>
      <Navbar user={user()} onLogout={handleLogout} />
      <main>
        {loading() ? (
          <div class="page"><p>Memuat...</p></div>
        ) : (
          <Router>
            <Route path="/login" component={Login} />
            <Route path="/" component={() => (
              <Protected><Dashboard /></Protected>
            )} />
          </Router>
        )}
      </main>
    </>
  );
};

export default App;
