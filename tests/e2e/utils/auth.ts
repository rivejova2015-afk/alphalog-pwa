import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { Page } from "@playwright/test";

function getBaseUrl() {
  return process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
}

export async function login(page: Page) {
  try {
    await page.goto("/dashboard");
    await page.waitForURL(/\/(dashboard|auth)(\/|$)/, { timeout: 5000 });
    if (/\/dashboard(\/|$)/.test(page.url())) {
      return;
    }
  } catch {
    // Continue with full login flow
  }

  const email = process.env.E2E_EMAIL || "test@alphalog.local";
  const rawPassword = process.env.E2E_PASSWORD || "Test@123456!";
  const isStrongPassword = (value: string) => {
    return (
      value.length >= 12 &&
      /[a-z]/.test(value) &&
      /[A-Z]/.test(value) &&
      /[0-9]/.test(value) &&
      /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/.test(value)
    );
  };
  const password = isStrongPassword(rawPassword) ? rawPassword : "Test@123456!";
  const baseURL = getBaseUrl();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const baseUrlObject = new URL(baseURL);

  const loginWithUi = async () => {
    await page.goto("/auth");
    await page.waitForLoadState("domcontentloaded");

    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    await emailInput.fill(email);

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill(password);

    const submitButton = page.locator(
      'button[type="submit"]:has-text("Sign In"), button[type="submit"]:has-text("Login"), button[type="submit"]'
    );
    await submitButton.first().click();

    const errorAlert = page.locator('div:has-text("Error:")');

    await Promise.race([
      page.waitForURL(/\/dashboard(\/|$)/, { timeout: 20000 }),
      errorAlert.first().waitFor({ state: "visible", timeout: 20000 }),
    ]);

    if (await errorAlert.first().isVisible().catch(() => false)) {
      const errorText = (await errorAlert.first().textContent().catch(() => null))?.trim();
      throw new Error(`E2E UI login failed: ${errorText || "unknown error"}`);
    }
  };

  type CachedSession = {
    access_token: string;
    refresh_token: string;
    token_type?: string;
    expires_in?: number;
    expires_at?: number;
    user?: unknown;
  };

  const globalKey = "__alphalog_e2e_session_cache__" as const;
  const globalState = globalThis as typeof globalThis & {
    [globalKey]?: {
      session: CachedSession | null;
      inFlight: Promise<CachedSession> | null;
    };
  };

  if (!globalState[globalKey]) {
    globalState[globalKey] = { session: null, inFlight: null };
  }

  const isSessionValid = (session: CachedSession | null) => {
    if (!session?.access_token || !session.refresh_token) return false;
    if (!session.expires_at) return true;
    const now = Math.floor(Date.now() / 1000);
    return session.expires_at - now > 60;
  };

  const setSessionInBrowser = async (session: {
    access_token: string;
    refresh_token: string;
    token_type?: string;
    expires_in?: number;
    expires_at?: number;
    user?: unknown;
  }) => {
    if (!supabaseUrl || !anonKey) return;
    const cookieBuffer: Array<{ name: string; value: string; options?: Record<string, any> }> = [];
    const serverClient = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return cookieBuffer.map(({ name, value, options }) => ({ name, value, options }));
        },
        setAll(cookiesToSet) {
          cookieBuffer.splice(0, cookieBuffer.length, ...cookiesToSet);
        },
      },
    });

    await serverClient.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    await page.context().clearCookies();
    const rawCookieUrl = baseUrlObject.origin || baseURL;
    const cookieUrl = /^https?:\/\//.test(rawCookieUrl) ? rawCookieUrl : "http://localhost:3000";
    const isHttp = cookieUrl.startsWith("http://");
    const nowSeconds = Math.floor(Date.now() / 1000);
    const normalizeSameSite = (value?: string) => {
      if (!value) return undefined;
      const normalized = value.toLowerCase();
      if (normalized === "lax") return "Lax" as const;
      if (normalized === "strict") return "Strict" as const;
      if (normalized === "none") return "None" as const;
      return undefined;
    };
    const toEpochSeconds = (value: unknown): number | undefined => {
      if (!value) return undefined;
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (value instanceof Date) return Math.floor(value.getTime() / 1000);
      if (typeof value === "string") {
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
      }
      return undefined;
    };

    const cookiesToSet = cookieBuffer
      .filter(({ name, value }) => Boolean(name) && Boolean(value))
      .map(({ name, value, options }) => {
        const cookie: {
          name: string;
          value: string;
          url?: string;
          domain?: string;
          path?: string;
          httpOnly?: boolean;
          secure?: boolean;
          sameSite?: "Lax" | "Strict" | "None";
          expires?: number;
        } = { name, value, url: cookieUrl };

        if (options?.path) cookie.path = String(options.path);
        if (typeof options?.httpOnly === "boolean") cookie.httpOnly = options.httpOnly;
        if (typeof options?.secure === "boolean") cookie.secure = options.secure;
        const sameSite = normalizeSameSite(options?.sameSite);
        if (sameSite) cookie.sameSite = sameSite;

        if (isHttp) {
          cookie.secure = false;
          if (cookie.sameSite === "None") cookie.sameSite = "Lax";
        }

        const maxAge = typeof options?.maxAge === "number" ? options.maxAge : Number(options?.maxAge);
        if (Number.isFinite(maxAge)) {
          if (maxAge > 0) cookie.expires = nowSeconds + maxAge;
          else return null;
        } else {
          const expires = toEpochSeconds(options?.expires);
          if (expires && expires > 0) cookie.expires = expires;
        }

        return cookie;
      })
      .filter((cookie): cookie is NonNullable<typeof cookie> => Boolean(cookie && cookie.url));

    await page.context().addCookies(cookiesToSet);
  };

  const tryPasswordLogin = async () => {
    if (!supabaseUrl || !anonKey) return null;
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data?.session) {
      return { error };
    }
    return { session: data.session };
  };

  const ensurePasswordUser = async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let existingUserId: string | null = null;
    try {
      const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const matchedUser = listData?.users?.find(
        (user) => user.email?.toLowerCase() === email.toLowerCase()
      );
      existingUserId = matchedUser?.id ?? null;
    } catch {
      existingUserId = null;
    }

    if (existingUserId) {
      const { error: updateError } = await admin.auth.admin.updateUserById(existingUserId, {
        password,
        email_confirm: true,
      });
      if (updateError) {
        throw new Error(`E2E password user update failed: ${updateError.message}`);
      }
      return;
    }

    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError && createError.message !== "User already registered") {
      throw new Error(`E2E password user create failed: ${createError.message}`);
    }
  };

  if (process.env.E2E_FORCE_UI_LOGIN === "1") {
    if (supabaseUrl && serviceRoleKey) {
      await ensurePasswordUser();
    }
    await loginWithUi();
    return;
  }

  if (isSessionValid(globalState[globalKey]?.session || null)) {
    const session = globalState[globalKey]!.session!;
    await setSessionInBrowser(session);
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 20000 });
    return;
  }

  if (globalState[globalKey]?.inFlight) {
    const session = await globalState[globalKey]!.inFlight!;
    await setSessionInBrowser(session);
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 20000 });
    return;
  }

  globalState[globalKey]!.inFlight = (async (): Promise<CachedSession> => {
    if (supabaseUrl && serviceRoleKey) {
      await ensurePasswordUser();
    }

    const passwordSession = await tryPasswordLogin();
    if (passwordSession?.session) {
      return {
        access_token: passwordSession.session.access_token,
        refresh_token: passwordSession.session.refresh_token,
        token_type: passwordSession.session.token_type,
        expires_in: passwordSession.session.expires_in,
        expires_at: passwordSession.session.expires_at,
        user: passwordSession.session.user,
      };
    }

    if (passwordSession?.error && supabaseUrl && serviceRoleKey && anonKey) {
      const retrySession = await tryPasswordLogin();
      if (retrySession?.session) {
        return {
          access_token: retrySession.session.access_token,
          refresh_token: retrySession.session.refresh_token,
          token_type: retrySession.session.token_type,
          expires_in: retrySession.session.expires_in,
          expires_at: retrySession.session.expires_at,
          user: retrySession.session.user,
        };
      }
    }

    const shouldAttemptMagicLink = Boolean(supabaseUrl && serviceRoleKey);
    if (!shouldAttemptMagicLink) {
      throw new Error("E2E login failed: missing Supabase auth configuration or session tokens.");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${baseURL}/auth`,
      },
    });

    if (error) {
      throw new Error(`E2E magic link error: ${error.message}`);
    }

    const properties = data?.properties || (data as any)?.properties || {};
    const actionLink = properties.action_link || (data as any)?.action_link;
    if (!actionLink) {
      throw new Error("E2E magic link missing action_link");
    }
    const actionUrl = new URL(actionLink);
    console.log("[E2E] Magic link properties keys:", Object.keys(properties || {}));
    console.log(
      "[E2E] Magic link action params present:",
      JSON.stringify({
        token: actionUrl.searchParams.has("token"),
        tokenHash: actionUrl.searchParams.has("token_hash"),
      })
    );


    const emailOtp =
      actionUrl.searchParams.get("token") ||
      (typeof properties.email_otp === "string" ? properties.email_otp.trim() : undefined);
    const hashedToken =
      (typeof properties.hashed_token === "string" ? properties.hashed_token.trim() : undefined) ||
      actionUrl.searchParams.get("token_hash");
    const verificationType =
      typeof properties.verification_type === "string" && properties.verification_type.length > 0
        ? properties.verification_type
        : "magiclink";
    if ((emailOtp || hashedToken) && anonKey) {
      const anon = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const tokenValue = emailOtp ? String(emailOtp) : undefined;
      const tokenHashValue = !tokenValue && hashedToken ? String(hashedToken) : undefined;

      const verifyPayload = tokenHashValue
        ? ({ type: verificationType as "magiclink", token_hash: tokenHashValue } as const)
        : ({ type: verificationType as "magiclink", token: tokenValue, email } as const);

      const { data: verifyData, error: verifyError } = await anon.auth.verifyOtp(verifyPayload);

      if (!verifyError && verifyData?.session) {
        return {
          access_token: verifyData.session.access_token,
          refresh_token: verifyData.session.refresh_token,
          token_type: verifyData.session.token_type,
          expires_in: verifyData.session.expires_in,
          expires_at: verifyData.session.expires_at,
          user: verifyData.session.user,
        };
      }

      if (verifyError) {
        console.warn("[E2E] verifyOtp error:", verifyError.message);
        const fallbackType = verificationType === "magiclink" ? "email" : "magiclink";
        const fallbackPayload = tokenHashValue
          ? ({ type: fallbackType, token_hash: tokenHashValue } as const)
          : ({ type: fallbackType, token: tokenValue, email } as const);

        const { data: fallbackData, error: fallbackError } = await anon.auth.verifyOtp(
          fallbackPayload
        );

        if (!fallbackError && fallbackData?.session) {
          return {
            access_token: fallbackData.session.access_token,
            refresh_token: fallbackData.session.refresh_token,
            token_type: fallbackData.session.token_type,
            expires_in: fallbackData.session.expires_in,
            expires_at: fallbackData.session.expires_at,
            user: fallbackData.session.user,
          };
        }

        if (fallbackError) {
          console.warn("[E2E] verifyOtp fallback error:", fallbackError.message);
        }
      }
    }

    const verificationResponse = await fetch(actionLink, { redirect: "manual" });
    const location =
      verificationResponse.headers.get("location") ||
      verificationResponse.headers.get("Location");

    const redirectUrl = location
      ? new URL(location, baseURL)
      : new URL(actionLink);
    const hashParams = new URLSearchParams(redirectUrl.hash.replace(/^#/, ""));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const expiresInRaw = hashParams.get("expires_in");
    const tokenType = hashParams.get("token_type") || "bearer";
    const code = redirectUrl.searchParams.get("code");

    console.log(
      "[E2E] Magic link tokens present:",
      JSON.stringify({
        code: Boolean(code),
        accessToken: Boolean(accessToken),
        refreshToken: Boolean(refreshToken),
        emailOtp: Boolean(emailOtp),
        hashedToken: Boolean(hashedToken),
      })
    );

    if (accessToken && refreshToken) {
      const expiresIn = Number(expiresInRaw || "3600");
      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: tokenType,
        expires_in: expiresIn,
        user: null,
      };
    }

    const actionCode = actionUrl.searchParams.get("code");
    const codeToExchange = code || actionCode;

    if (codeToExchange && anonKey) {
      const anon = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: exchangeData, error: exchangeError } = await anon.auth.exchangeCodeForSession(
        codeToExchange
      );

      if (exchangeError || !exchangeData?.session) {
        throw new Error(`E2E magic link exchange failed: ${exchangeError?.message || "unknown error"}`);
      }

      return {
        access_token: exchangeData.session.access_token,
        refresh_token: exchangeData.session.refresh_token,
        token_type: exchangeData.session.token_type,
        expires_in: exchangeData.session.expires_in,
        expires_at: exchangeData.session.expires_at,
        user: exchangeData.session.user,
      };
    }

    throw new Error("E2E magic link verification missing session tokens");
  })();

  const resolvedSession = await globalState[globalKey]!.inFlight!;
  globalState[globalKey]!.session = resolvedSession;
  globalState[globalKey]!.inFlight = null;

  await setSessionInBrowser(resolvedSession);
  await page.goto("/dashboard");
  await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 20000 });
  return;
}
