// frontend/web/src/store/auth.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  userType: 'customer' | 'driver' | 'merchant' | 'admin';
  avatarUrl?: string;
  country: string;
  city: string;
  isVerified: boolean;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  updateProfile: (data: any) => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { user, token } = response.data.data;
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },

      register: async (data: any) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/register', data);
          const { user, token } = response.data.data;
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Registration failed',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      setToken: (token: string) => {
        set({ token });
      },

      updateProfile: async (data: any) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.put('/users/profile', data);
          set({ user: response.data.data, isLoading: false });
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Update failed',
            isLoading: false,
          });
          throw error;
        }
      },
    }),
    {
      name: 'movr-auth',
    }
  )
);

// frontend/web/src/store/app.store.ts
interface AppStore {
  isDrawerOpen: boolean;
  isMobileMenuOpen: boolean;
  selectedAddress: any | null;
  cartItems: any[];
  
  setDrawerOpen: (open: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;
  setSelectedAddress: (address: any) => void;
  addToCart: (item: any) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  isDrawerOpen: false,
  isMobileMenuOpen: false,
  selectedAddress: null,
  cartItems: [],

  setDrawerOpen: (open: boolean) => set({ isDrawerOpen: open }),
  setMobileMenuOpen: (open: boolean) => set({ isMobileMenuOpen: open }),
  setSelectedAddress: (address: any) => set({ selectedAddress: address }),
  
  addToCart: (item: any) =>
    set((state) => ({
      cartItems: [...state.cartItems, item],
    })),
  
  removeFromCart: (itemId: string) =>
    set((state) => ({
      cartItems: state.cartItems.filter((item) => item.id !== itemId),
    })),
  
  clearCart: () => set({ cartItems: [] }),
}));
