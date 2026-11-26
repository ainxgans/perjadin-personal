/* @refresh reload */
import { render } from 'solid-js/web';
import App from './App';
import './styles/global.css';

render(() => <App />, document.getElementById('root')!);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed; ignore silently in unsupported contexts
    });
  });
}
