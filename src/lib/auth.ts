export function saveSession(data: {
  username: string;
  token: string;
  id: any;
  roles?: string[];
  refreshToken?: string;
}) {
  sessionStorage.setItem('username', data.username);
  sessionStorage.removeItem('logisticsAccess'); // the previous user's cached menu access
  sessionStorage.setItem('token', 'Bearer ' + data.token);
  sessionStorage.setItem('id', String(data.id));
  if (data.roles) sessionStorage.setItem('roles', JSON.stringify(data.roles));
  if (data.refreshToken) sessionStorage.setItem('refreshToken', data.refreshToken);
  sessionStorage.removeItem('locId'); // home location is no longer used (old sessions may still have it)
}

export function clearSession() {
  sessionStorage.removeItem('username');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('id');
  sessionStorage.removeItem('roles');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('locId');
  sessionStorage.removeItem('logisticsAccess');
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

