"use client";

import { useEffect } from "react";
import {
  DEVICE_PROFILE_STORAGE_KEY,
  TOUCH_INPUT_STORAGE_KEY,
  resolveDeviceProfile,
} from "@/lib/runtime/deviceProfile";

const DEVICE_PROFILE_DATASET_KEY = "deviceProfile";
const TOUCH_INPUT_DATASET_KEY = "touchInput";

function syncRuntimeDeviceProfile() {
  if (typeof window === "undefined") return;

  const profile = resolveDeviceProfile({
    userAgent: window.navigator.userAgent,
    maxTouchPoints: window.navigator.maxTouchPoints ?? 0,
    viewportWidth: window.innerWidth,
  });

  const touchInput = (window.navigator.maxTouchPoints ?? 0) > 0 ? "1" : "0";

  document.documentElement.dataset[DEVICE_PROFILE_DATASET_KEY] = profile;
  document.documentElement.dataset[TOUCH_INPUT_DATASET_KEY] = touchInput;
  window.localStorage.setItem(DEVICE_PROFILE_STORAGE_KEY, profile);
  window.localStorage.setItem(TOUCH_INPUT_STORAGE_KEY, touchInput);
}

export default function DeviceProfileRuntime() {
  useEffect(() => {
    let rafId: number | null = null;

    const scheduleSync = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        syncRuntimeDeviceProfile();
      });
    };

    syncRuntimeDeviceProfile();
    window.addEventListener("resize", scheduleSync, { passive: true });
    window.addEventListener("orientationchange", scheduleSync, { passive: true });
    window.addEventListener("pageshow", scheduleSync);
    document.addEventListener("visibilitychange", scheduleSync);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("orientationchange", scheduleSync);
      window.removeEventListener("pageshow", scheduleSync);
      document.removeEventListener("visibilitychange", scheduleSync);
    };
  }, []);

  return null;
}
