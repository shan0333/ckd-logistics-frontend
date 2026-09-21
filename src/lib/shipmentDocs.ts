import { OrginImage } from '@/lib/types';

// Shipment attachments come in two kinds: the ODC (over-dimensional cargo) document and the LR
// (lorry receipt) document. The backend stores every attachment for a shipment the same way
// (image table, keyed by shipment no, no document-type column), so the kind is carried in the
// file name instead: "ODC_permit.jpg" / "LR_scan.pdf". Tagging happens right before upload and
// the image viewers read it back, so no backend change or database migration is needed.
export type DocKind = 'ODC' | 'LR';

const PREFIXES: Record<DocKind, string> = { ODC: 'ODC_', LR: 'LR_' };

// What the system file picker accepts — photos and PDFs. Camera captures are always images.
export const DOC_ACCEPT = 'image/*,application/pdf';

export function tagDocs(files: File[], kind: DocKind): File[] {
  return files.map(
    (f) => new File([f], `${PREFIXES[kind]}${f.name}`, { type: f.type, lastModified: f.lastModified }),
  );
}

export function docKindOf(fileName?: string | null): DocKind | null {
  if (!fileName) return null;
  if (fileName.startsWith(PREFIXES.ODC)) return 'ODC';
  if (fileName.startsWith(PREFIXES.LR)) return 'LR';
  return null;
}

/** The file name without the ODC_/LR_ tag, for showing to people. */
export function displayName(fileName?: string | null): string {
  if (!fileName) return '';
  const kind = docKindOf(fileName);
  return kind ? fileName.slice(PREFIXES[kind].length) : fileName;
}

export function isPdf(img: Pick<OrginImage, 'type' | 'file_name'>): boolean {
  return img.type === 'application/pdf' || /\.pdf$/i.test(img.file_name ?? '');
}
