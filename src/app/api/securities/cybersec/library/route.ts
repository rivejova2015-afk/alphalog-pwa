import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "log_attachments";
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB por PDF

const metaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().max(200).optional(),
  category: z.string().trim().max(80).optional(),
  level: z.enum(["b", "i", "a", "all"]).optional(),
  notes: z.string().trim().max(1000).optional(),
});

// GET /api/securities/cybersec/library → PDFs subidos por el usuario (no borrados).
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("securities_library_uploads")
      .select("id, title, author, category, level, mime_type, size_bytes, notes, created_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      logError("Securities", { component: "GET library", message: error.message });
      return NextResponse.json({ error: "Failed to fetch uploads" }, { status: 500 });
    }
    return NextResponse.json({ uploads: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    logError("Securities", { component: "GET library", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/securities/cybersec/library (multipart) → sube un PDF propio.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let form: FormData;
    try { form = await request.formData(); } catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }

    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo PDF" }, { status: 400 });
    if (file.type !== "application/pdf") return NextResponse.json({ error: "Solo se permiten archivos PDF" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "El PDF supera el límite de 50 MB" }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });

    const parsed = metaSchema.safeParse({
      title: form.get("title") ?? "",
      author: form.get("author") ?? undefined,
      category: form.get("category") ?? undefined,
      level: form.get("level") ?? undefined,
      notes: form.get("notes") ?? undefined,
    });
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

    const safeName = (file.name || "documento.pdf").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    const storagePath = `${user.id}/library/${randomUUID()}_${safeName}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: "application/pdf",
    });
    if (upErr) {
      logError("Securities", { component: "POST library upload", message: upErr.message });
      return NextResponse.json({ error: "No se pudo subir el archivo" }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("securities_library_uploads")
      .insert({
        user_id: user.id,
        title: parsed.data.title,
        author: parsed.data.author ?? null,
        category: parsed.data.category ?? null,
        level: parsed.data.level ?? "all",
        storage_path: storagePath,
        mime_type: "application/pdf",
        size_bytes: file.size,
        notes: parsed.data.notes ?? null,
      })
      .select("id, title, author, category, level, mime_type, size_bytes, notes, created_at")
      .single();

    if (error || !data) {
      // Rollback del archivo si falla la metadata.
      await supabase.storage.from(BUCKET).remove([storagePath]);
      logError("Securities", { component: "POST library insert", message: error?.message ?? "no data" });
      return NextResponse.json({ error: "No se pudo guardar la metadata" }, { status: 500 });
    }
    return NextResponse.json({ upload: data });
  } catch (err) {
    logError("Securities", { component: "POST library", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
