// src/components/push/PushNotificationButton.client.tsx
'use client';

import { useState } from 'react';
import { requestNotificationPermission, subscribeToPush, getPushSubscription, sendTestPushNotification, unsubscribeFromPush } from '@/lib/push/vapid.client';

export function PushNotificationButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
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
      setError(err instanceof Error ? err.message : 'Error desconocido');
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
      setError(err instanceof Error ? err.message : 'Error desconocido');
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
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
          {success}
        </div>
      )}
      <div className="flex gap-2">
        {!isSubscribed ? (
          <button
            onClick={handleSubscribe}
            disabled={isLoading}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Activando...' : '🔔 Activar notificaciones'}
          </button>
        ) : (
          <>
            <button
              onClick={handleSendTest}
              disabled={isLoading}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Enviando...' : '✉️ Enviar prueba'}
            </button>
            <button
              onClick={handleUnsubscribe}
              disabled={isLoading}
              className="px-3 py-1 text-sm bg-gray-400 text-white rounded hover:bg-gray-500 disabled:opacity-50"
            >
              Desactivar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
