// src/app/api/terminal/instruments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";

interface ErrorResponse {
  data: any[];
  meta: {
    missingTable?: boolean;
    error?: string;
    code?: string;
    isTemporary?: boolean;
  };
}

/**
 * GET /api/terminal/instruments
 * Returns all available instruments (global, read-only)
 *
 * Response behavior:
 * - 200: Normal response (data array + meta)
 * - 503: Temporary service error (retry recommended)
 * - 401: Unauthorized (check auth)
 * Note: Never returns 500 to allow graceful client handling
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("instruments")
      .select("*")
      .order("sort_index", { ascending: true });

    // Handle Supabase errors gracefully
    if (error) {
      // PGRST205: Table not found in schema cache (permanent until migration runs)
      if (error.code === "PGRST205") {
        logError("instruments_table_missing", {
          endpoint: "/api/terminal/instruments",
          code: "PGRST205",
          message: error.message,
          table: "public.instruments",
        });

        const response: ErrorResponse = {
          data: [],
          meta: {
            missingTable: true,
            error: "Database table not found",
            code: "PGRST205",
            isTemporary: false, // This is permanent until migration runs
          },
        };
        return NextResponse.json(response);
      }

      // 401/403: Auth errors (permanent for this request)
      if (error.code === "401" || error.code === "403") {
        logError("instruments_unauthorized", {
          endpoint: "/api/terminal/instruments",
          code: error.code,
          message: error.message,
        });

        const response: ErrorResponse = {
          data: [],
          meta: {
            error: "Unauthorized to access instruments",
            code: error.code,
            isTemporary: false,
          },
        };
        return NextResponse.json(response, { status: 401 });
      }

      // Other Supabase errors: treat as temporary (429, 5xx, network)
      logError("instruments_fetch_error", {
        endpoint: "/api/terminal/instruments",
        code: error.code,
        message: error.message,
      });

      const response: ErrorResponse = {
        data: [],
        meta: {
          error: "Temporary database error",
          code: error.code,
          isTemporary: true,
        },
      };
      return NextResponse.json(response, { status: 503 });
    }

    return NextResponse.json({
      data: data || [],
      meta: { error: null, isTemporary: false },
    }, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    logError("instruments_internal_error", {
      endpoint: "/api/terminal/instruments",
      message: errorMsg || "Unknown error",
      stack: errorStack,
    });

    await recordBugFromRequest(request, {
      userId: null,
      status: 503,
      error: err,
    });

    const response: ErrorResponse = {
      data: [],
      meta: {
        error: "Internal server error",
        isTemporary: true,
      },
    };
    return NextResponse.json(response, { status: 503 });
  }
}
