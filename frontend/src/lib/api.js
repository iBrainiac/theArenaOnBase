// In dev, Vite proxies /api → localhost:3001 so VITE_BACKEND_URL is empty.
// In production, set VITE_BACKEND_URL to your Railway backend URL.
export const API_BASE = import.meta.env.VITE_BACKEND_URL || ''
