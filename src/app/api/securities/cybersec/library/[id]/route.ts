import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "log_attachments";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// DELETE /api/securities/cybersec/library/[id] → soft-delete + borra el archivo.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const { data: row, error: fetchErr } = await supabase
      .from("securities_library_uploads")
      .select("id, storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (fetchErr) {
      logError("Securities", { component: "DELETE library", message: fetchErr.message });
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
    if (!row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const { error: delErr } = await supabase
      .from("securities_library_uploads")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (delErr) {
      logError("Securities", { component: "DELETE library", message: delErr.message });
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }

    // Best-effort: liberar el archivo de Storage (la fila ya quedó soft-deleted).
    await supabase.storage.from(BUCKET).remove([row.storage_path]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("Securities", { component: "DELETE library", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
