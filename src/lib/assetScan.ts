// Asset QR codes may carry structured data rather than a bare id. This breaks the common shapes
// out into label/value pairs so the user can see what was scanned:
//   - a JSON object:                     {"assetId":"A-1001","type":"Pallet"}
//   - key/value parts split by newline,  assetId: A-1001
//     ";" or "|", using ":" or "=":       type=Pallet; owner=Spaceage
// Anything else (a plain barcode, a URL, a single "x:y") returns null and is shown as-is.

export interface ScanValue {
  label: string;
  value: string;
}

const KEY_VALUE = /^([^:=]{1,40}?)\s*[:=]\s*(.*)$/;

export function parseScanValues(code: string | undefined | null): ScanValue[] | null {
  const text = (code ?? '').trim();
  if (!text) return null;

  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const values = Object.entries(obj).map(([label, v]) => ({
          label,
          value: v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''),
        }));
        return values.length > 0 ? values : null;
      }
    } catch { /* not JSON — fall through */ }
  }

  const parts = text.split(/\r?\n|;|\|/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const values: ScanValue[] = [];
  for (const part of parts) {
    const m = part.match(KEY_VALUE);
    // "https://…" splits as key "https" + value "//…" — that's a URL, not a key/value pair.
    if (!m || m[2].startsWith('//')) return null;
    values.push({ label: m[1].trim(), value: m[2].trim() });
  }
  return values;
}
