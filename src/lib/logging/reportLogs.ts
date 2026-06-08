import { captureException, captureMessage } from "@/lib/sentry";
import { logError, logInfo } from "@/lib/log";

type ReportLogPayload = Record<string, unknown>;

const isProd = () => process.env.NODE_ENV === "production";

const logReport = (message: string, meta?: ReportLogPayload) => {
  if (isProd()) {
    captureMessage(`[ReportBot] ${message}`, meta);
  } else {
    logInfo("ReportBot", message, { component: "logging.reportBot", payload: meta });
  }
};

export const reportLog = {
  start: logReport,
  success: logReport,
  noChanges: logReport,
  failure: (message: string, error: unknown, meta?: ReportLogPayload) => {
    if (isProd()) {
      captureException(error, { message, ...meta });
    } else {
      logError("ReportBot", { component: "logging.reportBot.failure", message, error: error instanceof Error ? error.message : String(error), payload: meta });
    }
  },
};
