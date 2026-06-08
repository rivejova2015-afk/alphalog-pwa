// src/app/auth/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { logError, logInfo } from "@/lib/log";

const REMEMBER_ME_STORAGE_KEY = "alphalog.remember_me";
const REMEMBER_EMAIL_STORAGE_KEY = "alphalog.remember_email";

declare global {
  interface Window {
    hcaptcha?: {
      render: (container: HTMLElement, params: Record<string, unknown>) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [faceIdLoading, setFaceIdLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [rememberMe, setRememberMe] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [canUseFaceId, setCanUseFaceId] = useState(false);
  const hcaptchaSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;
  const captchaRef = useRef<HTMLDivElement | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReady, setCaptchaReady] = useState(false);
  const [captchaWidgetId, setCaptchaWidgetId] = useState<number | null>(null);

  useEffect(() => {
    document.title = mode === "signup" ? "Signup | AlphaLog" : "Login | AlphaLog";
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get("mode");
    const stepup = params.get("stepup") === "1";
    if (stepup) {
      setInfo("Verificacion adicional requerida. Inicia sesion para continuar.");
    }
    if (requestedMode === "signup") {
      setMode("signup");
    } else if (requestedMode === "login") {
      setMode("login");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedRemember = window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY);
    const savedEmail = window.localStorage.getItem(REMEMBER_EMAIL_STORAGE_KEY);

    if (savedRemember === "0") {
      setRememberMe(false);
    } else if (savedRemember === "1") {
      setRememberMe(true);
    }

    if (savedEmail) {
      setEmail(savedEmail);
    }

    const userAgent = window.navigator.userAgent;
    const isAppleMobile =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const webAuthnSupported =
      "PublicKeyCredential" in window &&
      !!window.navigator.credentials &&
      typeof window.navigator.credentials.get === "function";

    setIsIOS(isAppleMobile);
    setCanUseFaceId(isAppleMobile && webAuthnSupported);
  }, []);

  useEffect(() => {
    if (!hcaptchaSiteKey || !captchaRef.current) return;

    const renderCaptcha = () => {
      if (!window.hcaptcha || !captchaRef.current) return;
      if (captchaWidgetId !== null) return;
      const widgetId = window.hcaptcha.render(captchaRef.current, {
        sitekey: hcaptchaSiteKey,
        callback: (token: string) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(null),
        "error-callback": () => setError("No se pudo validar el captcha"),
      });
      setCaptchaWidgetId(widgetId);
      setCaptchaReady(true);
    };

    if (window.hcaptcha) {
      renderCaptcha();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.hcaptcha.com/1/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = renderCaptcha;
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [hcaptchaSiteKey, captchaWidgetId]);

  // Email/password form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const persistRememberPreference = (currentEmail: string) => {
    if (typeof window === "undefined") return;
    if (rememberMe) {
      window.localStorage.setItem(REMEMBER_ME_STORAGE_KEY, "1");
      window.localStorage.setItem(REMEMBER_EMAIL_STORAGE_KEY, currentEmail);
      return;
    }
    window.localStorage.setItem(REMEMBER_ME_STORAGE_KEY, "0");
    window.localStorage.removeItem(REMEMBER_EMAIL_STORAGE_KEY);
  };

  const getReadableAuthError = (value: unknown, fallback: string) => {
    const message = value instanceof Error ? value.message : String(value ?? fallback);
    if (message.includes("mfa_webauthn_enroll_not_enabled")) {
      return "Face ID no esta habilitado en Supabase (MFA WebAuthn).";
    }
    if (message.includes("mfa_webauthn_verify_not_enabled")) {
      return "Face ID no puede verificarse porque WebAuthn MFA no esta activo en Supabase.";
    }
    if (message.includes("NotAllowedError")) {
      return "Face ID fue cancelado o no autorizado en este dispositivo.";
    }
    return message || fallback;
  };

  const redirectAfterLogin = async () => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "/dashboard";
    const stepup = params.get("stepup") === "1";

    if (stepup) {
      await fetch("/api/auth/device/verify", { method: "POST" });
    }

    window.location.href = next;
  };

  const runIosFaceId = async (supabase: ReturnType<typeof createClient>) => {
    const { data: factorsData, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      throw listError;
    }

    const verifiedWebauthnFactor =
      factorsData?.webauthn?.find((factor) => factor.status === "verified") ?? null;

    if (verifiedWebauthnFactor) {
      const { error: authenticateError } = await supabase.auth.mfa.webauthn.authenticate({
        factorId: verifiedWebauthnFactor.id,
      });
      if (authenticateError) {
        throw authenticateError;
      }
      return;
    }

    const { error: registerError } = await supabase.auth.mfa.webauthn.register({
      friendlyName: "iOS Face ID",
    });

    if (registerError) {
      throw registerError;
    }

    setInfo("Face ID activado para este usuario en iOS.");
  };

  const signInGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/dashboard";
      const stepup = params.get("stepup") === "1";
      const nextTarget = stepup ? `/auth/stepup?next=${encodeURIComponent(next)}` : next;
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextTarget)}`;
      logInfo("Auth", "Redirecting to Google OAuth", { component: "auth.googleRedirect", redirectTo });

      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
    } catch (err) {
      logError("Auth", { component: "auth.googleOAuth.error", message: "Google OAuth error", error: err instanceof Error ? err.message : String(err) });
      setError(err instanceof Error ? err.message : "Error al iniciar sesion");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);
      setInfo(null);
      if (hcaptchaSiteKey && !captchaToken) {
        setError("Completa el captcha para continuar");
        setLoading(false);
        return;
      }
      const supabase = createClient();

      if (mode === "signup") {
        if (password !== confirmPassword) {
          setError("Las contraseñas no coinciden");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("La contraseña debe tener al menos 6 caracteres");
          setLoading(false);
          return;
        }

        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            captchaToken: captchaToken ?? undefined,
          },
        });

        if (err) {
          setError(err.message);
        } else {
          setError(null);
          setEmail("");
          setPassword("");
          setConfirmPassword("");
          alert("Registro exitoso. Revisa tu email para confirmar tu cuenta.");
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: {
            captchaToken: captchaToken ?? undefined,
          },
        });

        if (err) {
          setError(err.message);
        } else {
          persistRememberPreference(email);
          await redirectAfterLogin();
        }
      }
      if (window.hcaptcha && captchaWidgetId !== null) {
        window.hcaptcha.reset(captchaWidgetId);
        setCaptchaToken(null);
      }
    } catch (err) {
      logError("Auth", { component: "auth.email.error", message: "Email auth error", error: err instanceof Error ? err.message : String(err) });
      setError(err instanceof Error ? err.message : "Error al autenticarse");
    } finally {
      setLoading(false);
    }
  };

  const handleFaceIdLogin = async () => {
    if (!isIOS || !canUseFaceId) {
      setError("Face ID solo esta disponible en iOS con WebAuthn.");
      return;
    }

    if (!email || !password) {
      setError("Ingresa email y contrasena para continuar con Face ID.");
      return;
    }

    try {
      setFaceIdLoading(true);
      setError(null);
      setInfo(null);

      if (hcaptchaSiteKey && !captchaToken) {
        setError("Completa el captcha para continuar");
        return;
      }

      const supabase = createClient();
      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken: captchaToken ?? undefined,
        },
      });

      if (passwordError) {
        setError(passwordError.message);
        return;
      }

      await runIosFaceId(supabase);
      persistRememberPreference(email);
      await redirectAfterLogin();
    } catch (err) {
      setError(getReadableAuthError(err, "No se pudo validar Face ID."));
    } finally {
      if (window.hcaptcha && captchaWidgetId !== null) {
        window.hcaptcha.reset(captchaWidgetId);
        setCaptchaToken(null);
      }
      setFaceIdLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Ingresa tu email para continuar.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setInfo(null);
      if (hcaptchaSiteKey && !captchaToken) {
        setError("Completa el captcha para continuar");
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
        captchaToken: captchaToken ?? undefined,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setInfo("Te enviamos un enlace para crear tu contraseña.");
      if (window.hcaptcha && captchaWidgetId !== null) {
        window.hcaptcha.reset(captchaWidgetId);
        setCaptchaToken(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el enlace.");
    } finally {
      setLoading(false);
    }
  };

  // Detecta error en params (ej. ?error=missing_code)
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const queryError = searchParams.get("error");

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 text-slate-200 sm:px-6 sm:py-12">
      <div className="pointer-events-none absolute -top-24 left-1/2 hidden h-72 w-72 -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl sm:block" />
      <div className="pointer-events-none absolute bottom-0 right-0 hidden h-64 w-64 translate-x-1/3 rounded-full bg-cyan-600/10 blur-3xl sm:block" />

      <div className="relative mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <div className="inline-flex items-center gap-3 rounded-full border border-slate-700/70 bg-slate-900/70 px-4 py-2 text-xs uppercase tracking-[0.4em] text-slate-300">
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-glow" />
            AlphaLog
          </div>
          <h1 className="display-font text-4xl font-semibold text-slate-50 sm:text-5xl">
            Minimal. Elegante. Preciso.
          </h1>
          <p className="text-lg text-slate-300">
            Accede a tu terminal de trading, reportes y evidencia con una experiencia limpia y enfocada.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4">
              <p className="text-sm font-medium text-slate-100">Seguridad primero</p>
              <p className="mt-2 text-xs text-slate-400">Sesiones protegidas con Supabase + AlphaShield.</p>
            </div>
            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4">
              <p className="text-sm font-medium text-slate-100">PWA lista</p>
              <p className="mt-2 text-xs text-slate-400">Disponible offline con sincronizacion inteligente.</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-8 shadow-[0_24px_60px_rgba(2,4,10,0.55)] backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="display-font text-2xl text-slate-50">
                {mode === "login" ? "Iniciar sesion" : "Crear cuenta"}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Usa Google o tu email para continuar.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Si ya usaste Google con este email, no crees otra cuenta. Usa el mismo email al
                crear/iniciar sesion con contraseña para mantener tus datos.
              </p>
            </div>
          </div>

          <div className="mt-6 inline-flex w-full rounded-full border border-slate-700/70 bg-slate-900/70 p-1 text-sm">
            <button
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 rounded-full px-4 py-2 transition ${
                mode === "login"
                  ? "bg-slate-800 text-slate-50 shadow-[0_10px_24px_rgba(2,4,10,0.45)]"
                  : "text-slate-300 hover:text-slate-100"
              }`}
            >
              Iniciar sesion
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`flex-1 rounded-full px-4 py-2 transition ${
                mode === "signup"
                  ? "bg-slate-800 text-slate-50 shadow-[0_10px_24px_rgba(2,4,10,0.45)]"
                  : "text-slate-300 hover:text-slate-100"
              }`}
            >
              Registrarse
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-slate-400">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="mt-2 w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-600/70 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-slate-400">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="mt-2 w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-600/70 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            {mode === "login" && (
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  disabled={loading || faceIdLoading}
                  className="h-4 w-4 rounded border border-slate-700/70 bg-slate-900/60"
                />
                Recordarme en este dispositivo
              </label>
            )}

            {mode === "signup" && (
              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-slate-400">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="mt-2 w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-600/70 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            )}

            {hcaptchaSiteKey && (
              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-slate-400">
                  Verificacion
                </label>
                <div
                  ref={captchaRef}
                  className="mt-3 rounded-xl border border-slate-700/70 bg-slate-900/60 p-3"
                />
                {!captchaReady && (
                  <p className="mt-2 text-xs text-slate-500">Cargando captcha...</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Procesando..."
                : mode === "login"
                  ? "Iniciar sesion"
                  : "Registrarse"}
            </button>
            {mode === "login" && canUseFaceId && (
              <button
                type="button"
                onClick={handleFaceIdLogin}
                disabled={loading || faceIdLoading}
                className="w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {faceIdLoading ? "Validando Face ID..." : "Iniciar con Face ID (iOS)"}
              </button>
            )}
            {mode === "login" && isIOS && !canUseFaceId && (
              <p className="text-xs text-slate-500">
                Face ID no esta disponible en este navegador iOS.
              </p>
            )}
            {mode === "login" && (
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full text-xs uppercase tracking-[0.2em] text-slate-400 hover:text-slate-200"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-700/70" />
            <span>o</span>
            <div className="h-px flex-1 bg-slate-700/70" />
          </div>

          <button
            onClick={signInGoogle}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>G</span>
            Continuar con Google
          </button>

          <div className="mt-6 rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4 text-xs text-slate-300">
            <p className="text-sm font-semibold text-slate-100">Crear contraseña con tu email</p>
            <p className="mt-1 text-xs text-slate-400">
              Si ya entraste con Google, usa el mismo email y te enviaremos un enlace para crear
              contraseña.
            </p>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              className="mt-3 w-full rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Enviar enlace de contraseña
            </button>
            <a
              href="/auth/set-password"
              className="mt-3 block text-center text-xs uppercase tracking-[0.2em] text-slate-400 hover:text-slate-200"
            >
              Ya tengo sesion con Google
            </a>
          </div>

          {(error || queryError) && (
            <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              <p>
                <strong>Error:</strong> {error || queryError}
              </p>
              {queryError === "missing_code" && (
                <p className="mt-2 text-xs text-red-300">
                  El servidor no recibio un codigo de autorizacion de Google. Intenta de nuevo.
                </p>
              )}
            </div>
          )}

          {info && !(error || queryError) && (
            <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              {info}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
