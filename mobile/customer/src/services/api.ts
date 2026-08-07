import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const storesApi = {
  list: (params?: Record<string, unknown>) => api.get('/stores', { params }),
  get: (id: string) => api.get(`/stores/${id}`),
  products: (id: string) => api.get(`/stores/${id}/products`),
};

export const cartApi = {
  get: (storeId?: string) => api.get('/cart', { params: { storeId } }),
  create: (storeId: string) => api.post('/cart', { storeId }),
  addItem: (data: any) => api.post('/cart/items', data),
  updateItem: (id: string, quantity: number) => api.patch(`/cart/items/${id}`, { quantity }),
  removeItem: (id: string) => api.delete(`/cart/items/${id}`),
  checkout: (data: any) => api.post('/cart/checkout', data),
};

export const ordersApi = {
  list: () => api.get('/orders'),
  get: (id: string) => api.get(`/orders/${id}`),
};

/** Movr AI — multi-domain chat, channels, rankings, live-agent escalate */
export const aiApi = {
  channels: () => api.get('/ai/channels'),
  rankings: (type: 'stores' | 'drivers' | 'riders' = 'stores', limit = 10) =>
    api.get('/ai/rankings', { params: { type, limit } }),
  chat: (body: {
    message: string;
    sessionId?: string;
    countryCode?: string;
    lat?: number;
    lng?: number;
  }) => api.post('/ai/chat', body),
  escalate: (body: {
    transcript?: Array<{ role?: string; content?: string; from?: string; text?: string }>;
    subject?: string;
    channel?: string;
    email?: string;
    name?: string;
  }) => api.post('/ai/escalate', body),
};

export default api;
