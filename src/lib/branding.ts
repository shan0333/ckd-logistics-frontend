// SPACEAGE CONNECT logo / tab icon. Stored in S3 (branding/), served by the backend's public
// BrandingController (/api/public/branding/*) because the bucket is private. Replacing the file in
// S3 changes it everywhere - no frontend deploy needed.
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const LOGO_URL = `${API}/public/branding/logo`;
export const ICON_URL = `${API}/public/branding/icon`;
