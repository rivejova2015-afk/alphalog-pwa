// src/app/api/logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { decryptText, encryptText } from "@/lib/security/encryption";

const pageSize = 50;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const query = searchParams.get("q") || "";
    const categoryId = searchParams.get("categoryId") || "";
    const type = searchParams.get("type") || "";
    const tagNames = searchParams.get("tagNames") || "";
    const trash = searchParams.get("trash") === "1";

    const offset = (page - 1) * pageSize;

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},
        },
      }
    );

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authData.user.id;

    let baseQuery = supabase
      .from("logs")
      .select("*, categories(id, name), log_tags(tag_id, tags(id, name))", {
        count: "exact",
      })
      .eq("user_id", userId);

    if (trash) {
      baseQuery = baseQuery.not("deleted_at", "is", null);
    } else {
      baseQuery = baseQuery.is("deleted_at", null);
    }

    if (categoryId) {
      baseQuery = baseQuery.eq("category_id", categoryId);
    }

    if (type) {
      baseQuery = baseQuery.eq("type", type);
    }

    baseQuery = baseQuery.order("sort_index", { ascending: true }).order("created_at", { ascending: false });

    const searchLimit = 500;
    let totalCount = 0;
    let items: any[] = [];

    if (query) {
      const { data: searchItems, error } = await baseQuery.range(0, searchLimit - 1);
      if (error) {
        console.error("[Logs API] Query error:", error);
        return NextResponse.json(
          { error: "Error fetching logs" },
          { status: 500 }
        );
      }
      items = searchItems || [];
    } else {
      const { count } = await baseQuery;
      totalCount = count || 0;

      const { data: pageItems, error } = await baseQuery.range(offset, offset + pageSize - 1);
      if (error) {
        console.error("[Logs API] Query error:", error);
        return NextResponse.json(
          { error: "Error fetching logs" },
          { status: 500 }
        );
      }
      items = pageItems || [];
    }

    type TagJoin = { tags?: { name?: string } | null };
    type LogItem = {
      id: string;
      title: string;
      notes: string;
      type: string | null;
      category_id: string;
      log_tags?: TagJoin[] | null;
    };

    let filteredItems: LogItem[] = (items || []).map((log: LogItem) => ({
      ...log,
      title: decryptText(log.title) || "",
      notes: decryptText(log.notes) || "",
    })) as LogItem[];

    if (query) {
      const queryLower = query.toLowerCase();
      filteredItems = filteredItems.filter((log) =>
        log.title.toLowerCase().includes(queryLower) ||
        log.notes.toLowerCase().includes(queryLower)
      );
      totalCount = filteredItems.length;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      filteredItems = filteredItems.slice(start, end);
    }

    if (tagNames) {
      const tagsToFilter = tagNames.split(",").map((t) => t.trim().toLowerCase());
      filteredItems = filteredItems.filter((log) => {
        const logTagNames = (log.log_tags || [])
          .map((lt) => lt.tags?.name?.toLowerCase())
          .filter(Boolean) as string[];
        return tagsToFilter.some((tag) => logTagNames.includes(tag));
      });
    }

    const totalPages = Math.ceil((totalCount || 0) / pageSize);

    return NextResponse.json(
      {
        items: filteredItems,
        totalCount: totalCount || 0,
        totalPages,
        page,
        pageSize,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
      }
    );
  } catch (err) {
    console.error("[Logs API] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, notes, categoryId, type, tagNames } = body;

    if (!title || !notes || !categoryId) {
      return NextResponse.json(
        { error: "Missing required fields: title, notes, categoryId" },
        { status: 400 }
      );
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},
        },
      }
    );

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authData.user.id;

    // Create log
    const { data: logData, error: logError } = await supabase
      .from("logs")
      .insert({
        user_id: userId,
        title: encryptText(title.trim()),
        notes: encryptText(notes.trim()),
        type: type || null,
        category_id: categoryId,
      })
      .select()
      .single();

    if (logError) {
      console.error("[Logs API POST] Insert error:", logError);
      // Check if it's the unique constraint error (duplicate by day UTC)
      if (logError.code === "23505") {
        return NextResponse.json(
          {
            error: "already_exists",
            message:
              "Ya existe un log con ese título hoy (UTC). Cambia el título o edita el existente.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Error creating log" },
        { status: 500 }
      );
    }

    // Handle tags (batched — single SELECT + batch upsert + batch insert)
    if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
      const trimmedNames = [...new Set(tagNames.slice(0, 25).map((t: string) => t.trim()).filter(Boolean))];
      if (trimmedNames.length > 0) {
        // 1. Fetch all existing tags in one query
        const { data: existingTags } = await supabase
          .from("tags")
          .select("id, name_lower")
          .eq("user_id", userId)
          .in("name_lower", trimmedNames.map((n) => n.toLowerCase()))
          .is("deleted_at", null);

        const existingMap = new Map((existingTags || []).map((t: { id: string; name_lower: string }) => [t.name_lower, t.id]));
        const toInsert = trimmedNames.filter((n) => !existingMap.has(n.toLowerCase()));

        // 2. Batch-create missing tags
        if (toInsert.length > 0) {
          const { data: newTags } = await supabase
            .from("tags")
            .insert(toInsert.map((n) => ({ user_id: userId, name: n })))
            .select("id, name_lower");
          (newTags || []).forEach((t: { id: string; name_lower: string }) => existingMap.set(t.name_lower, t.id));
        }

        // 3. Batch-insert log_tag associations
        const logTagRows = trimmedNames
          .map((n) => existingMap.get(n.toLowerCase()))
          .filter(Boolean)
          .map((tagId) => ({ log_id: logData.id, tag_id: tagId, user_id: userId }));
        if (logTagRows.length > 0) {
          await supabase.from("log_tags").insert(logTagRows);
        }
      }
    }

    return NextResponse.json(
      {
        data: {
          ...logData,
          title: decryptText(logData.title),
          notes: decryptText(logData.notes),
        },
        message: "Log created successfully",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[Logs API POST] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, notes, categoryId, type, tagNames } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing log id" },
        { status: 400 }
      );
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},
        },
      }
    );

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authData.user.id;

    // Update log
    const { data: logData, error: logError } = await supabase
      .from("logs")
      .update({
        ...(title !== undefined && { title: encryptText(title.trim()) }),
        ...(notes !== undefined && { notes: encryptText(notes.trim()) }),
        ...(categoryId !== undefined && { category_id: categoryId }),
        ...(type !== undefined && { type: type || null }),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (logError) {
      console.error("[Logs API PATCH] Update error:", logError);
      if (logError.code === "23505") {
        return NextResponse.json(
          {
            error: "already_exists",
            message:
              "Ya existe un log con ese título hoy (UTC). Cambia el título o edita el existente.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Error updating log" },
        { status: 500 }
      );
    }

    // Update tags if provided (batched — single SELECT + batch upsert + batch insert)
    if (tagNames !== undefined && Array.isArray(tagNames)) {
      await supabase.from("log_tags").delete().eq("log_id", id);

      const trimmedNames = [...new Set(tagNames.slice(0, 25).map((t: string) => t.trim()).filter(Boolean))];
      if (trimmedNames.length > 0) {
        const { data: existingTags } = await supabase
          .from("tags")
          .select("id, name_lower")
          .eq("user_id", userId)
          .in("name_lower", trimmedNames.map((n) => n.toLowerCase()))
          .is("deleted_at", null);

        const existingMap = new Map((existingTags || []).map((t: { id: string; name_lower: string }) => [t.name_lower, t.id]));
        const toInsert = trimmedNames.filter((n) => !existingMap.has(n.toLowerCase()));

        if (toInsert.length > 0) {
          const { data: newTags } = await supabase
            .from("tags")
            .insert(toInsert.map((n) => ({ user_id: userId, name: n })))
            .select("id, name_lower");
          (newTags || []).forEach((t: { id: string; name_lower: string }) => existingMap.set(t.name_lower, t.id));
        }

        const logTagRows = trimmedNames
          .map((n) => existingMap.get(n.toLowerCase()))
          .filter(Boolean)
          .map((tagId) => ({ log_id: id, tag_id: tagId, user_id: userId }));
        if (logTagRows.length > 0) {
          await supabase.from("log_tags").insert(logTagRows);
        }
      }
    }

    return NextResponse.json(
      {
        data: {
          ...logData,
          title: decryptText(logData.title),
          notes: decryptText(logData.notes),
        },
        message: "Log updated successfully",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[Logs API PATCH] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const logId = searchParams.get("id");
    const permanent = searchParams.get("permanent") === "true";

    if (!logId) {
      return NextResponse.json(
        { error: "Missing log id" },
        { status: 400 }
      );
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},
        },
      }
    );

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authData.user.id;

    if (permanent) {
      // Hard delete
      await supabase.from("logs").delete().eq("id", logId).eq("user_id", userId);
    } else {
      // Soft delete: set deleted_at and mark attachments as deleted
      await supabase
        .from("logs")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", logId)
        .eq("user_id", userId);

      // Mark attachments as deleted
      await supabase
        .from("log_attachments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("log_id", logId)
        .eq("user_id", userId);
    }

    return NextResponse.json(
      { message: "Log deleted successfully" },
      { status: 200 }
    );
  } catch (err) {
    console.error("[Logs API DELETE] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
