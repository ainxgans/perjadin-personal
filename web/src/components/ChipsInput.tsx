import { Component, createSignal, For } from 'solid-js';

interface ChipsInputProps {
  values: () => string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

const ChipsInput: Component<ChipsInputProps> = (props) => {
  const [input, setInput] = createSignal('');
  let inputRef: HTMLInputElement | undefined;

  const addChip = (raw: string) => {
    const val = raw.trim();
    if (!val) return;
    const current = props.values();
    // Case-insensitive duplicate check
    if (current.some((c) => c.toLowerCase() === val.toLowerCase())) return;
    props.onChange([...current, val]);
    setInput('');
  };

  const removeChip = (index: number) => {
    props.onChange(props.values().filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(input());
    } else if (e.key === 'Backspace' && input() === '' && props.values().length > 0) {
      removeChip(props.values().length - 1);
    }
  };

  return (
    <div
      class="chips-input-container"
      onClick={() => inputRef?.focus()}
    >
      <For each={props.values()}>
        {(chip, i) => (
          <span class="chip">
            {chip}
            <button
              type="button"
              class="chip-remove"
              onClick={(e) => { e.stopPropagation(); removeChip(i()); }}
              aria-label={`Hapus ${chip}`}
            >
              ×
            </button>
          </span>
        )}
      </For>
      <input
        ref={inputRef}
        type="text"
        class="chips-input-field"
        value={input()}
        onInput={(e) => setInput(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input().trim()) addChip(input()); }}
        placeholder={props.values().length === 0 ? (props.placeholder || 'Ketik lalu tekan Enter...') : ''}
      />
    </div>
  );
};

export default ChipsInput;
