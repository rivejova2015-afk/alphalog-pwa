import { createServiceClient } from "@/lib/supabase/server";
import { captureException } from "@/lib/sentry";
import type { SupabaseClient } from "@supabase/supabase-js";

interface TradeRow {
  id: string;
  user_id: string;
  account_id: string;
  symbol: string;
  direction: string;
  status: string;
  entry_date: string;
  exit_date: string | null;
  entry_price: number;
  exit_price: number;
  stop_loss_price: number;
  take_profit_price: number;
  lots: number;
  pnl: number;
  pnl_percent: number;
  notes: string | null;
  setup_id: string | null;
  is_featured_in_report: boolean;
  tags?: string[];
}

interface DescendantRow {
  account_id: string;
  multiplier_path: number;
  depth: number;
  parent_account_id: string;
}

const logError = (error: unknown, context: Record<string, unknown>) => {
  if (process.env.NODE_ENV === "production") {
    captureException(error, context);
  }
  console.error("[CopyGroups][Mirroring]", error, context);
};

export const mirrorTradeOnCreate = async (options: {
  supabase: SupabaseClient;
  masterTrade: TradeRow;
  userId: string;
}) => {
  const { supabase, masterTrade, userId } = options;

  const { data: masterNode } = await supabase
    .from("copy_group_nodes")
    .select("copy_group_id")
    .eq("account_id", masterTrade.account_id)
    .eq("role", "master")
    .eq("status", "active")
    .maybeSingle();

  if (!masterNode?.copy_group_id) {
    return { mirrored: 0 };
  }

  const { data: group } = await supabase
    .from("copy_groups")
    .select("id, owner_id, sync_mode")
    .eq("id", masterNode.copy_group_id)
    .eq("owner_id", userId)
    .single();

  if (!group) {
    return { mirrored: 0 };
  }

  const service = createServiceClient();

  await service
    .from("trade_replication_map")
    .upsert(
      {
        master_trade_id: masterTrade.id,
        master_account_id: masterTrade.account_id,
        copy_group_id: group.id,
      },
      { onConflict: "master_trade_id,copy_group_id" }
    );

  const { data: descendants, error: descendantsError } = await service.rpc(
    "copy_group_get_solid_descendants",
    {
      p_copy_group_id: group.id,
      p_root_account_id: masterTrade.account_id,
    }
  );

  if (descendantsError) {
    logError(descendantsError, { action: "get_descendants", copy_group_id: group.id });
    return { mirrored: 0 };
  }

  await service
    .from("trade_replication_map")
    .upsert(
      {
        master_trade_id: masterTrade.id,
        master_account_id: masterTrade.account_id,
        copy_group_id: group.id,
      },
      { onConflict: "master_trade_id,copy_group_id" }
    );

  await service.from("copy_group_events").insert({
    copy_group_id: group.id,
    event_type: "MASTER_TRADE_LOGGED",
    actor_id: userId,
    payload_json: {
      master_trade_id: masterTrade.id,
      master_account_id: masterTrade.account_id,
      total_descendants: (descendants || []).length,
    },
  });

  let mirrored = 0;

  for (const descendant of (descendants || []) as DescendantRow[]) {
    try {
      const { data: existingLink } = await service
        .from("slave_trade_links")
        .select("id")
        .eq("master_trade_id", masterTrade.id)
        .eq("slave_account_id", descendant.account_id)
        .maybeSingle();

      if (existingLink) {
        continue;
      }

      const multiplier = Number(descendant.multiplier_path || 1);
      const mirrorLots = Number(masterTrade.lots) * multiplier;

      const { data: mirrorTrade, error: mirrorError } = await service
        .from("trades")
        .insert({
          user_id: masterTrade.user_id,
          account_id: descendant.account_id,
          symbol: masterTrade.symbol,
          direction: masterTrade.direction,
          status: masterTrade.status,
          entry_date: masterTrade.entry_date,
          exit_date: masterTrade.exit_date,
          entry_price: masterTrade.entry_price,
          exit_price: masterTrade.exit_price,
          stop_loss_price: masterTrade.stop_loss_price,
          take_profit_price: masterTrade.take_profit_price,
          lots: mirrorLots,
          pnl: masterTrade.pnl,
          pnl_percent: masterTrade.pnl_percent,
          notes: masterTrade.notes,
          setup_id: masterTrade.setup_id,
          is_featured_in_report: masterTrade.is_featured_in_report,
          tags: masterTrade.tags || [],
        })
        .select("id")
        .single();

      if (mirrorError || !mirrorTrade) {
        await service.from("replication_jobs").insert({
          copy_group_id: group.id,
          master_trade_id: masterTrade.id,
          slave_account_id: descendant.account_id,
          status: "failed",
          attempts: 1,
          last_error: mirrorError?.message || "Insert failed",
        });

        await service.from("copy_group_events").insert({
          copy_group_id: group.id,
          event_type: "MIRROR_FAILED",
          actor_id: userId,
          payload_json: {
            master_trade_id: masterTrade.id,
            slave_account_id: descendant.account_id,
            error: mirrorError?.message || "Insert failed",
          },
        });

        continue;
      }

      await service.from("slave_trade_links").insert({
        master_trade_id: masterTrade.id,
        slave_trade_id: mirrorTrade.id,
        slave_account_id: descendant.account_id,
        status: "replicated",
      });

      await service.from("copy_group_events").insert({
        copy_group_id: group.id,
        event_type: "MIRROR_CREATED",
        actor_id: userId,
        payload_json: {
          master_trade_id: masterTrade.id,
          slave_trade_id: mirrorTrade.id,
          slave_account_id: descendant.account_id,
          multiplier_path: multiplier,
        },
      });

      mirrored += 1;
    } catch (error) {
      logError(error, { action: "mirror_trade", copy_group_id: group.id });
    }
  }

  return { mirrored };
};

export const mirrorTradeOnUpdate = async (options: {
  supabase: SupabaseClient;
  masterTrade: TradeRow;
  userId: string;
}) => {
  const { supabase, masterTrade, userId } = options;

  const { data: masterNode } = await supabase
    .from("copy_group_nodes")
    .select("copy_group_id")
    .eq("account_id", masterTrade.account_id)
    .eq("role", "master")
    .eq("status", "active")
    .maybeSingle();

  if (!masterNode?.copy_group_id) {
    return { synced: 0 };
  }

  const { data: group } = await supabase
    .from("copy_groups")
    .select("id, owner_id, sync_mode")
    .eq("id", masterNode.copy_group_id)
    .eq("owner_id", userId)
    .single();

  if (!group) {
    return { synced: 0 };
  }

  const service = createServiceClient();

  const { data: descendants } = await service.rpc("copy_group_get_solid_descendants", {
    p_copy_group_id: group.id,
    p_root_account_id: masterTrade.account_id,
  });

  const descendantMap = new Map<string, number>();
  (descendants || []).forEach((row: DescendantRow) => {
    descendantMap.set(row.account_id, Number(row.multiplier_path || 1));
  });

  const { data: slaveLinks } = await service
    .from("slave_trade_links")
    .select("id, slave_trade_id, slave_account_id")
    .eq("master_trade_id", masterTrade.id);

  const typedSlaveLinks = (slaveLinks || []) as Array<{
    id: string;
    slave_trade_id: string;
    slave_account_id: string;
  }>;

  await service.from("copy_group_events").insert({
    copy_group_id: group.id,
    event_type: "MASTER_TRADE_UPDATED",
    actor_id: userId,
    payload_json: {
      master_trade_id: masterTrade.id,
      sync_mode: group.sync_mode,
      descendants: descendantMap.size,
    },
  });

  let synced = 0;

  if (group.sync_mode === "soft") {
    for (const link of typedSlaveLinks) {
      await service
        .from("slave_trade_links")
        .update({ status: "need_resync", last_error: null })
        .eq("id", link.id);
    }

    await service.from("copy_group_events").insert({
      copy_group_id: group.id,
      event_type: "NEED_RESYNC",
      actor_id: userId,
      payload_json: { master_trade_id: masterTrade.id, total: typedSlaveLinks.length },
    });

    return { synced: 0 };
  }

  for (const link of typedSlaveLinks) {
    const multiplier = descendantMap.get(link.slave_account_id);
    if (!multiplier) {
      await service
        .from("slave_trade_links")
        .update({ status: "need_resync", last_error: "Not in current graph" })
        .eq("id", link.id);
      continue;
    }

    const mirrorLots = Number(masterTrade.lots) * multiplier;
    const { error: updateError } = await service
      .from("trades")
      .update({
        symbol: masterTrade.symbol,
        direction: masterTrade.direction,
        status: masterTrade.status,
        entry_date: masterTrade.entry_date,
        exit_date: masterTrade.exit_date,
        entry_price: masterTrade.entry_price,
        exit_price: masterTrade.exit_price,
        stop_loss_price: masterTrade.stop_loss_price,
        take_profit_price: masterTrade.take_profit_price,
        lots: mirrorLots,
        pnl: masterTrade.pnl,
        pnl_percent: masterTrade.pnl_percent,
        notes: masterTrade.notes,
        setup_id: masterTrade.setup_id,
        is_featured_in_report: masterTrade.is_featured_in_report,
        tags: masterTrade.tags || [],
      })
      .eq("id", link.slave_trade_id);

    if (updateError) {
      await service
        .from("slave_trade_links")
        .update({ status: "failed", last_error: updateError.message })
        .eq("id", link.id);

      await service.from("copy_group_events").insert({
        copy_group_id: group.id,
        event_type: "MIRROR_FAILED",
        actor_id: userId,
        payload_json: {
          master_trade_id: masterTrade.id,
          slave_trade_id: link.slave_trade_id,
          error: updateError.message,
        },
      });
      continue;
    }

    await service
      .from("slave_trade_links")
      .update({ status: "replicated", last_error: null })
      .eq("id", link.id);

    synced += 1;
  }

  for (const [accountId, multiplier] of descendantMap.entries()) {
    const alreadyLinked = typedSlaveLinks.some((link) => link.slave_account_id === accountId);
    if (alreadyLinked) continue;

    const mirrorLots = Number(masterTrade.lots) * multiplier;
    const { data: mirrorTrade, error: mirrorError } = await service
      .from("trades")
      .insert({
        user_id: masterTrade.user_id,
        account_id: accountId,
        symbol: masterTrade.symbol,
        direction: masterTrade.direction,
        status: masterTrade.status,
        entry_date: masterTrade.entry_date,
        exit_date: masterTrade.exit_date,
        entry_price: masterTrade.entry_price,
        exit_price: masterTrade.exit_price,
        stop_loss_price: masterTrade.stop_loss_price,
        take_profit_price: masterTrade.take_profit_price,
        lots: mirrorLots,
        pnl: masterTrade.pnl,
        pnl_percent: masterTrade.pnl_percent,
        notes: masterTrade.notes,
        setup_id: masterTrade.setup_id,
        is_featured_in_report: masterTrade.is_featured_in_report,
        tags: masterTrade.tags || [],
      })
      .select("id")
      .single();

    if (mirrorError || !mirrorTrade) {
      await service.from("replication_jobs").insert({
        copy_group_id: group.id,
        master_trade_id: masterTrade.id,
        slave_account_id: accountId,
        status: "failed",
        attempts: 1,
        last_error: mirrorError?.message || "Insert failed",
      });
      continue;
    }

    await service.from("slave_trade_links").insert({
      master_trade_id: masterTrade.id,
      slave_trade_id: mirrorTrade.id,
      slave_account_id: accountId,
      status: "replicated",
    });

    await service.from("copy_group_events").insert({
      copy_group_id: group.id,
      event_type: "MIRROR_CREATED",
      actor_id: userId,
      payload_json: {
        master_trade_id: masterTrade.id,
        slave_trade_id: mirrorTrade.id,
        slave_account_id: accountId,
        multiplier_path: multiplier,
      },
    });
  }

  return { synced };
};

/**
 * mirrorTradeOnDelete - Soft-deletes all slave trades linked to a deleted master trade.
 * Should be called after a master trade is soft-deleted.
 */
export const mirrorTradeOnDelete = async (options: {
  supabase: SupabaseClient;
  masterTradeId: string;
  userId: string;
}) => {
  const { supabase, masterTradeId, userId } = options;

  const { data: masterNode } = await supabase
    .from("trade_replication_map")
    .select("copy_group_id")
    .eq("master_trade_id", masterTradeId)
    .maybeSingle();

  if (!masterNode?.copy_group_id) {
    return { deleted: 0 };
  }

  const service = createServiceClient();

  const { data: links } = await service
    .from("slave_trade_links")
    .select("id, slave_trade_id, slave_account_id")
    .eq("master_trade_id", masterTradeId)
    .not("status", "eq", "deleted");

  if (!links?.length) {
    return { deleted: 0 };
  }

  const deletedAt = new Date().toISOString();
  let deleted = 0;

  for (const link of links) {
    const { error: tradeDeleteErr } = await service
      .from("trades")
      .update({ deleted_at: deletedAt })
      .eq("id", link.slave_trade_id)
      .is("deleted_at", null);

    if (tradeDeleteErr) {
      logError(tradeDeleteErr, { action: "mirror_delete_slave", slave_trade_id: link.slave_trade_id });
      continue;
    }

    await service
      .from("slave_trade_links")
      .update({ status: "deleted" })
      .eq("id", link.id);

    deleted += 1;
  }

  await service.from("copy_group_events").insert({
    copy_group_id: masterNode.copy_group_id,
    event_type: "MIRROR_DELETED",
    actor_id: userId,
    payload_json: { master_trade_id: masterTradeId, deleted_count: deleted },
  });

  return { deleted };
};

/**
 * processPendingSoftResyncs - Processes slave_trade_links with status "need_resync"
 * by applying the latest master trade data. This completes the soft sync cycle.
 */
export const processPendingSoftResyncs = async (options: {
  supabase: SupabaseClient;
  copyGroupId: string;
  userId: string;
  limit?: number;
}) => {
  const { supabase, copyGroupId, userId, limit = 50 } = options;

  const { data: group } = await supabase
    .from("copy_groups")
    .select("id, owner_id")
    .eq("id", copyGroupId)
    .eq("owner_id", userId)
    .single();

  if (!group) {
    return { resynced: 0 };
  }

  const service = createServiceClient();

  const { data: pendingLinks } = await service
    .from("slave_trade_links")
    .select("id, master_trade_id, slave_trade_id, slave_account_id")
    .eq("status", "need_resync")
    .limit(limit);

  if (!pendingLinks?.length) {
    return { resynced: 0 };
  }

  type LinkRow = { id: string; master_trade_id: string; slave_trade_id: string; slave_account_id: string };
  const typedLinks = pendingLinks as LinkRow[];

  // Group by master_trade_id to batch fetch master trades
  const masterIds = [...new Set(typedLinks.map((l) => l.master_trade_id))];
  const { data: masterTrades } = await service
    .from("trades")
    .select("id, symbol, direction, status, entry_date, exit_date, entry_price, exit_price, stop_loss_price, take_profit_price, pnl, pnl_percent, notes, setup_id, is_featured_in_report, tags")
    .in("id", masterIds)
    .is("deleted_at", null);

  const masterMap = new Map((masterTrades ?? []).map((t: any) => [t.id as string, t]));

  let resynced = 0;

  for (const link of typedLinks) {
    const master = masterMap.get(link.master_trade_id) as TradeRow | undefined;
    if (!master) {
      await service
        .from("slave_trade_links")
        .update({ status: "need_resync", last_error: "Master trade not found or deleted" })
        .eq("id", link.id);
      continue;
    }

    const { error: updateError } = await service
      .from("trades")
      .update({
        symbol: master.symbol,
        direction: master.direction,
        status: master.status,
        entry_date: master.entry_date,
        exit_date: master.exit_date,
        entry_price: master.entry_price,
        exit_price: master.exit_price,
        stop_loss_price: master.stop_loss_price,
        take_profit_price: master.take_profit_price,
        pnl: master.pnl,
        pnl_percent: master.pnl_percent,
        notes: master.notes,
        setup_id: master.setup_id,
        is_featured_in_report: master.is_featured_in_report,
        tags: master.tags || [],
      })
      .eq("id", link.slave_trade_id)
      .is("deleted_at", null);

    if (updateError) {
      await service
        .from("slave_trade_links")
        .update({ status: "need_resync", last_error: updateError.message })
        .eq("id", link.id);
      continue;
    }

    await service
      .from("slave_trade_links")
      .update({ status: "replicated", last_error: null })
      .eq("id", link.id);

    resynced += 1;
  }

  await service.from("copy_group_events").insert({
    copy_group_id: copyGroupId,
    event_type: "SOFT_RESYNC_PROCESSED",
    actor_id: userId,
    payload_json: { processed: pendingLinks.length, resynced },
  });

  return { resynced };
};
