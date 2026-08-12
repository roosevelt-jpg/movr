import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function authHeaders(): Record<string, string> {
  // Expo SecureStore / AsyncStorage can replace this; keep simple for shared screens package.
  const token =
    (globalThis as any).__MOVR_TOKEN__ ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('movr_token') : null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type WalletTx = {
  id: string;
  type: string;
  amount: number;
  reference?: string;
  created_at: string;
};

type WalletState = {
  balance: number;
  rewardsBalance: number;
  currency: string;
  transactions: WalletTx[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** Stubs kept for any leftover consumers */
  dvtBalance: number;
  dvtPending: number;
  dvtOnchain: number;
  dvtHistory: any[];
  refreshDvt: () => Promise<void>;
};

const WalletContext = createContext<WalletState>({
  balance: 0,
  rewardsBalance: 0,
  currency: 'GHS',
  transactions: [],
  loading: false,
  refresh: async () => undefined,
  dvtBalance: 0,
  dvtPending: 0,
  dvtOnchain: 0,
  dvtHistory: [],
  refreshDvt: async () => undefined,
});

/**
 * Single wallet for Ride / Shop / Parcel / Rental (Phase 1).
 * Backed by GET /api/v1/wallet — not per-module wallets.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState(0);
  const [rewardsBalance, setRewardsBalance] = useState(0);
  const [currency, setCurrency] = useState('GHS');
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/wallet`, { headers: authHeaders() });
      const j = await res.json();
      if (j?.data) {
        setBalance(Number(j.data.balance || 0));
        setRewardsBalance(Number(j.data.rewardsBalance ?? j.data.points_balance ?? 0));
        setCurrency(String(j.data.currency || 'GHS'));
        setTransactions(Array.isArray(j.data.transactions) ? j.data.transactions : []);
      }
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshDvt = useCallback(async () => undefined, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <WalletContext.Provider
      value={{
        balance,
        rewardsBalance,
        currency,
        transactions,
        loading,
        refresh,
        dvtBalance: 0,
        dvtPending: 0,
        dvtOnchain: 0,
        dvtHistory: [],
        refreshDvt,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
