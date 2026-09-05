import { APIRequestContext, request as playwrightRequest } from '@playwright/test';
import { loadTestEnv } from './env';

/** Shape returned by POST /authenticate (see src/app/login/page.tsx + src/lib/auth.ts). */
export interface AuthResult {
  username: string;
  token: string;
  id: string | number;
  roles?: string[];
  refreshToken?: string;
  locId?: number | null;
}

export interface ShipmentRow {
  id?: number;
  shipment_no?: string;
  customer?: string;
  shipment_route_from?: string;
  shipment_route_to?: string;
  transporter_name?: string;
  vehicle_no?: string;
  curr_status?: string;
  org_status?: string;
  flag?: string;
  [k: string]: unknown;
}

export interface ShipmentFilter {
  fromDate?: string;
  toDate?: string;
  loc_id?: string;
  flag?: 'O' | 'D';
  status?: string[];
  received_fromDate?: string;
  received_toDate?: string;
  transName?: string[];
}

const env = loadTestEnv();

/** Bare API context pointed at the backend (no auth). */
export async function newApiContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: env.apiUrl, ignoreHTTPSErrors: true });
}

/** The header set the frontend's axios interceptor attaches to every authed call. */
export function authHeaders(auth: AuthResult): Record<string, string> {
  return {
    Authorization: auth.token.startsWith('Bearer ') ? auth.token : `Bearer ${auth.token}`,
    id: String(auth.id),
  };
}

export async function authenticate(
  ctx: APIRequestContext,
  creds: { username: string; password: string },
): Promise<AuthResult> {
  const res = await ctx.post('/authenticate', { data: creds });
  if (!res.ok()) {
    throw new Error(`POST /authenticate -> ${res.status()} ${res.statusText()}: ${await res.text()}`);
  }
  const body = await res.json();
  if (!body?.token) throw new Error(`/authenticate ok but no token in response: ${JSON.stringify(body)}`);
  return { username: creds.username, ...body };
}

export async function listShipments(
  ctx: APIRequestContext,
  auth: AuthResult,
  filter: ShipmentFilter,
): Promise<ShipmentRow[]> {
  const res = await ctx.post('/getOrgin', { headers: authHeaders(auth), data: filter });
  if (!res.ok()) throw new Error(`POST /getOrgin -> ${res.status()}: ${await res.text()}`);
  const body = await res.json();
  return Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
}

const wideRange: Pick<ShipmentFilter, 'fromDate' | 'toDate'> = {
  fromDate: '2000-01-01',
  toDate: '2999-12-31',
};

export async function findShipmentByNo(
  ctx: APIRequestContext,
  auth: AuthResult,
  shipmentNo: string,
  flag: 'O' | 'D' = 'O',
): Promise<ShipmentRow | undefined> {
  const rows = await listShipments(ctx, auth, {
    loc_id: auth.locId != null ? String(auth.locId) : '',
    flag,
    status: [],
    ...wideRange,
  });
  return rows.find((r) => r.shipment_no === shipmentNo);
}

/** Soft-deletes a shipment by number (mirrors the Shipments page's delete action). */
export async function deleteShipmentByNo(
  ctx: APIRequestContext,
  auth: AuthResult,
  shipmentNo: string,
): Promise<'deleted' | 'not-found'> {
  const row = await findShipmentByNo(ctx, auth, shipmentNo, 'O');
  if (!row) return 'not-found';
  const res = await ctx.post('/deleteOrgin', {
    headers: authHeaders(auth),
    data: { ...row, deleteFlag: true },
  });
  if (!res.ok()) throw new Error(`POST /deleteOrgin -> ${res.status()}: ${await res.text()}`);
  return 'deleted';
}

export async function dupCheck(
  ctx: APIRequestContext,
  auth: AuthResult,
  shipmentNo: string,
): Promise<boolean> {
  const res = await ctx.get(`/dupCheck/${encodeURIComponent(shipmentNo)}`, { headers: authHeaders(auth) });
  if (!res.ok()) throw new Error(`GET /dupCheck -> ${res.status()}: ${await res.text()}`);
  const body = await res.json().catch(() => ({}));
  return body?.message === 'true' || body?.message === true;
}

/**
 * Creates a shipment straight through the API the same way the Shipments modal does
 * (multipart form, `org` = JSON string). Returns the shipment_no used.
 * Only for test setup — always pair with deleteShipmentByNo in cleanup.
 */
export async function apiCreateShipment(
  ctx: APIRequestContext,
  auth: AuthResult,
  overrides: Record<string, unknown> = {},
): Promise<{ shipmentNo: string; payload: Record<string, unknown> }> {
  const { customers, vehicleTypes, locations } = await getDropdowns(ctx, auth);
  const nonHub = (locations as { id: number; name: string }[]).filter((l) => l.name !== 'Logistics');
  const from = auth.locId != null ? nonHub.find((l) => l.id === auth.locId) ?? nonHub[0] : nonHub[0];
  const to = nonHub.find((l) => l.id !== from?.id) ?? nonHub[1] ?? nonHub[0];
  if (!customers[0] || !from || !to) {
    throw new Error('Cannot build a test shipment — backend has no customers or <2 locations.');
  }
  const shipmentNo = `${loadTestEnv().testPrefix}${Date.now()}`;
  const payload: Record<string, unknown> = {
    shipment_no: shipmentNo,
    customer_id: String(customers[0].id),
    shipment_route_from_id: String(from.id),
    shipment_route_to_id: String(to.id),
    vehicle_type: vehicleTypes[0] ? String(vehicleTypes[0].id) : '',
    vehicle_no: 'E2E-VEH-01',
    lr_no: 'E2E-LR-01',
    lr_date: new Date().toISOString().slice(0, 10),
    transporter_name: 'E2E Transport Co',
    transit_days: '2',
    fast_mode: 'N',
    isfastflag: false,
    odc: 'N',
    flag: 'O',
    ...overrides,
  };
  const res = await ctx.post('/createOrgin', {
    headers: authHeaders(auth),
    multipart: { org: JSON.stringify(payload) },
  });
  if (!res.ok()) throw new Error(`POST /createOrgin -> ${res.status()}: ${await res.text()}`);
  return { shipmentNo, payload };
}

export async function getDropdowns(ctx: APIRequestContext, auth: AuthResult) {
  const h = { headers: authHeaders(auth) };
  const [cu, vt, loc] = await Promise.all([
    ctx.get('/getOrginCustomer', h),
    ctx.get('/getVehicletype', h),
    ctx.get('/getLocation', h),
  ]);
  const arr = async (r: import('@playwright/test').APIResponse) => {
    if (!r.ok()) return [];
    const b = await r.json().catch(() => []);
    return Array.isArray(b) ? b : Array.isArray(b?.data) ? b.data : [];
  };
  return { customers: await arr(cu), vehicleTypes: await arr(vt), locations: await arr(loc) };
}
