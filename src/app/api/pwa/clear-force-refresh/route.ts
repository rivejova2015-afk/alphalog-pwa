import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient();
    const { data: userData, error: userError } = await authClient.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
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

    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason : "client_applied";

    const { error } = await supabase.rpc("clear_force_refresh", { reason });
    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to clear force refresh" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("PwaClearForceRefresh", { component: "pwa.clear-force-refresh", message: "Error in POST /api/pwa/clear-force-refresh:", error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
