import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { logError } from "@/lib/log";

const synthesizeSchema = z.object({
  insights: z
    .array(z.string().max(500, "Each insight must be at most 500 characters"))
    .min(1, "At least one insight is required")
    .max(10, "At most 10 insights allowed"),
  period: z.enum(["month", "quarter"]).optional().default("month"),
});

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

/**
 * POST /api/intelligence/knowledge-factory/synthesize
 *
 * Accepts an array of insight strings and returns an AI-generated synthesis
 * with key lessons and action items using OpenAI gpt-4o-mini.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI synthesis is not available. OPENAI_API_KEY is not configured." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const parsed = synthesizeSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid request body" },
        { status: 400 }
      );
    }

    const { insights, period } = parsed.data;

    const periodLabel = period === "quarter" ? "ultimo trimestre" : "ultimo mes";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Eres un coach de trading profesional y analista de rendimiento. " +
              "Tu trabajo es sintetizar insights de trading en lecciones accionables. " +
              "Responde SIEMPRE en JSON valido con exactamente estos campos: " +
              '{ "synthesis": "string con la sintesis general", ' +
              '"key_lessons": ["array de strings con lecciones clave"], ' +
              '"action_items": ["array de strings con pasos de accion concretos"] }. ' +
              "Manten la sintesis concisa (max 3 parrafos). " +
              "Usa maximo 5 key_lessons y 5 action_items. " +
              "Escribe en espanol profesional.",
          },
          {
            role: "user",
            content: `Sintetiza estos insights de trading del ${periodLabel}:\n\n${insights
              .map((insight, index) => `${index + 1}. ${insight}`)
              .join("\n")}`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      logError("KnowledgeFactory:Synthesize", {
        component: "intelligence",
        action: "ai-synthesis",
        status: response.status,
        message: `OpenAI API returned ${response.status}`,
        error: errorBody,
      });
      return NextResponse.json(
        { error: "AI synthesis failed. Please try again later." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "AI returned an empty response." },
        { status: 502 }
      );
    }

    // Parse the JSON response from the model
    let synthesisResult: {
      synthesis: string;
      key_lessons: string[];
      action_items: string[];
    };

    try {
      const raw = JSON.parse(content) as Record<string, unknown>;
      synthesisResult = {
        synthesis: typeof raw.synthesis === "string" ? raw.synthesis : "",
        key_lessons: Array.isArray(raw.key_lessons)
          ? raw.key_lessons
              .filter((item): item is string => typeof item === "string")
              .slice(0, 5)
          : [],
        action_items: Array.isArray(raw.action_items)
          ? raw.action_items
              .filter((item): item is string => typeof item === "string")
              .slice(0, 5)
          : [],
      };
    } catch {
      // If JSON parsing fails, use the raw content as synthesis
      synthesisResult = {
        synthesis: content,
        key_lessons: [],
        action_items: [],
      };
    }

    return NextResponse.json({
      ok: true,
      period,
      ...synthesisResult,
    });
  } catch (error) {
    logError("KnowledgeFactory:Synthesize", {
      component: "intelligence",
      action: "ai-synthesis",
      status: 500,
      message: "Unexpected error in synthesis endpoint",
      error: error instanceof Error ? error.message : String(error),
    });
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
