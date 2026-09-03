'use client';

import { useEffect, useState } from 'react';
import { Bell, BellRing, Loader2 } from 'lucide-react';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function EnablePushButton({ className = '' }: { className?: string }) {
  const [state, setState] = useState<'checking' | 'unsupported' | 'off' | 'on' | 'busy'>('checking');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setState('unsupported');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? 'on' : 'off');
      } catch {
        setState('off');
      }
    })();
  }, []);

  const enable = async () => {
    setErr('');
    setState('busy');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setErr('Notifications were blocked in the browser.'); setState('off'); return; }
      const keyRes = await fetch('/api/push/key');
      if (!keyRes.ok) { setErr('Push is not available yet.'); setState('off'); return; }
      const { key } = await keyRes.json();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as unknown as BufferSource,
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error('subscribe failed');
      setState('on');
    } catch {
      setErr('Could not enable notifications.');
      setState('off');
    }
  };

  const disable = async () => {
    setState('busy');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setState('off');
    } catch {
      setState('on');
    }
  };

  if (state === 'unsupported' || state === 'checking') return null;

  if (state === 'on') {
    return (
      <button onClick={disable} title="Phone alerts are on — click to turn off" className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 ${className}`}>
        <BellRing size={15} /> Phone alerts on
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button onClick={enable} disabled={state === 'busy'} className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 ${className}`}>
        {state === 'busy' ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />} Enable phone alerts
      </button>
      {err && <span className="text-[11px] text-rose-500">{err}</span>}
    </span>
  );
}
