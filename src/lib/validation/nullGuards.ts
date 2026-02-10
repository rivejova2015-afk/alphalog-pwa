// src/lib/validation/nullGuards.ts

export const asString = (value: unknown, fallback = ""): string => {
  if (value === null || value === undefined) return fallback;
  return typeof value === "string" ? value : String(value);
};

export const asNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined) return fallback;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const asBoolean = (value: unknown, fallback = false): boolean => {
  if (value === null || value === undefined) return fallback;
  return Boolean(value);
};

export const asArray = <T>(value: unknown, fallback: T[] = []): T[] => {
  return Array.isArray(value) ? value : fallback;
};

export const ensureDefined = <T>(value: T | null | undefined, message: string): T => {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
};
