const parseBoolean = (rawValue: string | undefined, defaultValue: boolean) => {
  if (rawValue === undefined || rawValue === null || rawValue.trim() === "") {
    return defaultValue;
  }
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return defaultValue;
};

const publicFeatureFlags = {
  enableAab: parseBoolean(process.env.NEXT_PUBLIC_ENABLE_AAB, true),
  enableSystemLogs: parseBoolean(process.env.NEXT_PUBLIC_ENABLE_SYSTEM_LOGS, false),
  enableServiceWorkerInDev: parseBoolean(process.env.NEXT_PUBLIC_ENABLE_SW, false),
};

export type PublicFeatureFlagName = keyof typeof publicFeatureFlags;

export const getPublicFeatureFlags = () => publicFeatureFlags;

export const isPublicFeatureEnabled = (flagName: PublicFeatureFlagName) =>
  publicFeatureFlags[flagName];
