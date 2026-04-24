# QStash Configuration — HMM Regime Updater

## Cron Job: bot-regime-update

Actualiza el régimen de mercado con el modelo HMM cada 15 minutos en días hábiles.

### Configuración QStash

| Campo | Valor |
|-------|-------|
| URL | `https://alphalog.io/api/bot/regime/update` |
| Schedule | `*/15 * * * 1-5` (cada 15 min, lunes-viernes) |
| Method | `POST` |
| Body | `{}` (el endpoint obtiene datos de Supabase internamente) |

### Headers requeridos

```
Authorization: Bearer ${CRON_SECRET}
Content-Type: application/json
```

### Variables de entorno en Vercel

| Variable | Estado | Descripción |
|----------|--------|-------------|
| `CRON_SECRET` | **NUEVA — agregar en Vercel** | Token para autenticar llamadas cron de QStash |
| `BOT_SIGNAL_SECRET` | **NUEVA — agregar en Vercel** | Token para que el EA autentique `GET /api/bot/regime/current` |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya existe | Necesaria para las operaciones admin del endpoint |

### Cómo crear el cron en QStash (CLI)

```bash
curl -X POST https://qstash.upstash.io/v2/schedules \
  -H "Authorization: Bearer <QSTASH_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "https://alphalog.io/api/bot/regime/update",
    "cron": "*/15 * * * 1-5",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer <CRON_SECRET>",
      "Content-Type": "application/json"
    },
    "body": "{}"
  }'
```

### Endpoint: GET /api/bot/regime/current

Usado por el EA para cachear el régimen actual cada 15 minutos.

```
GET https://alphalog.io/api/bot/regime/current?botInstanceId=<uuid>
Authorization: Bearer <BOT_SIGNAL_SECRET>
```

Respuesta:
```json
{
  "regime": "SIDEWAYS_LOW_VOL",
  "confidence": 0.72,
  "detectedAt": "2026-04-20T14:00:00Z",
  "strategyApplied": "MEAN_REVERSION",
  "isColdStart": false,
  "stateProbabilities": { ... }
}
```

Cold start (sin datos previos):
```json
{
  "regime": "SIDEWAYS_LOW_VOL",
  "confidence": 0.5,
  "detectedAt": null,
  "strategyApplied": "MEAN_REVERSION",
  "isColdStart": true,
  "stateProbabilities": null
}
```

### Flujo completo

```
QStash (*/15 min lun-vie)
  → POST /api/bot/regime/update (Bearer CRON_SECRET)
    → live_market_data (XAUUSD, últimos 1000 ticks)
    → classifyRegime() → Viterbi HMM 7 estados
    → [si >= 96 obs] baumWelch() → refinar modelo
    → INSERT bot_regime_states
    → UPDATE bot_signal_engine_state.regime_code + hmm_model

EA (MetaTrader, cada 15 min)
  → GET /api/bot/regime/current?botInstanceId=<id> (Bearer BOT_SIGNAL_SECRET)
    → SELECT último bot_regime_states
    → Cache-Control: private, max-age=900
```

### Estrategias por régimen

| Régimen | Estrategia aplicada |
|---------|---------------------|
| `BULL_TREND_STRONG` | `TREND_FOLLOW` |
| `BEAR_TREND_STRONG` | `TREND_FOLLOW` |
| `BULL_TREND_WEAK` | `WEAK_TREND` |
| `BEAR_TREND_WEAK` | `WEAK_TREND` |
| `SIDEWAYS_LOW_VOL` | `MEAN_REVERSION` |
| `SIDEWAYS_HIGH_VOL` | `MEAN_REVERSION` |
| `BREAKOUT_IMMINENT` | `BREAKOUT_PREP` |
