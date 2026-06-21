// Password policy (audit 2026-06, Área 1).
//
// This is CLIENT-SIDE feedback only. The authoritative, server-side enforcement
// — minimum length + breached-password (HaveIBeenPwned) protection — is
// configured in Supabase Auth settings (signUp/updateUser go straight to
// Supabase from the browser, so Supabase is the real gate).
//
// NIST 800-63B guidance: favor length over forced character-class complexity,
// and reject known-breached passwords (handled by Supabase's HIBP integration).

export const MIN_PASSWORD_LENGTH = 12;

export function validatePassword(password: string): { ok: boolean; error?: string } {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
    };
  }
  return { ok: true };
}
