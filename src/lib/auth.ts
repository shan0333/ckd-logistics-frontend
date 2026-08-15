export function saveSession(data: {
  username: string;
  token: string;
  id: any;
  roles?: string[];
  refreshToken?: string;
  locId?: number | null;
}) {
  sessionStorage.setItem('username', data.username);
  sessionStorage.setItem('token', 'Bearer ' + data.token);
  sessionStorage.setItem('id', String(data.id));
  if (data.roles) sessionStorage.setItem('roles', JSON.stringify(data.roles));
  if (data.refreshToken) sessionStorage.setItem('refreshToken', data.refreshToken);
  // Stored as a string (not JSON) same as `id` — null/undefined (no fixed location, HQ/admin)
  // is represented by the key being absent rather than a literal "null" string, so getLocId()'s
  // sessionStorage.getItem() check can stay a simple null check.
  if (data.locId !== null && data.locId !== undefined) {
    sessionStorage.setItem('locId', String(data.locId));
  } else {
    sessionStorage.removeItem('locId');
  }
}

export function clearSession() {
  sessionStorage.removeItem('username');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('id');
  sessionStorage.removeItem('roles');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('locId');
}

export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('token') !== null;
}

export function getRoles(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem('roles') || '[]');
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : ['USER'];
  } catch {
    return ['USER'];
  }
}

export function getUsername(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('username') || '';
}

const ADMIN_ROLES = ['ADMIN', 'SUPER ADMIN'];

export function isAdmin(): boolean {
  return getRoles().some((r) => ADMIN_ROLES.includes(r.toUpperCase()));
}

// Home location (warehouse/hub) for the Origin/Destination shipment module. null = no fixed
// location (HQ/admin) — callers should treat that as "sees every route" (the modern equivalent
// of the legacy app's loc_id === -1 sentinel; this backend uses a nullable column instead of -1).
export function getLocId(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem('locId');
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}
