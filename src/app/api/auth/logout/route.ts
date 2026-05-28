/**
 * POST /api/auth/logout
 * 
 * Safely sign out and clear cookies.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logError } from "@/lib/log";

export async function POST() {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.signOut();

    if (error) {
      logError("Auth", { component: "auth.logout", message: error.message });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logError("Auth Logout", { component: "auth.logout", message: "Unexpected error:", error: error?.message || error instanceof Error ? error?.message || error.message : String(error?.message || error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
