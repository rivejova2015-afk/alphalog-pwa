import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "log_attachments";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// GET /api/securities/cybersec/library/signed-url?id=<upload_id>
// URL firmada (120s) para descargar/abrir el PDF propio.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = request.nextUrl.searchParams.get("id");
    if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const { data: row, error } = await supabase
      .from("securities_library_uploads")
      .select("storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      logError("Securities", { component: "GET library signed-url", message: error.message });
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
    if (!row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, 120);
    if (signErr || !signed) {
      logError("Securities", { component: "GET library signed-url", message: signErr?.message ?? "no url" });
      return NextResponse.json({ error: "No se pudo generar el enlace" }, { status: 500 });
    }
    return NextResponse.json({ url: signed.signedUrl });
  } catch (err) {
    logError("Securities", { component: "GET library signed-url", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
