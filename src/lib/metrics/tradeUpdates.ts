export type TradeUpdateReason = "create" | "update" | "delete" | "restore" | "bulk" | "unknown";

export interface TradeUpdateEvent {
  reason: TradeUpdateReason;
  tradeId?: string;
  accountId?: string;
  source?: string;
  at: string;
}

const EVENT_NAME = "alphalog:trade-update";
let target: EventTarget | null = null;

function getTarget(): EventTarget | null {
  if (typeof window === "undefined") return null;
  if (!target) {
    target = new EventTarget();
  }
  return target;
}

export function notifyTradeUpdate(event: Omit<TradeUpdateEvent, "at">): void {
  const eventTarget = getTarget();
  if (!eventTarget) return;

  eventTarget.dispatchEvent(
    new CustomEvent(EVENT_NAME, {
      detail: {
        ...event,
        at: new Date().toISOString(),
      } satisfies TradeUpdateEvent,
    })
  );
}

export function subscribeTradeUpdates(
  handler: (event: TradeUpdateEvent) => void
): () => void {
  const eventTarget = getTarget();
  if (!eventTarget) {
    return () => {};
  }

  const listener = (evt: Event) => {
    const detail = (evt as CustomEvent).detail as TradeUpdateEvent | undefined;
    if (detail) {
      handler(detail);
    }
  };

  eventTarget.addEventListener(EVENT_NAME, listener);

  return () => {
    eventTarget.removeEventListener(EVENT_NAME, listener);
  };
}
