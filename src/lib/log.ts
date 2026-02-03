/**
 * Logger estructurado para debugging y observabilidad
 */

export interface LogMeta extends Record<string, unknown> {
  component?: string;
  action?: string;
  endpoint?: string;
  status?: number;
  message?: string;
  payload?: unknown;
  error?: string;
  code?: string;
  table?: string;
  permanent?: boolean;
  circuitOpen?: boolean;
}

/**
 * Loguea error con contexto estructurado
 */
export function logError(name: string, meta: LogMeta): void {
  const context = {
    timestamp: new Date().toISOString(),
    component: meta.component,
    action: meta.action,
    endpoint: meta.endpoint,
    status: meta.status,
    message: meta.message,
    error: meta.error,
  };

  if (typeof window !== "undefined") {
    import("@/lib/alphashield/logger")
      .then(({ logger }) =>
        logger.error(name, meta.message || "Error", undefined, context)
      )
      .catch(() => undefined);
  }

  // En desarrollo, muestra en consola con color
  if (process.env.NODE_ENV === "development") {
    console.error(
      `%c[${name}] ${meta.message || "Error"}`,
      "color: #ef4444; font-weight: bold;",
      context
    );
  } else {
    console.error(`[${name}]`, context);
  }
}

/**
 * Loguea info general
 */
export function logInfo(name: string, message: string, meta?: LogMeta): void {
  if (typeof window !== "undefined") {
    import("@/lib/alphashield/logger")
      .then(({ logger }) => logger.info(name, message, meta || {}))
      .catch(() => undefined);
  }
  if (process.env.NODE_ENV === "development") {
    console.log(
      `%c[${name}] ${message}`,
      "color: #3b82f6; font-weight: bold;",
      meta
    );
  } else {
    console.log(`[${name}]`, message, meta);
  }
}

/**
 * Loguea warning
 */
export function logWarn(name: string, message: string, meta?: LogMeta): void {
  if (typeof window !== "undefined") {
    import("@/lib/alphashield/logger")
      .then(({ logger }) => logger.warn(name, message, meta || {}))
      .catch(() => undefined);
  }
  if (process.env.NODE_ENV === "development") {
    console.warn(
      `%c[${name}] ${message}`,
      "color: #f59e0b; font-weight: bold;",
      meta
    );
  } else {
    console.warn(`[${name}]`, message, meta);
  }
}
