import { saveAs } from 'file-saver';
import type { AxiosResponse } from 'axios';

// The Reports endpoints are requested as blobs, so on failure the server's plain-text message
// arrives as a Blob too — read it back so the user sees the real reason (e.g. "Shipment X was not
// found") instead of a generic "Download failed".
export async function reportErrorMessage(e: any, fallback: string): Promise<string> {
  if (e?.response?.status === 403) return 'You do not have access to this report.';
  const data = e?.response?.data;
  if (data instanceof Blob) {
    try {
      const text = (await data.text()).trim();
      if (text && text.length < 300 && !text.startsWith('{') && !text.startsWith('<')) return text;
    } catch { /* fall through */ }
  }
  return fallback;
}

/** Saves a blob response under the server's Content-Disposition filename (or the fallback). */
export function saveReport(res: AxiosResponse<Blob>, fallbackName: string) {
  const cd: string = res.headers?.['content-disposition'] ?? '';
  const match = cd.match(/filename="?([^";]+)"?/i);
  saveAs(res.data, match?.[1] ?? fallbackName);
}
