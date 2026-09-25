'use client';

import { useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from 'react';

interface CodeInputProps {
  value: string[];
  onChange: (chars: string[]) => void;
  autoFocus?: boolean;
}

export function CodeInput({ value, onChange, autoFocus }: CodeInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const set = (idx: number, ch: string) => {
    const next = [...value];
    next[idx] = ch;
    onChange(next);
  };

  const handleChange = (idx: number, raw: string) => {
    const ch = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-1);
    set(idx, ch);
    if (ch && idx < 5) refs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[idx]) {
        set(idx, '');
      } else if (idx > 0) {
        refs.current[idx - 1]?.focus();
        set(idx - 1, '');
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      refs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < 5) {
      refs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    const next = Array(6).fill('') as string[];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    onChange(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="flex gap-2 sm:gap-3 justify-center">
      {value.map((ch, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="text"
          value={ch}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onClick={() => refs.current[i]?.select()}
          spellCheck={false}
          autoCapitalize="characters"
          autoCorrect="off"
          className="w-11 h-14 sm:w-12 sm:h-14 text-center bg-surface-white border border-outline-variant
                     rounded-xl text-on-surface font-mono text-2xl font-bold
                     focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20
                     transition-all caret-transparent"
        />
      ))}
    </div>
  );
}
