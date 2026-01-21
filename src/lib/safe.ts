/**
 * Safe Data Layer - Normalización y validación de datos de red/DB
 * Previene crashes por datos mal formateados
 */

/**
 * Convierte un valor desconocido a un array tipado
 * Nunca throws, siempre retorna un array seguro
 */
export function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  return [];
}

/**
 * Valida si un valor es un objeto Record
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Parse JSON seguro - nunca throws
 */
export function safeJsonParse<T = unknown>(
  json: string,
  fallback?: T
): T | undefined {
  try {
    return JSON.parse(json) as T;
  } catch (err) {
    return fallback;
  }
}

/**
 * Normaliza respuestas de API:
 * - Si es array, retorna array
 * - Si es {data: array}, retorna array
 * - Si es {data: {...}} para objeto, retorna ese objeto
 * - Si es null/undefined, retorna array vacío o fallback
 */
export function normalizeListResponse<T = unknown>(
  response: unknown
): T[] {
  // Ya es array
  if (Array.isArray(response)) {
    return response as T[];
  }

  // Es objeto con propiedad 'data'
  if (isRecord(response) && response.data !== undefined) {
    if (Array.isArray(response.data)) {
      return response.data as T[];
    }
    // Si data es un objeto no-array, envuélvelo en array
    if (isRecord(response.data)) {
      return [response.data as T];
    }
  }

  // Fallback seguro: array vacío
  return [];
}

/**
 * Normaliza respuesta para objeto único
 * Si viene {data: {...}}, retorna ese objeto
 * Si viene {...}, retorna el objeto
 * Si viene null/undefined, retorna undefined
 */
export function normalizeSingleResponse<T>(response: unknown): T | undefined {
  if (isRecord(response)) {
    if (isRecord(response.data)) {
      return response.data as T;
    }
    return response as T;
  }
  return undefined;
}

/**
 * Valida que un objeto tenga propiedades requeridas
 * Retorna true si todas están presentes
 */
export function hasRequiredProps<T extends Record<string, unknown>>(
  obj: unknown,
  props: (keyof T)[]
): obj is T {
  if (!isRecord(obj)) return false;
  return props.every((prop) => obj[prop as string] !== undefined);
}

/**
 * Extrae mensaje de error de varias formas posibles
 */
export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (isRecord(err)) {
    if (typeof err.message === "string") return err.message;
    if (typeof err.error === "string") return err.error;
  }
  return "Error desconocido";
}

/**
 * Wrapper para operaciones que podrían fallar
 */
export async function safeTry<T>(
  fn: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    return fallback;
  }
}
