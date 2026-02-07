# AlphaLog - Bot Control Dev

## Overview
AlphaLog incluye un panel **Bot Control** para administrar el EA GoldRangeBasketR vía Supabase Edge Functions.

## Supabase (Edge Functions)
Funciones nuevas:
- /bot-telemetry (POST)
- /bot-commands (GET)
- /bot-settings-effective (GET)
- /bot-ack (POST)
- /bot-command-timeout (POST cron)
- /bot-maintenance (POST cron)

Variables de entorno (configurar en Supabase):
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- ALPHALOG_PUSH_NOTIFY_URL (opcional, ej: https://YOUR-ALPHALOG-DOMAIN/api/push/notify-user)
- ALPHALOG_PUSH_NOTIFY_TOKEN (opcional)

## Supabase Hardening (recomendado)
- Aplicar migración: supabase/migrations/023_bot_control_hardening.sql
- Cron:
	- /bot-command-timeout cada 1 min (modo estricto)
	- /bot-maintenance cada 15 min (offline + limpieza)

## Bot Control UI
Ruta: /dashboard/bot-control

Requisitos:
- Login (Supabase Auth)
- Push habilitado (botón de notificaciones en la cabecera)
- Modo offline: snapshot local, solo lectura

## Comandos (modo estricto)
- START / STOP / RESTART_LOGIC / CLOSE_ALL / EMERGENCY_STOP / APPLY_SETTINGS
- Todos los comandos se consideran **APPLIED** solo cuando todas las cuentas target hacen ACK.
- Timeout 60s: estado FAILED + push (si está configurado).

## Seguridad
- El cliente usa Supabase anon key y RLS.
- No exponer service_role en el cliente.

## Migraciones
Revisar: supabase/migrations/022_bot_control.sql

## Notas
- No colocar secretos en el repo. Usar .env.local y variables en Supabase.
