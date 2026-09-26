// Vehicle Reported On (and any other field using <input type="datetime-local">) needs three
// conversions: the ISO timestamp the backend sends back -> the "YYYY-MM-DDTHH:mm" shape the
// input requires, the input's edited value -> a full ISO timestamp to send back, and either
// shape -> something readable in a table/view.
//
// Jackson's default java.util.Date (de)serialization is what we're round-tripping against —
// confirmed against the backend (OrginServiceImpl.getJson uses a plain `new ObjectMapper()`,
// no @JsonFormat) — so a real toISOString() string is guaranteed to parse the same way the
// "date-only" string it replaces already did, just with the time-of-day finally included
// instead of defaulting to midnight.

/** ISO timestamp from the API -> local "YYYY-MM-DDTHH:mm" for a datetime-local input's value. */
export function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

/** A datetime-local input's value (local wall-clock time) -> full ISO timestamp for the API. */
export function fromDatetimeLocalValue(local?: string | null): string {
  if (!local) return '';
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Any date/timestamp shape -> "DD-MM-YYYY", for tables and view modals. */
export function formatDateOnly(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Either shape -> "DD-MM-YYYY HH:mm" for tables and view modals. */
export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${formatDateOnly(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
