import axios from 'axios';
import type { OrginFilter, ReportFilter, Transporter } from './types';

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
export const getOrginByShipmentNo = (shipmentNo: string) => api.get(`/getDestination/${shipmentNo}`);
export const getOdcLotsByShipmentNo = (shipmentNo: string) => api.get(`/getOdcLots/${shipmentNo}`);
export const getAssetMappingsByShipmentNo = (shipmentNo: string) => api.get(`/getAssetMappings/${shipmentNo}`);
export const createOrgin = (formData: FormData) =>
  api.post('/createOrgin', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteOrgin = (payload: any) => api.post('/deleteOrgin', payload);
export const getOrginCustomer = () => api.get('/getOrginCustomer');
export const getVehicletype = () => api.get('/getVehicletype');
export const getLocationList = () => api.get('/getLocation');
export const getOrginImages = (shipmentNo: string, flag: 'ORGIN' | 'DEST') =>
  api.get(`/getImage/${shipmentNo}/${flag}`);
export const deleteOrginImage = (id: number) => api.get(`/deleteImage/${id}`);
export const getTransporterName = () => api.get('/transporterName');
export const dupCheck = (shipNo: any) => api.get(`/dupCheck/${shipNo}`);

// ─── Transporter Master ──────────────────────────────────────────────────────
export const getTransporterMasterList = (payload: { offset: number; limit: number; search?: string }) =>
  api.post('/transporterMaster/list', payload);
export const createTransporter = (payload: Transporter) => api.post('/transporterMaster', payload);
export const updateTransporter = (payload: Transporter) => api.put('/transporterMaster', payload);
export const deleteTransporter = (id: number) => api.delete(`/transporterMaster/${id}`);

// ─── Billing Details ──────────────────────────────────────────────────────────
export const getBillingDetailsList = (payload: { offset: number; limit: number; search?: string }) =>
  api.post('/billingDetails/list', payload);
export const getEligibleShipmentsForBilling = (search: string) =>
  api.get('/billingDetails/eligibleShipments', { params: { search } });
export const createBillingDetails = (formData: FormData) =>
  api.post('/billingDetails', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateBillingDetails = (formData: FormData) =>
  api.put('/billingDetails', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// ─── Dashboard / Report ──────────────────────────────────────────────────────
export const getShipmentGraphInfo = (payload: OrginFilter) => api.post('/shipmentGraphInfo', payload);
// Reports menu (Shipment / ODC / SOF / Asset) — see Logistics-backend ReportsController.
export const downloadShipmentReport = (filter: ReportFilter, format: 'xlsx' | 'pdf') =>
  api.post('/reports/shipment', filter, { params: { format }, responseType: 'blob' });
export const downloadOdcReport = (filter: ReportFilter) =>
  api.post('/reports/odc', filter, { responseType: 'blob' });
export const downloadSofReport = (shipmentNo: string) =>
  api.get(`/reports/sof/${encodeURIComponent(shipmentNo)}`, { responseType: 'blob' });
export const getAssetReport = (q: string) => api.get('/reports/asset', { params: { q } });
export const searchShipmentNumbers = (q: string, limit = 20) =>
  api.get('/reports/shipmentNumbers', { params: { q, limit } });
export const downloadLogReport = (filter: OrginFilter) =>
  api.get('/logDownload', {
    headers: { filter: JSON.stringify(filter) },
    responseType: 'blob',
  });

export default api;
