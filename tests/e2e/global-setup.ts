import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export default async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Missing Supabase configuration for E2E global setup.");
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
  } else {
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError && createError.message !== "User already registered") {
      throw new Error(`E2E password user create failed: ${createError.message}`);
    }
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${baseUrl.replace(/\/$/, "")}/auth/callback`,
    },
  });

  if (linkError) {
    throw new Error(`E2E magic link error: ${linkError.message}`);
  }

  const properties = linkData?.properties || (linkData as any)?.properties || {};
  const actionLink = properties.action_link || (linkData as any)?.action_link;
  if (!actionLink) {
    throw new Error("E2E magic link missing action_link");
  }

  const actionUrl = new URL(actionLink);
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

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const verifyPayload = hashedToken
    ? ({ type: verificationType as "magiclink", token_hash: String(hashedToken) } as const)
    : ({ type: verificationType as "magiclink", token: String(emailOtp), email } as const);

  const { data, error } = await anon.auth.verifyOtp(verifyPayload);
  if (error || !data?.session) {
    throw new Error(`E2E verifyOtp failed: ${error?.message || "missing session"}`);
  }

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
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  const cookieUrl = /^https?:\/\//.test(baseUrl) ? baseUrl : "http://localhost:3000";
  const cookieHost = new URL(cookieUrl).hostname;
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

  const isHttp = cookieUrl.startsWith("http://");
  const cookies = cookieBuffer
    .filter(({ name, value }) => Boolean(name) && Boolean(value))
    .map(({ name, value, options }) => {
      const cookie: {
        name: string;
        value: string;
        domain: string;
        path: string;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: "Lax" | "Strict" | "None";
        expires?: number;
      } = { name, value, domain: cookieHost, path: "/" };

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
    .filter(
      (cookie): cookie is NonNullable<typeof cookie> =>
        Boolean(cookie && cookie.domain && cookie.path)
    );

  const storageStatePath = path.resolve(process.cwd(), "tests/e2e/.auth/state.json");
  fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });
  fs.writeFileSync(storageStatePath, JSON.stringify({ cookies, origins: [] }, null, 2));
}
