/**
 * POST /api/auth/refresh
 * 
 * Safely refresh auth session and update cookies.
 * This is a Route Handler, so it CAN modify cookies.
 * 
 * Usage from client:
 *   await fetch('/api/auth/refresh', { method: 'POST' })
 */

import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { logError } from "@/lib/log";

export async function POST(request: NextRequest) {
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
            // SAFE: This is a Route Handler, we CAN modify cookies here
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Refresh the session
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      logError("Auth", { component: "auth.refresh", message: error.message });
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: data.user,
    });
  } catch (error: any) {
    logError("Auth Refresh", { component: "auth.refresh", message: "Unexpected error:", error: error?.message || error instanceof Error ? error?.message || error.message : String(error?.message || error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
