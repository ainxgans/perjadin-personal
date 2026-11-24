import { Component, createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import type { SBMRate } from '../api';
import { SearchIcon, CheckIcon, MapPinIcon } from './Icons';

interface CreatableSelectProps {
  value: string;
  onChange: (value: string, rate?: SBMRate) => void;
  options: SBMRate[];
  placeholder?: string;
  required?: boolean;
}

const formatRp = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const CreatableSelect: Component<CreatableSelectProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [searchTerm, setSearchTerm] = createSignal('');
  let containerRef: HTMLDivElement | undefined;

  createEffect(() => {
    setSearchTerm(props.value || '');
  });

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  window.addEventListener('click', handleClickOutside);
  onCleanup(() => window.removeEventListener('click', handleClickOutside));

  const filtered = () => {
    const q = searchTerm().toLowerCase().trim();
    if (!q) return props.options || [];
    return (props.options || []).filter(
      (opt) =>
        opt.provinsi.toLowerCase().includes(q) ||
        (opt.ibukota && opt.ibukota.toLowerCase().includes(q))
    );
  };

  const exactMatch = () => {
    const q = searchTerm().toLowerCase().trim();
    return (props.options || []).some(
      (opt) =>
        opt.provinsi.toLowerCase() === q ||
        (opt.ibukota && opt.ibukota.toLowerCase() === q)
    );
  };

  const handleSelect = (opt: SBMRate) => {
    const displayVal = opt.ibukota ? `${opt.ibukota}, ${opt.provinsi}` : opt.provinsi;
    setSearchTerm(displayVal);
    props.onChange(displayVal, opt);
    setIsOpen(false);
  };

  const handleCreateCustom = () => {
    const val = searchTerm().trim();
    if (!val) return;
    props.onChange(val, undefined);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style="position: relative; width: 100%;">
      <div style="position: relative; display: flex; align-items: center;">
        <input
          type="text"
          class="form-control"
          style="padding-right: 2.25rem;"
          value={searchTerm()}
          placeholder={props.placeholder || 'Ketik atau pilih kota / provinsi tujuan...'}
          required={props.required}
          onFocus={() => setIsOpen(true)}
          onInput={(e) => {
            setSearchTerm(e.currentTarget.value);
            props.onChange(e.currentTarget.value, undefined);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsOpen(false);
            if (e.key === 'Enter') {
              e.preventDefault();
              const list = filtered();
              if (list.length > 0) {
                handleSelect(list[0]);
              } else {
                handleCreateCustom();
              }
            }
          }}
        />
        <span
          style="position: absolute; right: 0.75rem; color: var(--text-muted); pointer-events: none; display: flex; align-items: center;"
        >
          <MapPinIcon size={16} />
        </span>
      </div>

      <Show when={isOpen()}>
        <div
          class="dropdown-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: '0',
            right: '0',
            background: 'rgba(18, 20, 28, 0.98)',
            border: '1px solid var(--border-subtle)',
            'border-radius': '14px',
            'box-shadow': '0 12px 32px rgba(0,0,0,0.6)',
            'max-height': '240px',
            'overflow-y': 'auto',
            'z-index': '100',
            padding: '0.375rem',
          }}
        >
          <Show when={searchTerm().trim() && !exactMatch()}>
            <button
              type="button"
              class="dropdown-item-btn"
              onClick={handleCreateCustom}
              style={{
                width: '100%',
                'text-align': 'left',
                padding: '0.625rem 0.75rem',
                border: 'none',
                background: 'rgba(56, 189, 248, 0.08)',
                color: 'var(--sky)',
                'font-size': '0.8125rem',
                'border-radius': '8px',
                cursor: 'pointer',
                'margin-bottom': '0.25rem',
                display: 'flex',
                'align-items': 'center',
                gap: '0.5rem',
              }}
            >
              <span>+ Gunakan kota kustom:</span>
              <strong>"{searchTerm().trim()}"</strong>
            </button>
          </Show>

          <Show
            when={filtered().length > 0}
            fallback={
              !searchTerm().trim() ? (
                <div style="padding: 0.75rem; text-align: center; color: var(--text-muted); font-size: 0.75rem;">
                  Ketik nama kota atau pilih dari daftar SBM
                </div>
              ) : null
            }
          >
            <For each={filtered()}>
              {(opt) => {
                const label = opt.ibukota ? `${opt.ibukota}, ${opt.provinsi}` : opt.provinsi;
                const isSelected = props.value === label || props.value === opt.provinsi;
                return (
                  <button
                    type="button"
                    class="dropdown-item-btn"
                    onClick={() => handleSelect(opt)}
                    style={{
                      width: '100%',
                      'text-align': 'left',
                      padding: '0.5rem 0.75rem',
                      border: 'none',
                      background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      'font-size': '0.8125rem',
                      'border-radius': '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      'align-items': 'center',
                      'justify-content': 'space-between',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div>
                      <div style="font-weight: 600; color: var(--text-primary);">
                        {opt.provinsi}
                        {opt.ibukota ? ` (${opt.ibukota})` : ''}
                      </div>
                      <div style="font-size: 0.6875rem; color: var(--text-muted);">
                        Standar Biaya: <span class="amount text-emerald">{formatRp(opt.uang_harian)}</span> / hari
                      </div>
                    </div>
                    <Show when={isSelected}>
                      <CheckIcon size={14} class="text-sky" />
                    </Show>
                  </button>
                );
              }}
            </For>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default CreatableSelect;
