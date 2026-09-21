'use client';

import { RiFileTextLine } from 'react-icons/ri';
import { OrginImage } from '@/lib/types';
import { displayName, docKindOf, isPdf } from '@/lib/shipmentDocs';

// The attachment tiles shared by the Shipments and Receiving "Images" viewers: photos render as
// thumbnails, PDFs as a document tile, and ODC / LR documents carry a small badge (read back from
// the ODC_/LR_ tag in the stored file name — see shipmentDocs.ts). Clicking opens the file.
export default function ShipmentImageGrid({ images, testId }: { images: OrginImage[]; testId: string }) {
  return (
    <div data-testid={testId} className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {images.map((img) => {
        const kind = docKindOf(img.file_name);
        const name = displayName(img.file_name);
        return (
          <button key={img.id} onClick={() => window.open(img.s3_url, '_blank', 'noopener,noreferrer')}
            title={name || undefined}
            className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 hover:opacity-80">
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
        );
      })}
    </div>
  );
}
