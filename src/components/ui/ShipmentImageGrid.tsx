'use client';

import { RiCloseLine, RiFileTextLine } from 'react-icons/ri';
import { OrginImage } from '@/lib/types';
import { displayName, docKindOf, isPdf } from '@/lib/shipmentDocs';

interface Props {
  images: OrginImage[];
  testId: string;
  /** When set, each tile gets a remove (X) button — used by the Edit page for already-saved
   * documents. Omitted everywhere else (e.g. the read-only View page). */
  onRemove?: (img: OrginImage) => void;
}

// The attachment tiles shared by the Shipments and Receiving "Images" viewers: photos render as
// thumbnails, PDFs as a document tile, and ODC / LR documents carry a small badge (read back from
// the ODC_/LR_ tag in the stored file name — see shipmentDocs.ts). Clicking opens the file.
export default function ShipmentImageGrid({ images, testId, onRemove }: Props) {
  return (
    <div data-testid={testId} className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {images.map((img) => {
        const kind = docKindOf(img.file_name);
        const name = displayName(img.file_name);
        return (
          <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
            <button type="button" onClick={() => window.open(img.s3_url, '_blank', 'noopener,noreferrer')}
              title={name || undefined} className="w-full h-full hover:opacity-80">
              {isPdf(img) ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-slate-50 p-2 text-slate-500">
                  <RiFileTextLine className="w-8 h-8" />
                  <span className="text-[10px] leading-tight break-all line-clamp-2">{name || 'PDF'}</span>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.s3_url} alt={name || 'Shipment'} className="w-full h-full object-cover" />
              )}
              {kind && (
                <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/70 text-white text-[10px] font-semibold">
                  {kind}
                </span>
              )}
            </button>
            {onRemove && (
              <button type="button" onClick={() => onRemove(img)} aria-label={`Remove ${name || 'document'}`}
                data-testid={`${testId}-remove-${img.id}`}
                className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-slate-900/70 text-white hover:bg-red-600">
                <RiCloseLine className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
