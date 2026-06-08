"use client";

import { useEffect, useState } from "react";
import { captureException, captureMessage } from "@/lib/sentry";
import { createClient } from "@/lib/supabase/browser";
import { logError as logErrorCentral, logInfo as logInfoCentral } from "@/lib/log";
import {
  getPushSubscription,
  getVapidPublicKey,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/vapid.client";

type ApiError = {
  error?: string;
  details?: string | Record<string, string>;
};

const toBase64Key = (key: ArrayBuffer | null): string => {
  if (!key) return "";
  return btoa(String.fromCharCode(...new Uint8Array(key)));
};

const parseApiError = async (response: Response): Promise<string> => {
  try {
    const json = (await response.json()) as ApiError;
    if (json.details && typeof json.details === "object") {
      const details = Object.entries(json.details)
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ");
      return json.error ? `${json.error}. ${details}` : details;
    }
    if (typeof json.details === "string" && json.details.trim()) {
      return json.error ? `${json.error}. ${json.details}` : json.details;
    }
    if (json.error) return json.error;
  } catch {
    // ignore json parse failure
  }
  return `Request failed (${response.status})`;
};

export function PushNotificationButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const subscription = await getPushSubscription();
        if (mounted) setIsSubscribed(Boolean(subscription));
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const logClientError = (err: unknown, context: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") {
      logErrorCentral("PushNotificationButton", { component: "push.notificationButton.client", message: err instanceof Error ? err.message : String(err), payload: context });
      return;
    }
    captureException(err, context);
  };

  const logClientMessage = (message: string, context: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") {
      logInfoCentral("PushNotificationButton", message, { component: "push.notificationButton.client", payload: context });
      return;
    }
    captureMessage(message, context);
  };

  const getAuthHeaders = async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Always try browser permission first.
      const permission = await requestNotificationPermission();
      if (permission !== "granted") {
        setError("Permiso de notificaciones denegado.");
        return;
      }

      if (!getVapidPublicKey()) {
        setSuccess("Permiso concedido. Falta configurar VAPID para completar suscripcion.");
        logClientMessage("Missing VAPID public key", {
          feature: "push",
          action: "subscribe",
          reason: "missing_vapid_public_key",
        });
        return;
      }

      const subscription = await subscribeToPush();
      const authHeaders = await getAuthHeaders();

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: toBase64Key(subscription.getKey("p256dh")),
              auth: toBase64Key(subscription.getKey("auth")),
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setIsSubscribed(true);
      setSuccess("Notificaciones habilitadas.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(`No se pudo activar notificaciones: ${message}`);
      logClientError(err, {
        feature: "push",
        action: "subscribe",
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
        setError("No hay suscripcion activa.");
        return;
      }

      const authHeaders = await getAuthHeaders();

      const subscriptionsResponse = await fetch("/api/push/subscriptions", {
        credentials: "include",
        headers: authHeaders,
      });

      if (!subscriptionsResponse.ok) {
        throw new Error(await parseApiError(subscriptionsResponse));
      }

      const subscriptionsData = (await subscriptionsResponse.json()) as {
        subscriptions?: Array<{ id: string }>;
      };
      const subscriptionId = subscriptionsData.subscriptions?.[0]?.id;

      if (!subscriptionId) {
        setError("No se encontro subscripcion guardada.");
        return;
      }

      const response = await fetch("/api/push/test", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ subscriptionId }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      setSuccess("Notificacion de prueba enviada.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(`No se pudo enviar la notificacion de prueba: ${message}`);
      logClientError(err, {
        feature: "push",
        action: "test",
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
      const subscription = await getPushSubscription();
      if (!subscription) {
        setError("No hay suscripcion activa.");
        return;
      }

      const authHeaders = await getAuthHeaders();
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      const unsubscribed = await unsubscribeFromPush();
      if (!unsubscribed) {
        setError("No se pudo desactivar la suscripcion local.");
        return;
      }

      setIsSubscribed(false);
      setSuccess("Notificaciones deshabilitadas.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(`No se pudo desactivar notificaciones: ${message}`);
      logClientError(err, {
        feature: "push",
        action: "unsubscribe",
        message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="rounded-2xl border border-red-700/60 bg-red-950/60 p-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-green-700/60 bg-green-950/60 p-2 text-sm text-green-200">
          {success}
        </div>
      )}
      <div className="flex gap-2">
        {!isSubscribed ? (
          <button
            onClick={handleSubscribe}
            disabled={isLoading}
            className="rounded-full bg-blue-600 px-3 py-1 text-sm text-slate-950 shadow-[0_10px_22px_rgba(2,4,10,0.35)] hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Activando..." : "🔔 Activar notificaciones"}
          </button>
        ) : (
          <>
            <button
              onClick={handleSendTest}
              disabled={isLoading}
              className="rounded-full bg-green-600 px-3 py-1 text-sm text-slate-50 hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? "Enviando..." : "✉️ Enviar prueba"}
            </button>
            <button
              onClick={handleUnsubscribe}
              disabled={isLoading}
              className="rounded-full bg-slate-800/80 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              Desactivar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
