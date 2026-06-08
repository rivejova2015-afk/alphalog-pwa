"use client";

import { useEffect } from "react";
import { bootstrapOutbox } from "@/lib/alphacore/offline/networkFallback";

const CSRF_COOKIE = "al_csrf";
const CSRF_HEADER = "x-csrf-token";

const readCookie = (name: string) => {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
};

const isSameOrigin = (input: RequestInfo | URL) => {
  if (typeof window === "undefined") return false;
  if (typeof input === "string") {
    if (input.startsWith("/")) return true;
    try {
      const url = new URL(input, window.location.origin);
      return url.origin === window.location.origin;
    } catch {
      return false;
    }
  }
  if (input instanceof URL) {
    return input.origin === window.location.origin;
  }
  return true;
};

export default function CsrfBridge() {
  useEffect(() => {
    // Initialize the offline outbox singleton so it listens to `online`
    // events and runs the auto-sync interval globally, regardless of which
    // route the user lands on. Safe to call repeatedly.
    bootstrapOutbox();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.fetch !== "function") return;

    const originalFetch = window.fetch.bind(window);

    const patchedFetch: typeof window.fetch = async (input, init) => {
      if (!isSameOrigin(input)) {
        return originalFetch(input, init);
      }

      const method = (init?.method || "GET").toUpperCase();
      if (["GET", "HEAD", "OPTIONS"].includes(method)) {
        return originalFetch(input, init);
      }

      const csrfToken = readCookie(CSRF_COOKIE);
      if (!csrfToken) {
        return originalFetch(input, init);
      }

      const headers = new Headers(init?.headers || {});
      if (!headers.has(CSRF_HEADER)) {
        headers.set(CSRF_HEADER, csrfToken);
      }

      return originalFetch(input, {
        ...init,
        headers,
      });
    };

    window.fetch = patchedFetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
