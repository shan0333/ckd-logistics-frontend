'use client';

import { useRef, useState } from 'react';
import { RiCameraLine, RiCloseLine, RiFileTextLine, RiUploadLine } from 'react-icons/ri';
import CameraCaptureModal from '@/components/ui/CameraCaptureModal';
import { DOC_ACCEPT } from '@/lib/shipmentDocs';

interface Props {
  label: string;
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  /** Prefix for data-testid hooks: `${testId}-upload`, `-camera`, `-input`, `-list`. */
  testId: string;
}

const BTN = 'flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed';

// One document field that can be filled either from the system (file picker: photos or PDFs) or
// straight from the camera. Both sources add to the same list, so a user can mix them.
export default function DocumentUpload({ label, files, onChange, disabled, testId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);

  const add = (added: File[]) => onChange([...files, ...added]);
  const remove = (index: number) => onChange(files.filter((_, i) => i !== index));

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="flex flex-wrap gap-2">
        <button type="button" data-testid={`${testId}-upload`} disabled={disabled}
          onClick={() => inputRef.current?.click()} className={BTN}>
          <RiUploadLine className="w-4 h-4" /> Upload from system
        </button>
        <button type="button" data-testid={`${testId}-camera`} disabled={disabled}
          onClick={() => setShowCamera(true)} className={BTN}>
          <RiCameraLine className="w-4 h-4" /> Take photo
        </button>
      </div>
      <input ref={inputRef} type="file" multiple accept={DOC_ACCEPT} data-testid={`${testId}-input`}
        className="hidden"
        onChange={(e) => {
          add(Array.from(e.target.files ?? []));
          // Reset so picking the same file again after removing it still fires onChange.
          e.target.value = '';
        }} />

      {files.length > 0 && (
        <ul data-testid={`${testId}-list`} className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.lastModified}-${i}`}
              className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <RiFileTextLine className="w-4 h-4 shrink-0 text-slate-400" />
              <span className="truncate flex-1">{f.name}</span>
              <span className="text-slate-400 shrink-0">{Math.max(1, Math.round(f.size / 1024))} KB</span>
              <button type="button" onClick={() => remove(i)} disabled={disabled} aria-label={`Remove ${f.name}`}
                className="text-slate-400 hover:text-red-600 disabled:opacity-50">
                <RiCloseLine className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <CameraCaptureModal open={showCamera} onClose={() => setShowCamera(false)}
        onCapture={(file) => { add([file]); setShowCamera(false); }} />
    </div>
  );
}
