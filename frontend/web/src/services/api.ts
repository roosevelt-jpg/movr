// frontend/web/src/services/api.ts
import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { useAuthStore } from '../store/auth.store';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add token to headers
api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors and token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const { logout } = useAuthStore.getState();

    if (error.response?.status === 401) {
      // Token expired or invalid
      logout();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

// ============================================
// RIDES API
// ============================================

export const ridesApi = {
  requestRide: (data: any) => api.post('/rides/request', data),
  getRideDetails: (rideId: string) => api.get(`/rides/${rideId}`),
  getRideHistory: (limit = 10, offset = 0) =>
    api.get('/rides', { params: { limit, offset } }),
  cancelRide: (rideId: string) => api.put(`/rides/${rideId}/cancel`),
  rateRide: (rideId: string, data: { rating: number; review?: string; tags?: string[] } | number, review?: string) =>
    typeof data === 'number'
      ? api.post(`/rides/${rideId}/rate`, { rating: data, review })
      : api.post(`/rides/${rideId}/rate`, data),
  addTip: (rideId: string, amount: number) =>
    api.post(`/rides/${rideId}/tip`, { amount }),
};

// ============================================
// PAYMENTS API
// ============================================

export const paymentsApi = {
  initializePayment: (data: any) => api.post('/payments/initialize', data),
  verifyPayment: (txRef: string) => api.post('/payments/verify', { txRef }),
  getPaymentHistory: (limit = 10) =>
    api.get('/payments/history', { params: { limit } }),
};

// ============================================
// MARKETPLACE API
// ============================================

export const marketplaceApi = {
  getStores: (filters?: any) => api.get('/stores', { params: filters }),
  getStoreDetails: (storeId: string) => api.get(`/stores/${storeId}`),
  getStoreProducts: (storeId: string) =>
    api.get(`/stores/${storeId}/products`),
  createOrder: (data: any) => api.post('/cart/checkout', data),
  getOrder: (orderId: string) => api.get(`/orders/${orderId}`),
  getOrders: () => api.get('/orders'),
  cancelOrder: (orderId: string) => api.patch(`/orders/${orderId}/status`, { status: 'cancelled' }),
};

export const cartApi = {
  get: (storeId?: string) => api.get('/cart', { params: { storeId } }),
  create: (storeId: string) => api.post('/cart', { storeId }),
  addItem: (data: any) => api.post('/cart/items', data),
  updateItem: (id: string, quantity: number) =>
    api.patch(`/cart/items/${id}`, { quantity }),
  removeItem: (id: string) => api.delete(`/cart/items/${id}`),
  checkout: (data: any) => api.post('/cart/checkout', data),
};

// ============================================
// WALLET API
// ============================================

export const walletApi = {
  get: () => api.get('/wallet'),
  getBalance: () => api.get('/wallet'),
  getTransactions: (limit = 10) =>
    api.get('/wallet', { params: { limit } }),
  getAddresses: () => api.get('/wallet/addresses'),
  saveAddress: (data: { label: string; address: string; lat: number; lng: number }) =>
    api.post('/wallet/addresses', data),
  addFunds: (amount: number, method: string) =>
    api.post('/payments/initialize', {
      amount,
      paymentType: 'wallet',
      method,
    }),
  requestWithdrawal: (amount: number, accountDetails: any) =>
    api.post('/wallet/withdrawal', { amount, accountDetails }),
};

// ============================================
// SUBSCRIPTIONS API
// ============================================

export const subscriptionsApi = {
  getPlans: () => api.get('/subscriptions/plans'),
  getActive: () => api.get('/subscriptions/active'),
  activate: (planId: string) => api.post('/subscriptions/activate', { planId }),
  cancel: () => api.put('/subscriptions/cancel'),
};

// ============================================
// REWARDS API
// ============================================

export const rewardsApi = {
  getBreakdown: () => api.get('/rewards/breakdown'),
  getLeaderboard: () => api.get('/rewards/leaderboard'),
  redeem: (amount: number) => api.post('/rewards/redeem', { amount }),
};

// ============================================
// USERS API
// ============================================

export const usersApi = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (data: any) => api.put('/users/profile', data),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ============================================
// BLOCKCHAIN API
// ============================================

export const blockchainApi = {
  getTokenBalance: () => api.get('/blockchain/token/balance'),
  claimTokens: (walletAddress: string) =>
    api.post('/blockchain/token/claim', { walletAddress }),
  redeemTokens: (amount: number) =>
    api.post('/blockchain/token/redeem', { amount }),
};

export default api;
