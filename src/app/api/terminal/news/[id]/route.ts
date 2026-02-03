// src/app/api/terminal/news/[id]/route.ts
import { createClient } from "@/lib/supabase/server";
import { decryptText, encryptText } from "@/lib/security/encryption";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/terminal/news/{id}
 * Update news
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { title, url, source, relevancy_score, impact_label } = body;

    // Verify ownership
    const { data: existingNews } = await supabase
      .from("terminal_news")
      .select("user_id, title, url, source, relevancy_score, impact_label")
      .eq("id", id)
      .single();

    if (!existingNews || existingNews.user_id !== userData.user.id) {
      return NextResponse.json(
        { error: "News not found or unauthorized" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("terminal_news")
      .update({
        title: title !== undefined ? encryptText(title) : existingNews.title,
        url: url !== undefined ? encryptText(url) : existingNews.url,
        source: source !== undefined ? encryptText(source) : existingNews.source,
        relevancy_score: relevancy_score !== undefined ? relevancy_score : existingNews.relevancy_score,
        impact_label: impact_label !== undefined ? impact_label : existingNews.impact_label,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating news:", error);
      return NextResponse.json(
        { error: "Failed to update news" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...data,
      title: decryptText(data.title),
      url: decryptText(data.url),
      source: decryptText(data.source),
    });
  } catch (err: any) {
    console.error("Error in PATCH /api/terminal/news/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/terminal/news/{id}
 * Hard-delete news
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Verify ownership
    const { data: existingNews } = await supabase
      .from("terminal_news")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existingNews || existingNews.user_id !== userData.user.id) {
      return NextResponse.json(
        { error: "News not found or unauthorized" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("terminal_news")
      .delete()
      .eq("id", id)
      .eq("user_id", userData.user.id);

    if (error) {
      console.error("Error deleting news:", error);
      return NextResponse.json(
        { error: "Failed to delete news" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error in DELETE /api/terminal/news/[id]:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
