// src/app/auth/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

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
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
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
    if (requestedMode === "signup") {
      setMode("signup");
    } else if (requestedMode === "login") {
      setMode("login");
    }
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

  const signInGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      console.log("[Auth] Redirecting to Google OAuth with redirectTo:", redirectTo);

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
      console.error("[Auth] Google OAuth error:", err);
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
          // Redirect to dashboard
          window.location.href = "/dashboard";
        }
      }
      if (window.hcaptcha && captchaWidgetId !== null) {
        window.hcaptcha.reset(captchaWidgetId);
        setCaptchaToken(null);
      }
    } catch (err) {
      console.error("[Auth] Email auth error:", err);
      setError(err instanceof Error ? err.message : "Error al autenticarse");
    } finally {
      setLoading(false);
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
    <main className="relative min-h-screen overflow-hidden px-6 py-12 text-slate-200">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 translate-x-1/3 rounded-full bg-cyan-600/10 blur-3xl" />

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

            {hcaptchaSiteKey ? (
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
            ) : (
              <p className="text-xs text-amber-300">
                Falta configurar hCaptcha (NEXT_PUBLIC_HCAPTCHA_SITE_KEY).
              </p>
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
