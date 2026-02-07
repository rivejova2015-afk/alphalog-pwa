# EA Remote Setup (GoldRangeBasketR)

## 1) Crear Bot y Cuentas en Supabase
Tablas:
- bots
- bot_accounts
- bot_instances
- bot_settings_global
- bot_settings_override

Pasos sugeridos:
1. Crear un bot (bots) con tu user_id y nombre.
2. Crear cuentas (bot_accounts) con account_id únicos (1–15). 
3. Crear instancias (bot_instances) por cuenta con:
   - instance_id
   - instance_secret

## 2) Configurar EA en MT5
Inputs del EA:
- RemoteEnabled = true
- AccountId = (account_id de bot_accounts)
- InstanceId = (instance_id de bot_instances)
- InstanceSecret = (instance_secret de bot_instances)
- ApiBaseUrl = https://YOUR-SUPABASE-PROJECT.supabase.co/functions/v1

MT5 → Tools → Options → Expert Advisors → Allow WebRequest para:
- https://YOUR-SUPABASE-PROJECT.supabase.co

## 3) Settings efectivos
- Global: bot_settings_global.settings
- Override por cuenta: bot_settings_override.settings
- Effective = global + override

Claves soportadas (JSON):
- LotsFixed
- MaxPositionsTotal
- MaxEntriesPerBar
- ATRPeriod
- ATRk
- WarmupMinutes
- RangeGateEnabled
- RangeGateMinPoints
- RangeGateMaxPoints
- RangeGateMode
- RangeGateMinATR
- RangeGateMaxATR
- OrderFlowEnabled
- NewsEnabled
- NewsLotMultiplier
- DecisionEngineEnabled
- DecisionScoreMin
- DecisionBaseStart
- SweepLookbackBars
- MaxRetest
- OBBufferPoints
- EQTolerancePoints
- TargetEnabled
- TargetPct
- AsiaPrimeStart
- AsiaPrimeEnd
- NYPrimeStart
- NYPrimeEnd

## 4) Comandos
Desde /dashboard/bot-control:
- START, STOP, RESTART_LOGIC, CLOSE_ALL, EMERGENCY_STOP
- APPLY_SETTINGS (aplica settings efectivos)

## 5) Telemetría
El EA envía:
- equity, balance, positions_total, basket_r, tier
- last_signal_text, last_signal_ts, last_heartbeat_ts

## 6) Verificación
- Guardar EA → compila .ex5
- MT5 Navigator → Refresh → EA visible
- Bot Control: ONLINE por heartbeat (10s)
