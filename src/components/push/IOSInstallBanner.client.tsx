"use client";

import { useEffect, useState } from "react";
import { Share, Plus, X } from "lucide-react";

const DISMISS_KEY = "alphalog.iosInstallBanner.dismissedAt";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const ts = Number.parseInt(v, 10);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export default function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOSDevice()) return;
    if (isStandalone()) return;
    if (isDismissed()) return;
    setShow(true);
  }, []);

  if (!show) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Instalar AlphaLog en pantalla de inicio"
      className="fixed bottom-3 left-3 right-3 z-50 mx-auto max-w-md rounded-xl border border-blue-400/40 bg-blue-950/95 p-4 text-sm text-blue-50 shadow-2xl backdrop-blur sm:bottom-6"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={handleDismiss}
        className="absolute right-2 top-2 rounded-full p-1 text-blue-200 hover:bg-blue-900/60 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <p className="mb-2 pr-6 font-semibold text-white">
        Activa notificaciones de AlphaLog en tu iPhone
      </p>
      <p className="mb-3 text-blue-100/90">
        Para recibir alertas de cada operación del bot, agrega esta app a tu pantalla de inicio:
      </p>
      <ol className="space-y-1 text-blue-50/95">
        <li className="flex items-center gap-2">
          <span className="font-mono text-xs text-blue-200">1.</span>
          <span>Toca</span>
          <Share className="inline h-4 w-4 text-blue-200" aria-label="Compartir" />
          <span>(Compartir)</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="font-mono text-xs text-blue-200">2.</span>
          <span>Elige</span>
          <Plus className="inline h-4 w-4 text-blue-200" aria-label="Añadir" />
          <span>&quot;Añadir a inicio&quot;</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="font-mono text-xs text-blue-200">3.</span>
          <span>Abre AlphaLog desde el icono nuevo</span>
        </li>
      </ol>
    </div>
  );
}
