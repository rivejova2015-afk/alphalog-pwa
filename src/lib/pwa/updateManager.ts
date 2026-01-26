import { captureException, captureMessage } from "@/lib/sentry";

const RELOAD_FLAG_KEY = "__pwa_update_reloaded__";
const UPDATE_CHECK_MIN_INTERVAL_MS = 60 * 1000;
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

const isProd = process.env.NODE_ENV === "production";

const logInfo = (message: string, context?: Record<string, unknown>) => {
  if (isProd) {
    captureMessage(`[PWA] ${message}`, context);
    return;
  }
  if (context) {
    console.info(`[PWA] ${message}`, context);
  } else {
    console.info(`[PWA] ${message}`);
  }
};

const logError = (message: string, error?: unknown, context?: Record<string, unknown>) => {
  if (isProd) {
    captureException(error ?? new Error(message), { message, ...context });
    return;
  }
  console.error(`[PWA] ${message}`, error, context);
};

const logDebug = (message: string, context?: Record<string, unknown>) => {
  if (isProd) return;
  if (context) {
    console.info(`[PWA] ${message}`, context);
  } else {
    console.info(`[PWA] ${message}`);
  }
};

const hasReloaded = () => {
  try {
    return sessionStorage.getItem(RELOAD_FLAG_KEY) === "1";
  } catch {
    return false;
  }
};

const markReloaded = () => {
  try {
    sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
  } catch {
    // ignore storage failures
  }
};

const isSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator;

const shouldCheckForUpdate = (lastCheckAt: number) => {
  if (navigator.onLine === false) return false;
  return Date.now() - lastCheckAt >= UPDATE_CHECK_MIN_INTERVAL_MS;
};

const requestUpdate = (registration: ServiceWorkerRegistration, defer: () => void) => {
  if (hasReloaded()) {
    logInfo("Reload already performed, skipping update apply");
    return;
  }

  if (!navigator.serviceWorker.controller) {
    logInfo("Update available but no controller yet, skipping reload");
    return;
  }

  if (document.visibilityState !== "visible") {
    defer();
    logInfo("Update ready while hidden; deferring apply");
    return;
  }

  if (!registration.waiting) {
    logInfo("Update requested but no waiting worker found");
    return;
  }

  logInfo("Applying update via SKIP_WAITING");
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
};

const resolveRegistration = async () => {
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch (error) {
    logError("Failed to get service worker registration", error);
    return null;
  }
};

export const setupUpdateManager = () => {
  if (!isSupported()) return () => {};

  let registration: ServiceWorkerRegistration | null = null;
  let updateFoundAttached = false;
  let pendingUpdate = false;
  let pendingReload = false;
  let hadController = Boolean(navigator.serviceWorker.controller);
  let lastUpdateCheckAt = 0;
  let updateIntervalId: number | null = null;

  const deferUpdate = () => {
    pendingUpdate = true;
  };

  const scheduleReload = () => {
    if (hasReloaded()) return;

    if (document.visibilityState !== "visible") {
      pendingReload = true;
      logInfo("Controller changed while hidden; deferring reload");
      return;
    }

    markReloaded();
    logInfo("Controller changed; reloading");
    window.location.reload();
  };

  const handleControllerChange = () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    scheduleReload();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState !== "visible") return;

    if (pendingReload) {
      pendingReload = false;
      scheduleReload();
      return;
    }

    if (pendingUpdate) {
      pendingUpdate = false;
      void checkForWaiting();
      return;
    }

    void checkForUpdate("visibility");
  };

  const handleUpdateFound = () => {
    if (!registration?.installing) return;
    const installing = registration.installing;

    const handleStateChange = () => {
      if (installing.state !== "installed") return;
      if (!navigator.serviceWorker.controller) return;
      const reg = registration;
      if (!reg) return;
      requestUpdate(reg, deferUpdate);
    };

    installing.addEventListener("statechange", handleStateChange);
  };

  const attachUpdateFound = (reg: ServiceWorkerRegistration) => {
    if (updateFoundAttached) return;
    reg.addEventListener("updatefound", handleUpdateFound);
    updateFoundAttached = true;
  };

  const attachRegistration = (reg: ServiceWorkerRegistration) => {
    registration = reg;
    attachUpdateFound(reg);
    if (reg.waiting) {
      requestUpdate(reg, deferUpdate);
    }
  };

  const checkForUpdate = async (reason: string) => {
    if (!shouldCheckForUpdate(lastUpdateCheckAt)) {
      logDebug("Skipping update check; throttled or offline", { reason });
      return;
    }
    lastUpdateCheckAt = Date.now();

    const reg = registration ?? (await resolveRegistration());
    if (!reg) {
      logDebug("No service worker registration for update check", { reason });
      return;
    }

    attachRegistration(reg);
    try {
      await reg.update();
      logDebug("Service worker update check completed", { reason });
    } catch (error) {
      logError("Service worker update check failed", error, { reason });
    }
  };

  const checkForWaiting = async () => {
    const reg = registration ?? (await resolveRegistration());
    if (!reg) return;
    attachRegistration(reg);
    if (reg.waiting) {
      requestUpdate(reg, deferUpdate);
    }
  };

  const handleOnline = () => {
    void checkForUpdate("online");
  };

  const handleFocus = () => {
    void checkForUpdate("focus");
  };

  const handlePageShow = () => {
    void checkForUpdate("pageshow");
  };

  const startUpdateInterval = () => {
    if (UPDATE_CHECK_INTERVAL_MS <= 0) return;
    if (updateIntervalId !== null) return;
    updateIntervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void checkForUpdate("interval");
    }, UPDATE_CHECK_INTERVAL_MS);
  };

  navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("online", handleOnline);
  window.addEventListener("focus", handleFocus);
  window.addEventListener("pageshow", handlePageShow);

  void checkForWaiting();
  void checkForUpdate("startup");

  navigator.serviceWorker.ready
    .then((reg) => {
      attachRegistration(reg);
      startUpdateInterval();
      void checkForUpdate("ready");
    })
    .catch((error) => logError("Service worker ready check failed", error));

  return () => {
    navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("focus", handleFocus);
    window.removeEventListener("pageshow", handlePageShow);
    if (updateIntervalId !== null) {
      window.clearInterval(updateIntervalId);
      updateIntervalId = null;
    }
    if (registration && updateFoundAttached) {
      registration.removeEventListener("updatefound", handleUpdateFound);
    }
  };
};
