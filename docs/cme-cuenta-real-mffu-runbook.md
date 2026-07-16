# Runbook: conectar y validar una cuenta real de MyFundedFutures

Este documento es una checklist manual. Ningún paso de acá se ejecuta
automáticamente — cada uno lo hacés vos, con tus propias credenciales,
directo en la app desplegada. Nunca pegues tu usuario/contraseña de
Tradovate en una sesión de agente/IA.

## 0. Requisito previo

- [ ] Deploy de este plan (Tareas 1-2) ya hecho en `alphalog-pwa` (Fly.io).
      (Es un paso separado, autorizado explícitamente por vos — no se hace
      solo al terminar el plan.)

## 1. Conseguir la cuenta y credenciales

- [ ] Cuenta de evaluación o fondeada de MyFundedFutures, operando sobre
      Tradovate.
- [ ] Usuario y contraseña de Tradovate para esa cuenta.
- [ ] (NO se necesita, salvo que el paso 2 falle) el add-on pago
      "API Access" de Tradovate — la investigación previa sugiere que el
      login usuario/contraseña normal alcanza para cuentas de prop firm.

## 2. Dar de alta la cuenta y conectar (paso go/no-go)

- [ ] En la app: New Strategy wizard → "Futures CME" → "Agregar cuenta
      nueva" → tipo "PropFirm" → proveedor "MyFundedFutures" → completar
      número de cuenta / fondeo / pérdida diaria → "Guardar cuenta".
- [ ] En el panel CME PropFirm: conectar la cuenta recién creada con tu
      usuario/contraseña real de Tradovate.
- [ ] **Resultado esperado**: la conexión queda en estado `connected`. Si
      falla con un error de autenticación, esa es la señal de que el
      mecanismo `cid=0`/`sec=''` no alcanza para esta cuenta — en ese caso,
      evaluar el add-on pago de Tradovate antes de seguir (no asumido por
      este plan).

## 3. Validar en modo shadow (sin arriesgar plata)

`DISPATCH_MODE` no está seteado en producción → modo `shadow` por default,
ningún paso de acá coloca una orden real.

- [ ] Confirmar que `/api/cme/connections` muestra `status: 'connected'`
      para la cuenta.
- [ ] Dejar correr un algoritmo real vinculado a esta cuenta (o esperar a
      que uno existente dispare una señal) y confirmar que aparece en
      `cme_signals` con `status: 'skipped'` y
      `reject_reason: 'shadow_mode'`.
- [ ] Activar manualmente el kill-switch desde el panel y confirmar que la
      conexión pasa a `paused`/similar.
- [ ] Confirmar que el cron `risk-monitor` no tira error al leer el equity
      real de la cuenta (revisar logs de Fly: `fly logs -a alphalog-pwa`).

## 4. Flip a modo live — SOLO con tu OK explícito, en otra conversación

Este paso está deliberadamente fuera de este plan y de este runbook como
acción automática. Cuando decidas dar este paso:

- [ ] Pedirlo explícitamente (ej. "flippeá a live la cuenta de MFFU").
- [ ] Se seteará `DISPATCH_MODE=live` como secret de Fly en `alphalog-pwa`
      únicamente en ese momento, con tamaño de posición chico a definir
      en esa conversación.
