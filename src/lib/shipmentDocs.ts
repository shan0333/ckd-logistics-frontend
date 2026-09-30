import { OrginImage } from '@/lib/types';

// Shipment attachments come in two kinds: the ODC (over-dimensional cargo) document and the LR
// (lorry receipt) document. The backend stores every attachment for a shipment the same way
// (image table, keyed by shipment no, no document-type column), so the kind is carried in the
// file name instead: "ODC_permit.jpg" / "LR_scan.pdf". Tagging happens right before upload and
// the image viewers read it back, so no backend change or database migration is needed.
//
// Inward ODC documents specifically are tagged "ODC<1-based lot index>_..." (e.g. "ODC1_",
// "ODC2_") instead of a flat "ODC_" — a shipment can have multiple lot scans, each with its own
// document, and the backend matches the digit back to the orgin_odc_lot row it belongs to (see
// OrginServiceImpl.insertNewOdcLots/resolveLotId). Receiving's single ODC document (no lots
// involved there) still uses the plain "ODC_" tag via tagDocs.
//
// Adding a document to a lot that was already saved on an earlier create/edit (as opposed to a
// brand-new lot in this same request) uses "ODCEXISTING<lot id>_..." instead — there's no
// 1-based index to resolve because the lot already has a real orgin_odc_lot id, and the backend
// checks that id actually belongs to this shipment before linking the upload (resolveLotId).
// This tag is stored permanently as-is in image.file_name once uploaded, same as the index-based
// one, so displayName/docKindOf below must keep recognizing it forever, not just at upload time.
export type DocKind = 'ODC' | 'LR';

const PREFIXES: Record<DocKind, string> = { ODC: 'ODC_', LR: 'LR_' };
const ODC_LOT_PREFIX = /^ODC(?:EXISTING)?(\d*)_/;

// What the system file picker accepts — photos and PDFs. Camera captures are always images.
export const DOC_ACCEPT = 'image/*,application/pdf';

export function tagDocs(files: File[], kind: DocKind): File[] {
  return files.map(
    (f) => new File([f], `${PREFIXES[kind]}${f.name}`, { type: f.type, lastModified: f.lastModified }),
  );
}

/** Tags files for one Inward ODC lot entry — lotIndex is the entry's 1-based position among the
 * NEW lots being submitted this request (must match the order sent in odc_lots). */
export function tagDocsForLot(files: File[], lotIndex: number): File[] {
  return files.map(
    (f) => new File([f], `ODC${lotIndex}_${f.name}`, { type: f.type, lastModified: f.lastModified }),
  );
}

/** Tags files being added to a lot that was already saved before this request (edit mode) —
 * lotId is its real orgin_odc_lot id, not a position in this request's odc_lots array. */
export function tagDocsForExistingLot(files: File[], lotId: number): File[] {
  return files.map(
    (f) => new File([f], `ODCEXISTING${lotId}_${f.name}`, { type: f.type, lastModified: f.lastModified }),
  );
}

export function docKindOf(fileName?: string | null): DocKind | null {
  if (!fileName) return null;
  if (ODC_LOT_PREFIX.test(fileName)) return 'ODC';
  if (fileName.startsWith(PREFIXES.LR)) return 'LR';
  return null;
}

/** The file name without the ODC_/ODC<n>_/LR_ tag, for showing to people. */
export function displayName(fileName?: string | null): string {
  if (!fileName) return '';
  const odcMatch = fileName.match(ODC_LOT_PREFIX);
  if (odcMatch) return fileName.slice(odcMatch[0].length);
  if (fileName.startsWith(PREFIXES.LR)) return fileName.slice(PREFIXES.LR.length);
  return fileName;
}

export function isPdf(img: Pick<OrginImage, 'type' | 'file_name'>): boolean {
  return img.type === 'application/pdf' || /\.pdf$/i.test(img.file_name ?? '');
}
