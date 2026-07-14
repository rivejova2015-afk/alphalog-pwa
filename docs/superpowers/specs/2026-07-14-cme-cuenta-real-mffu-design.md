# Sub-proyecto 2: Conectar cuenta real (MyFundedFutures/Tradovate) — Design

> Sub-proyecto 2 de 4 del roadmap forex/futuros. Depende de sub-proyecto 1
> (migración CME/Tradovate a Postgres propio), ya completo y desplegado.

## Contexto

El objetivo es correr el flujo completo — algoritmo creado en AlphaLog → señal
→ ejecución real en una cuenta de broker — de punta a punta, de forma
confiable y sin intervención manual constante, contra una cuenta real de
**MyFundedFutures (MFFU)** operando sobre **Tradovate**.

Investigación previa (código + fuentes externas) mostró que el motor de
ejecución **ya existe casi completo** — este no es un proyecto de "construir
un broker client desde cero", sino de "conectar y validar lo que ya está
construido".

## Estado actual del código (inventario)

Ya existe y está en producción (sub-proyecto 1):

- **Cliente API real de Tradovate** (`src/lib/cme/tradovate.ts`): auth
  (`tradovateAuth`), renovación de token (`tradovateRenew`), listar cuentas
  (`getAccounts`), colocar orden de mercado con bracket SL/TP
  (`placeMarketOrder`), posiciones (`getPositions`), cash balance
  (`getCashBalance`), cerrar posición (`closePosition`). Apunta a
  `demo.tradovateapi.com` o `live.tradovateapi.com` según `is_paper`.
- **Conexión real** (`src/app/api/cme/connect/route.ts`): autentica contra
  Tradovate de verdad, matchea la cuenta devuelta contra
  `algo_cme_accounts.account_number`, guarda el token cifrado en el vault de
  lattice-server (`src/lib/cme/vault.ts` → `lattice-secrets.ts`).
- **Ejecución real** (`src/lib/cme/order-executor.ts` `executeSignal` +
  `src/lib/engine/dispatchers/tradovate.ts` `dispatchTradovate`): coloca
  órdenes reales vía `placeMarketOrder`, con position-awareness (evita
  duplicar en la misma dirección; revierte con una orden si la señal es
  opuesta a la posición abierta), sizing por ATR(14) o Kelly, y un modo
  `shadow` vs `live` controlado por `DISPATCH_MODE` (default `shadow` —
  seguro, no dispara órdenes reales).
- **Red de seguridad**: kill-switch (`/api/cme/kill-switch`), risk-monitor
  cron (circuit breaker), global-halt.
- **UI**: `CmePropFirmWorkspace.client.tsx` ya tiene el form de conexión
  (usuario/password) enganchado a `/api/cme/connect`.
- **Schema** (`lattice-server/data/alphalog/schema.sql`): la tabla
  `algo_cme_accounts` ya tiene un CHECK que permite
  `provider_name = 'MyFundedFutures'` para `account_type = 'propfirm'` — el
  trabajo previo ya anticipó esta prop firm específica.

## Gap identificado

No existe ningún endpoint para **crear** una cuenta prop-firm nueva
(`algo_cme_accounts`) — `src/app/api/intelligence/algorithms/cme-accounts/route.ts`
solo tiene `GET`. Sin esto, no hay forma de dar de alta la cuenta de MFFU
desde la UI/API antes de poder conectarla.

## Incógnita a validar empíricamente (antes que nada más)

Investigación externa (ver spec de referencias abajo) encontró dos mecanismos
distintos en la API de Tradovate, fácil de confundir:

1. **Add-on pago "API Access"** ($25/mes, CID/SEC propio): requiere una
   cuenta **live personal** con ≥$1000 — las cuentas de evaluación o
   "fondeadas" de prop firms (que siguen siendo simuladas del lado de
   Tradovate) **no califican**.
2. **Login usuario/contraseña** (`/auth/accesstokenrequest`, ya usado por
   nuestro código con `cid=0`/`sec=''`): el mismo mecanismo que usa la app
   de Tradovate para loguear al trader. Herramientas de automatización de
   terceros (ej. PickMyTrade) usan esto para conectar cuentas de MFFU sin
   pedir CID/SEC.

Nuestro código ya está construido para el mecanismo (2), que probablemente
es el correcto para una cuenta MFFU. Pero esto **no está documentado con
certeza absoluta** y debe verificarse contra el entorno demo/evaluación de
MFFU antes de conectar cualquier cuenta con plata real en juego. Si falla,
el plan B es evaluar si el add-on pago aplica a alguna etapa de MFFU o si
hace falta un enfoque distinto (ej. igual que PickMyTrade).

## Alcance aprobado

1. **Nuevo endpoint** `POST /api/intelligence/algorithms/cme-accounts` para
   dar de alta una cuenta prop-firm (`label`, `provider_name`,
   `account_number`, `account_type`, `is_paper`, `funded_amount`,
   `max_daily_loss`, `max_trailing_dd`), con ownership vía `user_id` de
   sesión y validación zod (reusa el patrón de otras rutas CME ya
   migradas a `getPgClient()`).
2. **UI mínima** para dar de alta la cuenta: un form compacto agregado a
   `CmePropFirmWorkspace.client.tsx` (o modal simple), sin rediseñar el
   componente — YAGNI, solo lo necesario para crear el registro.
3. **Acción del usuario, fuera de código**: abrir/usar la cuenta de
   evaluación de MFFU, conseguir usuario/contraseña de Tradovate para esa
   cuenta.
4. **Validar la incógnita**: conectar de verdad contra el entorno
   demo/evaluación de MFFU (`is_paper=true`), confirmar que
   `tradovateAuth` + `getAccounts` funcionan con `cid=0`/`sec=''`. Este es
   el paso go/no-go antes de cualquier otra cosa.
5. **Correr en modo shadow** (`DISPATCH_MODE` sin setear = default seguro)
   durante un período, con un algoritmo real generando señales, para
   observar que `cme_signals`, posiciones y PnL se sincronizan bien sin
   arriesgar plata.
6. **Checklist de validación end-to-end** antes de considerar "listo"
   (ver abajo).
7. **Solo con OK explícito del usuario**, en un paso separado y posterior:
   flip a `DISPATCH_MODE=live` en Fly, con tamaño de posición chico.

## Checklist de validación end-to-end (Tarea final del plan)

- [ ] Cuenta creada vía el nuevo endpoint, visible en la UI.
- [ ] `/api/cme/connect` autentica de verdad contra el entorno demo de MFFU.
- [ ] `/api/cme/connections` muestra `status: 'connected'`.
- [ ] `tradovate-poll` cron corre sin error contra la cuenta real.
- [ ] Un algoritmo real dispara una señal → aparece en `cme_signals` con
      `status: 'skipped'` y `reject_reason: 'shadow_mode'` (modo shadow).
- [ ] Kill-switch (`/api/cme/kill-switch`) corta la conexión de verdad
      (`status: 'paused'` o similar) cuando se activa manualmente.
- [ ] Risk-monitor cron lee el equity real de la cuenta sin error.
- [ ] (Solo tras OK explícito) `DISPATCH_MODE=live` + una señal real coloca
      una orden real chica en Tradovate, visible en la cuenta de MFFU.

## Fuera de alcance

- IBKR / TradeStation / Rithmic (sub-proyecto 4, "coming soon").
- Enjambre MT4/MT5 (sub-proyecto 3, spec aparte).
- El add-on pago de Tradovate — solo se evalúa si el paso de validación
  empírica (mecanismo 2) falla.
- Rediseño de `CmePropFirmWorkspace.client.tsx` más allá del form de alta.

## Riesgos

- **Incertidumbre de la incógnita de auth**: mitigado corriendo el paso 4
  contra el entorno demo antes de tocar nada con plata real.
- **Política de MFFU sobre bots** ("Fair Play and Prohibited Trading
  Practices"): permite automatización siempre que no explote fills
  simulados ni sea HFT. El dispatcher existente (ATR/Kelly, sin HFT) ya
  encaja; no se necesita cambio de lógica de trading por esto.
- **Arriesgar el fee de evaluación**: mitigado por la etapa de shadow mode
  antes de cualquier ejecución real, y por probar primero en el entorno de
  evaluación (no en cuenta ya fondeada) si el usuario así lo decide al
  llegar a ese punto.

## Testing

Sigue el patrón ya establecido en sub-proyecto 1: tests contra Postgres
real (no mocks) para el nuevo endpoint POST, reutilizando
`src/lib/pg/__tests__/client.test.ts` como referencia de setup/teardown.
