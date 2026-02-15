// src/app/api/push/subscriptions/route.ts
// Get current user's push subscriptions

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function getUserFromRequest(request: NextRequest) {
  const supabase = await createClient();

  const sessionUser = await supabase.auth.getUser();
  if (sessionUser.data.user) {
    return { supabase, user: sessionUser.data.user };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return { supabase, user: null };
  }

  const token = authHeader.slice("bearer ".length).trim();
  if (!token) return { supabase, user: null };

  const tokenUser = await supabase.auth.getUser(token);
  return { supabase, user: tokenUser.data.user ?? null };
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, created_at, user_agent")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch subscriptions:", error);
      return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
    }

    return NextResponse.json({ subscriptions: subscriptions || [] });
  } catch (error) {
    console.error("Get subscriptions endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
