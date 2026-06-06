"use client";

import { useEffect } from "react";
import { isPublicFeatureEnabled } from "@/lib/runtime/featureFlags";

import { logWarn, logInfo } from "@/lib/log";
export default function ServiceWorkerRegister() {
  useEffect(() => {
    // Only register SW in production or when explicitly enabled
    const enableSW = isPublicFeatureEnabled("enableServiceWorkerInDev");
    const isProduction = process.env.NODE_ENV === "production";

    if (!enableSW && !isProduction) {
      logInfo("ServiceWorkerRegister", "Registration disabled in dev. Set NEXT_PUBLIC_ENABLE_SW=true to enable", { component: "serviceworkerregister" });
      return;
    }

    if (!("serviceWorker" in navigator)) {
      logWarn("ServiceWorkerRegister", "Service Worker not supported", { component: "serviceworkerregister.unsupported" });
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        logInfo("ServiceWorkerRegister", "Registered successfully", { component: "serviceworkerregister" });
        intervalId = setInterval(() => {
          reg.update();
        }, 60000);
      })
      .catch((err) => {
        logWarn("ServiceWorkerRegister", "[SW] Registration failed", { component: "serviceworkerregister", error: err instanceof Error ? err.message : String(err) });
      });

    return () => {
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, []);

  return null;
}
