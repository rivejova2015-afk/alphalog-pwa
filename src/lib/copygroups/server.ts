import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { captureException } from "@/lib/sentry";
import { logError, logWarn } from "@/lib/log";

export type CopyGroupSnapshot = {
  nodes: Array<Record<string, unknown>>;
  links: Array<Record<string, unknown>>;
  experiments: Record<string, unknown>;
  meta: {
    generated_at: string;
    version_int?: number;
  };
};

const sortById = <T extends { id?: string | null }>(items: T[]) =>
  [...items].sort((a, b) => (a.id || "").localeCompare(b.id || ""));

export const buildCopyGroupSnapshot = async (
  supabase: SupabaseClient,
  copyGroupId: string
): Promise<CopyGroupSnapshot> => {
  const [{ data: nodes }, { data: links }, { data: experiments }] = await Promise.all([
    supabase
      .from("copy_group_nodes")
      .select("id, copy_group_id, account_id, role, status, risk_pct, risk_node, created_at, updated_at")
      .eq("copy_group_id", copyGroupId),
    supabase
      .from("copy_group_links")
      .select("id, copy_group_id, parent_account_id, child_account_id, copy_multiplier, link_type, created_at")
      .eq("copy_group_id", copyGroupId),
    supabase
      .from("copy_group_experiments")
      .select("flags_json")
      .eq("copy_group_id", copyGroupId)
      .maybeSingle(),
  ]);

  const snapshot: CopyGroupSnapshot = {
    nodes: sortById(nodes || []),
    links: sortById(links || []),
    experiments: (experiments?.flags_json as Record<string, unknown>) || {},
    meta: {
      generated_at: new Date().toISOString(),
    },
  };

  return snapshot;
};

export const checksumSnapshot = (snapshot: CopyGroupSnapshot) =>
  createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

export const recordCopyGroupEvent = async (
  supabase: SupabaseClient,
  copyGroupId: string,
  eventType: string,
  actorId?: string | null,
  payload?: Record<string, unknown> | null
) => {
  const { error } = await supabase.from("copy_group_events").insert({
    copy_group_id: copyGroupId,
    event_type: eventType,
    actor_id: actorId || null,
    payload_json: payload || null,
  });

  if (error) {
    logWarn("CopyGroups", "Failed to record event", { component: "copygroups.event.record", eventType, error: error instanceof Error ? error.message : String(error) });
  }
};

export const createSnapshotVersion = async (options: {
  supabase: SupabaseClient;
  copyGroupId: string;
  actorId?: string | null;
  message?: string | null;
  eventPayload?: Record<string, unknown> | null;
}): Promise<number> => {
  const { supabase, copyGroupId, actorId, message, eventPayload } = options;
  const { data: group, error: groupError } = await supabase
    .from("copy_groups")
    .select("active_version")
    .eq("id", copyGroupId)
    .single();

  if (groupError || !group) {
    throw new Error("CopyGroup not found");
  }

  const nextVersion = (group.active_version || 1) + 1;
  const snapshot = await buildCopyGroupSnapshot(supabase, copyGroupId);
  snapshot.meta.version_int = nextVersion;
  const checksum = checksumSnapshot(snapshot);

  const { error: versionError } = await supabase.from("copy_group_versions").insert({
    copy_group_id: copyGroupId,
    version_int: nextVersion,
    message: message || null,
    created_by: actorId || null,
  });

  if (versionError) {
    throw versionError;
  }

  const { error: snapshotError } = await supabase.from("copy_group_snapshots").insert({
    copy_group_id: copyGroupId,
    version_int: nextVersion,
    snapshot_json: snapshot,
    checksum,
  });

  if (snapshotError) {
    throw snapshotError;
  }

  const { error: updateError } = await supabase
    .from("copy_groups")
    .update({ active_version: nextVersion })
    .eq("id", copyGroupId);

  if (updateError) {
    throw updateError;
  }

  await recordCopyGroupEvent(supabase, copyGroupId, "VERSION_CREATED", actorId || null, {
    version: nextVersion,
    message,
    ...(eventPayload || {}),
  });

  return nextVersion;
};

export const createInitialVersion = async (options: {
  supabase: SupabaseClient;
  copyGroupId: string;
  actorId?: string | null;
  message?: string | null;
}): Promise<void> => {
  const { supabase, copyGroupId, actorId, message } = options;
  const snapshot = await buildCopyGroupSnapshot(supabase, copyGroupId);
  snapshot.meta.version_int = 1;
  const checksum = checksumSnapshot(snapshot);

  const { error: versionError } = await supabase.from("copy_group_versions").insert({
    copy_group_id: copyGroupId,
    version_int: 1,
    message: message || "Initial version",
    created_by: actorId || null,
  });

  if (versionError) {
    throw versionError;
  }

  const { error: snapshotError } = await supabase.from("copy_group_snapshots").insert({
    copy_group_id: copyGroupId,
    version_int: 1,
    snapshot_json: snapshot,
    checksum,
  });

  if (snapshotError) {
    throw snapshotError;
  }

  await supabase.from("copy_groups").update({ active_version: 1 }).eq("id", copyGroupId);
  await recordCopyGroupEvent(supabase, copyGroupId, "VERSION_CREATED", actorId || null, {
    version: 1,
    message: message || "Initial version",
  });
};

export const reportCopyGroupError = (error: unknown, context: Record<string, unknown>) => {
  if (process.env.NODE_ENV === "production") {
    captureException(error, context);
  }
  logError("CopyGroups", { component: "copygroups", message: error instanceof Error ? error.message : String(error), payload: context });
};
