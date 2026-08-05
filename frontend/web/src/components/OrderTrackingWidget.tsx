import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL =
  (typeof window !== 'undefined' && (window as any).__MOVR_SOCKET__) ||
  process.env.REACT_APP_SOCKET_URL ||
  'http://127.0.0.1:3000';

/** Live courier marker for marketplace deliveries (Phase 4). */
export default function OrderTrackingWidget({
  orderId,
  room,
  deliveryMode,
  courierId,
}: {
  orderId: string;
  room?: string;
  deliveryMode?: string | null;
  courierId?: string | null;
}) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    if (!orderId || deliveryMode === 'merchant_own') return;
    let socket: Socket | null = null;
    try {
      socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
      socket.emit('delivery:join', orderId);
      socket.on('delivery:location', (data: any) => {
        if (String(data?.orderId) !== String(orderId)) return;
        if (data.lat != null && data.lng != null) {
          setPos({ lat: Number(data.lat), lng: Number(data.lng) });
        }
        if (data.status) setStatus(String(data.status));
      });
    } catch {
      /* offline */
    }
    return () => {
      socket?.off('delivery:location');
      socket?.disconnect();
    };
  }, [orderId, deliveryMode]);

  const x = pos ? Math.min(90, Math.max(10, ((pos.lng + 0.2) / 0.1) * 50 + 25)) : 50;
  const y = pos ? Math.min(90, Math.max(10, ((5.65 - pos.lat) / 0.1) * 50 + 25)) : 50;

  return (
    <div className="rounded-2xl bg-surface-elevated border border-border p-4">
      <h2 className="font-semibold mb-2">Live tracking · {room || `delivery:${orderId}`}</h2>
      <p className="text-text-secondary text-sm mb-3">
        Mode: {deliveryMode || 'unset'} · Courier: {courierId || 'assigning…'}
        {status ? ` · ${status}` : ''}
      </p>
      <div className="relative h-48 rounded-xl bg-surface border border-border overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div
          className="absolute w-3 h-3 rounded-full bg-motion-blue shadow-active-glow"
          style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
          title={pos ? `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}` : 'Waiting for location'}
        />
        {!pos ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-text-secondary">
            Waiting for courier GPS…
          </p>
        ) : null}
      </div>
    </div>
  );
}
