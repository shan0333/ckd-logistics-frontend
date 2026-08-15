'use client';

import { useEffect } from 'react';
import { RiAlertLine, RiCloseLine } from 'react-icons/ri';

interface Props {
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title = 'Confirm Delete',
  message = 'This action cannot be undone.',
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={onCancel}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn  { from { opacity: 0; transform: scale(0.92) translateY(8px) }
                            to   { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          width: '100%',
          maxWidth: '400px',
          margin: '0 16px',
          animation: 'popIn 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 20px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <RiAlertLine style={{ color: '#DC2626', fontSize: '20px' }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: '16px', color: '#111' }}>{title}</span>
          </div>
          <button onClick={onCancel} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9CA3AF', padding: '4px', borderRadius: '6px',
          }}>
            <RiCloseLine style={{ fontSize: '20px' }} />
          </button>
        </div>

        {/* Body */}
        <p style={{ padding: '12px 20px 0', color: '#6B7280', fontSize: '14px', lineHeight: '1.5' }}>
          {message}
        </p>

        {/* Actions */}
        <div style={{
          display: 'flex', gap: '10px', justifyContent: 'flex-end',
          padding: '20px',
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 18px', borderRadius: '8px', fontWeight: 600,
              border: '1.5px solid #E5E7EB', background: '#fff',
              color: '#374151', cursor: 'pointer', fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 18px', borderRadius: '8px', fontWeight: 600,
              border: 'none', background: '#DC2626',
              color: '#fff', cursor: 'pointer', fontSize: '14px',
              boxShadow: '0 2px 8px rgba(220,38,38,0.35)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
