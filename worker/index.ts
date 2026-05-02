/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

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

export {};
