// src/app/api/tradermap/goals/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/tradermap/goals
 * Get all goals for user (non-deleted), including quarters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("tradermap_goals")
      .select(
        `*, 
        account:accounts(id, name, currency),
        quarters:tradermap_goal_quarters(*)`
      )
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .order("sort_index", { ascending: true });

    if (error) {
      console.error("Error fetching goals:", error);
      return NextResponse.json(
        { error: "Failed to fetch goals" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (err: unknown) {
    console.error("Error in GET /api/tradermap/goals:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tradermap/goals
 * Create new annual goal and auto-create 4 quarters
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, account_id, year } = body;

    // Validate
    if (!title || !account_id || !year) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify account exists and belongs to user
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", account_id)
      .eq("user_id", userData.user.id)
      .single();

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Create goal
    const { data: goalData, error: goalError } = await supabase
      .from("tradermap_goals")
      .insert({
        user_id: userData.user.id,
        account_id,
        year,
        title,
        active_quarter: 1,
        sort_index: 0,
      })
      .select()
      .single();

    if (goalError) {
      console.error("Error creating goal:", goalError);
      return NextResponse.json(
        { error: "Failed to create goal" },
        { status: 500 }
      );
    }

    // Create 4 quarters automatically
    const quarterMonths = [
      { start: 0, end: 2 },   // Q1: Jan-Mar
      { start: 3, end: 5 },   // Q2: Apr-Jun
      { start: 6, end: 8 },   // Q3: Jul-Sep
      { start: 9, end: 11 },  // Q4: Oct-Dec
    ];

    const quarters = quarterMonths.map((months, idx) => {
      const startDate = new Date(year, months.start, 1);
      const endDate = new Date(year, months.end + 1, 0);
      return {
        user_id: userData.user.id,
        goal_id: goalData.id,
        quarter: idx + 1,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        start_balance: 0,
        target_balance: 0,
        current_balance: null,
      };
    });

    const { error: quartersError } = await supabase
      .from("tradermap_goal_quarters")
      .insert(quarters);

    if (quartersError) {
      console.error("Error creating quarters:", quartersError);
      // Rollback goal creation
      await supabase.from("tradermap_goals").delete().eq("id", goalData.id);
      return NextResponse.json(
        { error: "Failed to create quarters" },
        { status: 500 }
      );
    }

    // Fetch full goal with quarters
    const { data: fullGoal } = await supabase
      .from("tradermap_goals")
      .select(
        `*, 
        account:accounts(id, name, currency),
        quarters:tradermap_goal_quarters(*)`
      )
      .eq("id", goalData.id)
      .single();

    // Send push notification for new goal creation
    const pushPayload = {
      userId: userData.user.id,
      title: '🎯 Nueva Meta Creada',
      body: `Meta: "${title}" | Año: ${year}`,
      tag: 'alphalog-goal-created',
      data: {
        type: 'goal_created',
        goal_id: goalData.id,
      },
    };

    fetch(`${request.headers.get('origin')}/api/push/notify-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${request.headers.get('authorization') || ''}`,
      },
      body: JSON.stringify(pushPayload),
    }).catch((error) => {
      console.warn('Failed to send goal creation push:', error);
      // Don't fail the request if push fails
    });

    return NextResponse.json(fullGoal);
  } catch (err: unknown) {
    console.error("Error in POST /api/tradermap/goals:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
