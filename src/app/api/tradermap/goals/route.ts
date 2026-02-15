import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptText, encryptText } from "@/lib/security/encryption";

type QuarterKey = "Q1" | "Q2" | "Q3" | "Q4";

type QuarterInput = {
  quarter: QuarterKey | string | number;
  start_date: string;
  end_date: string;
  start_balance: number | string;
  target_balance: number | string;
  current_balance?: number | string | null;
};

const QUARTERS: QuarterKey[] = ["Q1", "Q2", "Q3", "Q4"];

const QUARTER_MONTHS: Record<QuarterKey, [number, number]> = {
  Q1: [0, 2],
  Q2: [3, 5],
  Q3: [6, 8],
  Q4: [9, 11],
};

const safeDecrypt = (value?: string | null) => {
  try {
    return decryptText(value);
  } catch {
    return value ?? "";
  }
};

const normalizeQuarter = (value: unknown): QuarterKey | null => {
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (normalized === "Q1" || normalized === "Q2" || normalized === "Q3" || normalized === "Q4") {
      return normalized;
    }
    if (normalized === "1") return "Q1";
    if (normalized === "2") return "Q2";
    if (normalized === "3") return "Q3";
    if (normalized === "4") return "Q4";
  }
  if (typeof value === "number" && value >= 1 && value <= 4) {
    return `Q${value}` as QuarterKey;
  }
  return null;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toDateOrNull = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return value;
};

const createDefaultQuarters = (year: number) =>
  QUARTERS.map((quarter, index) => {
    const [startMonth, endMonth] = QUARTER_MONTHS[quarter];
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, endMonth + 1, 0);
    return {
      quarter,
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      start_balance: 0,
      target_balance: 1,
      current_balance: null,
      sort_index: index,
    };
  });

const validateQuarters = (quarters: QuarterInput[] | undefined) => {
  if (!quarters || quarters.length === 0) {
    return { ok: true as const, rows: null as null | Array<{
      quarter: QuarterKey;
      start_date: string;
      end_date: string;
      start_balance: number;
      target_balance: number;
      current_balance: number | null;
      sort_index: number;
    }> };
  }

  const normalizedRows: Array<{
    quarter: QuarterKey;
    start_date: string;
    end_date: string;
    start_balance: number;
    target_balance: number;
    current_balance: number | null;
    sort_index: number;
  }> = [];

  if (quarters.length !== 4) {
    return { ok: false as const, error: "Quarter payload must include Q1-Q4" };
  }

  for (const [index, row] of quarters.entries()) {
    const quarter = normalizeQuarter(row.quarter);
    if (!quarter) {
      return { ok: false as const, error: "Invalid quarter key in payload" };
    }

    const startDate = toDateOrNull(row.start_date);
    const endDate = toDateOrNull(row.end_date);
    if (!startDate || !endDate) {
      return { ok: false as const, error: `Invalid start/end date for ${quarter}` };
    }

    const startBalance = toNumber(row.start_balance);
    const targetBalance = toNumber(row.target_balance);
    const currentBalance =
      row.current_balance === undefined || row.current_balance === null || row.current_balance === ""
        ? null
        : toNumber(row.current_balance);

    if (startBalance === null || targetBalance === null) {
      return { ok: false as const, error: `Invalid balances for ${quarter}` };
    }
    if (startBalance < 0 || targetBalance < 0) {
      return { ok: false as const, error: `Balances must be >= 0 for ${quarter}` };
    }
    if (targetBalance <= startBalance) {
      return { ok: false as const, error: `target_balance must be greater than start_balance for ${quarter}` };
    }
    if (currentBalance !== null && currentBalance < 0) {
      return { ok: false as const, error: `current_balance must be >= 0 for ${quarter}` };
    }

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (start > end) {
      return { ok: false as const, error: `start_date must be <= end_date for ${quarter}` };
    }

    normalizedRows.push({
      quarter,
      start_date: startDate,
      end_date: endDate,
      start_balance: startBalance,
      target_balance: targetBalance,
      current_balance: currentBalance,
      sort_index: index,
    });
  }

  const unique = new Set(normalizedRows.map((row) => row.quarter));
  if (unique.size !== 4) {
    return { ok: false as const, error: "Quarter payload must contain unique Q1-Q4 values" };
  }

  for (let i = 0; i < normalizedRows.length; i += 1) {
    for (let j = i + 1; j < normalizedRows.length; j += 1) {
      const left = normalizedRows[i];
      const right = normalizedRows[j];
      const leftStart = new Date(left.start_date).getTime();
      const leftEnd = new Date(left.end_date).getTime();
      const rightStart = new Date(right.start_date).getTime();
      const rightEnd = new Date(right.end_date).getTime();
      const overlaps = leftStart <= rightEnd && rightStart <= leftEnd;
      if (overlaps) {
        return {
          ok: false as const,
          error: `Date ranges overlap between ${left.quarter} and ${right.quarter}`,
        };
      }
    }
  }

  return { ok: true as const, rows: normalizedRows };
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("tradermap_goals")
      .select(
        "*, account:accounts(id, name, currency), quarters:tradermap_goal_quarters(*)"
      )
      .eq("user_id", userData.user.id)
      .is("deleted_at", null)
      .order("sort_index", { ascending: true });

    if (error) {
      console.error("Error fetching goals:", error);
      return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
    }

    const decrypted = (data || []).map((goal: Record<string, unknown>) => ({
      ...goal,
      title: safeDecrypt(goal.title as string | null),
    }));

    return NextResponse.json(decrypted);
  } catch (err) {
    console.error("Error in GET /api/tradermap/goals:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      title?: string;
      account_id?: string;
      year?: number;
      active_quarter?: QuarterKey | string | number;
      quarters?: QuarterInput[];
    };

    const title = body.title?.trim();
    const accountId = body.account_id?.trim();
    const year = Number(body.year);
    const activeQuarter = normalizeQuarter(body.active_quarter) || "Q1";

    if (!title || !accountId || !Number.isInteger(year)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (year < 2020 || year > 2100) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const validatedQuarters = validateQuarters(body.quarters);
    if (!validatedQuarters.ok) {
      return NextResponse.json({ error: validatedQuarters.error }, { status: 400 });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", accountId)
      .eq("user_id", userData.user.id)
      .single();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const encryptedTitle = encryptText(title);
    if (!encryptedTitle) {
      return NextResponse.json({ error: "Failed to encrypt title" }, { status: 500 });
    }

    const { data: goalData, error: goalError } = await supabase
      .from("tradermap_goals")
      .insert({
        user_id: userData.user.id,
        account_id: accountId,
        year,
        title: encryptedTitle,
        active_quarter: activeQuarter,
        sort_index: 0,
      })
      .select()
      .single();

    if (goalError) {
      console.error("Error creating goal:", goalError);
      return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
    }

    const rows = (validatedQuarters.rows || createDefaultQuarters(year)).map((quarter) => ({
      user_id: userData.user.id,
      goal_id: goalData.id,
      quarter: quarter.quarter,
      start_date: quarter.start_date,
      end_date: quarter.end_date,
      start_balance: quarter.start_balance,
      target_balance: quarter.target_balance,
      current_balance: quarter.current_balance ?? null,
      sort_index: quarter.sort_index,
    }));

    const { error: quartersError } = await supabase
      .from("tradermap_goal_quarters")
      .insert(rows);

    if (quartersError) {
      console.error("Error creating quarters:", quartersError);
      await supabase.from("tradermap_goals").delete().eq("id", goalData.id);
      return NextResponse.json({ error: "Failed to create quarters" }, { status: 500 });
    }

    const { data: fullGoal } = await supabase
      .from("tradermap_goals")
      .select("*, account:accounts(id, name, currency), quarters:tradermap_goal_quarters(*)")
      .eq("id", goalData.id)
      .single();

    const pushPayload = {
      userId: userData.user.id,
      title: "Nueva Meta Creada",
      body: `Meta: "${title}" | Anio: ${year}`,
      tag: "alphalog-goal-created",
      data: {
        type: "goal_created",
        goal_id: goalData.id,
      },
    };

    const origin = request.headers.get("origin");
    if (origin) {
      fetch(`${origin}/api/push/notify-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pushPayload),
      }).catch((pushError) => {
        console.warn("Failed to send goal creation push:", pushError);
      });
    }

    return NextResponse.json({
      ...fullGoal,
      title: safeDecrypt((fullGoal as { title?: string | null } | null)?.title || ""),
    });
  } catch (err) {
    console.error("Error in POST /api/tradermap/goals:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
