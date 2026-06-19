/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

// `__SW_MANIFEST` is replaced at build time with the precache manifest.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// ── Custom handlers (preserved from the previous worker/index.ts) ────────────

// Apply an update when the page posts SKIP_WAITING (driven by updateManager.ts).
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

interface PushPayload {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, string>;
}

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;

  let payload: PushPayload;
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    payload = { title: "AlphaLog", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "AlphaLog", {
      body: payload.body ?? "",
      icon: payload.icon ?? "/icons/icon-192.png",
      badge: payload.badge ?? "/icons/icon-192.png",
      tag: payload.tag ?? "alphalog-notification",
      data: payload.data ?? {},
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const data = event.notification.data as { url?: string } | undefined;
  const url = data?.url ?? "/intelligence/agents/polyarb";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});

// ── Serwist core ─────────────────────────────────────────────────────────────
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
