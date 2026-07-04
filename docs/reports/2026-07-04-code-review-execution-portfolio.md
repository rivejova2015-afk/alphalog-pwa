# Code review — execution algos (TWAP/VWAP/IS) + Portfolio HRP

**Fecha**: 2026-07-04
**Branch**: `claude/alphalog-status-check-ywz6s` (PR #68)
**Diff revisado**: `origin/main...HEAD` — ~5900 líneas, 55 archivos
**Alcance**: propfirm enforcement (Fase 2), execution algos (TWAP/VWAP/IS) wireados al dispatcher real de Tradovate + cron `execution-tick`, Portfolio HRP wireado a retornos reales + cron `portfolio/rebalance`.

## Metodología

Review a nivel "high" (recall-biased): 8 agentes buscadores independientes corrieron en paralelo, cada uno con un ángulo distinto —

1. Line-by-line diff scan
2. Removed-behavior auditor
3. Cross-file tracer (callers/callees de funciones cambiadas)
4. Reuse (lógica duplicada)
5. Simplification (complejidad innecesaria)
6. Efficiency (trabajo desperdiciado)
7. Altitude (fixes superficiales vs profundos)
8. Conventions (CLAUDE.md)

Los candidatos con escenario de falla concreto pasaron a una **fase de verificación independiente**: un agente por candidato, sin ver el veredicto del buscador, con instrucción de intentar refutarlo leyendo el código real. Solo sobrevivieron los que un verificador pudo confirmar con cita de archivo:línea. 10 hallazgos de correctness sobrevivieron la verificación — todos listados abajo con veredicto **CONFIRMADO**.

## Hallazgos

### 1. Race condition: slice-0 puede ejecutarse dos veces

**Archivos**: `src/lib/engine/dispatchers/tradovate.ts`, `src/app/api/cron/cme/execution-tick/route.ts`, `src/lib/cme/execution-slices.ts`

La primera slice de un plan TWAP/VWAP/IS se inserta con `scheduled_at=now()` (los planners defaultean `startAt` a `new Date()`). En el instante en que esa fila es visible, ya matchea la query del cron `execution-tick` (`status='pending' AND scheduled_at<=now()`), que corre cada minuto vía `crontab` (scheduler real confirmado — no `vercel.json`, que está inerte). Si el cron dispara en la ventana entre el insert y que el propio dispatcher llame `checkOrderRisk`+`executeSignal` sobre esa misma fila, ambos caminos pueden pasar su propio risk check y ambos llaman `executeSignal()` sobre el mismo `cme_signals.id` — `executeSignal` hace un `UPDATE ... WHERE id=X` incondicional, sin guard `WHERE status='pending'`, así que ninguno de los dos caminos detecta que el otro ya actuó. Resultado: una orden real duplicada en Tradovate.

**Veredicto**: CONFIRMADO
**Fix**: Ver sección "Fixes aplicados" #1.

### 2. Max-contracts double-counts la posición flatten en un reversal

**Archivo**: `src/lib/cme/risk-manager.ts:121`

Con Apex $25k (límite 2 contratos), cuenta long 2 contratos (en el límite), llega señal SELL. El dispatcher arma `quantity = abs(netPos) + proposedQty = 2+1 = 3` (una sola orden de flatten+flip). `checkOrderRisk` suma `currentContracts` desde `cme_positions` (=2, la orden no se colocó todavía) y chequea `currentContracts(2) + quantity(3) = 5 > limit(2)` → rechaza, aunque la posición neta real resultante (long 2 → sell 3 → short 1) está bien dentro del límite.

**Veredicto**: CONFIRMADO
**Fix**: Ver sección "Fixes aplicados" #2.

### 3. `isPastCutoffEt` bloquea todo el domingo

**Archivo**: `src/lib/cme/market-hours.ts:91`

`checkOrderRisk` primero chequea `isGlobexOpen()` — false todo el domingo antes de las 18:00 ET (corta ahí, `isPastCutoffEt` nunca se alcanza). Pero desde el domingo 18:00 ET, `isGlobexOpen` devuelve true y la ejecución llega al chequeo de cutoff propfirm, donde `isPastCutoffEt` devuelve `true` incondicionalmente para `dayOfWeek===0` sin importar la hora. Todos los domingos, para cuentas con `overnightCutoffEt` configurado (Apex 16:59, Lucid Trading 16:45, Tradeify 16:55), la primera orden legítima de la semana se rechaza con `propfirm_overnight_cutoff` aunque Globex ya reabrió.

**Veredicto**: CONFIRMADO
**Fix**: Ver sección "Fixes aplicados" #3.

### 4. Trailing-DD: `.limit(500)` solo cubre ~1.7-2 días de los 90 pretendidos

**Archivo**: `src/lib/cme/risk-manager.ts:57`

`equity-sync` corre cada 5 min en días hábiles (`crontab`) → ~288 filas/día/conexión → ~18,432 filas en 90 días. La query ordena DESC por `snapshot_at` y corta en `.limit(500)`, que a esa frecuencia cubre solo ~1.7-2 días reales, no 90. `observedPeak`/`effectivePeak`/`drawdownFromPeak` se calculan solo sobre ese set truncado — un peak real más viejo que ~2 días es invisible, subestimando el drawdown real. Una cuenta que violó su regla de trailing-DD puede seguir operando sin que se detecte.

**Veredicto**: CONFIRMADO
**Fix**: Ver sección "Fixes aplicados" #4.

### 5. Cron `execution-tick`: catch block no llama `finalizeParentIfDone`

**Archivo**: `src/app/api/cron/cme/execution-tick/route.ts:87`

Los otros 2 exit paths del loop (risk denegado, `executeSignal` success/failure) llaman `finalizeParentIfDone` antes de continuar. El `catch (err)` marca la slice `rejected` pero nunca llama `finalizeParentIfDone`. Si esto pasa en la última slice pendiente de un plan, el padre queda trabado en `status='executing'` para siempre — ningún cron futuro lo revisita porque la query solo selecciona hermanas `pending`.

**Veredicto**: CONFIRMADO
**Fix**: Ver sección "Fixes aplicados" #5.

### 6. Dispatcher: `checkOrderRisk` de slice-0 sin try/catch

**Archivo**: `src/lib/engine/dispatchers/tradovate.ts:435`

A diferencia del `executeSignal` unas líneas más abajo (que sí está envuelto), el `checkOrderRisk` de slice-0 es una llamada sin protección. Si tira una excepción real (no un `{allowed:false}` normal), la excepción se propaga fuera de `dispatchTradovate` — después de que el padre+hijas ya se insertaron. El caller externo (`tradovate-poll`) solo loguea `processor_threw` sin tocar `cme_signals`. El padre y la slice-0 quedan huérfanos para siempre.

**Veredicto**: CONFIRMADO
**Fix**: Ver sección "Fixes aplicados" #6.

### 7. `insertExecutionSlices`: padre huérfano si falla el insert de hijas

**Archivo**: `src/lib/cme/execution-slices.ts:132`

Si el insert del padre commitea pero el insert de las N hijas falla después, la función solo relanza el error — no hay rollback ni marca al padre. `finalizeParentIfDone` no-opea porque no tiene hermanas que revisar (`if (rows.length === 0) return;`). El padre queda en `'executing'` con cero hijas para siempre.

**Veredicto**: CONFIRMADO
**Fix**: Ver sección "Fixes aplicados" #7.

### 8. VWAP cae a TWAP en silencio sin loguear nada

**Archivo**: `src/lib/cme/execution-algos.ts:107`

`buildHourlyVolumeProfile()` devuelve exactamente 0 para cualquier hora UTC sin barras históricas — ocurrencia real y rutinaria para la ventana de mantenimiento diario de Globex (17:00-18:00 ET). Si una sola slice de un plan VWAP cae en esa hora, `cleanProfile.filter(v>0)` descarta esa entrada, `cleanProfile.length !== sliceCount`, y el plan ENTERO revierte a TWAP — devuelto igual como `algo:'vwap'`. Ningún log avisa de este camino específico.

**Veredicto**: CONFIRMADO
**Fix**: Ver sección "Fixes aplicados" #8.

### 9. `expires_at` se calcula pero nunca se lee

**Archivo**: `src/app/api/cron/cme/execution-tick/route.ts:27`

`insertExecutionSlices` setea `expires_at = scheduled_at + 2min`, y el propio comentario del cron (línea 100) asume que las slices "expiran solas" — pero la query solo filtra `scheduled_at<=now()`, sin cota superior. Si el cron se pierde corridas por 20+ minutos (deploy, outage), al resumir coloca TODAS las slices vencidas de golpe sin importar cuán viejas son, colapsando lo que debía ser una distribución lenta en el tiempo en una sola colocación tardía.

**Veredicto**: CONFIRMADO
**Fix**: Ver sección "Fixes aplicados" #9.

### 10. Lista de propfirms recortada 7→4 sin aviso para cuentas legacy

**Archivo**: `src/components/intelligence/algorithms/NewStrategyWizard.client.tsx:59`

El dropdown de propfirms pasó de 7 nombres a 4, con un CHECK constraint nuevo en DB enforceando solo esos 4. `getPropfirmRule()` falla abierto (skip silencioso de todos los checks propfirm) para cualquier `provider_name` no reconocido — confirmado por el propio test suite (`"provider desconocido (TopstepX legacy) → no aplica cutoff"`). Una cuenta con un nombre legacy (si existiera) pierde todo el enforcement propfirm para siempre, sin forma de arreglarlo desde la UI (el dropdown ya no ofrece los nombres viejos). Salvedad: el commit que hizo el recorte afirma que `algo_cme_accounts` estaba vacía en producción al momento del cambio, y el CHECK constraint (sin `NOT VALID`) habría fallado la migración si hubiera existido una fila violatoria — así que la exposición real hoy es probablemente cero, pero el gap de código es real.

**Veredicto**: CONFIRMADO (gap de código real; exposición en producción no verificable desde este entorno, pero indirectamente acotada por el éxito de la migración)
**Fix**: Ver sección "Fixes aplicados" #10.

## Fixes aplicados

| # | Fix | Archivo(s) tocado(s) | Tests nuevos |
|---|-----|----------------------|---------------|
| 1 | Claim atómico (`UPDATE ... WHERE status='pending'`) antes de ejecutar cualquier slice, en dispatcher y cron | `execution-slices.ts`, `tradovate.ts`, `execution-tick/route.ts` | ✅ |
| 2 | `checkOrderRisk` acepta `isReversal`; max-contracts usa posición neta resultante en reversals | `risk-manager.ts`, `tradovate.ts` | ✅ |
| 3 | `isPastCutoffEt`: domingo solo bloqueado antes de 18:00 ET | `market-hours.ts` | ✅ |
| 4 | Trailing-DD: 2 queries chicas (MAX real + equity actual) en vez de `.limit(500)` | `risk-manager.ts` | ✅ |
| 5 | `finalizeParentIfDone` agregado al catch block del cron | `execution-tick/route.ts` | ✅ |
| 6 | `checkOrderRisk` de slice-0 envuelto en try/catch | `tradovate.ts` | ✅ |
| 7 | Padre marcado `rejected` (best-effort) si falla el insert de hijas | `execution-slices.ts` | ✅ |
| 8 | `SchedulePlan.fallbackReason` + `logWarn` cuando VWAP degrada a TWAP | `execution-algos.ts`, `tradovate.ts` | ✅ |
| 9 | Slices con `expires_at` vencido se marcan `rejected` sin ejecutar | `execution-tick/route.ts` | ✅ |
| 10 | Banner visible "Provider no reconocido" en vez de fallo silencioso | `propfirm-rules/route.ts`, `CmePropfirmRulesPanel.client.tsx` | ✅ |

Ver el commit que acompaña este documento para el diff completo de cada fix.

## Verificación final

- `npx tsc --noEmit` — limpio.
- `npx vitest run` — **3031 tests verde** (era 3009 antes de los fixes, +22 tests nuevos cubriendo cada bug: claim atómico, isReversal en max-contracts, domingo en isPastCutoffEt, peak real de trailing-DD, finalizeParentIfDone en el catch, checkOrderRisk envuelto en try/catch, padre marcado rejected en insert parcial, fallbackReason de VWAP, expires_at enforced, providerRecognized).
- `npm run lint` — 0 errores, 25 warnings preexistentes sin cambios.
- Cada test nuevo referencia explícitamente el número de bug del review en su nombre o comentario, para trazabilidad.
