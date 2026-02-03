// src/app/api/terminal/evidence/generate/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { encryptText } from "@/lib/security/encryption";

/**
 * POST /api/terminal/evidence/generate
 * STUB: Generate evidence report with IA (simulated)
 * 
 * In production, this would call an actual IA API.
 * For now, generates placeholder Spanish content.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { instrumentId, title } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // STUB: Generate placeholder content in Spanish
    const stubContent = `ANÁLISIS DE EVIDENCIA - ${title.toUpperCase()}
====================================================

Instrumento: ${instrumentId ? "Especificado" : "General"}
Fecha de Generación: ${new Date().toLocaleString("es-ES")}
Generado por: IA Stub (Simulación)

RESUMEN EJECUTIVO
-----------------
Este reporte ha sido generado como un stub de ejemplo.
En producción, se utilizaría un modelo de IA real para análisis profundo.

ANÁLISIS
--------
• Análisis técnico: Pendiente de evaluación real
• Análisis fundamental: Información de mercado disponible
• Niveles clave: Support y Resistance a evaluar
• Sentimiento de mercado: Neutral

CONCLUSIONES
-----------
Se recomienda validar este análisis con fuentes adicionales
antes de tomar decisiones de trading.

NOTAS
-----
Este es un contenido stub. Reemplazar con IA real en producción.

---
Descargo de responsabilidad: Este análisis es solo para propósitos educativos.`;

    // Insert report into database
    const { data, error } = await supabase
      .from("terminal_evidence_reports")
      .insert([
        {
          user_id: userData.user.id,
          instrument_id: instrumentId || null,
          title: encryptText(title),
          content: encryptText(stubContent),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating evidence:", error);
      return NextResponse.json(
        { error: "Failed to create evidence" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      reportId: data.id,
      title,
      content: stubContent,
    });
  } catch (err: unknown) {
    console.error("Error in POST /api/terminal/evidence/generate:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
