"use client";

// Nudge authenticated users who have NO second factor to enable 2FA.
// Pairs with the lockout-safe device-trust change (audit 2026-06, Área 13):
// users without MFA are not blocked, but are invited to protect their account.

import { useEffect, useState } from "react";

const DISMISS_KEY = "al_2fa_prompt_dismissed";

export default function Enable2FaPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

        // TOTP factors?
        const mfaRes = await fetch("/api/auth/mfa");
        if (!mfaRes.ok) return; // not authenticated → nothing to prompt
        const { factors } = await mfaRes.json().catch(() => ({ factors: [] }));
        if (factors && factors.length > 0) return; // has TOTP

        // WebAuthn / Face ID passkeys?
        const wnRes = await fetch("/api/auth/webauthn/auth-options", { method: "POST" });
        if (wnRes.ok) {
          const opts = await wnRes.json().catch(() => ({}));
          if (opts.allowCredentials && opts.allowCredentials.length > 0) return; // has passkey
        }

        if (!cancelled) setShow(true); // no second factor at all
      } catch {
        // ignore — never block the app on this nudge
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore storage failures
    }
    setShow(false);
  };

  return (
    <div className="fixed bottom-4 left-4 z-[9998] flex max-w-sm items-center gap-3 rounded-lg border border-amber-700/50 bg-amber-950/90 px-4 py-3 text-amber-100 shadow-lg backdrop-blur-sm">
      <div className="text-xl">🛡️</div>
      <div className="flex flex-col gap-0.5">
        <div className="text-sm font-semibold">Protege tu cuenta con 2FA</div>
        <div className="text-xs text-amber-300/80">
          Activa la verificación en dos pasos para asegurar tus acciones sensibles.
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <a
          href="/auth/stepup?enroll=1"
          className="whitespace-nowrap rounded-md bg-amber-600 px-3 py-1.5 text-center text-xs font-medium text-white transition-colors hover:bg-amber-500"
        >
          Activar 2FA
        </a>
        <button
          onClick={dismiss}
          className="whitespace-nowrap rounded-md px-3 py-1 text-xs text-amber-300/70 transition-colors hover:text-amber-100"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
