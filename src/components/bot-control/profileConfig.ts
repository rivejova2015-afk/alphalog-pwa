"use client";

export type BotMode = "forex" | "futuros";

export interface BotProfileConfig {
  mode: BotMode;
  botName: string;
  title: string;
  subtitle: string;
  lotsLabel: string;
  lotsKey: string;
  maxTotalLabel: string;
  maxTotalKey: string;
  rangeMinLabel: string;
  rangeMinKey: string;
  rangeMaxLabel: string;
  rangeMaxKey: string;
  targetEnabledLabel: string;
  targetEnabledKey: string;
  settingsDefaults: Record<string, unknown>;
}

const FOREX_DEFAULT_SETTINGS: Record<string, unknown> = {
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

const FUTURES_DEFAULT_SETTINGS: Record<string, unknown> = {
  ContractsFixed: 1,
  MaxContractsTotal: 10,
  MaxEntriesPerBar: 15,
  ATRPeriod: 14,
  ATRk: 1.0,
  WarmupMinutes: 45,
  RangeGateEnabled: false,
  RangeGateMode: 0,
  RangeGateMinTicks: 0,
  RangeGateMaxTicks: 0,
  RangeGateMinATR: 0.0,
  RangeGateMaxATR: 0.0,
  TickSize: 0.25,
  TickValue: 12.5,
  SessionTemplate: "RTH",
  SessionStart: "13:30",
  SessionEnd: "20:00",
  OrderFlowEnabled: false,
  NewsEnabled: false,
  NewsLotMultiplier: 0.7,
  DecisionEngineEnabled: false,
  DecisionScoreMin: 60,
  DecisionBaseStart: 60,
  SweepLookbackBars: 10,
  MaxRetest: 1,
  OBBufferTicks: 50,
  EQToleranceTicks: 20,
  DailyTargetEnabled: false,
  TargetPct: 1.0,
};

export const BOT_PROFILE_CONFIG: Record<BotMode, BotProfileConfig> = {
  forex: {
    mode: "forex",
    botName: "Bot Forex",
    title: "Bot Forex",
    subtitle: "Control panel AlphaLog -> EA GoldRangeBasketR",
    lotsLabel: "LotsFixed",
    lotsKey: "LotsFixed",
    maxTotalLabel: "MaxPositionsTotal",
    maxTotalKey: "MaxPositionsTotal",
    rangeMinLabel: "RangeGateMinPoints",
    rangeMinKey: "RangeGateMinPoints",
    rangeMaxLabel: "RangeGateMaxPoints",
    rangeMaxKey: "RangeGateMaxPoints",
    targetEnabledLabel: "Daily Target Enabled",
    targetEnabledKey: "TargetEnabled",
    settingsDefaults: FOREX_DEFAULT_SETTINGS,
  },
  futuros: {
    mode: "futuros",
    botName: "Bot Futuros",
    title: "Bot Futuros",
    subtitle: "Control panel AlphaLog -> Futures Runtime",
    lotsLabel: "ContractsFixed",
    lotsKey: "ContractsFixed",
    maxTotalLabel: "MaxContractsTotal",
    maxTotalKey: "MaxContractsTotal",
    rangeMinLabel: "RangeGateMinTicks",
    rangeMinKey: "RangeGateMinTicks",
    rangeMaxLabel: "RangeGateMaxTicks",
    rangeMaxKey: "RangeGateMaxTicks",
    targetEnabledLabel: "Daily Target Enabled",
    targetEnabledKey: "DailyTargetEnabled",
    settingsDefaults: FUTURES_DEFAULT_SETTINGS,
  },
};

export function getBotProfileConfig(mode: BotMode): BotProfileConfig {
  return BOT_PROFILE_CONFIG[mode];
}
