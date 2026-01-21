// src/app/auth/page.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  
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
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();

      if (mode === 'signup') {
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
        });

        if (err) {
          setError(err.message);
        } else {
          // Redirect to dashboard
          window.location.href = "/dashboard";
        }
      }
    } catch (err) {
      console.error("[Auth] Email auth error:", err);
      setError(err instanceof Error ? err.message : "Error al autenticarse");
    } finally {
      setLoading(false);
    }
  };

  // Detecta error en params (ej. ?error=missing_code)
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const queryError = searchParams.get("error");

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Iniciar sesión - AlphaLog</h1>
      <p style={{ marginBottom: 24 }}>Usa Google, email o contraseña para acceder</p>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid #e5e7eb' }}>
        <button
          onClick={() => {
            setMode('login');
            setError(null);
          }}
          style={{
            padding: '12px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: mode === 'login' ? 'bold' : 'normal',
            borderBottom: mode === 'login' ? '2px solid #2563eb' : 'none',
            color: mode === 'login' ? '#2563eb' : '#666',
          }}
        >
          Iniciar Sesión
        </button>
        <button
          onClick={() => {
            setMode('signup');
            setError(null);
          }}
          style={{
            padding: '12px 16px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: mode === 'signup' ? 'bold' : 'normal',
            borderBottom: mode === 'signup' ? '2px solid #2563eb' : 'none',
            color: mode === 'signup' ? '#2563eb' : '#666',
          }}
        >
          Registrarse
        </button>
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleEmailAuth} style={{ marginBottom: 24, maxWidth: 400 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {mode === 'signup' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              Confirmar Contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#1f2937',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            fontWeight: 500,
          }}
        >
          {loading 
            ? 'Procesando...' 
            : mode === 'login' 
              ? 'Iniciar Sesión' 
              : 'Registrarse'
          }
        </button>
      </form>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
        <span style={{ color: '#999' }}>O</span>
        <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
      </div>

      {/* Google OAuth */}
      <button 
        onClick={signInGoogle} 
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: '#fff',
          color: '#1f2937',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          fontWeight: 500,
        }}
      >
        🔗 Continuar con Google
      </button>

      {/* Errors */}
      {(error || queryError) && (
        <div style={{ marginTop: 16, padding: 12, backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: "4px" }}>
          <p><strong>Error:</strong> {error || queryError}</p>
          {queryError === "missing_code" && (
            <p style={{ fontSize: "12px", marginTop: 8 }}>
              El servidor no recibió un código de autorización de Google. Intenta de nuevo.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
