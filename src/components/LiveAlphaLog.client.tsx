"use client";

// Live AlphaLog client bridge: keeps the app refreshed from realtime changes.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { startLiveAlphaLog } from "@/lib/liveAlphaLog";

const REFRESH_DEBOUNCE_MS = 500;

export function LiveAlphaLog() {
  const router = useRouter();
  const refreshLock = useRef(false);

  useEffect(() => {
    const triggerRefresh = () => {
      if (refreshLock.current) return;
      refreshLock.current = true;
      setTimeout(() => {
        router.refresh();
        refreshLock.current = false;
      }, REFRESH_DEBOUNCE_MS);
    };

    const service = startLiveAlphaLog({ onEvent: triggerRefresh });

    return () => {
      service.stop();
    };
  }, [router]);

  return null;
}
