# Changelog

Resumen de los hitos relevantes de **AlphaLog PWA**. Formato [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Los commits "sprint X" del bot/coinarb y los micro-fixes de infra no se listan aquí — esto es la vista del **producto frontend**. Para el histórico completo: `git log --oneline`.

---

## [Unreleased] — Final wrap

### Added
- SEO base mínimo: `export const metadata` en layouts de `/auth`, `/business`, `/intelligence`, `/securities` + `/dashboard` y `/health` pages.
- `src/app/robots.ts` y `src/app/sitemap.ts` — disallow indexing de rutas autenticadas, permiten solo públicas.
- `CHANGELOG.md` (este archivo) con resumen de hitos.

### Changed
- `CLAUDE.md` actualizado: nuevas deps de testing, sección Performance tooling, regla i18n, lista "Reciente" consolidada.
- Sentry `tunnelRoute` deshabilitado hasta que se setee DSN en Vercel (evita 404 silencioso en `/monitoring`).
- console.log → logError batch 2: 5 endpoints más visibles migrados (`tradehub/trades/[id]`, `tradehub/setups`, `tradehub/evidence`).
- `git config core.autocrlf input` aplicado.

---

## [2026-05-03] — Integral plan A+B+C+D (commit `24cd662`)

### Security
- Next.js patch 16.2.4 → 16.2.6 (vulnerabilities runtime resueltas).
- 7 vulns transitivas restantes vía `next-pwa` (build-time only, documentadas).
- `console.log → logError` batch 1: `journal/route.ts`, `accounts/route.ts`, `tradehub/trades/route.ts`.

### UX
- Badge legacy de `@/components/shared/` eliminado. 5 archivos migrados a `@/components/ui/badge` con mapeo de variants.
- `EvidenceVault` con búsqueda full-text + filtro por tipo (image/pdf/other) + filtro por status + contador.
- `EventModal` confirm migrado a `ConfirmDialog`.

### Testing & A11y
- Vitest UI configurado: `@testing-library/react` + `jsdom` + polyfill `<dialog>`.
- 13 unit tests UI nuevos: `ConfirmDialog`, `Skeleton`, `EmptyState`, `ErrorBoundaryPage`.
- E2E specs: `inbox.spec.ts` (4 tests) + `polyarb.spec.ts` (3 tests).
- A11y verificado: 13 modales identificados ya con `role="dialog"` + `aria-modal`.

### Performance
- `@next/bundle-analyzer` + `cross-env` instalados. `npm run analyze` para inspeccionar chunks.
- Cache-Control en endpoints GET principales verificado (ya cubierto).

### Treasury
- `PUT /api/treasury/configs` nuevo endpoint para editar thresholds.
- `UmbralPanel` y `AntiDDPanel` ahora editables inline (antes solo lectura).

---

## [2026-05-03] — Quick wins (commit `5c52312`)

- Fix lint preexistente `CoinarbDashboard` (`Date.now()` en render → React Compiler purity).
- `Operations` panel ahora es mini-dashboard con 4 tiles agregados (decisions, SOPs, milestones, costs).
- `/map/*` legacy eliminado (5 files). Nav actualizado a `/map-hot/*` + Securities añadido.

---

## [2026-05-03] — Multi-sprint frontend (commit `33573ae`)

### Intelligence tabs (backend ya existía)
- `/intelligence/tabs/knowledge-factory`: insights 30d + síntesis IA.
- `/intelligence/tabs/capital-levels`: distribución real vs propfirm + top accounts.
- `/intelligence/tabs/mindops`: correlación mood↔outcome + acciones recomendadas.
- `/intelligence/tabs/constraint-monitor`: semáforo 4 disciplinas (rename del "solver").

### UI Foundation
- `@/components/ui`: `ConfirmDialog`, `Skeleton`, `EmptyState`, `ErrorBoundaryPage` + barrel index.
- Modal `<dialog>` nativo con `aria-modal`.

### Sweep Business panels (8 paneles)
- `alert()` / `confirm()` / `prompt()` del browser eliminados → Sonner + ConfirmDialog + Skeleton.

### Errors + Sentry
- 5 nuevos `error.tsx` (intelligence, map-hot, securities, inbox, auth).
- `@sentry/nextjs` instalado y configurado (DSN pendiente en Vercel).
- `logError` server-side ahora delega a Sentry.captureMessage.

---

## [2026-05-04] — AlphaLog Securities + CyberSec Academy (commit `126cb68`)

### Added
- Nuevo top-level hub `/securities` (paralelo a Trading/Business/Intelligence).
- **CyberSec Academy**: 58 módulos en 13 categorías, 12 lecciones extendidas, 12 quizzes, 7 prácticas, 10 homework, examen final (32 preguntas).
- 4 tablas Supabase con RLS: `securities_progress`, `securities_quiz_results`, `securities_homework_submissions`, `securities_exam_results`.
- 4 API endpoints autenticados con Zod validation.
- 9 pages + 9 client components siguiendo paleta del proyecto.
- Navegación integrada: AppSidebar + SelectorDashboard + MobileBottomNav.

---

## Roadmap futuro (no en este release)

- AAB drag/drop UX spec + implementación
- TerminalReportsBot QStash scheduling
- alphacore-offline E2E spec
- TraderMap V2 unification
- Cron auto-recovery centralized alerts
- Sentry env vars activación
- i18n sweep español completo
- OG image dinámica
- Crypto integrations coinarb (Coinglass v3, CryptoQuant)
- console→logError batch 3+ (~185 archivos restantes)
