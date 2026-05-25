// Sentry wrapper — preserves the legacy stub's API surface so existing callers
// (src/lib/copygroups/mirroring.ts and any future ones) keep compiling, but
// now delegates to the real @sentry/nextjs SDK initialized in
// sentry.{client,server,edge}.config.ts.
//
// When NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN env vars are unset, the underlying
// Sentry init() short-circuits — these calls become no-ops (no errors thrown,
// no events sent). That keeps local dev clean of false signals.

import * as Sentry from '@sentry/nextjs';

export type SentryContext = Record<string, unknown>;

export const captureMessage = (message: string, context?: SentryContext): void => {
  Sentry.captureMessage(message, context ? { extra: context } : undefined);
};

export const captureException = (error: unknown, context?: SentryContext): void => {
  Sentry.captureException(error, context ? { extra: context } : undefined);
};

// Tagged variant — drives the "Trading Operations Mission Control" dashboard
// which groups by `tag:module:*` (bot, cme, coinarb, polyarb, treasury, ...).
// withScope isolates the tag so it does not leak into unrelated events.
export const captureMessageWithModule = (
  module: string,
  message: string,
  context?: SentryContext
): void => {
  Sentry.withScope((scope) => {
    scope.setTag('module', module);
    if (context) scope.setExtras(context);
    Sentry.captureMessage(message);
  });
};
