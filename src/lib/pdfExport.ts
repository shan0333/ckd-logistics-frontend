// Started as a copy of ckd-next-frontend/src/lib/pdfExport.ts (the /ckd dashboard's PDF export).
// Differs in downloadDashboardAsPdf: this one never slices a chart across a page break (too-tall
// rows are split into their widgets, too-tall widgets are scaled to one page) instead of tiling.

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

/** Downloads an ordered list of sections as a multi-page A4 PDF where **nothing is ever cut
 *  across a page break**: each section (header, stat tiles, a row of charts, ...) is captured as
 *  its own image and placed whole — on the current page if it fits, otherwise on a fresh one.
 *
 *  A section taller than a whole page (e.g. a two-chart row that stacked into one column in a
 *  narrow window, or zoomed in) is broken into its widgets — every `<section>` inside it — and
 *  each widget is placed whole, at the same share of the page width it had on screen. A single
 *  widget that is *still* taller than a page is scaled down to fit one page. Used for the
 *  "Export Full Dashboard PDF" button; it captures exactly what's on screen in each section. */
export async function downloadDashboardAsPdf(sections: (HTMLElement | null)[], filename: string): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  let y = MARGIN_MM;
  let pageHasContent = false;

  const newPage = () => { pdf.addPage(); y = MARGIN_MM; pageHasContent = false; };

  /** Places one captured image whole. `widthMm` is its natural width on the page. */
  const place = (dataUrl: string, widthMm: number, heightMm: number) => {
    let w = widthMm, h = heightMm;
    if (h > CONTENT_HEIGHT_MM) {            // taller than a page on its own: shrink to fit one page
      w = (w * CONTENT_HEIGHT_MM) / h;
      h = CONTENT_HEIGHT_MM;
    }
    if (pageHasContent && y + h > PAGE_HEIGHT_MM - MARGIN_MM) newPage();
    const x = MARGIN_MM + (CONTENT_WIDTH_MM - w) / 2;   // centred when narrower than the page
    pdf.addImage(dataUrl, 'JPEG', x, y, w, h);
    y += h + SECTION_GAP_MM;
    pageHasContent = true;
  };

  /** The widgets inside a section: its outermost <section> descendants. */
  const partsOf = (el: HTMLElement): HTMLElement[] => {
    const all = Array.from(el.querySelectorAll<HTMLElement>('section'));
    return all.filter((s) => !all.some((o) => o !== s && o.contains(s)));
  };

  for (const el of sections) {
    if (!el) continue;
    const dataUrl = await captureElementJpeg(el);
    const img = await loadImage(dataUrl);
    const heightMm = (img.naturalHeight * CONTENT_WIDTH_MM) / img.naturalWidth;

    const parts = heightMm > CONTENT_HEIGHT_MM ? partsOf(el) : [];
    if (parts.length > 1) {
      // Too tall as one block — place its widgets one by one, each keeping its on-screen width share.
      const sectionWidthPx = el.getBoundingClientRect().width || 1;
      for (const part of parts) {
        const partUrl = await captureElementJpeg(part);
        const partImg = await loadImage(partUrl);
        const widthMm = Math.min(CONTENT_WIDTH_MM, (CONTENT_WIDTH_MM * part.getBoundingClientRect().width) / sectionWidthPx);
        place(partUrl, widthMm, (partImg.naturalHeight * widthMm) / partImg.naturalWidth);
      }
      continue;
    }
    place(dataUrl, CONTENT_WIDTH_MM, heightMm);
  }

  pdf.save(filename);
}
