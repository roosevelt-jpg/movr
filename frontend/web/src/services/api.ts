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
  rateRide: (rideId: string, rating: number, review?: string) =>
    api.post(`/rides/${rideId}/rate`, { rating, review }),
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
  getStores: (filters?: any) => api.get('/marketplace/stores', { params: filters }),
  getStoreDetails: (storeId: string) => api.get(`/marketplace/stores/${storeId}`),
  getStoreProducts: (storeId: string) =>
    api.get(`/marketplace/stores/${storeId}/products`),
  createOrder: (data: any) => api.post('/marketplace/orders', data),
  getOrder: (orderId: string) => api.get(`/marketplace/orders/${orderId}`),
  getOrders: () => api.get('/marketplace/orders'),
  cancelOrder: (orderId: string) => api.put(`/marketplace/orders/${orderId}/cancel`),
};

// ============================================
// WALLET API
// ============================================

export const walletApi = {
  getBalance: () => api.get('/wallet/balance'),
  getTransactions: (limit = 10) =>
    api.get('/wallet/transactions', { params: { limit } }),
  addFunds: (amount: number, method: string) =>
    api.post('/wallet/add-funds', { amount, method }),
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
