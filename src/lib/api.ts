import axios from 'axios';
import type { OrginFilter } from './types';

// Same-origin /api on spaceageconnect.com routes to the same Logistics-backend the CKD app
// already uses (nginx's /api location isn't scoped per Referer path except for the legacy
// /jockeydeployment app — see deploy/nginx-logistics.conf) — this app is a separate frontend
// deployment, but it talks to the exact same, already-deployed backend, not a new one.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('token') || '';
}

function getUserId(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('id') || '';
}

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = getToken();
  const id = getUserId();
  if (token) config.headers['Authorization'] = token;
  if (id) config.headers['id'] = id;
  return config;
});

// ─── Auth ──────────────────────────────────────────────────────────────────
export const authenticate = (username: string, password: string) =>
  api.post('/authenticate', { username, password });

// ─── Orgin (Shipments) ───────────────────────────────────────────────────────
export const getOrginList = (payload: OrginFilter) => api.post('/getOrgin', payload);
export const createOrgin = (formData: FormData) =>
  api.post('/createOrgin', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteOrgin = (payload: any) => api.post('/deleteOrgin', payload);
export const getOrginCustomer = () => api.get('/getOrginCustomer');
export const getVehicletype = () => api.get('/getVehicletype');
export const getLocationList = () => api.get('/getLocation');
export const getOrginImages = (shipmentNo: string, flag: 'ORGIN' | 'DEST') =>
  api.get(`/getImage/${shipmentNo}/${flag}`);
export const getTransporterName = () => api.get('/transporterName');
export const dupCheck = (shipNo: any) => api.get(`/dupCheck/${shipNo}`);

// ─── Dashboard / Report ──────────────────────────────────────────────────────
export const getShipmentGraphInfo = (payload: OrginFilter) => api.post('/shipmentGraphInfo', payload);
export const downloadLogReport = (filter: OrginFilter) =>
  api.get('/logDownload', {
    headers: { filter: JSON.stringify(filter) },
    responseType: 'blob',
  });

export default api;
