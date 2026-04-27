# PolyArb Crypto Latency Physics v1 — Documento de Estado Completo

**Generado**: 2026-04-27  
**Versión del engine**: Level 150 — Consensus Extendido de 14 Voters  
**Deploy**: Fly.io `polyarb-crypto-v1` · Región: Singapore (`sin`)  
**Modo actual**: DRY_RUN (paper trading)

---

## 1. Descripción General

PolyArb es un bot de arbitraje autónomo que opera en **Polymarket** (mercados de predicción de criptomonedas). Opera mercados de tipo `btc-updown-5m-{timestamp}`: contratos binarios que resuelven en 5 minutos sobre si BTC/ETH subirá o bajará.

**Filosofía**: Máxima agresividad matemática. Kelly criterion, física de momentum, consenso multi-engine. Sin filtros de riesgo conservadores.

**Stack**: Node.js 22 · TypeScript 5 · ESM · Supabase (PostgreSQL) · Fly.io · Ethers.js 6 · Zod

---

## 2. Arquitectura del Engine

### 2.1 Loop Principal (`src/index.ts` + `src/loop.ts`)

```
index.ts (startup)
  ├── loadAgentConfig()          — config desde Supabase
  ├── sweepUnsettledPositions()  — liquida posiciones pasadas al arrancar
  ├── redeemPendingWins()        — redención on-chain via NegRiskAdapter
  ├── BinanceFeed.start()        — WebSocket BTC/ETH/SOL precios en tiempo real
  ├── PolymarketFeed.start()     — polling CLOB orderbook cada 5s
  └── runLoop() → tradingTick()  — loop secuencial (setTimeout, NO setInterval)

loop.ts (tick cada 250ms)
  ├── runStatisticalChecks()     — Circuit Breaker estadístico cada 5 min
  ├── checkProfitTakeExits()     — cierra posiciones que alcanzaron profit target
  ├── checkTimedOutPositions()   — cierra posiciones cuyo mercado expiró
  └── processMarket()            — evalúa cada mercado activo para entrada
```

**Crítico**: El loop usa `setTimeout` recursivo (NO `setInterval`). Cada tick espera a que el anterior complete antes de iniciar el siguiente. Esto elimina el race condition que causó 608 exits duplicados.

---

## 3. Feeds de Datos

### 3.1 Binance WebSocket (`src/feeds/binance-ws.ts`)
- Stream combinado: `btcusdt@aggTrade` + `ethusdt@aggTrade` + `solusdt@aggTrade`
- Actualización en tiempo real de precio de referencia (off-chain)
- Reconexión automática con backoff exponencial

### 3.2 Polymarket Feed (`src/feeds/polymarket-ws.ts`)
- Polling del CLOB orderbook: `GET /book?token_id={tokenId}`
- Intervalo: 5 segundos por mercado
- Expone: best bid, best ask, bid size, ask size
- Hook `onOrderbookUpdate` → alimenta SentimentPulseTracker
- Descubrimiento de mercados: `fetchCryptoMarkets()` via Gamma API
- Refresh automático de mercados nuevos cada 5 minutos

---

## 4. Matemática del Engine

### 4.1 Momentum Physics (`src/math/momentum-physics.ts`)
```
velocity    = (currentPrice - prevPrice) / dt
acceleration = (velocity - prevVelocity) / dt
jerk         = (acceleration - prevAcceleration) / dt
```
- Detecta dirección, fuerza y cambio de aceleración del precio de Polymarket
- Base del "Hunt Signal": velocidad > threshold → señal de entrada

### 4.2 Heston Volatility (`src/math/heston-vol.ts`)
- Modelo de volatilidad estocástica para precio justo del contrato
- Parámetros: κ (mean-reversion), θ (long-run vol), σ (vol-of-vol), ρ (correlación)

### 4.3 Jump Diffusion (`src/math/jump-diffusion.ts`)
- Modelo Merton para eventos de salto (noticias macro, flash crashes)
- Ajusta el fairPrice cuando hay probabilidad alta de salto

### 4.4 Kelly Sizer (`src/math/kelly-sizer.ts`)
- Kelly criterion clásico para sizing de posición
- Cap máximo: 10% del capital disponible por posición

### 4.5 Asymmetric Kelly (`src/math/asymmetric-kelly.ts`) ← NUEVO (Level 150)
- Reemplaza `rewardRiskRatio = 1.5` fijo
- `b = (1 - entryPrice) / entryPrice` — ratio real del mercado binario
- YES @ 0.10: b=9.0 → Kelly agresivo | YES @ 0.90: b=0.11 → Kelly conservador

### 4.6 Vol Surface (`src/math/vol-surface.ts`)
- Superficie de volatilidad implícita por strike
- Calibración continua con datos de mercado

---

## 5. Consensus de 14 Engines (Level 150)

El bot vota en consenso. Para entrar se requiere mayoría calificada de engines + margen de score. Todos votan YES o NO.

### Pool de Voters

| ID | Engine | Archivo | Descripción |
|----|--------|---------|-------------|
| V1 | Velocity Detector | `skills/velocity-detector.ts` | Momentum del precio de Polymarket |
| V2 | Sentiment Pulse | `skills/sentiment-pulse.ts` | Flujo bid/ask del orderbook |
| V3 | Fundamental Engine | `analysis/fundamental-engine.ts` | F&G + Derivatives + News + MacroGuard |
| V4 | Adaptive Kelly | `skills/adaptive-kelly.ts` | Kelly ajustado por win rate reciente |
| A2 | Orderbook Depth | `skills/orderbook-depth.ts` | Imbalance de 5 niveles bid vs ask |
| A3 | Stasis Breakout | `skills/stasis-breakout.ts` | Breakout tras precio quieto ≥5min |
| A4 | Entropy Detector | `skills/entropy-detector.ts` | Shannon entropy de últimos 40 ticks |
| B1 | Funding Momentum | `analysis/providers/funding-momentum.ts` | Velocidad de cambio del funding rate |
| B2 | News Impact Decay | `analysis/providers/news-impact-decay.ts` | Decay personalizado por tipo de titular |
| B3 | Session Clock | `skills/session-clock.ts` | Win rate condicional por sesión UTC |
| B4 | Sentiment Divergence | `skills/sentiment-divergence.ts` | Fear&Greed vs movimiento real de precio |
| C3 | Reversal Radar | `skills/reversal-radar.ts` | Jerk negativo → reversión inminente |
| C4 | Bayesian Win Rate | `skills/bayesian-winrate.ts` | Beta posterior por condición de mercado |
| E2 | Replay Similarity | `skills/replay-similarity.ts` | Situaciones similares en historial |

### Engines de Soporte (no votan, modifican comportamiento)

| ID | Engine | Función |
|----|--------|---------|
| C1 | Adaptive Consensus | Thresholds dinámicos según win rate reciente |
| C2 | Asymmetric Kelly | Sizing real por strike del mercado binario |
| D1 | Spoofing Detector | VETO HARD si detecta órdenes fantasma |
| E1 | Calibration Tracker | Bias correction del fairPrice por bucket de probabilidad |
| E3 | Adaptive Profit-Take | Profit target dinámico 60–85% (vs 70% fijo) |

### Adaptive Consensus Thresholds (C1)

| Win Rate Reciente | Fracción de Voters | Margen de Score |
|------------------|--------------------|-----------------|
| ≥ 75% | 55% | 0.45 |
| ≥ 60% | 60% | 0.55 |
| ≥ 45% | 65% | 0.60 |
| < 45% | 75% | 0.75 |

*Floor absoluto: mínimo 3 votes, mínimo margen 0.45*

---

## 6. Fundamental Engine (`src/analysis/fundamental-engine.ts`)

Agregador de señales macro. Corre en background con refresh cada 1 minuto.

### Providers

| Provider | Fuente | Señal |
|----------|--------|-------|
| Fear & Greed (`fear-greed.ts`) | Alternative.me API | Score 0-100, sesgo direccional |
| Derivatives (`derivatives.ts`) | Binance Open Interest + Funding | Long/Short ratio, basis, OI delta |
| News Scanner (`news-scanner.ts`) | CryptoPanic API (opcional) | Impacto de noticias con decay exponencial |
| Macro Guard (`macro-guard.ts`) | Calendario económico | Bloquea entradas en ventanas de alto riesgo macro |
| Funding Momentum (`funding-momentum.ts`) | Binance funding rate | Velocidad de cambio del funding (cascada de liquidaciones) |
| News Impact Decay (`news-impact-decay.ts`) | CryptoPanic histórico | Tau personalizado por tipo de titular (ETF, HACK, ATH…) |

**Composite Score**: suma ponderada de todos los providers → escala -10 a +10

---

## 7. Gestión de Posiciones

### 7.1 Position Tracker (`src/trading/position-tracker.ts`)

- **Optimistic delete**: elimina la posición de memoria ANTES de cualquier await
- Esto previene que un segundo tick intente cerrar la misma posición
- **Idempotency guard**: `.eq('status', 'OPEN')` en el UPDATE de DB
- Si un segundo cierre llega (bug), la DB lo rechaza silenciosamente

### 7.2 Timeout de Posición
- Slug `btc-updown-5m-{UNIX_TS}` → usa timestamp embedded para expirar exacto
- Cierra 30s después de expirar el mercado (tiempo para que el CLOB registre resolución)
- Fallback: 6 minutos de wall-clock para slugs sin timestamp

### 7.3 Circuit Breaker (`src/trading/circuit-breaker.ts`)
- Pérdida acumulada > threshold → pausa el bot
- Configurable desde Supabase (`polyarb_agents.params`)

---

## 8. Settlement Engine (`src/skills/settlement-engine.ts`)

Detecta resolución de mercados y calcula P&L real.

### Flujo de Settlement

```
Posición expira
  → espera 30s (CLOB API necesita tiempo)
  → settleWithRetry() × hasta 20 intentos (cada 30s = 10 min)
       ├── fetchByClobConditionId()   ← PRIMARY: CLOB API /markets/{conditionId}
       │   Funciona para mercados pasados Y activos
       └── fetchByGammaSlug()         ← FALLBACK: Gamma API /events?slug=
           Solo funciona para mercados recientes
  → parseWinner(): precio > 0.9 o < 0.05 → resuelto
  → calcPnl(): ganó → shares - sizeUsd | perdió → -sizeUsd
  → persistSettlement() → UPDATE polyarb_positions + polyarb_trades
```

### Exit Reasons

| Valor | Significado |
|-------|-------------|
| `settled_win` | Mercado resuelto, ganó la posición |
| `settled_loss` | Mercado resuelto, perdió la posición |
| `settlement_timeout` | No se pudo resolver tras 20 intentos — NO es pérdida confirmada |
| `profit_take` | Salida anticipada al alcanzar profit target |
| `circuit_breaker` | Liquidación forzada por circuit breaker |

### Sweep al Arrancar
En cada startup, `sweepUnsettledPositions()` busca todas las posiciones `CLOSED/LIQUIDATED` con `exit_reason` distinto de `settled_win/settled_loss` y re-verifica via CLOB API. Procesa hasta 200 posiciones con 400ms entre cada una.

### Validación con Zod
Los schemas de CLOB y Gamma API están validados con Zod. Si la API cambia de shape, el engine registra advertencia y continúa (no corrompe datos).

---

## 9. Statistical Circuit Breaker (`src/trading/statistical-circuit-breaker.ts`)

Sistema de monitoreo en tiempo real que pausa el bot automáticamente ante anomalías estadísticas.

### Checks

| Check | Condición | Resultado |
|-------|-----------|-----------|
| Win Rate Floor | Win rate < 15% tras ≥30 trades cerrados | PAUSE |
| Duplicate Exit | >1 EXIT para mismo conditionId en 60s | PAUSE inmediato |
| Settlement Timeout Rate | >60% posiciones son `settlement_timeout` tras ≥20 trades | PAUSE |

**Auto-resume**: Si las métricas normalizan (win rate vuelve a ≥15%), el bot se reanuda automáticamente en el próximo check (cada 5 minutos).

**Fail-safe**: Si el check falla por error de DB, el trading continúa sin interrupciones.

---

## 10. Order Manager (`src/trading/order-manager.ts`)

### Modos de Firma

| Modo | Config | Descripción |
|------|--------|-------------|
| DRY_RUN | `POLYARB_DRY_RUN=true` | Simula órdenes, no envía nada real |
| EOA | `POLYARB_WALLET_PRIVATE_KEY` | Firma EIP-712 con clave privada directa |
| POLY_PROXY | `walletAddress` + `apiSecret` L2 | Firma via proxy L2 (sin exponer clave) |

### Balance Tracking
- Polling cada 30s: CLOB balance + on-chain wallet balance
- Muestra en logs: `CLOB=$X | Wallet=$Y | Total=$Z USDC`

---

## 11. Window Gate (`src/trading/window-gate.ts`)

Previene entradas en los últimos N segundos de la ventana de 5 minutos.
- Si quedan < 90s de mercado → no entra (riesgo asimétrico)
- Configurable via `params.windowGateSeconds`

---

## 12. Adaptive Profit-Take (`src/skills/adaptive-profit-take.ts`)

Reemplaza el `PROFIT_TAKE_PCT = 70%` fijo con un target dinámico.

| Condición | Ajuste al Target |
|-----------|-----------------|
| Entropy: DIRECTIONAL | +12% (hasta 85%) |
| Entropy: NOISY | -8% (mínimo 62%) |
| Reversal inminente | -15% (mínimo 60%) |
| < 90s en ventana | -10% (mínimo 60%) |
| Regime: VOLATILE | -8% |
| Regime: CALM | +5% (hasta 83%) |

**Rango**: 60% – 85%

---

## 13. Telemetría (`src/telemetry/writer.ts`)

Escribe snapshots cada 60s a `polyarb_agents.telemetry_snapshot`:
- Balance actual, P&L acumulado, error count
- Engine votes snapshot (votes YES/NO por engine)
- Métricas de latencia del loop

### Compliance Logger (`src/telemetry/compliance.ts`)
Registra eventos en `polyarb_compliance_logs`:
- `AGENT_START`, `AGENT_STOP`, `AGENT_PAUSE`, `AGENT_RESUME`

---

## 14. CTF Redeemer (`src/trading/ctf-redeemer.ts`)

Redención on-chain de tokens ganadores en Polygon via NegRiskAdapter.
- Requiere MATIC para gas en la wallet
- Busca posiciones `settled_win` con `redeemed=false`
- Obtiene `clobTokenIds` de Gamma API → redime el token ganador

---

## 15. Bugs Críticos Resueltos (Historial de Sesión)

### Bug #1 — Race Condition: 608 exits duplicados
**Causa**: `setInterval` + async tick — cuando el tick tardaba >250ms, el próximo empezaba antes de que el anterior terminara. Dos ticks concurrentes intentaban cerrar la misma posición.  
**Fix**: Reemplazar `setInterval` con `setTimeout` recursivo. Cada tick espera a que el anterior complete.  
**Commit**: `1801536`

### Bug #2 — Residual duplicates post-fix
**Causa**: `closePosition()` eliminaba la posición de memoria DESPUÉS de los awaits de DB. Un timeout de DB permitía que el siguiente tick encontrara la posición en memoria y la cerrara de nuevo a precio diferente.  
**Fix**: Optimistic delete (eliminar de memoria ANTES del primer await) + idempotency guard `.eq('status','OPEN')` en DB.  
**Commit**: `e751a80`

### Bug #3 — 94% de posiciones como `settled_loss` falsas
**Causa**: El settlement engine usaba Gamma API `/events?slug=past-event` que devuelve array vacío para mercados ya cerrados. Tras 8 reintentos (4 min), marcaba la posición como `settled_loss` por defecto, aunque en realidad podría haber ganado.  
**Fix**:
1. CLOB API como fuente primaria: `GET /markets/{conditionId}` — funciona para mercados pasados
2. Max retries: 8 → 20 (10 minutos de ventana)
3. Default en timeout: `settled_loss` → `settlement_timeout` (no es pérdida confirmada)
4. Sweep incluye `settlement_timeout` para reintento en próximo restart  
**Commit**: `2b5f354`

### Bug #4 — `zod` no en production deps
**Causa**: `zod` fue importado en `settlement-engine.ts` pero no declarado en `package.json`. El Dockerfile hace `npm ci --omit=dev` → `zod` no instalado → crash al startup.  
**Fix**: `npm install zod --save`  
**Commit**: `0ca0b27`

### Bug #5 — CLOB API retorna precios como número (no string)
**Causa**: El Zod schema esperaba `price: z.string()` pero CLOB a veces devuelve `price: 0.52` (número). Fallback a Gamma API que estaba rota.  
**Fix**: `z.union([z.string(), z.number()]).transform(v => String(v))`  
**Commit**: `0ca0b27`

### Bug #6 — Tabla/columna incorrecta en memory queries
**Causa**: `bayesian-winrate.ts` y `replay-similarity.ts` consultaban `polyarb_memory_entries` pero la tabla real es `polyarb_signal_memory`. También `hunt_strength_bucket` → `hunt_bucket`.  
**Fix**: Corrección de nombres en ambos archivos.  
**Commit**: `e8e486d`

---

## 16. Datos en Supabase

### Tablas del Bot

| Tabla | Contenido |
|-------|-----------|
| `polyarb_agents` | Config del agente, estado, heartbeat, telemetry_snapshot |
| `polyarb_positions` | Cada posición abierta/cerrada con P&L y exit_reason |
| `polyarb_trades` | Registro de ENTRY y EXIT trades individuales |
| `polyarb_signal_memory` | Historial de señales para Memory Bank y Replay Similarity |
| `polyarb_compliance_logs` | Audit trail de start/stop/pause/resume |

### Resumen de Posiciones (al 2026-04-27)
- **Total registradas**: ~510 posiciones (paper trading)
- **Sweeps ejecutados**: 3 restarts → sweep corriendo con CLOB API
- **Estado**: re-verificando 478 posiciones reseteadas de `settled_loss` → `settlement_timeout`
- **Victorias confirmadas (muestra)**: $5.00, $6.93, $5.98, $5.25, $5.00

---

## 17. Variables de Entorno Requeridas

```bash
# Supabase
POLYARB_SUPABASE_URL=https://jgkvnnlodwdtjsmmzwry.supabase.co
POLYARB_SUPABASE_ANON_KEY=eyJ...
POLYARB_AGENT_ID=<uuid del agente en polyarb_agents>
POLYARB_USER_ID=<uuid del usuario>

# Polymarket API (CLOB)
POLYARB_API_KEY=...
POLYARB_API_SECRET=...
POLYARB_API_PASSPHRASE=...

# Wallet (uno de los dos modos)
POLYARB_WALLET_PRIVATE_KEY=0x...   # Modo EOA
POLYARB_WALLET_ADDRESS=0x...       # Modo POLY_PROXY (sin exponer clave)

# Modo
POLYARB_DRY_RUN=true               # Paper trading
NODE_ENV=production

# Opcional
CRYPTOPANIC_API_TOKEN=...          # News signal (gratuito en cryptopanic.com)
```

---

## 18. Estructura de Archivos

```
polyarb/
├── src/
│   ├── index.ts                    # Entry point + startup + shutdown
│   ├── loop.ts                     # Main trading tick (14 engines)
│   ├── config.ts                   # Carga config desde Supabase
│   ├── supabase.ts                 # Cliente Supabase
│   ├── feeds/
│   │   ├── binance-ws.ts           # WebSocket precios Binance
│   │   └── polymarket-ws.ts        # Polling CLOB Polymarket
│   ├── math/
│   │   ├── momentum-physics.ts     # velocity/acceleration/jerk
│   │   ├── kelly-sizer.ts          # Kelly criterion
│   │   ├── asymmetric-kelly.ts     # Kelly por strike binario ← NUEVO
│   │   ├── heston-vol.ts           # Volatilidad estocástica
│   │   ├── jump-diffusion.ts       # Modelo de saltos Merton
│   │   └── vol-surface.ts          # Superficie de volatilidad
│   ├── skills/
│   │   ├── velocity-detector.ts    # Señal de momentum principal
│   │   ├── sentiment-pulse.ts      # Flujo bid/ask
│   │   ├── adaptive-kelly.ts       # Kelly adaptativo por win rate
│   │   ├── memory-bank.ts          # Historial de señales
│   │   ├── orderbook-depth.ts      # Imbalance 5 niveles ← NUEVO
│   │   ├── stasis-breakout.ts      # Breakout post-quietud ← NUEVO
│   │   ├── entropy-detector.ts     # Shannon entropy ← NUEVO
│   │   ├── session-clock.ts        # Win rate por sesión UTC ← NUEVO
│   │   ├── sentiment-divergence.ts # F&G vs precio real ← NUEVO
│   │   ├── reversal-radar.ts       # Jerk → reversión ← NUEVO
│   │   ├── bayesian-winrate.ts     # Beta posterior ← NUEVO
│   │   ├── replay-similarity.ts    # Situaciones similares ← NUEVO
│   │   ├── calibration-tracker.ts  # Bias por bucket ← NUEVO
│   │   ├── adaptive-consensus.ts   # Thresholds dinámicos ← NUEVO
│   │   ├── adaptive-profit-take.ts # Profit target dinámico ← NUEVO
│   │   ├── spoofing-detector.ts    # VETO órdenes fantasma ← NUEVO
│   │   ├── cross-market.ts         # Correlación cross-market
│   │   ├── regime-detector.ts      # Detección de régimen
│   │   └── settlement-engine.ts    # Liquidación de posiciones
│   ├── analysis/
│   │   ├── fundamental-engine.ts   # Agregador macro
│   │   └── providers/
│   │       ├── fear-greed.ts       # Alternative.me API
│   │       ├── derivatives.ts      # Binance funding + OI
│   │       ├── news-scanner.ts     # CryptoPanic
│   │       ├── macro-guard.ts      # Calendario económico
│   │       ├── funding-momentum.ts # Velocidad funding ← NUEVO
│   │       └── news-impact-decay.ts # Decay personalizado ← NUEVO
│   ├── trading/
│   │   ├── position-tracker.ts     # In-memory + DB sync
│   │   ├── order-manager.ts        # CLOB + DRY_RUN
│   │   ├── circuit-breaker.ts      # Breaker por pérdida acumulada
│   │   ├── statistical-circuit-breaker.ts  # Breaker estadístico ← NUEVO
│   │   ├── window-gate.ts          # Gate temporal de ventana
│   │   ├── ctf-redeemer.ts         # Redención on-chain
│   │   ├── clob-auth.ts            # Autenticación CLOB API
│   │   └── clob-signer.ts          # Firma EIP-712 / POLY_PROXY
│   ├── telemetry/
│   │   ├── writer.ts               # Snapshot periódico
│   │   └── compliance.ts           # Audit trail
│   ├── lib/
│   │   └── clob-fetch.ts           # Fetch wrapper con retry
│   └── crypto/
│       └── encryption.ts           # AES-256-GCM
├── package.json                    # zod en production deps
├── tsconfig.json
├── fly.toml                        # Fly.io: sin singapore, 256MB
└── Dockerfile                      # node:22-slim + npm ci --omit=dev
```

---

## 19. Deploy & Ops

### Fly.io
```bash
# Deploy completo
npm run build && fly deploy --app polyarb-crypto-v1

# Ver logs en tiempo real
fly logs --app polyarb-crypto-v1

# Restart manual
fly machine restart 6e826010b769e8 --app polyarb-crypto-v1

# Estado de máquinas
fly machines list --app polyarb-crypto-v1
```

### Comandos via Dashboard (Supabase `polyarb_agents.status`)
| Status | Efecto |
|--------|--------|
| `RUNNING` | Trading activo |
| `PAUSED` | Pausa el trading (mantiene posiciones abiertas) |
| `STOPPED` | Shutdown completo del proceso |

Poll cada 5 segundos — el bot detecta cambios automáticamente.

---

## 20. Próximos Pasos para Live

1. **Esperar sweep completo** — Las 478 posiciones se re-verifican con CLOB API. El stat-cb se desbloqueará cuando el win rate real supere 15%.
2. **Analizar win rate real** — Tras el sweep, consultar DB para win rate limpio sin datos contaminados.
3. **Evaluar si win rate ≥ 40%** — Threshold mínimo para considerar ir live.
4. **Configurar CRYPTOPANIC_API_TOKEN** — Activa el engine de noticias (gratuito).
5. **Activar modo LIVE** — Cambiar `POLYARB_DRY_RUN=false` + depositar USDC en wallet CLOB.
6. **Monitorear primeras 24h live** — El stat-cb actuará como guardián automático.

---

*Documento generado el 2026-04-27. El bot está operativo en Fly.io en modo DRY_RUN.*
