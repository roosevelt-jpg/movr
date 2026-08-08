import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/** Legacy scripted bot — redirect to canonical Movr AI. */
export default function MovrBotPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/ai', { replace: true });
  }, [navigate]);
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-zinc-400 text-sm">
      Redirecting to Movr AI…
    </div>
  );
}
