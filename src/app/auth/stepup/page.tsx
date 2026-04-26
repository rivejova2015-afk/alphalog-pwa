"use client";

import { useEffect, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";

type Stage = "loading" | "totp" | "webauthn" | "enroll-totp" | "error" | "done";

interface TotpFactor {
  id: string;
  friendly_name?: string;
}

export default function StepUpPage() {
  const [stage, setStage] = useState<Stage>("loading");
  const [error, setError] = useState<string | null>(null);
  const [totpFactors, setTotpFactors] = useState<TotpFactor[]>([]);
  const [selectedFactor, setSelectedFactor] = useState<string>("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [enrollData, setEnrollData] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [enrollCode, setEnrollCode] = useState("");

  const getNext = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("next") || "/dashboard";
  };

  useEffect(() => {
    const init = async () => {
      // Check TOTP factors
      const mfaRes = await fetch("/api/auth/mfa");
      if (mfaRes.ok) {
        const { factors } = await mfaRes.json();
        if (factors && factors.length > 0) {
          setTotpFactors(factors);
          setSelectedFactor(factors[0].id);
          setStage("totp");
          return;
        }
      }

      // Check WebAuthn credentials
      const wnRes = await fetch("/api/auth/webauthn/auth-options", {
        method: "POST",
      });
      if (wnRes.ok) {
        const options = await wnRes.json();
        if (options.allowCredentials && options.allowCredentials.length > 0) {
          setStage("webauthn");
          handleWebAuthn(options);
          return;
        }
      }

      // No MFA enrolled — fall back to device verify
      const deviceRes = await fetch("/api/auth/device/verify", {
        method: "POST",
      });
      if (deviceRes.ok) {
        window.location.href = getNext();
      } else {
        setStage("enroll-totp");
      }
    };

    init().catch(() => setStage("error"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWebAuthn = async (options: unknown) => {
    try {
      const assertion = await startAuthentication({
        optionsJSON: options as Parameters<typeof startAuthentication>[0]["optionsJSON"],
      });
      const res = await fetch("/api/auth/webauthn/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      });
      if (res.ok) {
        window.location.href = getNext();
      } else {
        setError("Autenticacion con passkey fallida.");
        setStage("error");
      }
    } catch {
      setError("Passkey cancelada o no disponible.");
      setStage("error");
    }
  };

  const handleTotpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId: selectedFactor, code }),
      });
      if (res.ok) {
        window.location.href = getNext();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Código incorrecto.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEnroll = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/mfa", { method: "POST" });
      if (!res.ok) throw new Error("Enroll failed");
      const data = await res.json();
      setEnrollData({ factorId: data.factorId, qrCode: data.qrCode, secret: data.secret });
    } catch {
      setError("No se pudo iniciar el enrolamiento.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnrollVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollData) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId: enrollData.factorId, code: enrollCode }),
      });
      if (res.ok) {
        window.location.href = getNext();
      } else {
        setError("Código incorrecto. Verifica la app autenticadora.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === "loading" || stage === "webauthn") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔐</div>
          <p className="text-slate-300">
            {stage === "webauthn" ? "Esperando passkey..." : "Verificando..."}
          </p>
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-400 mb-4">{error ?? "Error de verificación."}</p>
          <a href="/auth" className="text-sky-400 underline text-sm">
            Volver al login
          </a>
        </div>
      </div>
    );
  }

  if (stage === "totp") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 rounded-xl p-6 border border-slate-800">
          <div className="text-3xl mb-4 text-center">🔑</div>
          <h1 className="text-lg font-semibold text-center mb-1">
            Verificación en dos pasos
          </h1>
          <p className="text-slate-400 text-sm text-center mb-6">
            Ingresa el código de tu app autenticadora
          </p>
          <form onSubmit={handleTotpVerify} className="space-y-4">
            {totpFactors.length > 1 && (
              <select
                value={selectedFactor}
                onChange={(e) => setSelectedFactor(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
              >
                {totpFactors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.friendly_name ?? f.id}
                  </option>
                ))}
              </select>
            )}
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-center text-2xl tracking-widest font-mono"
              autoFocus
              autoComplete="one-time-code"
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2 transition-colors"
            >
              {submitting ? "Verificando..." : "Verificar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (stage === "enroll-totp") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 rounded-xl p-6 border border-slate-800">
          <div className="text-3xl mb-4 text-center">🛡️</div>
          <h1 className="text-lg font-semibold text-center mb-1">
            Configura 2FA
          </h1>
          <p className="text-slate-400 text-sm text-center mb-6">
            Protege tu cuenta con un autenticador TOTP
          </p>
          {!enrollData ? (
            <button
              onClick={handleStartEnroll}
              disabled={submitting}
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium rounded-lg py-2 transition-colors"
            >
              {submitting ? "Generando QR..." : "Activar autenticador"}
            </button>
          ) : (
            <form onSubmit={handleEnrollVerify} className="space-y-4">
              <p className="text-slate-400 text-sm text-center">
                Escanea el código QR con Google Authenticator o Authy
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enrollData.qrCode}
                alt="QR Code"
                className="mx-auto w-48 h-48 rounded-lg"
              />
              <p className="text-slate-500 text-xs text-center break-all">
                Clave manual: {enrollData.secret}
              </p>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="Código de verificación"
                value={enrollCode}
                onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-center text-2xl tracking-widest font-mono"
                autoFocus
                autoComplete="one-time-code"
              />
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button
                type="submit"
                disabled={submitting || enrollCode.length !== 6}
                className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium rounded-lg py-2 transition-colors"
              >
                {submitting ? "Verificando..." : "Confirmar y activar"}
              </button>
            </form>
          )}
          <button
            onClick={() => (window.location.href = getNext())}
            className="w-full mt-3 text-slate-500 text-sm hover:text-slate-300 transition-colors"
          >
            Omitir por ahora
          </button>
        </div>
      </div>
    );
  }

  return null;
}
