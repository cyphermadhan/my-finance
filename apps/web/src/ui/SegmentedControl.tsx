'use client';

import type { KeyboardEvent } from 'react';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group, e.g. "Create or join a family". */
  ariaLabel: string;
};

/**
 * Accessible segmented control (radiogroup pattern): roving tabindex + arrow-key
 * navigation. Replaces ad-hoc button pairs used as toggles.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel }: Props<T>) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = options.findIndex((o) => o.value === value);
    if (idx === -1) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(options[(idx + 1) % options.length].value);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(options[(idx - 1 + options.length) % options.length].value);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(options[0].value);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(options[options.length - 1].value);
    }
  }

  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={`segmented__option ${selected ? 'is-selected' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
