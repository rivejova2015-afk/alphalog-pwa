// src/app/auth/callback/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { logError, logInfo } from "@/lib/log";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const origin = url.origin;

  logInfo("AuthCallback", "incoming", {
    component: "auth.callback.request",
    href: url.toString(),
    code: code ? "present" : "MISSING",
    hash: url.hash,
    searchParams: Array.from(url.searchParams.entries()),
  });

  if (!code) {
    logError("AuthCallback", { component: "auth.callback.missingCode", message: "No code found in query params", payload: { hash: url.hash } });
    return NextResponse.redirect(`${origin}/auth?error=missing_code`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logError("AuthCallback", { component: "auth.callback.exchangeError", message: "exchangeCodeForSession error", error: error.message });
      return NextResponse.redirect(`${origin}/auth?error=${error.code}`);
    }
    logInfo("AuthCallback", "Session exchanged", { component: "auth.callback.exchanged", userEmail: data.user?.email });
  } catch (err) {
    logError("AuthCallback", { component: "auth.callback.unexpected", message: "Unexpected error during session exchange", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.redirect(`${origin}/auth?error=session_exchange_failed`);
  }

  return response;
}
