// src/app/auth/callback/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const origin = url.origin;

  console.log("[Callback] URL:", url.toString());
  console.log("[Callback] Code:", code ? "present" : "MISSING");
  console.log("[Callback] Hash:", url.hash);
  console.log("[Callback] SearchParams:", Array.from(url.searchParams.entries()));

  if (!code) {
    console.error("[Callback] ERROR: No code found in query params. Hash:", url.hash);
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
      console.error("[Callback] exchangeCodeForSession error:", error);
      return NextResponse.redirect(`${origin}/auth?error=${error.code}`);
    }
    console.log("[Callback] Session exchanged successfully for user:", data.user?.email);
  } catch (err) {
    console.error("[Callback] Unexpected error during session exchange:", err);
    return NextResponse.redirect(`${origin}/auth?error=session_exchange_failed`);
  }

  return response;
}
