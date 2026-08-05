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

export default api;
