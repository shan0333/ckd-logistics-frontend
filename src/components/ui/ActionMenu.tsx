'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiMore2Fill } from 'react-icons/ri';
import clsx from 'clsx';

export interface ActionItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export default function ActionMenu({ items }: { items: ActionItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      // Menu is 192px (w-48) wide — align its right edge with the button's right edge.
      setPos({ top: rect.bottom + 4, left: rect.right - 192 });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      setOpen(false);
    };
    // Any scroll (table, page, etc.) invalidates the computed position — just close the menu.
    const onScroll = () => setOpen(false);

    document.addEventListener('mousedown', onClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const visible = items.filter((i) => !i.hidden);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        title="Actions"
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
      >
        <RiMore2Fill className="w-5 h-5" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-50 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1"
        >
          {visible.map(({ label, icon: Icon, onClick, danger, disabled, disabledReason }) => (
            <button
              key={label}
              type="button"
              disabled={disabled}
              title={disabled ? disabledReason : undefined}
              onClick={() => { if (disabled) return; setOpen(false); onClick(); }}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                disabled
                  ? 'text-slate-300 cursor-not-allowed'
                  : danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
