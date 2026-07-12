'use client';

import { useEffect } from 'react';
import { X } from 'react-feather';

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Max width of the dialog in px. Defaults to 480. */
  maxWidth?: number;
};

/** Centered, escape-/backdrop-dismissable dialog. Shares .modal-* styles. */
export function Modal({ title, onClose, children, maxWidth }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h3>{title}</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
