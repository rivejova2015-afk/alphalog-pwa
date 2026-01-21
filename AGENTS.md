# AlphaLog - Codex Rules (AGENTS.md)

## Fuente de verdad
- Sigue estrictamente: APP_MAP.md, DATA_SCHEMA.md, KNOWN_ISSUES.md, MIGRATION_PLAN.md.
- Si falta info, DETENTE y pregunta. No inventes.

## Diseño
- Prohibido cambiar el diseño global sin permiso explícito del usuario.
- Mantén componentes existentes y estilos consistentes.

## Stack
- Next.js App Router (/app)
- Supabase (Auth + DB)
- PWA: manifest + caching/offline + plan/implementación de push

## Seguridad
- Nunca hardcodear keys/tokens.
- Usar .env.local y documentar variables sin valores.
- Si aparecen secretos en archivos, señalarlos y pedir rotación.

## Calidad
- Tareas tamaño MEDIO (1–3h). Divide si es más grande.
- Siempre:
  1) aplicar cambios
  2) ejecutar lint/build/tests si existen
  3) resumir cambios + checklist
- Incluye rollback: cómo revertir (git revert / restore de archivos).

## Dependencias
- No agregar nuevas dependencias sin justificar y sin pedir permiso.