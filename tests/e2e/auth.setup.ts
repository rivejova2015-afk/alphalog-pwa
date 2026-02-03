import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import fs from "fs";
import path from "path";

const storageStatePath = path.resolve(process.cwd(), "tests/e2e/.auth/state.json");

test("setup auth state", async ({ page }) => {
  const email = process.env.E2E_EMAIL || "test@alphalog.local";
  const rawPassword = process.env.E2E_PASSWORD || "Test@123456!";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
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

  if (supabaseUrl && serviceRoleKey) {
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
  } else {
    throw new Error("Missing Supabase admin configuration for E2E auth setup.");
  }

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("Missing Supabase configuration for E2E auth setup.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${baseUrl.replace(/\/$/, "")}/auth/callback`,
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

  const { data: verifyData, error: verifyError } = await anon.auth.verifyOtp(verifyPayload);

  if (verifyError || !verifyData?.session) {
    throw new Error(`E2E verifyOtp failed: ${verifyError?.message || "missing session"}`);
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
    access_token: verifyData.session.access_token,
    refresh_token: verifyData.session.refresh_token,
  });

  await page.context().clearCookies();
  const cookieUrl = /^https?:\/\//.test(baseUrl) ? baseUrl : "http://localhost:3000";
  const cookiesToSet = cookieBuffer
    .filter(({ name, value }) => Boolean(name) && Boolean(value))
    .map(({ name, value }) => ({ name, value, url: cookieUrl }))
    .filter((cookie) => Boolean(cookie.url));

  await page.context().addCookies(cookiesToSet);

  await page.goto("/dashboard");
  await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 20000 });

  await expect(page).toHaveURL(/\/dashboard(\/|$)/);

  fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });
  await page.context().storageState({ path: storageStatePath });
});
