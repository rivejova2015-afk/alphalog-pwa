export type TradeUpdateReason = "create" | "update" | "delete" | "restore" | "bulk" | "unknown";

export interface TradeUpdateEvent {
  reason: TradeUpdateReason;
  tradeId?: string;
  accountId?: string;
  source?: string;
  at: string;
}

const EVENT_NAME = "alphalog:trade-update";
const CHANNEL_NAME = "alphalog:trade-update";
let target: EventTarget | null = null;
let broadcastChannel: BroadcastChannel | null = null;

function getTarget(): EventTarget | null {
  if (typeof window === "undefined") return null;
  if (!target) {
    target = new EventTarget();
  }
  return target;
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
  return broadcastChannel;
}

export function notifyTradeUpdate(event: Omit<TradeUpdateEvent, "at">): void {
  const eventTarget = getTarget();
  const detail = {
    ...event,
    at: new Date().toISOString(),
  } satisfies TradeUpdateEvent;

  if (eventTarget) {
    eventTarget.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail,
      })
    );
  }

  const channel = getBroadcastChannel();
  if (channel) {
    channel.postMessage(detail);
  }
}

export function subscribeTradeUpdates(
  handler: (event: TradeUpdateEvent) => void
): () => void {
  const eventTarget = getTarget();
  const channel = getBroadcastChannel();

  const listener = (evt: Event) => {
    const detail = (evt as CustomEvent).detail as TradeUpdateEvent | undefined;
    if (detail) {
      handler(detail);
    }
  };

  const broadcastListener = (evt: MessageEvent) => {
    const detail = evt.data as TradeUpdateEvent | undefined;
    if (detail && typeof detail.at === "string") {
      handler(detail);
    }
  };

  if (eventTarget) {
    eventTarget.addEventListener(EVENT_NAME, listener);
  }
  if (channel) {
    channel.addEventListener("message", broadcastListener);
  }

  return () => {
    if (eventTarget) {
      eventTarget.removeEventListener(EVENT_NAME, listener);
    }
    if (channel) {
      channel.removeEventListener("message", broadcastListener);
    }
  };
}
