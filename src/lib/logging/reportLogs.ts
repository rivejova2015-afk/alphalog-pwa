import { captureException, captureMessage } from "@/lib/sentry";

type ReportLogPayload = Record<string, unknown>;

const isProd = () => process.env.NODE_ENV === "production";

export const reportLog = {
  start: (message: string, meta?: ReportLogPayload) => {
    if (isProd()) {
      captureMessage(`[ReportBot] ${message}`, meta);
    } else {
      console.info(`[ReportBot] ${message}`, meta);
    }
  },
  success: (message: string, meta?: ReportLogPayload) => {
    if (isProd()) {
      captureMessage(`[ReportBot] ${message}`, meta);
    } else {
      console.info(`[ReportBot] ${message}`, meta);
    }
  },
  noChanges: (message: string, meta?: ReportLogPayload) => {
    if (isProd()) {
      captureMessage(`[ReportBot] ${message}`, meta);
    } else {
      console.info(`[ReportBot] ${message}`, meta);
    }
  },
  failure: (message: string, error: unknown, meta?: ReportLogPayload) => {
    if (isProd()) {
      captureException(error, { message, ...meta });
    } else {
      console.error(`[ReportBot] ${message}`, error, meta);
    }
  },
};
