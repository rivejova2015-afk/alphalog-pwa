// src/components/bot-control/BotControlWorkspace.client.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import BackToDashboardButton from "@/components/BackToDashboardButton.client";
import { PushNotificationButton } from "@/components/push/PushNotificationButton.client";
import { createClient } from "@/lib/supabase/browser";
import { isOffline, getBotControlOfflineData, saveBotControlSnapshot } from "@/lib/offline/snapshot";
import { BotMode, getBotProfileConfig } from "@/components/bot-control/profileConfig";
import { IVSurfacePanel } from "@/components/bot-control/panels/IVSurfacePanel.client";
import { EngineDevToolsPanel } from "@/components/bot-control/panels/EngineDevToolsPanel.client";
import { SkillsPanel } from "@/components/bot-control/panels/SkillsPanel.client";

interface Bot {
  id: string;
  name: string;
}

interface BotAccount {
  id: string;
  bot_id: string;
  account_id: string;
  label: string | null;
  app_account_id: string | null;
}

interface AppAccount {
  id: string;
  name: string;
}

interface BotInstance {
  id: string;
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

interface BotControlWorkspaceProps {
  mode: BotMode;
  basePath: string;
}

export default function BotControlWorkspace({ mode, basePath }: BotControlWorkspaceProps) {
  const profile = useMemo(() => getBotProfileConfig(mode), [mode]);
  const profileDefaults = profile.settingsDefaults;
  const isFutures = mode === "futuros";
  const lotsKey = profile.lotsKey;
  const maxTotalKey = profile.maxTotalKey;
  const rangeMinKey = profile.rangeMinKey;
  const rangeMaxKey = profile.rangeMaxKey;
  const targetEnabledKey = profile.targetEnabledKey;
  const obBufferKey = isFutures ? "OBBufferTicks" : "OBBufferPoints";
  const eqToleranceKey = isFutures ? "EQToleranceTicks" : "EQTolerancePoints";

  const [accounts, setAccounts] = useState<BotAccount[]>([]);
  const [appAccounts, setAppAccounts] = useState<AppAccount[]>([]);
  const [instances, setInstances] = useState<BotInstance[]>([]);
  const [activeTab, setActiveTab] = useState<"controls" | "iv-surface" | "engine" | "skills">("controls");
  const [telemetry, setTelemetry] = useState<BotTelemetry[]>([]);
  const [commands, setCommands] = useState<BotCommand[]>([]);
  const [commandStatus, setCommandStatus] = useState<BotCommandStatus[]>([]);
  const [settingsGlobal, setSettingsGlobal] = useState<Record<string, unknown>>(profileDefaults);
  const [settingsOverride, setSettingsOverride] = useState<Record<string, Record<string, unknown>>>({});
  const [dirtyGlobalSettings, setDirtyGlobalSettings] = useState(false);
  const [dirtyOverrideSettings, setDirtyOverrideSettings] = useState<Record<string, boolean>>({});
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showSelectAccountModal, setShowSelectAccountModal] = useState(false);
  const [newMt5AccountId, setNewMt5AccountId] = useState("");
  const [newMt5AccountLabel, setNewMt5AccountLabel] = useState("");
  const [newAppAccountId, setNewAppAccountId] = useState("");
  const [selectedBotAccountId, setSelectedBotAccountId] = useState("");
  const [selectedAppAccountId, setSelectedAppAccountId] = useState("");

  const supabase = useMemo(() => createClient(), []);
  const dirtyGlobalRef = useRef(dirtyGlobalSettings);
  const dirtyOverrideRef = useRef(dirtyOverrideSettings);

  useEffect(() => {
    dirtyGlobalRef.current = dirtyGlobalSettings;
  }, [dirtyGlobalSettings]);

  useEffect(() => {
    dirtyOverrideRef.current = dirtyOverrideSettings;
  }, [dirtyOverrideSettings]);

  const accountsForBot = useMemo(
    () => accounts.filter((account) => account.bot_id === selectedBotId),
    [accounts, selectedBotId]
  );

  const appAccountsMap = useMemo(() => {
    const map = new Map<string, string>();
    appAccounts.forEach((account) => map.set(account.id, account.name));
    return map;
  }, [appAccounts]);

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

  useEffect(() => {
    setDirtyGlobalSettings(false);
    setDirtyOverrideSettings({});
    dirtyGlobalRef.current = false;
    dirtyOverrideRef.current = {};
    setSelectedBotAccountId("");
  }, [selectedBotId]);

  useEffect(() => {
    if (!newAppAccountId && appAccounts.length > 0) {
      setNewAppAccountId(appAccounts[0].id);
    }
    if (!selectedAppAccountId && appAccounts.length > 0) {
      setSelectedAppAccountId(appAccounts[0].id);
    }
  }, [appAccounts, newAppAccountId, selectedAppAccountId]);

  useEffect(() => {
    setSettingsGlobal(profileDefaults);
    setSettingsOverride({});
    setSelectedBotId(null);
  }, [profileDefaults]);

  useEffect(() => {
    if (!selectedBotAccountId && accountsForBot.length > 0) {
      setSelectedBotAccountId(accountsForBot[0].id);
    }
  }, [accountsForBot, selectedBotAccountId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        throw new Error("Sesion no valida para Bot Control.");
      }

      const requiredBotNames = ["Bot Forex", "Bot Futuros"];
      let botsData: Bot[] = [];

      const botsResult = await supabase
        .from("bots")
        .select("id, name")
        .order("created_at", { ascending: true });

      if (botsResult.error) throw botsResult.error;
      botsData = botsResult.data || [];

      if (!offlineMode) {
        const existingNames = new Set(botsData.map((bot) => bot.name));
        const missingRows = requiredBotNames
          .filter((name) => !existingNames.has(name))
          .map((name) => ({ user_id: authData.user.id, name }));

        if (missingRows.length > 0) {
          const insertRes = await supabase.from("bots").insert(missingRows);
          if (insertRes.error) throw insertRes.error;
          const refreshRes = await supabase
            .from("bots")
            .select("id, name")
            .order("created_at", { ascending: true });
          if (refreshRes.error) throw refreshRes.error;
          botsData = refreshRes.data || [];
        }
      }

      const activeBot = botsData.find((bot) => bot.name === profile.botName) || null;
      const botId = activeBot?.id || null;

      if (!botId) {
        setAccounts([]);
        setInstances([]);
        setTelemetry([]);
        setCommands([]);
        setCommandStatus([]);
        setSelectedBotId(null);
        setError(`No se encontró el perfil ${profile.botName}.`);
        return;
      }

      if (botId !== selectedBotId) {
        setSelectedBotId(botId);
      }

      const [accountsResult, appAccountsResult, instancesResult, telemetryResult, commandsResult] = await Promise.all([
        supabase
          .from("bot_accounts")
          .select("id, bot_id, account_id, label, app_account_id")
          .eq("bot_id", botId)
          .order("created_at", { ascending: true }),
        supabase.from("accounts").select("id, name").order("created_at", { ascending: true }),
        supabase.from("bot_instances").select("id, bot_account_id, last_heartbeat_at"),
        supabase.from("bot_telemetry").select("bot_account_id, equity, balance, positions_total, positions_buy, positions_sell, basket_r, tier, last_signal_text, last_signal_ts, last_heartbeat_ts"),
        supabase
          .from("bot_commands")
          .select("id, command_type, status, created_at")
          .eq("bot_id", botId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (accountsResult.error) throw accountsResult.error;
      if (appAccountsResult.error) throw appAccountsResult.error;
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

      setAccounts(accountsResult.data || []);
      setAppAccounts(appAccountsResult.data || []);
      setInstances(instancesResult.data || []);
      setTelemetry(telemetryResult.data || []);
      setCommands(commandsResult.data || []);
      setCommandStatus(commandStatusResult.data || []);

      const settingsMerged = {
        ...profileDefaults,
        ...(globalSettingsResult.data?.settings || {}),
      };
      if (!dirtyGlobalRef.current) {
        setSettingsGlobal(settingsMerged);
      }

      const overrideMap: Record<string, Record<string, unknown>> = {};
      (overridesResult.data || []).forEach((row: BotSettingsRow) => {
        overrideMap[row.bot_account_id as string] = row.settings || {};
      });
      setSettingsOverride((prev) => {
        const dirtyMap = dirtyOverrideRef.current;
        if (!dirtyMap || Object.keys(dirtyMap).length === 0) {
          return overrideMap;
        }
        const next: Record<string, Record<string, unknown>> = { ...overrideMap };
        Object.keys(dirtyMap).forEach((accountId) => {
          if (dirtyMap[accountId]) {
            next[accountId] = prev[accountId] || next[accountId] || {};
          }
        });
        return next;
      });

      await saveBotControlSnapshot({
        bots: botsData || [],
        accounts: accountsResult.data || [],
        app_accounts: appAccountsResult.data || [],
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
    const snapshotBots = (snapshot.bots || []) as Bot[];
    const targetBot = snapshotBots.find((bot) => bot.name === profile.botName) || null;
    const targetBotId = targetBot?.id || null;

    setSelectedBotId(targetBotId);
    setAccounts(((snapshot.accounts || []) as BotAccount[]).filter((item) => item.bot_id === targetBotId));
    setAppAccounts((snapshot.app_accounts || []) as AppAccount[]);
    setTelemetry((snapshot.telemetry || []) as BotTelemetry[]);
    setCommands((snapshot.commands || []) as BotCommand[]);
    setCommandStatus((snapshot.command_status || []) as BotCommandStatus[]);
    setSettingsGlobal({
      ...profileDefaults,
      ...(snapshot.settings_global as Record<string, unknown> || {}),
    });

    if (!targetBotId) {
      setError(`Perfil ${profile.botName} no disponible en snapshot offline.`);
    }
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
  }, [offlineMode, profile.botName, profileDefaults]);

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

      setDirtyGlobalSettings(false);
      dirtyGlobalRef.current = false;
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

      setDirtyOverrideSettings((prev) => ({
        ...prev,
        [accountId]: false,
      }));
      dirtyOverrideRef.current = {
        ...dirtyOverrideRef.current,
        [accountId]: false,
      };
      await createCommand(COMMANDS.APPLY_SETTINGS, [accountId], { scope: "override" });
    } catch (err) {
      console.error("[BotControl] applyOverrideSettings error:", err);
      setError("No se pudo aplicar override por cuenta.");
      setLoading(false);
    }
  };

  const updateSetting = (key: string, value: unknown) => {
    setDirtyGlobalSettings(true);
    dirtyGlobalRef.current = true;
    setSettingsGlobal((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateOverrideSetting = (accountId: string, key: string, value: unknown) => {
    setDirtyOverrideSettings((prev) => ({
      ...prev,
      [accountId]: true,
    }));
    dirtyOverrideRef.current = {
      ...dirtyOverrideRef.current,
      [accountId]: true,
    };
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

  const normalizeError = (err: unknown, fallback: string) => {
    if (typeof err !== "object" || err === null) return fallback;
    const maybeCode = "code" in err ? String((err as { code?: unknown }).code || "") : "";
    const maybeMessage = "message" in err ? String((err as { message?: unknown }).message || "") : "";
    if (maybeCode === "23505") return "La cuenta MT5 ya existe en Bot Control.";
    if (maybeCode === "42501") return "No tienes permisos para vincular esta cuenta.";
    if (maybeMessage) return maybeMessage;
    return fallback;
  };

  const resetAddAccountForm = () => {
    setNewMt5AccountId("");
    setNewMt5AccountLabel("");
    setNewAppAccountId(appAccounts[0]?.id || "");
  };

  const resetSelectAccountForm = () => {
    setSelectedBotAccountId(accountsForBot[0]?.id || "");
    setSelectedAppAccountId(appAccounts[0]?.id || "");
  };

  const openAddAccountModal = () => {
    if (!selectedBotId) {
      setError("Selecciona un bot antes de agregar una cuenta.");
      return;
    }
    if (appAccounts.length === 0) {
      setError("No tienes cuentas registradas en TradeHub. Crea una primero.");
      return;
    }
    setError(null);
    setNotice(null);
    resetAddAccountForm();
    setShowAddAccountModal(true);
  };

  const openSelectAccountModal = () => {
    if (accountsForBot.length === 0) {
      setError("No hay cuentas MT5 registradas para este bot.");
      return;
    }
    if (appAccounts.length === 0) {
      setError("No tienes cuentas registradas en TradeHub para vincular.");
      return;
    }
    setError(null);
    setNotice(null);
    resetSelectAccountForm();
    setShowSelectAccountModal(true);
  };

  const handleAddBotAccount = async () => {
    const accountId = newMt5AccountId.trim();
    if (!selectedBotId) {
      setError("Selecciona un bot antes de guardar.");
      return;
    }
    if (!accountId) {
      setError("El account id de MT5 es obligatorio.");
      return;
    }
    if (!newAppAccountId) {
      setError("Debes seleccionar una cuenta de la app.");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Sesion expirada. Inicia sesion de nuevo.");

      const { error: insertError } = await supabase.from("bot_accounts").insert({
        user_id: userId,
        bot_id: selectedBotId,
        account_id: accountId,
        label: newMt5AccountLabel.trim() || null,
        app_account_id: newAppAccountId,
      });

      if (insertError) throw insertError;

      setShowAddAccountModal(false);
      resetAddAccountForm();
      setNotice("Cuenta MT5 agregada y vinculada correctamente.");
      await loadData();
    } catch (err) {
      console.error("[BotControl] add bot account error:", err);
      setError(normalizeError(err, "No se pudo agregar la cuenta MT5."));
    } finally {
      setLoading(false);
    }
  };

  const handleRelinkBotAccount = async () => {
    if (!selectedBotAccountId) {
      setError("Selecciona una cuenta MT5 para vincular.");
      return;
    }
    if (!selectedAppAccountId) {
      setError("Selecciona una cuenta de la app.");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { error: updateError } = await supabase
        .from("bot_accounts")
        .update({ app_account_id: selectedAppAccountId })
        .eq("id", selectedBotAccountId);

      if (updateError) throw updateError;

      setShowSelectAccountModal(false);
      setNotice("Cuenta vinculada correctamente.");
      await loadData();
    } catch (err) {
      console.error("[BotControl] relink bot account error:", err);
      setError(normalizeError(err, "No se pudo vincular la cuenta seleccionada."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-200">
      <header className="bg-slate-900/80 border-b border-slate-700/60 px-6 py-4 flex items-center justify-between backdrop-blur-xl shadow-[0_12px_30px_rgba(2,4,10,0.45)]">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🤖</span>
            <h1 className="display-font text-2xl font-semibold text-slate-50">{profile.title}</h1>
          </div>
          <p className="text-sm text-slate-400">{profile.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href={basePath}
            className="px-3 py-2 rounded-xl border border-slate-600 bg-slate-800/80 text-sm font-semibold text-slate-100 hover:bg-slate-700/80 transition"
          >
            Atrás al selector
          </Link>
          <button
            onClick={openAddAccountModal}
            disabled={offlineMode || loading}
            className="px-3 py-2 rounded-xl border border-slate-600 bg-slate-800/80 text-sm font-semibold text-slate-100 hover:bg-slate-700/80 transition disabled:opacity-60"
          >
            Agregar cuenta
          </button>
          <button
            onClick={openSelectAccountModal}
            disabled={offlineMode || loading}
            className="px-3 py-2 rounded-xl border border-blue-500/50 bg-blue-500/20 text-sm font-semibold text-blue-100 hover:bg-blue-500/30 transition disabled:opacity-60"
          >
            Seleccionar cuenta
          </button>
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

          {notice && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-200 text-sm">
              {notice}
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-1 p-1 rounded-xl border border-white/10 bg-white/[0.03] w-fit">
            {(["controls", "iv-surface", "engine", "skills"] as const).map((tab) => {
              const labels: Record<string, string> = {
                controls: "Controls",
                "iv-surface": "IV Surface",
                engine: "Engine DevTools",
                skills: "Skills",
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {activeTab === "controls" && (
          <>
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
                    {profile.lotsLabel}
                    <input
                      type="number"
                      step="0.01"
                      min={isFutures ? "1" : "0.01"}
                      max={isFutures ? "100" : "1.0"}
                      value={Number(settingsGlobal[lotsKey] ?? profileDefaults[lotsKey] ?? (isFutures ? 1 : 0.01))}
                      onChange={(e) => updateSetting(lotsKey, Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    {profile.maxTotalLabel}
                    <input
                      type="number"
                      value={Number(settingsGlobal[maxTotalKey] ?? profileDefaults[maxTotalKey] ?? (isFutures ? 10 : 50))}
                      onChange={(e) => updateSetting(maxTotalKey, Number(e.target.value))}
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
                      <option value={0}>{isFutures ? "TICKS" : "POINTS"}</option>
                      <option value={1}>ATR</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    {profile.rangeMinLabel}
                    <input
                      type="number"
                      value={Number(settingsGlobal[rangeMinKey] ?? profileDefaults[rangeMinKey] ?? 0)}
                      onChange={(e) => updateSetting(rangeMinKey, Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    {profile.rangeMaxLabel}
                    <input
                      type="number"
                      value={Number(settingsGlobal[rangeMaxKey] ?? profileDefaults[rangeMaxKey] ?? 0)}
                      onChange={(e) => updateSetting(rangeMaxKey, Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  {isFutures && (
                    <>
                      <label className="flex flex-col gap-1">
                        TickSize
                        <input
                          type="number"
                          step="0.01"
                          value={Number(settingsGlobal.TickSize ?? profileDefaults.TickSize ?? 0.25)}
                          onChange={(e) => updateSetting("TickSize", Number(e.target.value))}
                          className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        TickValue
                        <input
                          type="number"
                          step="0.01"
                          value={Number(settingsGlobal.TickValue ?? profileDefaults.TickValue ?? 12.5)}
                          onChange={(e) => updateSetting("TickValue", Number(e.target.value))}
                          className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                        />
                      </label>
                    </>
                  )}
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
                    {isFutures ? "OBBufferTicks" : "OBBufferPoints"}
                    <input
                      type="number"
                      value={Number(settingsGlobal[obBufferKey] ?? profileDefaults[obBufferKey] ?? 50)}
                      onChange={(e) => updateSetting(obBufferKey, Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    {isFutures ? "EQToleranceTicks" : "EQTolerancePoints"}
                    <input
                      type="number"
                      value={Number(settingsGlobal[eqToleranceKey] ?? profileDefaults[eqToleranceKey] ?? 20)}
                      onChange={(e) => updateSetting(eqToleranceKey, Number(e.target.value))}
                      className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-2 col-span-2">
                    <input
                      type="checkbox"
                      checked={Boolean(settingsGlobal[targetEnabledKey] ?? false)}
                      onChange={(e) => updateSetting(targetEnabledKey, e.target.checked)}
                    />
                    {profile.targetEnabledLabel}
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
                  {isFutures ? (
                    <>
                      <label className="flex flex-col gap-1">
                        SessionTemplate
                        <select
                          value={String(settingsGlobal.SessionTemplate ?? "RTH")}
                          onChange={(e) => updateSetting("SessionTemplate", e.target.value)}
                          className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                        >
                          <option value="RTH">RTH</option>
                          <option value="ETH">ETH</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        SessionStart
                        <input
                          type="time"
                          value={String(settingsGlobal.SessionStart ?? "13:30")}
                          onChange={(e) => updateSetting("SessionStart", e.target.value)}
                          className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        SessionEnd
                        <input
                          type="time"
                          value={String(settingsGlobal.SessionEnd ?? "20:00")}
                          onChange={(e) => updateSetting("SessionEnd", e.target.value)}
                          className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                        />
                      </label>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
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

              {isFutures && (
                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4 md:col-span-2">
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">Rollover Guard</h3>
                  <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-3">
                      <div className="text-xs text-slate-500">Contrato activo</div>
                      <div className="mt-1">{String(settingsGlobal.ActiveContract || "Sin data aún")}</div>
                    </div>
                    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-3">
                      <div className="text-xs text-slate-500">Rollover cercano</div>
                      <div className="mt-1">{String(settingsGlobal.RolloverStatus || "Sin data aún")}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-[0_18px_40px_rgba(2,4,10,0.45)] backdrop-blur">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="display-font text-lg font-semibold text-slate-100">Cuentas</h2>
                <p className="text-sm text-slate-400">Estado por cuenta + overrides</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-300">
                Perfil activo: {profile.botName}
              </div>
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
                        <div className="text-xs text-slate-500">
                          Cuenta app vinculada: {account.app_account_id ? (appAccountsMap.get(account.app_account_id) || "No disponible") : "Sin vincular"}
                        </div>
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
                          {profile.lotsLabel}
                          <input
                            type="number"
                            step="0.01"
                            min={isFutures ? "1" : "0.01"}
                            max={isFutures ? "100" : "1.0"}
                            value={Number(settingsOverride[account.id]?.[lotsKey] ?? settingsGlobal[lotsKey] ?? profileDefaults[lotsKey] ?? (isFutures ? 1 : 0.01))}
                            onChange={(e) => updateOverrideSetting(account.id, lotsKey, Number(e.target.value))}
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
                            <option value={0}>{isFutures ? "TICKS" : "POINTS"}</option>
                            <option value={1}>ATR</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          {profile.rangeMinLabel}
                          <input
                            type="number"
                            value={Number(settingsOverride[account.id]?.[rangeMinKey] ?? settingsGlobal[rangeMinKey] ?? profileDefaults[rangeMinKey] ?? 0)}
                            onChange={(e) => updateOverrideSetting(account.id, rangeMinKey, Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          {profile.rangeMaxLabel}
                          <input
                            type="number"
                            value={Number(settingsOverride[account.id]?.[rangeMaxKey] ?? settingsGlobal[rangeMaxKey] ?? profileDefaults[rangeMaxKey] ?? 0)}
                            onChange={(e) => updateOverrideSetting(account.id, rangeMaxKey, Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                        {isFutures && (
                          <>
                            <label className="flex flex-col gap-1">
                              TickSize
                              <input
                                type="number"
                                step="0.01"
                                value={Number(settingsOverride[account.id]?.TickSize ?? settingsGlobal.TickSize ?? profileDefaults.TickSize ?? 0.25)}
                                onChange={(e) => updateOverrideSetting(account.id, "TickSize", Number(e.target.value))}
                                className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              TickValue
                              <input
                                type="number"
                                step="0.01"
                                value={Number(settingsOverride[account.id]?.TickValue ?? settingsGlobal.TickValue ?? profileDefaults.TickValue ?? 12.5)}
                                onChange={(e) => updateOverrideSetting(account.id, "TickValue", Number(e.target.value))}
                                className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                              />
                            </label>
                          </>
                        )}
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
                          {isFutures ? "OBBufferTicks" : "OBBufferPoints"}
                          <input
                            type="number"
                            value={Number(settingsOverride[account.id]?.[obBufferKey] ?? settingsGlobal[obBufferKey] ?? profileDefaults[obBufferKey] ?? 50)}
                            onChange={(e) => updateOverrideSetting(account.id, obBufferKey, Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          {isFutures ? "EQToleranceTicks" : "EQTolerancePoints"}
                          <input
                            type="number"
                            value={Number(settingsOverride[account.id]?.[eqToleranceKey] ?? settingsGlobal[eqToleranceKey] ?? profileDefaults[eqToleranceKey] ?? 20)}
                            onChange={(e) => updateOverrideSetting(account.id, eqToleranceKey, Number(e.target.value))}
                            className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                          />
                        </label>
                        <label className="flex items-center gap-2 col-span-2">
                          <input
                            type="checkbox"
                            checked={Boolean(settingsOverride[account.id]?.[targetEnabledKey] ?? settingsGlobal[targetEnabledKey] ?? false)}
                            onChange={(e) => updateOverrideSetting(account.id, targetEnabledKey, e.target.checked)}
                          />
                          {profile.targetEnabledLabel}
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
                        {isFutures && (
                          <>
                            <label className="flex flex-col gap-1">
                              SessionTemplate
                              <select
                                value={String(settingsOverride[account.id]?.SessionTemplate ?? settingsGlobal.SessionTemplate ?? "RTH")}
                                onChange={(e) => updateOverrideSetting(account.id, "SessionTemplate", e.target.value)}
                                className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                              >
                                <option value="RTH">RTH</option>
                                <option value="ETH">ETH</option>
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              SessionStart
                              <input
                                type="time"
                                value={String(settingsOverride[account.id]?.SessionStart ?? settingsGlobal.SessionStart ?? "13:30")}
                                onChange={(e) => updateOverrideSetting(account.id, "SessionStart", e.target.value)}
                                className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              SessionEnd
                              <input
                                type="time"
                                value={String(settingsOverride[account.id]?.SessionEnd ?? settingsGlobal.SessionEnd ?? "20:00")}
                                onChange={(e) => updateOverrideSetting(account.id, "SessionEnd", e.target.value)}
                                className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-1"
                              />
                            </label>
                          </>
                        )}
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
          </>
          )}

          {activeTab === "iv-surface" && (
            <IVSurfacePanel
              botInstanceId={
                instances.find((i) => i.bot_account_id === selectedBotAccountId)?.id ??
                instances[0]?.id ??
                ""
              }
            />
          )}

          {activeTab === "engine" && (
            <EngineDevToolsPanel
              botInstanceId={
                instances.find((i) => i.bot_account_id === selectedBotAccountId)?.id ??
                instances[0]?.id ??
                ""
              }
            />
          )}

          {activeTab === "skills" && (
            <SkillsPanel />
          )}
        </div>
      </div>

      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-100">Agregar cuenta MT5</h3>
            <p className="mt-1 text-sm text-slate-400">Registra el account id donde el bot operara y vincula la cuenta de la app.</p>

            <div className="mt-4 space-y-3">
              <label className="flex flex-col gap-1 text-sm">
                Account ID MT5 *
                <input
                  type="text"
                  value={newMt5AccountId}
                  onChange={(e) => setNewMt5AccountId(e.target.value)}
                  placeholder="Ej: 12345678"
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                Etiqueta (opcional)
                <input
                  type="text"
                  value={newMt5AccountLabel}
                  onChange={(e) => setNewMt5AccountLabel(e.target.value)}
                  placeholder="Ej: Cuenta principal"
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                Cuenta de la app *
                <select
                  value={newAppAccountId}
                  onChange={(e) => setNewAppAccountId(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2"
                >
                  <option value="">Selecciona una cuenta</option>
                  {appAccounts.map((appAccount) => (
                    <option key={appAccount.id} value={appAccount.id}>
                      {appAccount.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setShowAddAccountModal(false)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddBotAccount}
                disabled={loading}
                className="rounded-lg bg-emerald-500/80 px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60"
              >
                Guardar cuenta
              </button>
            </div>
          </div>
        </div>
      )}

      {showSelectAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-100">Seleccionar cuenta</h3>
            <p className="mt-1 text-sm text-slate-400">Vincula una cuenta MT5 existente con una cuenta registrada en la app.</p>

            <div className="mt-4 space-y-3">
              <label className="flex flex-col gap-1 text-sm">
                Cuenta MT5
                <select
                  value={selectedBotAccountId}
                  onChange={(e) => setSelectedBotAccountId(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2"
                >
                  <option value="">Selecciona una cuenta MT5</option>
                  {accountsForBot.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label || account.account_id} ({account.account_id})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                Cuenta de la app
                <select
                  value={selectedAppAccountId}
                  onChange={(e) => setSelectedAppAccountId(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2"
                >
                  <option value="">Selecciona una cuenta</option>
                  {appAccounts.map((appAccount) => (
                    <option key={appAccount.id} value={appAccount.id}>
                      {appAccount.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setShowSelectAccountModal(false)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleRelinkBotAccount}
                disabled={loading}
                className="rounded-lg bg-blue-500/80 px-3 py-2 text-sm font-semibold text-slate-100 disabled:opacity-60"
              >
                Guardar vinculacion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
