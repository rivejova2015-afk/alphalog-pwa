export type SentryContext = Record<string, unknown>;

type SentryLike = {
  captureMessage?: (message: string, context?: { extra?: SentryContext }) => void;
  captureException?: (error: unknown, context?: { extra?: SentryContext }) => void;
};

const getSentry = (): SentryLike | null => {
  const globalRef = typeof window !== "undefined" ? window : globalThis;
  const sentry = (globalRef as typeof globalThis & { Sentry?: SentryLike }).Sentry;
  return sentry ?? null;
};

export const captureMessage = (message: string, context?: SentryContext) => {
  const sentry = getSentry();
  if (!sentry?.captureMessage) return;
  sentry.captureMessage(message, context ? { extra: context } : undefined);
};

export const captureException = (error: unknown, context?: SentryContext) => {
  const sentry = getSentry();
  if (!sentry?.captureException) return;
  sentry.captureException(error, context ? { extra: context } : undefined);
};
