import { createSignal } from 'solid-js';

const STORAGE_KEY = 'perjadin_hide_amounts';

const initialHidden =
  typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1';

export const [hideAmounts, setHideAmounts] = createSignal<boolean>(initialHidden);

export const toggleHideAmounts = () => {
  const next = !hideAmounts();
  setHideAmounts(next);
  try {
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    // ignore storage errors
  }
};

export const formatRp = (n: number) => {
  if (hideAmounts()) return 'Rp ••••••';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
};
