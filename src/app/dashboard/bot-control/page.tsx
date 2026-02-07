// src/app/dashboard/bot-control/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import BackToDashboardButton from "@/components/BackToDashboardButton.client";
import { PushNotificationButton } from "@/components/push/PushNotificationButton.client";
import { createClient } from "@/lib/supabase/browser";
import { isOffline, getBotControlOfflineData, saveBotControlSnapshot } from "@/lib/offline/snapshot";

interface Bot {
  id: string;
  name: string;
}

interface BotAccount {
  id: string;
  bot_id: string;
  account_id: string;
  label: string | null;
}

interface BotInstance {
  bot_account_id: string;
  last_heartbeat_at: string | null;
}

interface BotTelemetry {
  bot_account_id: string;
  equity: number | null;
  balance: number | null;
  positions_total: number | null;
  positions_buy: number | null;
  positions_sell: number | null;
  basket_r: number | null;
  tier: string | null;
  last_signal_text: string | null;
  last_signal_ts: string | null;
  last_heartbeat_ts: string | null;
}

interface BotCommand {
  id: string;
  command_type: string;
  status: string;
  created_at: string;
}

interface BotCommandStatus {
  id: string;
  command_id: string;
  bot_account_id: string;
  status: string;
  acked_at: string | null;
}

interface BotSettingsRow {
  id: string;
  settings: Record<string, unknown>;
  bot_id?: string;
  bot_account_id?: string;
}

const DEFAULT_SETTINGS: Record<string, unknown> = {
  LotsFixed: 0.01,
  MaxPositionsTotal: 50,
  MaxEntriesPerBar: 15,
  ATRPeriod: 14,
  ATRk: 1.0,
  WarmupMinutes: 45,
  RangeGateEnabled: false,
  RangeGateMinPoints: 0,
  RangeGateMaxPoints: 0,
  RangeGateMode: 0,
  RangeGateMinATR: 0.0,
  RangeGateMaxATR: 0.0,
  OrderFlowEnabled: false,
  NewsEnabled: false,
  NewsLotMultiplier: 0.7,
  DecisionEngineEnabled: false,
  DecisionScoreMin: 60,
  DecisionBaseStart: 60,
  SweepLookbackBars: 10,
  MaxRetest: 1,
  OBBufferPoints: 50,
  EQTolerancePoints: 20,
  TargetEnabled: false,
  TargetPct: 1.0,
  AsiaPrimeStart: "00:30",
  AsiaPrimeEnd: "03:30",
  NYPrimeStart: "13:30",
  NYPrimeEnd: "17:00",
};

const COMMANDS = {
  START: "START",
  STOP: "STOP",
  RESTART: "RESTART_LOGIC",
  CLOSE_ALL: "CLOSE_ALL",
  EMERGENCY_STOP: "EMERGENCY_STOP",
  APPLY_SETTINGS: "APPLY_SETTINGS",
};

const ONLINE_THRESHOLD_MS = 30_000;

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return Number(value).toFixed(2);
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export default function BotControlPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [accounts, setAccounts] = useState<BotAccount[]>([]);
  const [instances, setInstances] = useState<BotInstance[]>([]);
  const [telemetry, setTelemetry] = useState<BotTelemetry[]>([]);
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [commandStatus, setCommandStatus] = useState<BotCommandStatus[]>([]);
  const [settingsGlobal, setSettingsGlobal] = useState<Record<string, unknown>>(DEFAULT_SETTINGS);
  const [settingsOverride, setSettingsOverride] = useState<Record<string, Record<string, unknown>>>({});
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const accountsForBot = useMemo(
    () => accounts.filter((account) => account.bot_id === selectedBotId),
    [accounts, selectedBotId]
  );

  const telemetryMap = useMemo(() => {
    const map = new Map<string, BotTelemetry>();
    telemetry.forEach((row) => map.set(row.bot_account_id, row));
    return map;
  }, [telemetry]);

  const instanceMap = useMemo(() => {
    const map = new Map<string, BotInstance>();
    instances.forEach((row) => map.set(row.bot_account_id, row));
    return map;
  }, [instances]);

  useEffect(() => {
    const updateOffline = () => setOfflineMode(isOffline());
    updateOffline();
    window.addEventListener("online", updateOffline);
    window.addEventListener("offline", updateOffline);
    return () => {
      window.removeEventListener("online", updateOffline);
      window.removeEventListener("offline", updateOffline);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: botsData, error: botsError } = await supabase
        .from("bots")
        .select("id, name")
        .order("created_at", { ascending: true });

      if (botsError) throw botsError;

      const botId = selectedBotId || botsData?.[0]?.id || null;
      if (botId && botId !== selectedBotId) {
        setSelectedBotId(botId);
      }

      const [accountsResult, instancesResult, telemetryResult, commandsResult] = await Promise.all([
        supabase.from("bot_accounts").select("id, bot_id, account_id, label").order("created_at", { ascending: true }),
        supabase.from("bot_instances").select("bot_account_id, last_heartbeat_at"),
        supabase.from("bot_telemetry").select("bot_account_id, equity, balance, positions_total, positions_buy, positions_sell, basket_r, tier, last_signal_text, last_signal_ts, last_heartbeat_ts"),
        supabase.from("bot_commands").select("id, command_type, status, created_at").order("created_at", { ascending: false }).limit(10),
      ]);

      if (accountsResult.error) throw accountsResult.error;
      if (instancesResult.error) throw instancesResult.error;
      if (telemetryResult.error) throw telemetryResult.error;
      if (commandsResult.error) throw commandsResult.error;

      const commandsIds = (commandsResult.data || []).map((cmd) => cmd.id);
      const commandStatusResult = commandsIds.length
        ? await supabase
            .from("bot_command_status")
            .select("id, command_id, bot_account_id, status, acked_at")
            .in("command_id", commandsIds)
        : { data: [], error: null };

      if (commandStatusResult.error) throw commandStatusResult.error;

      const globalSettingsResult = botId
        ? await supabase
            .from("bot_settings_global")
            .select("id, settings, bot_id")
            .eq("bot_id", botId)
            .maybeSingle()
        : { data: null, error: null };

      if (globalSettingsResult.error) throw globalSettingsResult.error;

      const overridesResult = botId
        ? await supabase
            .from("bot_settings_override")
            .select("id, settings, bot_account_id")
            .in("bot_account_id", (accountsResult.data || []).filter((a) => a.bot_id === botId).map((a) => a.id))
        : { data: [], error: null };

      if (overridesResult.error) throw overridesResult.error;

      setBots(botsData || []);
      setAccounts(accountsResult.data || []);
      setInstances(instancesResult.data || []);
      setTelemetry(telemetryResult.data || []);
      setCommands(commandsResult.data || []);
      setCommandStatus(commandStatusResult.data || []);

      const settingsMerged = {
        ...DEFAULT_SETTINGS,
        ...(globalSettingsResult.data?.settings || {}),
      };
      setSettingsGlobal(settingsMerged);

      const overrideMap: Record<string, Record<string, unknown>> = {};
      (overridesResult.data || []).forEach((row: BotSettingsRow) => {
        overrideMap[row.bot_account_id as string] = row.settings || {};
      });
      setSettingsOverride(overrideMap);

      await saveBotControlSnapshot({
        bots: botsData || [],
        accounts: accountsResult.data || [],
        telemetry: telemetryResult.data || [],
        commands: commandsResult.data || [],
        command_status: commandStatusResult.data || [],
        settings_global: globalSettingsResult.data?.settings || null,
        settings_override: overridesResult.data || [],
      });
    } catch (err) {
      console.error("[BotControl] loadData error:", err);
      setError("No se pudo cargar la información del bot.");
    } finally {
      setLoading(false);
    }
  };

  const loadOfflineSnapshot = async () => {
    const snapshot = await getBotControlOfflineData();
    if (!snapshot) return;
    setBots((snapshot.bots || []) as Bot[]);
    setAccounts((snapshot.accounts || []) as BotAccount[]);
    setTelemetry((snapshot.telemetry || []) as BotTelemetry[]);
    setCommands((snapshot.commands || []) as BotCommand[]);
    setCommandStatus((snapshot.command_status || []) as BotCommandStatus[]);
    setSettingsGlobal({
      ...DEFAULT_SETTINGS,
      ...(snapshot.settings_global as Record<string, unknown> || {}),
    });
  };

  useEffect(() => {
    if (offlineMode) {
      loadOfflineSnapshot();
      return;
    }
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 10_000);
    return () => clearInterval(interval);
  }, [offlineMode, selectedBotId]);

  const createCommand = async (commandType: string, targetAccountIds?: string[], payload: Record<string, unknown> = {}) => {
    if (!selectedBotId) return;

    setLoading(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id || null;

      const { data: command, error: commandError } = await supabase
        .from("bot_commands")
        .insert({
          bot_id: selectedBotId,
          command_type: commandType,
          payload,
          target_scope: targetAccountIds ? "accounts" : "all",
          created_by: userId,
          status: "PENDING",
        })
        .select("id")
        .single();

      if (commandError) throw commandError;

      const targetIds = targetAccountIds || accountsForBot.map((account) => account.id);
      const statusRows = targetIds.map((accountId) => ({
        command_id: command.id,
        bot_account_id: accountId,
        status: "PENDING",
      }));

      if (statusRows.length > 0) {
        const { error: statusError } = await supabase
          .from("bot_command_status")
          .insert(statusRows);
        if (statusError) throw statusError;
      }

      await loadData();
    } catch (err) {
      console.error("[BotControl] createCommand error:", err);
      setError("No se pudo enviar el comando.");
    } finally {
      setLoading(false);
    }
  };

  const applyGlobalSettings = async () => {
    if (!selectedBotId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id || null;

      const { error: upsertError } = await supabase
        .from("bot_settings_global")
        .upsert({
          bot_id: selectedBotId,
          settings: settingsGlobal,
          updated_by: userId,
        }, { onConflict: "bot_id" });

      if (upsertError) throw upsertError;

      await createCommand(COMMANDS.APPLY_SETTINGS, undefined, { scope: "global" });
    } catch (err) {
      console.error("[BotControl] applyGlobalSettings error:", err);
      setError("No se pudo aplicar settings globales.");
      setLoading(false);
    }
  };

  const applyOverrideSettings = async (accountId: string) => {
    setLoading(true);
    setError(null);
    try {
      const override = settingsOverride[accountId] || {};
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id || null;

      const { error: upsertError } = await supabase
        .from("bot_settings_override")
        .upsert({
          bot_account_id: accountId,
          settings: override,
          updated_by: userId,
        }, { onConflict: "bot_account_id" });

      if (upsertError) throw upsertError;

      await createCommand(COMMANDS.APPLY_SETTINGS, [accountId], { scope: "override" });
    } catch (err) {
      console.error("[BotControl] applyOverrideSettings error:", err);
      setError("No se pudo aplicar override por cuenta.");
      setLoading(false);
    }
  };

  const updateSetting = (key: string, value: unknown) => {
    setSettingsGlobal((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateOverrideSetting = (accountId: string, key: string, value: unknown) => {
    setSettingsOverride((prev) => ({
      ...prev,
      [accountId]: {
        ...(prev[accountId] || {}),
        [key]: value,
      },
    }));
  };

  const getCommandStatusCounts = (commandId: string) => {
    const statuses = commandStatus.filter((status) => status.command_id === commandId);
    const pending = statuses.filter((status) => status.status === "PENDING").length;
    const applied = statuses.filter((status) => status.status === "APPLIED").length;
    const failed = statuses.filter((status) => status.status === "FAILED").length;
    return { pending, applied, failed };
  };

  const isAccountOnline = (accountId: string) => {
    const instance = instanceMap.get(accountId);
    if (!instance?.last_heartbeat_at) return false;
    return Date.now() - new Date(instance.last_heartbeat_at).getTime() <= ONLINE_THRESHOLD_MS;
  };

  return (
    <div className="min-h-screen text-slate-200">
      <header className="bg-slate-900/80 border-b border-slate-700/60 px-6 py-4 flex items-center justify-between backdrop-blur-xl shadow-[0_12px_30px_rgba(2,4,10,0.45)]">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🤖</span>
            <h1 className="display-font text-2xl font-semibold text-slate-50">Bot Control</h1>
          </div>
          <p className="text-sm text-slate-400">Control panel AlphaLog → EA GoldRangeBasketR</p>
        </div>
        <div className="flex items-center gap-3">
          <PushNotificationButton />
          <BackToDashboardButton />
        </div>
      </header>

      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {offlineMode && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200 text-sm">
              Estás en modo offline. Vista de solo lectura desde el snapshot local.
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-200 text-sm">
              {error}
            </div>
          )}

          <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-[0_18px_40px_rgba(2,4,10,0.45)] backdrop-blur">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="display-font text-lg font-semibold text-slate-100">Global Controls</h2>
                <p className="text-sm text-slate-400">Aplica comandos a todas las cuentas del bot</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => createCommand(COMMANDS.START)}
                  disabled={offlineMode || loading}
                  className="px-4 py-2 rounded-xl bg-emerald-500/80 text-slate-900 text-sm font-semibold hover:bg-emerald-400 transition"
                >
                  Master START
                </button>
                <button
                  onClick={() => createCommand(COMMANDS.STOP)}
                  disabled={offlineMode || loading}
                  className="px-4 py-2 rounded-xl bg-amber-500/80 text-slate-900 text-sm font-semibold hover:bg-amber-400 transition"
                >
                  Master STOP
                </button>
                <button
                  onClick={() => createCommand(COMMANDS.RESTART)}
                  disabled={offlineMode || loading}
                  className="px-4 py-2 rounded-xl bg-slate-700 text-slate-100 text-sm font-semibold hover:bg-slate-600 transition"
                >
                  Restart Logic ALL
                </button>
                <button
                  onClick={() => createCommand(COMMANDS.EMERGENCY_STOP)}
                  disabled={offlineMode || loading}
                  className="px-4 py-2 rounded-xl bg-rose-500/80 text-slate-100 text-sm font-semibold hover:bg-rose-400 transition"
                >
                  Kill Switch ALL
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Settings Global</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <label className="flex flex-col gap-1">
                    LotsFixed
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="1.0"
                      value={Number(settingsGlobal.LotsFixed ?? 0.01)}
                      onChange={(e) => updateSetting("LotsFixed", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    MaxPositionsTotal
                    <input
                      type="number"
                      value={Number(settingsGlobal.MaxPositionsTotal ?? 50)}
                      onChange={(e) => updateSetting("MaxPositionsTotal", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    MaxEntriesPerBar
                    <input
                      type="number"
                      value={Number(settingsGlobal.MaxEntriesPerBar ?? 15)}
                      onChange={(e) => updateSetting("MaxEntriesPerBar", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    ATRPeriod
                    <input
                      type="number"
                      value={Number(settingsGlobal.ATRPeriod ?? 14)}
                      onChange={(e) => updateSetting("ATRPeriod", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    ATRk
                    <input
                      type="number"
                      step="0.1"
                      value={Number(settingsGlobal.ATRk ?? 1.0)}
                      onChange={(e) => updateSetting("ATRk", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    WarmupMinutes
                    <input
                      type="number"
                      value={Number(settingsGlobal.WarmupMinutes ?? 45)}
                      onChange={(e) => updateSetting("WarmupMinutes", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-2 col-span-2">
                    <input
                      type="checkbox"
                      checked={Boolean(settingsGlobal.RangeGateEnabled ?? false)}
                      onChange={(e) => updateSetting("RangeGateEnabled", e.target.checked)}
                    />
                    RangeGateEnabled
                  </label>
                  <label className="flex flex-col gap-1">
                    RangeGateMode
                    <select
                      value={Number(settingsGlobal.RangeGateMode ?? 0)}
                      onChange={(e) => updateSetting("RangeGateMode", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    >
                      <option value={0}>POINTS</option>
                      <option value={1}>ATR</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    RangeGateMinPoints
                    <input
                      type="number"
                      value={Number(settingsGlobal.RangeGateMinPoints ?? 0)}
                      onChange={(e) => updateSetting("RangeGateMinPoints", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    RangeGateMaxPoints
                    <input
                      type="number"
                      value={Number(settingsGlobal.RangeGateMaxPoints ?? 0)}
                      onChange={(e) => updateSetting("RangeGateMaxPoints", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    RangeGateMinATR
                    <input
                      type="number"
                      step="0.1"
                      value={Number(settingsGlobal.RangeGateMinATR ?? 0)}
                      onChange={(e) => updateSetting("RangeGateMinATR", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    RangeGateMaxATR
                    <input
                      type="number"
                      step="0.1"
                      value={Number(settingsGlobal.RangeGateMaxATR ?? 0)}
                      onChange={(e) => updateSetting("RangeGateMaxATR", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-2 col-span-2">
                    <input
                      type="checkbox"
                      checked={Boolean(settingsGlobal.OrderFlowEnabled ?? false)}
                      onChange={(e) => updateSetting("OrderFlowEnabled", e.target.checked)}
                    />
                    OrderFlowEnabled
                  </label>
                  <label className="flex items-center gap-2 col-span-2">
                    <input
                      type="checkbox"
                      checked={Boolean(settingsGlobal.NewsEnabled ?? false)}
                      onChange={(e) => updateSetting("NewsEnabled", e.target.checked)}
                    />
                    NewsEnabled (High impact)
                  </label>
                  <label className="flex flex-col gap-1">
                    NewsLotMultiplier
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="1.0"
                      value={Number(settingsGlobal.NewsLotMultiplier ?? 0.7)}
                      onChange={(e) => updateSetting("NewsLotMultiplier", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-2 col-span-2">
                    <input
                      type="checkbox"
                      checked={Boolean(settingsGlobal.DecisionEngineEnabled ?? false)}
                      onChange={(e) => updateSetting("DecisionEngineEnabled", e.target.checked)}
                    />
                    DecisionEngineEnabled
                  </label>
                  <label className="flex flex-col gap-1">
                    DecisionScoreMin
                    <input
                      type="number"
                      value={Number(settingsGlobal.DecisionScoreMin ?? 60)}
                      onChange={(e) => updateSetting("DecisionScoreMin", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    DecisionBaseStart
                    <input
                      type="number"
                      value={Number(settingsGlobal.DecisionBaseStart ?? 60)}
                      onChange={(e) => updateSetting("DecisionBaseStart", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    SweepLookbackBars
                    <input
                      type="number"
                      value={Number(settingsGlobal.SweepLookbackBars ?? 10)}
                      onChange={(e) => updateSetting("SweepLookbackBars", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    MaxRetest
                    <input
                      type="number"
                      value={Number(settingsGlobal.MaxRetest ?? 1)}
                      onChange={(e) => updateSetting("MaxRetest", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    OBBufferPoints
                    <input
                      type="number"
                      value={Number(settingsGlobal.OBBufferPoints ?? 50)}
                      onChange={(e) => updateSetting("OBBufferPoints", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    EQTolerancePoints
                    <input
                      type="number"
                      value={Number(settingsGlobal.EQTolerancePoints ?? 20)}
                      onChange={(e) => updateSetting("EQTolerancePoints", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-2 col-span-2">
                    <input
                      type="checkbox"
                      checked={Boolean(settingsGlobal.TargetEnabled ?? false)}
                      onChange={(e) => updateSetting("TargetEnabled", e.target.checked)}
                    />
                    Daily Target Enabled
                  </label>
                  <label className="flex flex-col gap-1">
                    TargetPct
                    <input
                      type="number"
                      step="0.1"
                      value={Number(settingsGlobal.TargetPct ?? 1.0)}
                      onChange={(e) => updateSetting("TargetPct", Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    AsiaPrimeStart
                    <input
                      type="time"
                      value={String(settingsGlobal.AsiaPrimeStart ?? "00:30")}
                      onChange={(e) => updateSetting("AsiaPrimeStart", e.target.value)}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    AsiaPrimeEnd
                    <input
                      type="time"
                      value={String(settingsGlobal.AsiaPrimeEnd ?? "03:30")}
                      onChange={(e) => updateSetting("AsiaPrimeEnd", e.target.value)}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    NYPrimeStart
                    <input
                      type="time"
                      value={String(settingsGlobal.NYPrimeStart ?? "13:30")}
                      onChange={(e) => updateSetting("NYPrimeStart", e.target.value)}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    NYPrimeEnd
                    <input
                      type="time"
                      value={String(settingsGlobal.NYPrimeEnd ?? "17:00")}
                      onChange={(e) => updateSetting("NYPrimeEnd", e.target.value)}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                </div>
                <button
                  onClick={applyGlobalSettings}
                  disabled={offlineMode || loading}
                  className="mt-4 px-4 py-2 rounded-xl bg-blue-500/80 text-slate-100 text-sm font-semibold hover:bg-blue-400 transition"
                >
                  Apply to ALL
                </button>
              </div>

              <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Strict Mode Status</h3>
                <div className="space-y-3">
                  {commands.length === 0 ? (
                    <p className="text-sm text-slate-400">Sin comandos recientes.</p>
                  ) : (
                    commands.map((command) => {
                      const counts = getCommandStatusCounts(command.id);
                      return (
                        <div key={command.id} className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200">{command.command_type}</span>
                            <span className={`text-xs ${command.status === "APPLIED" ? "text-emerald-400" : command.status === "FAILED" ? "text-rose-400" : "text-amber-300"}`}>
                              {command.status}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-400">{formatTimestamp(command.created_at)}</div>
                          <div className="mt-2 flex gap-3 text-xs">
                            <span className="text-amber-300">PENDING: {counts.pending}</span>
                            <span className="text-emerald-300">APPLIED: {counts.applied}</span>
                            <span className="text-rose-300">FAILED: {counts.failed}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-[0_18px_40px_rgba(2,4,10,0.45)] backdrop-blur">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="display-font text-lg font-semibold text-slate-100">Cuentas</h2>
                <p className="text-sm text-slate-400">Estado por cuenta + overrides</p>
              </div>
              <select
                value={selectedBotId || ""}
                onChange={(e) => setSelectedBotId(e.target.value)}
                className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1 text-sm"
              >
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>{bot.name}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {accountsForBot.map((account) => {
                const accountTelemetry = telemetryMap.get(account.id);
                const online = isAccountOnline(account.id);
                return (
                  <div key={account.id} className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{account.label || account.account_id}</div>
                        <div className="text-xs text-slate-400">{account.account_id}</div>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${online ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700/40 text-slate-400"}`}>
                        {online ? "ONLINE" : "OFFLINE"}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <div>
                        <div className="text-slate-400">Equity</div>
                        <div>{formatNumber(accountTelemetry?.equity)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Balance</div>
                        <div>{formatNumber(accountTelemetry?.balance)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">#Posiciones</div>
                        <div>{accountTelemetry?.positions_total ?? "-"}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">BasketR / Tier</div>
                        <div>{formatNumber(accountTelemetry?.basket_r)} / {accountTelemetry?.tier || "-"}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-slate-400">Última señal</div>
                        <div>{accountTelemetry?.last_signal_text || "-"} · {formatTimestamp(accountTelemetry?.last_signal_ts)}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => createCommand(COMMANDS.START, [account.id])}
                        disabled={offlineMode || loading}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/80 text-slate-900 text-xs font-semibold"
                      >
                        START
                      </button>
                      <button
                        onClick={() => createCommand(COMMANDS.STOP, [account.id])}
                        disabled={offlineMode || loading}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/80 text-slate-900 text-xs font-semibold"
                      >
                        STOP
                      </button>
                      <button
                        onClick={() => createCommand(COMMANDS.RESTART, [account.id])}
                        disabled={offlineMode || loading}
                        className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-100 text-xs font-semibold"
                      >
                        RESTART
                      </button>
                      <button
                        onClick={() => createCommand(COMMANDS.CLOSE_ALL, [account.id])}
                        disabled={offlineMode || loading}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/80 text-slate-100 text-xs font-semibold"
                      >
                        CLOSE ALL
                      </button>
                      <button
                        onClick={() => createCommand(COMMANDS.EMERGENCY_STOP, [account.id])}
                        disabled={offlineMode || loading}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/80 text-slate-100 text-xs font-semibold"
                      >
                        EMERGENCY STOP
                      </button>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-700/60 bg-slate-900/50 p-3">
                      <h4 className="text-xs font-semibold text-slate-200 mb-2">Overrides por cuenta</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <label className="flex flex-col gap-1">
                          LotsFixed
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max="1.0"
                            value={Number(settingsOverride[account.id]?.LotsFixed ?? settingsGlobal.LotsFixed ?? 0.01)}
                            onChange={(e) => updateOverrideSetting(account.id, "LotsFixed", Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                        <label className="flex items-center gap-2 col-span-2">
                          <input
                            type="checkbox"
                            checked={Boolean(settingsOverride[account.id]?.RangeGateEnabled ?? settingsGlobal.RangeGateEnabled ?? false)}
                            onChange={(e) => updateOverrideSetting(account.id, "RangeGateEnabled", e.target.checked)}
                          />
                          RangeGateEnabled
                        </label>
                        <label className="flex flex-col gap-1">
                          RangeGateMode
                          <select
                            value={Number(settingsOverride[account.id]?.RangeGateMode ?? settingsGlobal.RangeGateMode ?? 0)}
                            onChange={(e) => updateOverrideSetting(account.id, "RangeGateMode", Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          >
                            <option value={0}>POINTS</option>
                            <option value={1}>ATR</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          RangeGateMinPoints
                          <input
                            type="number"
                            value={Number(settingsOverride[account.id]?.RangeGateMinPoints ?? settingsGlobal.RangeGateMinPoints ?? 0)}
                            onChange={(e) => updateOverrideSetting(account.id, "RangeGateMinPoints", Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          RangeGateMaxPoints
                          <input
                            type="number"
                            value={Number(settingsOverride[account.id]?.RangeGateMaxPoints ?? settingsGlobal.RangeGateMaxPoints ?? 0)}
                            onChange={(e) => updateOverrideSetting(account.id, "RangeGateMaxPoints", Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          RangeGateMinATR
                          <input
                            type="number"
                            step="0.1"
                            value={Number(settingsOverride[account.id]?.RangeGateMinATR ?? settingsGlobal.RangeGateMinATR ?? 0)}
                            onChange={(e) => updateOverrideSetting(account.id, "RangeGateMinATR", Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          RangeGateMaxATR
                          <input
                            type="number"
                            step="0.1"
                            value={Number(settingsOverride[account.id]?.RangeGateMaxATR ?? settingsGlobal.RangeGateMaxATR ?? 0)}
                            onChange={(e) => updateOverrideSetting(account.id, "RangeGateMaxATR", Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                        <label className="flex items-center gap-2 col-span-2">
                          <input
                            type="checkbox"
                            checked={Boolean(settingsOverride[account.id]?.OrderFlowEnabled ?? settingsGlobal.OrderFlowEnabled ?? false)}
                            onChange={(e) => updateOverrideSetting(account.id, "OrderFlowEnabled", e.target.checked)}
                          />
                          OrderFlowEnabled
                        </label>
                        <label className="flex items-center gap-2 col-span-2">
                          <input
                            type="checkbox"
                            checked={Boolean(settingsOverride[account.id]?.NewsEnabled ?? settingsGlobal.NewsEnabled ?? false)}
                            onChange={(e) => updateOverrideSetting(account.id, "NewsEnabled", e.target.checked)}
                          />
                          NewsEnabled
                        </label>
                        <label className="flex flex-col gap-1">
                          NewsLotMultiplier
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max="1.0"
                            value={Number(settingsOverride[account.id]?.NewsLotMultiplier ?? settingsGlobal.NewsLotMultiplier ?? 0.7)}
                            onChange={(e) => updateOverrideSetting(account.id, "NewsLotMultiplier", Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                        <label className="flex items-center gap-2 col-span-2">
                          <input
                            type="checkbox"
                            checked={Boolean(settingsOverride[account.id]?.DecisionEngineEnabled ?? settingsGlobal.DecisionEngineEnabled ?? false)}
                            onChange={(e) => updateOverrideSetting(account.id, "DecisionEngineEnabled", e.target.checked)}
                          />
                          DecisionEngineEnabled
                        </label>
                        <label className="flex flex-col gap-1">
                          DecisionScoreMin
                          <input
                            type="number"
                            value={Number(settingsOverride[account.id]?.DecisionScoreMin ?? settingsGlobal.DecisionScoreMin ?? 60)}
                            onChange={(e) => updateOverrideSetting(account.id, "DecisionScoreMin", Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          DecisionBaseStart
                          <input
                            type="number"
                            value={Number(settingsOverride[account.id]?.DecisionBaseStart ?? settingsGlobal.DecisionBaseStart ?? 60)}
                            onChange={(e) => updateOverrideSetting(account.id, "DecisionBaseStart", Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          SweepLookbackBars
                          <input
                            type="number"
                            value={Number(settingsOverride[account.id]?.SweepLookbackBars ?? settingsGlobal.SweepLookbackBars ?? 10)}
                            onChange={(e) => updateOverrideSetting(account.id, "SweepLookbackBars", Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          MaxRetest
                          <input
                            type="number"
                            value={Number(settingsOverride[account.id]?.MaxRetest ?? settingsGlobal.MaxRetest ?? 1)}
                            onChange={(e) => updateOverrideSetting(account.id, "MaxRetest", Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          OBBufferPoints
                          <input
                            type="number"
                            value={Number(settingsOverride[account.id]?.OBBufferPoints ?? settingsGlobal.OBBufferPoints ?? 50)}
                            onChange={(e) => updateOverrideSetting(account.id, "OBBufferPoints", Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          EQTolerancePoints
                          <input
                            type="number"
                            value={Number(settingsOverride[account.id]?.EQTolerancePoints ?? settingsGlobal.EQTolerancePoints ?? 20)}
                            onChange={(e) => updateOverrideSetting(account.id, "EQTolerancePoints", Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                        <label className="flex items-center gap-2 col-span-2">
                          <input
                            type="checkbox"
                            checked={Boolean(settingsOverride[account.id]?.TargetEnabled ?? settingsGlobal.TargetEnabled ?? false)}
                            onChange={(e) => updateOverrideSetting(account.id, "TargetEnabled", e.target.checked)}
                          />
                          Daily Target Enabled
                        </label>
                        <label className="flex flex-col gap-1">
                          TargetPct
                          <input
                            type="number"
                            step="0.1"
                            value={Number(settingsOverride[account.id]?.TargetPct ?? settingsGlobal.TargetPct ?? 1.0)}
                            onChange={(e) => updateOverrideSetting(account.id, "TargetPct", Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                      </div>
                      <button
                        onClick={() => applyOverrideSettings(account.id)}
                        disabled={offlineMode || loading}
                        className="mt-3 px-3 py-1.5 rounded-lg bg-blue-500/80 text-slate-100 text-xs font-semibold"
                      >
                        Apply por cuenta
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
