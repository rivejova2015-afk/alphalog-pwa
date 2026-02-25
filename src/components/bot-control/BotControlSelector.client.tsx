"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BackToDashboardButton from "@/components/BackToDashboardButton.client";
import { PushNotificationButton } from "@/components/push/PushNotificationButton.client";
import { createClient } from "@/lib/supabase/browser";
import { isOffline } from "@/lib/offline/snapshot";
import { BOT_PROFILE_CONFIG, BotMode } from "@/components/bot-control/profileConfig";

interface BotRow {
  id: string;
  name: string;
}

interface BotAccountRow {
  id: string;
  bot_id: string;
}

interface BotInstanceRow {
  bot_account_id: string;
  last_heartbeat_at: string | null;
}

interface BotCommandRow {
  id: string;
  bot_id: string;
  command_type: string;
  status: string;
  created_at: string;
}

type SelectorStatus = "Online" | "Paused" | "Error";

interface CardState {
  status: SelectorStatus;
  lastEvent: string;
  botId: string | null;
}

interface BotControlSelectorProps {
  basePath: string;
}

const ONLINE_THRESHOLD_MS = 30_000;

function formatEvent(command: BotCommandRow | undefined): string {
  if (!command) return "Sin eventos recientes";
  const ts = new Date(command.created_at);
  return `${command.command_type} · ${ts.toLocaleDateString()} ${ts.toLocaleTimeString()}`;
}

function getStatusClass(status: SelectorStatus): string {
  if (status === "Online") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (status === "Error") return "border-rose-500/40 bg-rose-500/10 text-rose-200";
  return "border-slate-600/60 bg-slate-800/70 text-slate-300";
}

export default function BotControlSelector({ basePath }: BotControlSelectorProps) {
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardState, setCardState] = useState<Record<BotMode, CardState>>({
    forex: { status: "Paused", lastEvent: "Sin eventos recientes", botId: null },
    futuros: { status: "Paused", lastEvent: "Sin eventos recientes", botId: null },
  });
  const supabase = useMemo(() => createClient(), []);

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
    const loadSelector = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData?.user) {
          throw new Error("Sesion no valida para Bot Control.");
        }

        const requiredBotNames = [BOT_PROFILE_CONFIG.forex.botName, BOT_PROFILE_CONFIG.futuros.botName];
        let bots: BotRow[] = [];

        const botsResult = await supabase.from("bots").select("id, name").order("created_at", { ascending: true });
        if (botsResult.error) throw botsResult.error;
        bots = (botsResult.data || []) as BotRow[];

        if (!offlineMode) {
          const existingNames = new Set(bots.map((bot) => bot.name));
          const missingRows = requiredBotNames
            .filter((name) => !existingNames.has(name))
            .map((name) => ({ user_id: authData.user.id, name }));

          if (missingRows.length > 0) {
            const insertResult = await supabase.from("bots").insert(missingRows).select("id, name");
            if (insertResult.error) throw insertResult.error;

            const refresh = await supabase.from("bots").select("id, name").order("created_at", { ascending: true });
            if (refresh.error) throw refresh.error;
            bots = (refresh.data || []) as BotRow[];
          }
        }

        const botByName = new Map<string, string>();
        bots.forEach((bot) => botByName.set(bot.name, bot.id));

        const selectedBotIds = Object.values(BOT_PROFILE_CONFIG)
          .map((profile) => botByName.get(profile.botName))
          .filter((id): id is string => Boolean(id));

        const [accountsRes, instancesRes, commandsRes] = await Promise.all([
          selectedBotIds.length > 0
            ? supabase.from("bot_accounts").select("id, bot_id").in("bot_id", selectedBotIds)
            : Promise.resolve({ data: [], error: null }),
          supabase.from("bot_instances").select("bot_account_id, last_heartbeat_at"),
          selectedBotIds.length > 0
            ? supabase
                .from("bot_commands")
                .select("id, bot_id, command_type, status, created_at")
                .in("bot_id", selectedBotIds)
                .order("created_at", { ascending: false })
                .limit(25)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (accountsRes.error) throw accountsRes.error;
        if (instancesRes.error) throw instancesRes.error;
        if (commandsRes.error) throw commandsRes.error;

        const accountRows = (accountsRes.data || []) as BotAccountRow[];
        const instanceRows = (instancesRes.data || []) as BotInstanceRow[];
        const commandRows = (commandsRes.data || []) as BotCommandRow[];
        const accountIdToBotId = new Map<string, string>();
        accountRows.forEach((row) => accountIdToBotId.set(row.id, row.bot_id));

        const now = Date.now();
        const perMode: Record<BotMode, CardState> = {
          forex: { status: "Paused", lastEvent: "Sin eventos recientes", botId: botByName.get(BOT_PROFILE_CONFIG.forex.botName) || null },
          futuros: { status: "Paused", lastEvent: "Sin eventos recientes", botId: botByName.get(BOT_PROFILE_CONFIG.futuros.botName) || null },
        };

        (["forex", "futuros"] as BotMode[]).forEach((mode) => {
          const profile = BOT_PROFILE_CONFIG[mode];
          const botId = botByName.get(profile.botName) || null;
          const modeCommands = commandRows.filter((command) => command.bot_id === botId);
          const latestCommand = modeCommands[0];

          const hasFailed = modeCommands.some((command) => command.status === "FAILED");
          const hasOnlineInstance = instanceRows.some((instance) => {
            const rowBotId = accountIdToBotId.get(instance.bot_account_id);
            if (!rowBotId || rowBotId !== botId || !instance.last_heartbeat_at) return false;
            return now - new Date(instance.last_heartbeat_at).getTime() <= ONLINE_THRESHOLD_MS;
          });

          perMode[mode] = {
            status: hasOnlineInstance ? "Online" : hasFailed ? "Error" : "Paused",
            lastEvent: formatEvent(latestCommand),
            botId,
          };
        });

        setCardState(perMode);
      } catch (err) {
        console.error("[BotControlSelector] load error:", err);
        setError(err instanceof Error ? err.message : "No se pudo cargar Bot Control.");
      } finally {
        setLoading(false);
      }
    };

    void loadSelector();
  }, [offlineMode, supabase]);

  return (
    <div className="min-h-screen text-slate-200">
      <header className="bg-slate-900/80 border-b border-slate-700/60 px-6 py-4 flex items-center justify-between backdrop-blur-xl shadow-[0_12px_30px_rgba(2,4,10,0.45)]">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🤖</span>
            <h1 className="display-font text-2xl font-semibold text-slate-50">Bot Control</h1>
          </div>
          <p className="text-sm text-slate-400">Selecciona el perfil operativo</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <PushNotificationButton />
          <BackToDashboardButton />
        </div>
      </header>

      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {offlineMode && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200 text-sm">
              Estás en modo offline. Selector en modo lectura.
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-200 text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {(Object.keys(BOT_PROFILE_CONFIG) as BotMode[]).map((mode) => {
              const profile = BOT_PROFILE_CONFIG[mode];
              const state = cardState[mode];

              return (
                <Link
                  key={mode}
                  href={`${basePath}/${mode}`}
                  className="rounded-3xl border border-slate-700/70 bg-slate-900/70 p-6 shadow-[0_18px_40px_rgba(2,4,10,0.45)] backdrop-blur transition hover:border-blue-400/40 hover:bg-slate-900/85"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="display-font text-xl font-semibold text-slate-100">{profile.title}</h2>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(state.status)}`}>
                      {loading ? "Cargando..." : state.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{profile.subtitle}</p>
                  <div className="mt-4 rounded-xl border border-slate-700/60 bg-slate-900/50 p-3">
                    <div className="text-xs text-slate-500">Último evento</div>
                    <div className="mt-1 text-sm text-slate-200">{loading ? "Cargando..." : state.lastEvent}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
