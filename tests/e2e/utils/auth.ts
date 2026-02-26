import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { Page } from "@playwright/test";

type CachedSession = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  expires_at?: number;
  user?: unknown;
};

type CookieBufferEntry = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

type AuthMode = "auto" | "password" | "magic";

function getBaseUrl() {
  return process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
}

function getCookieOrigin(baseURL: string) {
  try {
    const parsed = new URL(baseURL);
    return parsed.origin;
  } catch {
    return "http://localhost:3000";
  }
}

function isRemoteBaseUrl(baseURL: string) {
  try {
    const host = new URL(baseURL).hostname.toLowerCase();
    return !["localhost", "127.0.0.1", "::1"].includes(host);
  } catch {
    return false;
  }
}

function isStrongPassword(value: string) {
  return (
    value.length >= 12 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/.test(value)
  );
}

function isSessionValid(session: CachedSession | null) {
  if (!session?.access_token || !session.refresh_token) return false;
  if (!session.expires_at) return true;
  const now = Math.floor(Date.now() / 1000);
  return session.expires_at - now > 60;
}

function toEpochSeconds(value: unknown): number | undefined {
  if (!value) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
  }
  return undefined;
}

function normalizeSameSite(value?: string): "Lax" | "Strict" | "None" | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized === "lax") return "Lax";
  if (normalized === "strict") return "Strict";
  if (normalized === "none") return "None";
  return undefined;
}

function buildPlaywrightCookies(cookieBuffer: CookieBufferEntry[], baseURL: string) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const cookieUrl = getCookieOrigin(baseURL);
  const isHttp = cookieUrl.startsWith("http://");

  return cookieBuffer
    .filter(({ name, value }) => Boolean(name) && Boolean(value))
    .map(({ name, value, options }) => {
      const cookie: {
        name: string;
        value: string;
        url: string;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: "Lax" | "Strict" | "None";
        expires?: number;
      } = { name, value, url: cookieUrl };

      if (typeof options?.httpOnly === "boolean") cookie.httpOnly = options.httpOnly;
      if (typeof options?.secure === "boolean") cookie.secure = options.secure;

      const sameSite = normalizeSameSite(
        typeof options?.sameSite === "string" ? options.sameSite : undefined
      );
      if (sameSite) cookie.sameSite = sameSite;

      if (isHttp) {
        cookie.secure = false;
        if (cookie.sameSite === "None") cookie.sameSite = "Lax";
      }

      const maxAgeValue =
        typeof options?.maxAge === "number" ? options.maxAge : Number(options?.maxAge);
      if (Number.isFinite(maxAgeValue)) {
        if (maxAgeValue <= 0) return null;
        cookie.expires = nowSeconds + Number(maxAgeValue);
      } else {
        const expires = toEpochSeconds(options?.expires);
        if (expires && expires > nowSeconds) cookie.expires = expires;
      }

      return cookie;
    })
    .filter((cookie): cookie is NonNullable<typeof cookie> => Boolean(cookie?.url));
}

function resolveAuthMode(baseURL: string) {
  const remote = isRemoteBaseUrl(baseURL);
  const requested = (process.env.E2E_AUTH_MODE || "").toLowerCase();
  const authMode: AuthMode =
    requested === "password" || requested === "magic" || requested === "auto"
      ? requested
      : remote
        ? "password"
        : "auto";

  const allowMagicByMode = authMode === "magic" || (authMode === "auto" && !remote);
  const allowMagicByFlag = process.env.E2E_ALLOW_MAGIC_LINK === "1";
  return {
    remote,
    authMode,
    allowMagicLink: allowMagicByMode || allowMagicByFlag,
  };
}

async function ensurePasswordUser(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  email: string;
  password: string;
}) {
  const { supabaseUrl, serviceRoleKey, email, password } = params;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let existingUserId: string | null = null;
  try {
    const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const matchedUser = listData?.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase());
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
}

async function tryPasswordLogin(params: {
  supabaseUrl: string;
  anonKey: string;
  email: string;
  password: string;
}) {
  const { supabaseUrl, anonKey, email, password } = params;
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data?.session) {
    return { error };
  }
  return { session: data.session };
}

async function tryMagicLinkLogin(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  anonKey: string;
  email: string;
  baseURL: string;
}) {
  const { supabaseUrl, serviceRoleKey, anonKey, email, baseURL } = params;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${baseURL.replace(/\/$/, "")}/auth`,
    },
  });

  if (error) {
    throw new Error(`E2E magic link error: ${error.message}`);
  }

  const properties = data?.properties || (data as Record<string, unknown>)?.properties || {};
  const actionLink =
    (properties as Record<string, unknown>)?.action_link ||
    (data as Record<string, unknown>)?.action_link;

  if (typeof actionLink !== "string" || actionLink.length === 0) {
    throw new Error("E2E magic link missing action_link");
  }

  const actionUrl = new URL(actionLink);
  const emailOtp =
    actionUrl.searchParams.get("token") ||
    (typeof (properties as Record<string, unknown>).email_otp === "string"
      ? (properties as Record<string, string>).email_otp.trim()
      : undefined);
  const hashedToken =
    (typeof (properties as Record<string, unknown>).hashed_token === "string"
      ? (properties as Record<string, string>).hashed_token.trim()
      : undefined) || actionUrl.searchParams.get("token_hash");
  const verificationType =
    typeof (properties as Record<string, unknown>).verification_type === "string" &&
    String((properties as Record<string, unknown>).verification_type).length > 0
      ? String((properties as Record<string, unknown>).verification_type)
      : "magiclink";

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (emailOtp || hashedToken) {
    const verifyPayload = hashedToken
      ? ({ type: verificationType as "magiclink", token_hash: String(hashedToken) } as const)
      : ({ type: verificationType as "magiclink", token: String(emailOtp), email } as const);

    const { data: verifyData, error: verifyError } = await anon.auth.verifyOtp(verifyPayload);
    if (!verifyError && verifyData?.session) {
      return verifyData.session;
    }

    if (verifyError) {
      console.warn("[E2E] verifyOtp error:", verifyError.message);
      const fallbackType = verificationType === "magiclink" ? "email" : "magiclink";
      const fallbackPayload = hashedToken
        ? ({ type: fallbackType, token_hash: String(hashedToken) } as const)
        : ({ type: fallbackType, token: String(emailOtp), email } as const);

      const { data: fallbackData, error: fallbackError } = await anon.auth.verifyOtp(fallbackPayload);
      if (!fallbackError && fallbackData?.session) {
        return fallbackData.session;
      }
      if (fallbackError) {
        console.warn("[E2E] verifyOtp fallback error:", fallbackError.message);
      }
    }
  }

  const verificationResponse = await fetch(actionLink, { redirect: "manual" });
  const location = verificationResponse.headers.get("location") || verificationResponse.headers.get("Location");
  const redirectUrl = location ? new URL(location, baseURL) : new URL(actionLink);
  const hashParams = new URLSearchParams(redirectUrl.hash.replace(/^#/, ""));

  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  const expiresInRaw = hashParams.get("expires_in");
  const tokenType = hashParams.get("token_type") || "bearer";
  if (accessToken && refreshToken) {
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: tokenType,
      expires_in: Number(expiresInRaw || "3600"),
      expires_at: undefined,
      user: null,
    };
  }

  const codeToExchange = redirectUrl.searchParams.get("code") || actionUrl.searchParams.get("code");
  if (codeToExchange) {
    const { data: exchangeData, error: exchangeError } = await anon.auth.exchangeCodeForSession(codeToExchange);
    if (!exchangeError && exchangeData?.session) {
      return exchangeData.session;
    }
    throw new Error(`E2E magic link exchange failed: ${exchangeError?.message || "unknown error"}`);
  }

  throw new Error("E2E magic link verification missing session tokens");
}

async function setSessionInBrowser(params: {
  page: Page;
  baseURL: string;
  supabaseUrl: string;
  anonKey: string;
  session: CachedSession;
}) {
  const { page, baseURL, supabaseUrl, anonKey, session } = params;
  const cookieBuffer: CookieBufferEntry[] = [];
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

  const cookiesToSet = buildPlaywrightCookies(cookieBuffer, baseURL);
  if (cookiesToSet.length === 0) {
    console.warn("[E2E] No auth cookies were generated by createServerClient.setSession.");
    return;
  }

  await page.context().clearCookies();
  await page.context().addCookies(cookiesToSet);
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
  const password = isStrongPassword(rawPassword) ? rawPassword : "Test@123456!";
  const baseURL = getBaseUrl();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mode = resolveAuthMode(baseURL);

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
  const navigateToDashboard = async () => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 20000 });
  };

  if (process.env.E2E_FORCE_UI_LOGIN === "1") {
    if (!supabaseUrl || !anonKey) {
      throw new Error("E2E UI login requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    }
    if (serviceRoleKey) {
      await ensurePasswordUser({ supabaseUrl, serviceRoleKey, email, password });
    }
    await loginWithUi();
    return;
  }

  if (!supabaseUrl || !anonKey) {
    throw new Error("E2E login failed: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

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

  if (isSessionValid(globalState[globalKey]?.session || null)) {
    await setSessionInBrowser({
      page,
      baseURL,
      supabaseUrl,
      anonKey,
      session: globalState[globalKey]!.session!,
    });
    try {
      await navigateToDashboard();
    } catch {
      await loginWithUi();
    }
    return;
  }

  if (globalState[globalKey]?.inFlight) {
    const session = await globalState[globalKey]!.inFlight!;
    await setSessionInBrowser({ page, baseURL, supabaseUrl, anonKey, session });
    try {
      await navigateToDashboard();
    } catch {
      await loginWithUi();
    }
    return;
  }

  globalState[globalKey]!.inFlight = (async (): Promise<CachedSession> => {
    if (serviceRoleKey) {
      await ensurePasswordUser({ supabaseUrl, serviceRoleKey, email, password });
    }

    const passwordResult = await tryPasswordLogin({ supabaseUrl, anonKey, email, password });
    if (passwordResult?.session) {
      return {
        access_token: passwordResult.session.access_token,
        refresh_token: passwordResult.session.refresh_token,
        token_type: passwordResult.session.token_type,
        expires_in: passwordResult.session.expires_in,
        expires_at: passwordResult.session.expires_at,
        user: passwordResult.session.user,
      };
    }

    if (serviceRoleKey) {
      const retryResult = await tryPasswordLogin({ supabaseUrl, anonKey, email, password });
      if (retryResult?.session) {
        return {
          access_token: retryResult.session.access_token,
          refresh_token: retryResult.session.refresh_token,
          token_type: retryResult.session.token_type,
          expires_in: retryResult.session.expires_in,
          expires_at: retryResult.session.expires_at,
          user: retryResult.session.user,
        };
      }
    }

    if (!mode.allowMagicLink) {
      const errorMessage = passwordResult?.error?.message || "password login failed";
      throw new Error(
        `E2E password login failed (${errorMessage}). Magic-link fallback disabled for auth mode "${mode.authMode}" on ${mode.remote ? "remote" : "local"} base URL.`
      );
    }

    if (!serviceRoleKey) {
      throw new Error("E2E magic-link fallback requires SUPABASE_SERVICE_ROLE_KEY.");
    }

    const magicSession = await tryMagicLinkLogin({
      supabaseUrl,
      serviceRoleKey,
      anonKey,
      email,
      baseURL,
    });

    return {
      access_token: magicSession.access_token,
      refresh_token: magicSession.refresh_token,
      token_type: magicSession.token_type,
      expires_in: magicSession.expires_in,
      expires_at: magicSession.expires_at,
      user: magicSession.user,
    };
  })();

  let resolvedSession: CachedSession;
  try {
    resolvedSession = await globalState[globalKey]!.inFlight!;
  } catch (error) {
    globalState[globalKey]!.inFlight = null;
    throw error;
  }

  globalState[globalKey]!.session = resolvedSession;
  globalState[globalKey]!.inFlight = null;

  await setSessionInBrowser({ page, baseURL, supabaseUrl, anonKey, session: resolvedSession });
  try {
    await navigateToDashboard();
  } catch {
    await loginWithUi();
  }
}
