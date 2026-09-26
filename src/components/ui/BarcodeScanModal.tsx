'use client';

import { useEffect, useRef, useState } from 'react';
import { RiCloseLine, RiLoader4Line } from 'react-icons/ri';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';

interface Props {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

// Live camera-based barcode/QR scanning, for warehouses without a handheld scanner gun (the
// gun-based path is just a focused text input elsewhere — it types into whatever has focus).
// Structured the same way as CameraCaptureModal (own overlay above the form, z-60, own Esc
// handler) but decodes continuously via @zxing/browser instead of taking a single photo.
export default function BarcodeScanModal({ open, onClose, onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStarting(true);

    let stopped = false;
    let controls: IScannerControls | null = null;
    const reader = new BrowserMultiFormatReader();

    const start = async () => {
      try {
        let mediaControls: IScannerControls;
        try {
          mediaControls = await reader.decodeFromConstraints(
            { video: { facingMode: 'environment' } },
            videoRef.current ?? undefined,
            (result) => {
              if (result && !stopped) {
                stopped = true;
                mediaControls.stop();
                onScan(result.getText());
              }
            },
          );
        } catch {
          mediaControls = await reader.decodeFromConstraints(
            { video: true },
            videoRef.current ?? undefined,
            (result) => {
              if (result && !stopped) {
                stopped = true;
                mediaControls.stop();
                onScan(result.getText());
              }
            },
          );
        }
        if (stopped) { mediaControls.stop(); return; }
        controls = mediaControls;
      } catch {
        if (!stopped) setError('Could not access a camera — check the browser permission, or enter the code manually instead.');
      } finally {
        if (!stopped) setStarting(false);
      }
    };
    start();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [open, onScan]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-label="Scan barcode or QR code">
      <div data-testid="barcode-scan-modal" className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">Scan Barcode / QR Code</h2>
          <button type="button" onClick={onClose} aria-label="Close scanner" className="text-slate-400 hover:text-slate-700">
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 flex flex-col items-center gap-4 overflow-y-auto">
          {error ? (
            <p data-testid="barcode-scan-error" className="text-sm text-red-600 text-center py-8">{error}</p>
          ) : (
            <>
              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                {starting && <RiLoader4Line className="w-8 h-8 text-white animate-spin absolute z-10" />}
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="pointer-events-none absolute inset-8 border-2 border-white/70 rounded-lg" />
              </div>
              <p className="text-sm text-slate-500 text-center">Point the camera at the barcode or QR code — it captures automatically.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
