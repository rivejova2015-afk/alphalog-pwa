# Auditoría de madurez — Business Hub, Treasury, Secure Mail, Bot Control, Coinarb

**Fecha**: 2026-07-06
**Branch**: `claude/alphalog-status-check-ywz6s`
**Alcance**: 5 módulos que nunca habían pasado por un review dedicado (~36,000 LOC combinadas) — Business Hub, Treasury, Secure Mail (PGP), Bot Control (MT5), Coinarb (crypto 50x).

## Metodología

Dado el tamaño (5 módulos, ~36K LOC), un review de 8-ángulos exhaustivo por módulo (como el de `2026-07-04-code-review-execution-portfolio.md`) hubiera sido desproporcionado. El esfuerzo se escaló por riesgo:

1. **Mapeo**: 3 agentes de exploración en paralelo (uno por área de riesgo financiero/seguridad) para localizar tamaño, cobertura de tests, y candidatos a bug antes de comprometer tiempo de review profundo.
2. **Fix inmediato** de los 2 bugs ya confirmados durante el mapeo (Secure Mail audit trail roto, Coinarb strategy_id colisión).
3. **Reviews dirigidos** (3-4 agentes buscadores por módulo, no 8) en las áreas de mayor riesgo señaladas por el mapeo, cada hallazgo con escenario de falla concreto citado archivo:línea.
4. **Tests + reconciliación** de gaps de cobertura HTTP-level y código duplicado descubiertos en el camino.

## Hallazgos

### 1. Secure Mail: audit trail de accesos roto desde que se escribió

**Archivo**: `src/app/api/secure-mail/messages/[id]/route.ts`

El endpoint insertaba `event: "read"` en `secure_message_access_audit`, pero el CHECK constraint de la migración 017 solo permitía `'open','decrypt','download_attachment','send'`. El insert fallaba **siempre**, en silencio (fire-and-forget, sin manejo de error) — el audit trail de "quién leyó qué mensaje y cuándo" nunca tuvo una sola fila real.

**Veredicto**: CONFIRMADO
**Fix**: migración `20260704014503_secure_message_access_audit_add_read_event.sql` agrega `'read'` al CHECK constraint. Aplicada a producción vía Supabase MCP y verificada con `pg_get_constraintdef`. Test de ruta nuevo (`src/app/api/secure-mail/messages/[id]/__tests__/route.test.ts`) confirma que el insert ya no falla.

### 2. Coinarb: 5 estrategias pisándose las stats diarias entre sí

**Archivo**: `coinarb/src/risk/daily-tracker.ts::flush()`

`flush()` hardcodeaba `strategy_id: 'A'` en el upsert a `coinarb_daily_stats` (`onConflict: 'agent_id,strategy_id,day_utc'`), pero `coinarb/src/core/loop.ts` corre **5 strategy runners independientes** ('A' smc, 'B' aggressive, 'M' mean-reversion, 'P' momentum, 'DD' dd-scalper), cada uno con su propio `DailyTracker`. Los 5 flushes diarios colisionaban en la misma fila `(agent_id, 'A', day_utc)` — solo sobrevivía la del último runner en flushear, pisando las de los otros 4. Esto también contaminaba potencialmente el pipeline de retornos de Portfolio HRP (`loadCryptoReturns` lee `coinarb_daily_stats.total_pnl_usd` asumiendo que refleja el agregado real del día).

**Veredicto**: CONFIRMADO
**Fix**: `flush(strategyId: StrategyId)` ahora recibe y persiste el id real del runner que lo llama; `core/loop.ts:348` pasa `runner.id` en vez de nada. Tests nuevos confirman que los 5 strategy_id posibles se persisten sin colisionar. **No se hizo backfill** del histórico ya pisado — no hay forma confiable de reconstruirlo; la pérdida de datos histórica queda documentada acá.

### 3. Secure Mail: import de private key sin passphrase se guardaba sin aviso

**Archivo**: `src/components/secureMail/KeySetup.client.tsx::handleImport()`

El flujo de import guardaba cualquier private key pegada tal cual, con `key_kdf` hardcodeado a `{algorithm:'Imported', iterations:0, hashAlgorithm:'N/A'}` sin verificar que la key estuviera realmente cifrada. Un usuario podía pegar una clave privada en texto plano y quedaba persistida en la DB (`secure_mailboxes.pgp_private_key_encrypted`) sin ningún guardrail ni advertencia.

**Veredicto**: CONFIRMADO (gap de seguridad, no explotable remotamente — requiere que el propio dueño pegue una key sin cifrar, pero sin el guard la app no lo detecta ni avisa)
**Fix**: `isPrivateKeyPassphraseProtected()` nueva en `src/lib/crypto/openpgp.ts` (chequea `readPrivateKey().isDecrypted()`). `handleImport()` la llama antes del insert y rechaza con mensaje explícito si la key no está protegida. Tests unitarios (3 casos: protegida/no-protegida/parse-failure) + tests de componente (2 casos: rechaza sin insertar / permite cuando sí está protegida).

### 4. Bot Control: `isDailyCircuitOpen()` interpretaba mal las unidades de `pnl_today`

**Archivo**: `src/lib/bot/arbitrage/risk-guard.ts::isDailyCircuitOpen()`

El heurístico `Math.abs(pnlToday) <= 1 ? pnlToday : pnlToday / 100` intentaba adivinar si `algorithms.pnl_today` venía en fracción o en porcentaje. Pero la columna es **siempre dólares** (`numeric(14,2)`, migración 044) — todo otro consumidor (`AlgoCard`, `AlgoAccordion`, tests) la formatea como `$X.XX`. No existe ningún writer que alguna vez escriba una fracción o porcentaje ahí. Consecuencia: cualquier pérdida real en dólares ≥ $0.05 se malinterpretaba como una caída de decenas de puntos porcentuales (ej. `-75.25` dólares en una cuenta de $50k, una caída trivial de -0.15%, se leía como `-75.25/100 = -75%` y disparaba el circuit breaker). El breaker abierto también saltaba el paso de cerrar posiciones expiradas (`pair-monitor.ts`), aumentando la exposición en vez de reducirla.

**Veredicto**: CONFIRMADO
**Fix**: la función ahora normaliza `pnl_today` (dólares) contra `bot_telemetry.equity` de la cuenta que sostiene las posiciones (`slow_bot_account_id` del par), en vez de adivinar la unidad. Sin equity disponible para normalizar, falla abierto (no dispara) en vez de malinterpretar el valor. Tests actualizados para reflejar la semántica correcta (incluye el caso de regresión exacto: `-75.25` USD no dispara sobre una cuenta de $50k equity).

### 5. Bot Control: el piso de Kelly permitía tamaño mínimo con edge negativo

**Archivo**: `src/lib/bot/signal-engine/position-sizer.ts::calculatePositionSize()`

El clamp `Math.max(0.001, Math.min(kellyRaw, 0.05))` aplicaba el piso de 0.001 **incluso cuando `kellyRaw` era negativo** (edge negativo según la fórmula de Kelly, ej. una racha de pérdidas o un win rate bajo con R:R break-even). Esto convertía una conclusión de "no hay ventaja estadística, no operar" en una orden real de tamaño mínimo (0.16–0.8 lotes en cuentas de $10k–$50k, notional relevante, no un artefacto de redondeo). El único otro gate (circuit breaker -25% diario acumulado) no cubre este caso de sizing por-trade.

**Veredicto**: CONFIRMADO
**Fix**: cuando `kellyRaw <= 0` la función retorna `blocked:true, lots:0, reason:'NEGATIVE_EDGE'` antes de aplicar cualquier piso. El piso de 0.001 ahora solo aplica a edges positivos muy chicos. Tests actualizados: el caso que antes probaba "el piso nunca baja de 0.001" ahora prueba explícitamente que un edge negativo bloquea con `lots:0`, más un caso nuevo para edge positivo diminuto que sí debe respetar el piso.

### 6. Treasury: cycle-math sin clamp podía producir una fecha de ciclo sin sentido

**Archivos**: `src/app/api/treasury/payouts/preview/route.ts`, `src/app/api/treasury/payouts/create/route.ts`

Ambas rutas reimplementaban el cálculo de `cycleStart`/`cycleExpectedEnd` inline con `new Date(year, month, withdrawal_day)` en vez de usar `payoutEngine.computeCycleStart()` (que clampea `withdrawal_day` a 28). Para `withdrawal_day` en 29-31, en meses que no tienen ese día, el overflow de `Date` podía producir un ciclo casi de longitud cero en vez de retroceder correctamente: con `withdrawal_day=30` y "hoy" = 2026-03-01, el código viejo calculaba `cycleStart = 2026-03-02` (un ciclo de -1 día antes de "hoy"), mientras que el resultado correcto es `2026-02-28`.

**Veredicto**: CONFIRMADO
**Fix**: ambas rutas ahora delegan en `payoutEngine.computeCycleStart()`/`computeCycleExpectedEnd()`/`calculatePeriodPnL()`/`calculatePayoutBreakdown()` — funciones ya existentes, ya testeadas, que las rutas duplicaban inline con el bug. Esto también eliminó ~150 líneas de lógica duplicada por ruta. Tests de ruta nuevos incluyen el escenario de regresión exacto (withdrawal_day=30, hoy=2026-03-01 → cycleStart=2026-02-28).

### 7. Treasury: `tax_buffer_accumulated` nunca se incrementaba

**Archivo**: `src/app/api/treasury/payouts/create/route.ts`

`treasury_configs.tax_buffer_accumulated` se lee en 2 paneles (`Overview.client.tsx`, `Milestone.client.tsx`) para mostrar el progreso hacia `tax_buffer_target`, pero **nada en el codebase lo incrementaba jamás** — el único writer lo inicializa en 0 al crear el config (`queries.ts:242`) y ahí se quedaba para siempre, sin importar cuántos payouts se crearan. El progreso mostrado al usuario era permanentemente 0%.

**Veredicto**: CONFIRMADO
**Fix**: `payouts/create` ahora incrementa `tax_buffer_accumulated` por el `tax_reserve_amount` del payout recién creado, en un update best-effort posterior al insert exitoso (un fallo acá no revierte el payout ya creado — solo se loguea).

## Revisado sin hallazgos

### Coinarb: consistencia de sizing entre estrategias

Se comparó el sizing math entre `dd-daily-scalper.ts`, `mean-reversion.ts` y `momentum-breakout.ts` para detectar inconsistencias post-PR #63 (que había agregado "sizing cap + fee-aware TP" solo a `dd-daily-scalper`). **Sin hallazgos** — las diferencias de fórmula entre estrategias son diseño intencional (cada una tiene su propio perfil de riesgo/holding period), no una regresión de sincronización faltante.

## Reconciliación de code smells

- **Test file duplicado**: `src/lib/treasury/payoutEngine.test.ts` (389 líneas, fuera de `__tests__/`) coexistía con el canónico `src/lib/treasury/__tests__/payoutEngine.test.ts` (279 líneas), cubriendo las mismas funciones. Se migraron los 2 casos únicos que faltaban en el canónico (`withdrawal_day=1`, `profitTotal=0` exacto) y se borró el archivo fuera de convención.
- **CLAUDE.md desactualizado**: la nota "Coinarb subproject: 140 tests across 14 files" reflejaba un estado muy anterior — la cifra real a esta fecha es 340 tests / 29 files. El conteo de Vitest raíz también estaba desactualizado (1356/106 → 3037/260). Ambos corregidos.

## Lo que NO se hizo (fuera de alcance, documentado por decisión explícita)

- **Backfill de `coinarb_daily_stats`**: no hay forma confiable de reconstruir el histórico pisado por el bug de `strategy_id` — la pérdida queda como dato histórico irrecuperable.
- **Rediseño de "E2E real" de Secure Mail**: mail entrante no PGP-armado por el remitente externo queda envuelto en cifrado AES genérico server-side (`encryptText`), no en E2E real. Esto es una limitación de diseño documentada, no un bug — forzar/validar PGP del lado del remitente externo requeriría UX nueva, fuera de alcance de este pase.
- **Consolidación de circuit-breakers**: existen 3 implementaciones independientes (`bot/arbitrage/risk-guard.ts`, `cme/risk-manager.ts`, `coinarb/circuit-breaker.ts`) sin abstracción compartida. Se confirmó que ninguna tiene un umbral más débil de lo pretendido tras el fix de unidades de Bot Control — no se consolidan porque operan en mercados con semánticas de riesgo distintas.
- **Review profundo de Business Hub CRUD general**: sin lógica financiera de riesgo, queda solo señalado el gap de testing (5/18 rutas con test HTTP-level) sin un pase de review dedicado — menor prioridad que Treasury/Secure Mail/Bot/Coinarb en este ciclo.
- **Ambigüedad de diseño sin resolver**: `coinarb/circuit-breaker.ts::recordClose()` trata `pnlUsd===0` (breakeven) como loss (solo `pnlUsd > 0` cuenta como win) — no se determinó si es intencional; no se tocó por no tener un escenario de falla concreto asociado.

## Estado de verificación

- `npx tsc --noEmit` (root): limpio.
- `npx vitest run` (root): 3037/3037 verde, 260 archivos.
- `cd coinarb && npx vitest run`: 340/340 verde, 29 archivos.
- `npm run lint` (root): 0 errores (25 warnings pre-existentes sin relación a este trabajo).
- Migración de Secure Mail aplicada a producción vía Supabase MCP, verificada con `pg_get_constraintdef`.
- `cd coinarb && npx tsc --noEmit`: 1 error pre-existente (`jose` declarado en `package.json` pero no instalado en este sandbox) — gap de entorno no relacionado a ningún archivo tocado en esta auditoría, no se intentó arreglar.
