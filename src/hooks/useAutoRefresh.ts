/**
 * useAutoRefresh Hook with Circuit Breaker
 * Manejo robusto de data fetching con:
 * - Auto-refresh configurable (intervalo)
 * - Circuit breaker para errores permanentes (PGRST205, missingTable)
 * - Revalidate en focus + reconexión
 * - Stale-while-revalidate (mostrar último dato bueno mientras refresca)
 * - Control de concurrencia (no duplicar fetches)
 * - Abort controller para cancelar fetch viejo
 * - Retry con exponential backoff para fallos temporales
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { logError, logInfo, logWarn } from "@/lib/log";

interface UseAutoRefreshOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  intervalMs?: number;
  enabled?: boolean;
  onError?: (err: Error) => void;
}

interface UseAutoRefreshReturn<T> {
  data: T | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  circuitOpen?: boolean; // true si hay error permanente (no se autorefresh)
  missingTable?: boolean; // true si PGRST205 (tabla no existe)
}

export function useAutoRefresh<T>({
  key,
  fetcher,
  intervalMs = 60000,
  enabled = true,
  onError,
}: UseAutoRefreshOptions<T>): UseAutoRefreshReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [circuitOpen, setCircuitOpen] = useState(false);
  const [missingTable, setMissingTable] = useState(false);

  // Refs para control de concurrencia y lifecycle
  const abortControllerRef = useRef<AbortController | null>(null);
  const isFetchingRef = useRef(false);
  const lastGoodDataRef = useRef<T | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const maxRetriesRef = useRef(3);
  const circuitOpenRef = useRef(false);

  /**
   * Calcula delay de retry con exponential backoff
   * 1s -> 2s -> 4s -> max 10s
   */
  const getBackoffDelay = useCallback((attempt: number): number => {
    const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
    return delay;
  }, []);

  /**
   * Realiza el fetch con retry y abort logic
   */
  const performFetch = useCallback(
    async (isRefresh: boolean = false) => {
      // Si circuit está abierto, no intentes fetch automático
      if (circuitOpenRef.current && isRefresh) {
        logWarn(key, "Circuit breaker abierto, saltando auto-refresh");
        return;
      }

      // Evita fetch concurrente
      if (isFetchingRef.current) {
        logWarn(key, "Fetch en progreso, ignorando request duplicado");
        return;
      }

      isFetchingRef.current = true;

      try {
        // Cancela fetch anterior si existe
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();

        const signal = abortControllerRef.current.signal;

        // Estado inicial
        if (!isRefresh) {
          setIsLoading(true);
        } else {
          setIsRefreshing(true);
        }

        // Wrap fetcher con signal si es posible
        // (algunos fetchers podrían no soportar signal, es OK)
        let result: T;
        try {
          result = await Promise.race([
            fetcher(),
            new Promise<never>((_, reject) => {
              signal.addEventListener("abort", () => {
                reject(new Error("Fetch abortado"));
              });
            }),
          ]);
        } catch (err) {
          if (err instanceof Error && err.message === "Fetch abortado") {
            logInfo(key, "Fetch abortado por nueva request");
            return;
          }
          throw err;
        }

        // Success: resetea retry counter y circuit breaker
        retryCountRef.current = 0;
        circuitOpenRef.current = false;
        setCircuitOpen(false);
        setMissingTable(false);
        setData(result);
        lastGoodDataRef.current = result;
        setError(null);

        logInfo(key, "Data refrescada exitosamente", { time: new Date() });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        
        // Intenta extraer metadatos de respuesta API
        let isTemporary = true;
        let isPermanent = false;
        let isMissingTableError = false;

        // Si es respuesta JSON con meta
        if (typeof err === "object" && err !== null) {
          const apiError = err as any;
          if (apiError.meta?.isTemporary === false) {
            isTemporary = false;
            isPermanent = true;
          }
          if (apiError.meta?.missingTable) {
            isMissingTableError = true;
            isPermanent = true;
          }
          if (apiError.meta?.code === "PGRST205") {
            isMissingTableError = true;
            isPermanent = true;
          }
        }

        // Detecta errores permanentes del código/mensaje
        const message = error.message.toLowerCase();
        if (
          error.message.includes("PGRST205") ||
          message.includes("not found") && message.includes("table")
        ) {
          isPermanent = true;
          isMissingTableError = true;
          isTemporary = false;
        }

        // Errores de auth son permanentes para esta session
        const status = (error as any)?.status;
        if (status === 401 || status === 403) {
          isPermanent = true;
          isTemporary = false;
        }

        // Abre circuit breaker si error es permanente
        if (isPermanent) {
          circuitOpenRef.current = true;
          setCircuitOpen(true);
          if (isMissingTableError) {
            setMissingTable(true);
          }

          logError(key, {
            component: key,
            action: "fetch",
            message: error.message,
            permanent: true,
            circuitOpen: true,
          });

          setError(error);
          onError?.(error);
          return; // No retry para errores permanentes
        }

        // Si es error de red/temporal y no superamos max retries
        if (isTemporary && retryCountRef.current < maxRetriesRef.current) {
          const delay = getBackoffDelay(retryCountRef.current);
          retryCountRef.current++;

          logWarn(key, `Error retryable, reintentando en ${delay}ms`, {
            attempt: retryCountRef.current,
            error: error.message,
          });

          // Schedule retry
          setTimeout(() => {
            performFetch(isRefresh);
          }, delay);
          return;
        }

        // Error final: mantiene lastGoodData visible
        setError(error);
        logError(key, {
          component: key,
          action: "fetch",
          message: error.message,
          error: error.stack,
        });

        onError?.(error);
      } finally {
        isFetchingRef.current = false;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [fetcher, key, getBackoffDelay, onError]
  );

  /**
   * Refresh manual (para botones "Reintentar")
   * Resetea circuit breaker para permitir un reintento manual
   */
  const refresh = useCallback(async () => {
    retryCountRef.current = 0; // Reset retry counter
    circuitOpenRef.current = false; // Abre circuit manualmente
    setCircuitOpen(false);
    await performFetch(true);
  }, [performFetch]);

  /**
   * Setup inicial: fetch on mount
   */
  useEffect(() => {
    if (!enabled) return;

    performFetch(false);

    return () => {
      // Cleanup: cancela fetch pendiente
      abortControllerRef.current?.abort();
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [enabled, key, performFetch]);

  /**
   * Auto-refresh con intervalo configurable
   * NO activa si circuit está abierto (error permanente)
   */
  useEffect(() => {
    if (!enabled || intervalMs <= 0 || circuitOpen) return;

    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
    }

    intervalIdRef.current = setInterval(() => {
      performFetch(true);
    }, intervalMs);

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [enabled, intervalMs, performFetch, circuitOpen]);

  /**
   * Revalidate on focus
   * NO activa si circuit está abierto
   */
  useEffect(() => {
    if (!enabled || circuitOpen) return;

    const handleFocus = () => {
      logInfo(key, "Tab enfocada, revalidando data...");
      performFetch(true);
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [enabled, key, performFetch, circuitOpen]);

  /**
   * Revalidate on online
   * NO activa si circuit está abierto
   */
  useEffect(() => {
    if (!enabled || circuitOpen) return;

    const handleOnline = () => {
      logInfo(key, "Conexión restaurada, revalidando data...");
      retryCountRef.current = 0; // Reset retry counter
      performFetch(true);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [enabled, key, performFetch, circuitOpen]);

  return {
    data: data || lastGoodDataRef.current,
    isLoading,
    isRefreshing,
    error,
    refresh,
    circuitOpen,
    missingTable,
  };
}

// `logWarn` is re-exported above from `@/lib/log` (already imported by
// users of this hook). No local wrapper needed.
