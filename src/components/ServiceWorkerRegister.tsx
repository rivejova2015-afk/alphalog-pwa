"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    // Only register SW in production or when explicitly enabled
    const enableSW = process.env.NEXT_PUBLIC_ENABLE_SW === "true";
    const isProduction = process.env.NODE_ENV === "production";

    if (!enableSW && !isProduction) {
      console.log("[SW] Registration disabled in dev. Set NEXT_PUBLIC_ENABLE_SW=true to enable");
      return;
    }

    if (!("serviceWorker" in navigator)) {
      console.warn("[SW] Service Worker not supported");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[SW] Registered successfully");

        // Check for updates periodically
        setInterval(() => {
          reg.update();
        }, 60000); // Every minute
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });
  }, []);

  return null;
}
