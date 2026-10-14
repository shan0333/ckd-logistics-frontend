// Same helper as ckd-next-frontend/src/lib/pdfExport.ts (the /ckd dashboard's PDF export), so both
// apps' dashboard PDFs look and behave the same. Keep the two copies in step.

import { toPng, toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';

// Elements the export shouldn't capture (the "PDF"/"Export…" buttons themselves) are marked
// with this class. html-to-image's `filter` runs per-node on the cloned tree — returning false
// drops that node (and its subtree) from the render entirely, which is what we want here rather
// than a CSS visibility toggle: the button still needs to be clickable/visible on screen right
// up until (and again immediately after) the capture.
const EXPORT_HIDE_CLASS = 'pdf-hide';
function excludeExportControls(node: HTMLElement): boolean {
  return !(node.classList && node.classList.contains(EXPORT_HIDE_CLASS));
}

// html-to-image renders the DOM subtree through an SVG <foreignObject> and lets the browser
// do the actual painting, unlike html2canvas which reimplements CSS painting itself and (as of
// its last release) can't parse the oklch() colors Tailwind v4's default palette compiles to.
// Foreign-object rendering means whatever the browser can render, this can capture — including
// oklch, gradients, box-shadow, everything already on screen.
async function captureElementPng(el: HTMLElement, pixelRatio = 2): Promise<string> {
  return toPng(el, {
    backgroundColor: '#ffffff',
    pixelRatio,
    cacheBust: true,
    filter: excludeExportControls,
  });
}

// The full-dashboard export can be several thousand px tall (every chart + table at once) —
// a lossless PNG at that size lands in the tens of MB. JPEG trades a touch of edge sharpness
// on chart lines for a dramatically smaller file, which matters far more for something meant
// to be emailed/downloaded as a report. Individual chart exports stay PNG (small either way,
// and crisper for a single "poster" image).
async function captureElementJpeg(el: HTMLElement, pixelRatio = 1.5, quality = 0.92): Promise<string> {
  return toJpeg(el, {
    backgroundColor: '#ffffff',
    pixelRatio,
    quality,
    cacheBust: true,
    filter: excludeExportControls,
  });
}

const PX_PER_MM = 96 / 25.4; // CSS px per mm at the standard 96dpi CSS reference

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Downloads a single element as a one-page PDF sized to that element's own aspect ratio
 *  (a "poster" export) — used for the per-chart "download this chart" buttons. */
export async function downloadElementAsPdf(el: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await captureElementPng(el);
  const img = await loadImage(dataUrl);
  const widthMm = img.naturalWidth / PX_PER_MM / 2; // /2 undoes the pixelRatio:2 capture scale
  const heightMm = img.naturalHeight / PX_PER_MM / 2;
  const pdf = new jsPDF({
    orientation: widthMm >= heightMm ? 'l' : 'p',
    unit: 'mm',
    format: [widthMm, heightMm],
  });
  pdf.addImage(dataUrl, 'PNG', 0, 0, widthMm, heightMm);
  pdf.save(filename);
}

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 6;
const SECTION_GAP_MM = 4;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;
const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - MARGIN_MM * 2;

/** Tiles one (already-captured) image down the page from `startY`, adding new pages as needed —
 *  the fallback for a single section taller than one whole page (realistically only the full
 *  Lot Progress table with a lot of rows). Same "repeat the full image at a shifted negative
 *  offset per page" trick as before, just scoped to one section instead of the whole capture. */
function tileImageAcrossPages(pdf: jsPDF, dataUrl: string, widthMm: number, heightMm: number, startY: number) {
  let heightLeft = heightMm - (CONTENT_HEIGHT_MM - startY + MARGIN_MM);
  pdf.addImage(dataUrl, 'JPEG', MARGIN_MM, startY, widthMm, heightMm);
  let position = startY;
  while (heightLeft > 0) {
    position = MARGIN_MM - (heightMm - heightLeft);
    pdf.addPage();
    pdf.addImage(dataUrl, 'JPEG', MARGIN_MM, position, widthMm, heightMm);
    heightLeft -= CONTENT_HEIGHT_MM;
  }
}

/** Downloads an ordered list of sections as a multi-page A4 PDF — each section (a chart card,
 *  the stat tiles, a table, ...) is captured and placed as its own image, and a section only
 *  ever starts a fresh page rather than being sliced mid-chart across a page boundary (unlike
 *  naively tiling one giant screenshot, which cuts through whatever happens to sit on a page
 *  edge). A section taller than a full page on its own (realistically only a long table) falls
 *  back to tileImageAcrossPages for just that one section. Used for the "export full dashboard"
 *  button — captures exactly what's currently toggled into each section (including whichever
 *  drill-down panel happens to be open), same as the on-screen page. */
export async function downloadDashboardAsPdf(sections: (HTMLElement | null)[], filename: string): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  let y = MARGIN_MM;
  let pageHasContent = false;

  for (const el of sections) {
    if (!el) continue;
    const dataUrl = await captureElementJpeg(el);
    const img = await loadImage(dataUrl);
    const heightMm = (img.naturalHeight * CONTENT_WIDTH_MM) / img.naturalWidth;

    if (heightMm > CONTENT_HEIGHT_MM) {
      if (pageHasContent) { pdf.addPage(); y = MARGIN_MM; }
      tileImageAcrossPages(pdf, dataUrl, CONTENT_WIDTH_MM, heightMm, y);
      pdf.addPage();
      y = MARGIN_MM;
      pageHasContent = false;
      continue;
    }

    if (pageHasContent && y + heightMm > PAGE_HEIGHT_MM - MARGIN_MM) {
      pdf.addPage();
      y = MARGIN_MM;
      pageHasContent = false;
    }

    pdf.addImage(dataUrl, 'JPEG', MARGIN_MM, y, CONTENT_WIDTH_MM, heightMm);
    y += heightMm + SECTION_GAP_MM;
    pageHasContent = true;
  }

  // The tiled-section branch always opens a trailing page for whatever comes next, even when
  // that tiled section was the last one overall — drop it rather than shipping a blank final page.
  const pageCount = pdf.getNumberOfPages();
  if (pageCount > 1 && !pageHasContent) {
    pdf.deletePage(pageCount);
  }

  pdf.save(filename);
}
