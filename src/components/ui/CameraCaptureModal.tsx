'use client';

import { useEffect, useRef, useState } from 'react';
import { RiCameraLine, RiCloseLine, RiLoader4Line } from 'react-icons/ri';

interface Props {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

// A file input's `capture="environment"` attribute only reliably launches a native camera app
// on mobile browsers — desktop Chrome/Edge/Firefox ignore it and show the regular file picker.
// getUserMedia gives a real live preview that behaves the same on every device (desktop webcam
// included), so "Take photo" does what it says everywhere.
//
// This draws its own overlay (above the shipment form's modal, z-60) instead of reusing Modal,
// because it opens on top of another modal and Esc must close only the camera, not the form.
export default function CameraCaptureModal({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStarting(true);

    let cancelled = false;
    const start = async () => {
      try {
        // Prefer the rear camera on phones/tablets; desktops have one camera and ignore this.
        // `ideal` 16:9 HD degrades gracefully on cameras that can't do it.
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
          });
        }
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (!cancelled) setError('Could not access a camera — check the browser permission, or use "Upload from system" instead.');
      } finally {
        if (!cancelled) setStarting(false);
      }
    };
    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  // Capture phase on window so this runs before the form Modal's document-level Esc handler
  // and can stop it from also closing the form underneath.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-label="Take photo">
      <div data-testid="camera-capture-modal" className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">Take Photo</h2>
          <button type="button" onClick={onClose} aria-label="Close camera" className="text-slate-400 hover:text-slate-700">
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 flex flex-col items-center gap-4 overflow-y-auto">
          {error ? (
            <p className="text-sm text-red-600 text-center py-8">{error}</p>
          ) : (
            <>
              <div className="w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                {starting && <RiLoader4Line className="w-8 h-8 text-white animate-spin absolute" />}
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
              <button
                type="button"
                data-testid="camera-capture-button"
                onClick={capture}
                disabled={starting}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0">
                <RiCameraLine /> Capture
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
