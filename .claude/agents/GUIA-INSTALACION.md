# Agentes de AlphaLog — Guía de Instalación

## Paso 1: Crea la carpeta
En la raíz de tu proyecto `alphalog-pwa/`:
```
mkdir -p .claude/agents
```

## Paso 2: Copia los 10 archivos a `.claude/agents/`

```
alphalog-pwa/
├── .claude/
│   └── agents/
│       ├── market-sentinel.md      ← Analista de mercado
│       ├── bug-fixer.md            ← Soluciona errores
│       ├── alpha-shield.md         ← Seguridad
│       ├── supabase-architect.md   ← Base de datos
│       ├── ui-designer.md          ← UI/UX
│       ├── deploy-ops.md           ← DevOps / Vercel
│       ├── performance-optimizer.md ← Rendimiento
│       ├── test-engineer.md        ← Testing
│       ├── bot-specialist.md       ← Bot MT5
│       └── feature-completer.md    ← Completar features
├── CLAUDE.md                       ← Ya existe (memoria del proyecto)
├── src/
└── ...
```

## Paso 3: Reinicia Claude Code
Escribe `/agents` para verificar que los 10 estén activos.

---

## Tu equipo de 10 agentes

| # | Agente | Modelo | Rol |
|---|--------|--------|-----|
| 1 | **market-sentinel** | Opus | Analiza noticias, sentimiento de mercado, conclusiones operativas |
| 2 | **bug-fixer** | Sonnet | Detecta y arregla errores al momento |
| 3 | **alpha-shield** | Sonnet | Auditoría de seguridad (RLS, cifrado, CSRF, auth) |
| 4 | **supabase-architect** | Sonnet | Gestiona las 69 tablas, migrations, RLS, tipos |
| 5 | **ui-designer** | Sonnet | Mejora interfaz, responsive, accesibilidad |
| 6 | **deploy-ops** | Sonnet | Vercel deploys, GitHub Actions, env vars |
| 7 | **performance-optimizer** | Sonnet | Velocidad, bundle, queries, caching |
| 8 | **test-engineer** | Sonnet | Escribe tests (Vitest + Playwright) |
| 9 | **bot-specialist** | Sonnet | Sistema MT5, heartbeat, telemetría, Copy Groups |
| 10 | **feature-completer** | Opus | Termina features incompletas (P&L, Copy Groups UI, Intelligence) |

---

## Ejemplos de uso

```
"Analiza las noticias de impacto de hoy sobre el oro"
→ market-sentinel

"Hay un error 500 en /api/tradehub/trades, arrégalo"
→ bug-fixer

"Audita las RLS policies de las tablas de treasury"
→ alpha-shield

"Crea una tabla para notificaciones personalizadas"
→ supabase-architect

"El dashboard se ve mal en móvil, mejóralo"
→ ui-designer

"Haz deploy a producción"
→ deploy-ops

"La página de trades carga lento"
→ performance-optimizer

"Escribe tests para el payout engine de treasury"
→ test-engineer

"El bot no manda heartbeat hace 5 minutos, diagnostica"
→ bot-specialist

"Completa el P&L periódico que devuelve null"
→ feature-completer
```
