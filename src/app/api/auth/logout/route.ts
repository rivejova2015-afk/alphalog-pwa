/**
 * POST /api/auth/logout
 * 
 * Safely sign out and clear cookies.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";

export async function POST(request: Request) {
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

    // Capture the user before signOut so we can record who logged out.
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.auth.signOut();

    if (error) {
      logError("Auth", { component: "auth.logout", message: error.message });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (user) {
      await logAuditFromRequest(
        { userId: user.id, action: "logout", resourceType: "auth_session", status: "success" },
        request
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logError("Auth Logout", { component: "auth.logout", message: "Unexpected error:", error: error?.message || error instanceof Error ? error?.message || error.message : String(error?.message || error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
