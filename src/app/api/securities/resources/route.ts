import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/server";
import { logError, logInfo } from "@/lib/log";

/**
 * GET /api/securities/resources?module=50&type=video
 * Obtiene recursos por módulo o tipo
 */
export async function GET(request: NextRequest) {
  try {
    const db = await createClient();
    const user = await getUser(db);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const moduleId = searchParams.get("module");
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    let query = db.from("securities_resources").select("*").limit(limit);

    if (moduleId) {
      query = query.eq("module_id", parseInt(moduleId, 10));
    }

    if (type) {
      query = query.eq("type", type);
    }

    const { data, error } = await query.order("rating", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        resources: data || [],
        count: data?.length || 0,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    logError("CyberSec", "Error fetching resources", {
      component: "api.securities.resources",
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to fetch resources" },
      { status: 500 }
    );
  }
}
