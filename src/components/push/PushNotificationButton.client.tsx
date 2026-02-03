// src/components/push/PushNotificationButton.client.tsx
'use client';

import { useState } from 'react';
import { captureException, captureMessage } from '@/lib/sentry';
import { requestNotificationPermission, subscribeToPush, getPushSubscription, unsubscribeFromPush, getVapidPublicKey } from '@/lib/push/vapid.client';

export function PushNotificationButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const logClientError = (err: unknown, context: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[PushNotificationButton]', err, context);
      return;
    }
    captureException(err, context);
  };

  const logClientMessage = (message: string, context: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[PushNotificationButton]', message, context);
      return;
    }
    captureMessage(message, context);
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!getVapidPublicKey()) {
        setError('Notificaciones no disponibles (configuración pendiente).');
        logClientMessage('Missing VAPID public key', {
          feature: 'push',
          action: 'subscribe',
          reason: 'missing_vapid_public_key',
        });
        return;
      }

      // Request notification permission
      const permission = await requestNotificationPermission();

      if (permission !== 'granted') {
        setError('Permiso de notificaciones denegado');
        setIsLoading(false);
        return;
      }

      // Subscribe to push
      const subscription = await subscribeToPush();

      // Send to server
      const session = localStorage.getItem('supabase.auth.token');
      if (!session) {
        setError('No estás autenticado');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session}`,
        },
        body: JSON.stringify({
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.getKey('p256dh')
                ? btoa(
                    String.fromCharCode.apply(
                      null,
                      Array.from(new Uint8Array(subscription.getKey('p256dh')!))
                    )
                  )
                : '',
              auth: subscription.getKey('auth')
                ? btoa(
                    String.fromCharCode.apply(
                      null,
                      Array.from(new Uint8Array(subscription.getKey('auth')!))
                    )
                  )
                : '',
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription');
      }

      setIsSubscribed(true);
      setSuccess('✅ Notificaciones habilitadas');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError('No se pudo activar notificaciones. Intenta de nuevo.');
      logClientError(err, {
        feature: 'push',
        action: 'subscribe',
        message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTest = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const subscription = await getPushSubscription();
      if (!subscription) {
        setError('No hay subscripción activa');
        setIsLoading(false);
        return;
      }

      // Get subscription ID from server
      const session = localStorage.getItem('supabase.auth.token');
      if (!session) {
        setError('No estás autenticado');
        setIsLoading(false);
        return;
      }

      // Fetch subscription ID (would need to store it during subscribe)
      // For now, use a placeholder approach
      const subscriptionsResponse = await fetch('/api/push/subscriptions', {
        headers: {
          Authorization: `Bearer ${session}`,
        },
      });

      if (!subscriptionsResponse.ok) {
        setError('Failed to fetch subscription ID');
        setIsLoading(false);
        return;
      }

      const subscriptionsData = await subscriptionsResponse.json();
      if (!subscriptionsData.subscriptions || subscriptionsData.subscriptions.length === 0) {
        setError('No subscriptions found');
        setIsLoading(false);
        return;
      }

      const subscriptionId = subscriptionsData.subscriptions[0].id;

      // Send test
      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session}`,
        },
        body: JSON.stringify({ subscriptionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }

      setSuccess('✅ Notificación de prueba enviada');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError('No se pudo enviar la notificación de prueba.');
      logClientError(err, {
        feature: 'push',
        action: 'test',
        message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const subscription = await unsubscribeFromPush();
      if (!subscription) {
        setError('No hay subscripción activa');
        setIsLoading(false);
        return;
      }

      setIsSubscribed(false);
      setSuccess('Notificaciones deshabilitadas');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError('No se pudo desactivar notificaciones.');
      logClientError(err, {
        feature: 'push',
        action: 'unsubscribe',
        message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="text-sm text-red-200 bg-red-950/60 p-2 rounded-2xl border border-red-700/60">
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm text-green-200 bg-green-950/60 p-2 rounded-2xl border border-green-700/60">
          {success}
        </div>
      )}
      <div className="flex gap-2">
        {!isSubscribed ? (
          <button
            onClick={handleSubscribe}
            disabled={isLoading}
            className="px-3 py-1 text-sm bg-blue-600 text-slate-950 rounded-full hover:bg-blue-700 disabled:opacity-50 shadow-[0_10px_22px_rgba(2,4,10,0.35)]"
          >
            {isLoading ? 'Activando...' : '🔔 Activar notificaciones'}
          </button>
        ) : (
          <>
            <button
              onClick={handleSendTest}
              disabled={isLoading}
              className="px-3 py-1 text-sm bg-green-600 text-slate-50 rounded-full hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Enviando...' : '✉️ Enviar prueba'}
            </button>
            <button
              onClick={handleUnsubscribe}
              disabled={isLoading}
              className="px-3 py-1 text-sm bg-slate-800/80 text-slate-200 rounded-full hover:bg-slate-800 disabled:opacity-50"
            >
              Desactivar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
