"use client";

import { useEffect } from "react";
import { isPublicFeatureEnabled } from "@/lib/runtime/featureFlags";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    // Only register SW in production or when explicitly enabled
    const enableSW = isPublicFeatureEnabled("enableServiceWorkerInDev");
    const isProduction = process.env.NODE_ENV === "production";

    if (!enableSW && !isProduction) {
      console.log("[SW] Registration disabled in dev. Set NEXT_PUBLIC_ENABLE_SW=true to enable");
      return;
    }

    if (!("serviceWorker" in navigator)) {
      console.warn("[SW] Service Worker not supported");
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[SW] Registered successfully");
        intervalId = setInterval(() => {
          reg.update();
        }, 60000);
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });

    return () => {
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, []);

  return null;
}
