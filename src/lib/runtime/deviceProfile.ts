export type DeviceProfile = "mobile" | "desktop";

export const DEVICE_PROFILE_STORAGE_KEY = "alphalog.device_profile";
export const TOUCH_INPUT_STORAGE_KEY = "alphalog.touch_input";

const MOBILE_USER_AGENT_PATTERN =
  /android|iphone|ipad|ipod|iemobile|opera mini|mobile|blackberry|windows phone/i;

type ResolveDeviceProfileParams = {
  userAgent: string;
  maxTouchPoints: number;
  viewportWidth: number;
};

export function resolveDeviceProfile({
  userAgent,
  maxTouchPoints,
  viewportWidth,
}: ResolveDeviceProfileParams): DeviceProfile {
  const isMobileUserAgent = MOBILE_USER_AGENT_PATTERN.test(userAgent);
  const isTouchViewport = maxTouchPoints > 0 && viewportWidth <= 1024;

  if (isMobileUserAgent || isTouchViewport) {
    return "mobile";
  }

  return "desktop";
}

export function isAppleMobileDevice(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  return (
    /iphone|ipad|ipod/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
}
