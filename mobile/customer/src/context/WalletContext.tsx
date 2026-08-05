import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type WalletState = {
  dvtBalance: number;
  dvtPending: number;
  dvtOnchain: number;
  dvtHistory: any[];
  refreshDvt: () => Promise<void>;
};

const WalletContext = createContext<WalletState>({
  dvtBalance: 0,
  dvtPending: 0,
  dvtOnchain: 0,
  dvtHistory: [],
  refreshDvt: async () => undefined,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [dvtBalance, setDvtBalance] = useState(0);
  const [dvtPending, setDvtPending] = useState(0);
  const [dvtOnchain, setDvtOnchain] = useState(0);
  const [dvtHistory, setDvtHistory] = useState<any[]>([]);

  const refreshDvt = async () => {
    try {
      const [b, h] = await Promise.all([
        fetch(`${API}/token/balance`).then((r) => r.json()),
        fetch(`${API}/token/history`).then((r) => r.json()),
      ]);
      if (b?.data) {
        setDvtBalance(Number(b.data.total || 0));
        setDvtPending(Number(b.data.pending || 0));
        setDvtOnchain(Number(b.data.onchain || 0));
      }
      if (h?.data) setDvtHistory(h.data);
    } catch {
      /* offline */
    }
  };

  useEffect(() => {
    refreshDvt();
  }, []);

  return (
    <WalletContext.Provider
      value={{ dvtBalance, dvtPending, dvtOnchain, dvtHistory, refreshDvt }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
