// src/app/dashboard/logs/pwa/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { logWarn } from "@/lib/log";
import { getPushSubscription, requestNotificationPermission, subscribeToPush, getVapidPublicKey } from "@/lib/push/vapid.client";

export default function PWADiagnosticsPage() {
  const [swReady, setSwReady] = useState<boolean>(false);
  const [swController, setSwController] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const init = async () => {
      try {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
        const reg = await navigator.serviceWorker.ready.catch(() => null);
        setSwReady(!!reg);
        setSwController(!!navigator.serviceWorker.controller);
        setPermission(Notification?.permission ?? "default");
        const sub = await getPushSubscription();
        setSubscription(sub);
      } catch (err) {
        logWarn("PWADiagnostics", "init error", { component: "dashboard.logs.pwa.init", error: err instanceof Error ? err.message : String(err) });
      }
    };
    init();
  }, []);

  async function handleRequestPermission() {
    try {
      const p = await requestNotificationPermission();
      setPermission(p);
      setMessage(`Permission: ${p}`);
    } catch (err) {
      setMessage("Failed to request permission");
    }
  }

  async function handleSubscribe() {
    try {
      setLoading(true);
      const requestedPermission = await requestNotificationPermission();
      setPermission(requestedPermission);

      if (requestedPermission !== "granted") {
        setMessage("Permiso de notificaciones denegado.");
        return;
      }

      if (!getVapidPublicKey()) {
        setMessage("Permiso concedido. Falta configuracion VAPID para suscribirse.");
        return;
      }
      const sub = await subscribeToPush();
      setSubscription(sub);
      setMessage("Suscripcion local completada.");
    } catch (err) {
      setMessage("No se pudo suscribir. Revisa configuracion de push.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTestPush() {
    try {
      setLoading(true);
      // Attempt to call existing test endpoint if subscription stored server-side
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage("Not authenticated for test push.");
        return;
      }
      // Fetch latest subscription id for user
      const { data: subs, error } = await supabase
        .from('push_subscriptions')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error || !subs || subs.length === 0) {
        setMessage("No stored subscription found. Save subscription via your API.");
        return;
      }
      const subId = subs[0].id as string;
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ subscriptionId: subId }),
      });
      if (res.ok) {
        setMessage("Test push sent.");
      } else {
        setMessage("Test push endpoint not implemented or failed.");
      }
    } catch (err) {
      setMessage("Test push failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-white text-xl font-semibold">PWA Diagnostics</h1>
      <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Service Worker Registered</span>
          <span className={swReady ? 'text-green-400' : 'text-slate-400'}>{swReady ? 'Yes' : 'No'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Service Worker Active</span>
          <span className={swController ? 'text-green-400' : 'text-slate-400'}>{swController ? 'Yes' : 'No'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Notification Permission</span>
          <span className="text-sky-400">{permission}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Push Subscription</span>
          <span className={subscription ? 'text-green-400' : 'text-slate-400'}>{subscription ? 'Exists' : 'None'}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleRequestPermission} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-white text-sm">Activar notificaciones</button>
        <button onClick={handleSubscribe} disabled={permission !== 'granted' || loading} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900/40 border border-slate-700 rounded text-white text-sm">Suscribirse</button>
        <button onClick={handleTestPush} disabled={loading} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-white text-sm">Test Push</button>
      </div>

      {message && (
        <div className="text-slate-300 text-sm">{message}</div>
      )}
    </div>
  );
}
