# CyberSec Academy — Roadmap de mejoras pendientes

> Fecha: 2026-06-14 · Estado: PLAN (no implementado)
> Contexto: tras la fase de gamificación (XP/nivel/Path/maestría/hábito/celebración/SRS)
> y la de optimización (persistencia en DB + endpoint `/summary` + tests UI),
> quedaron fuera los ítems de impacto bajo/medio del análisis exhaustivo. Este doc
> los detalla para ejecutarlos cuando se decida.

## Base actual (referencia)
- Contenido estático en `src/lib/securities/cybersec/*`: 82 módulos, 82 lecciones,
  82 quizzes, 15 práctica, 18 homework, 56 preguntas de examen, 45 flashcards.
- Estado de usuario en Supabase: `securities_progress`, `securities_quiz_results`,
  `securities_exam_results`, `securities_homework_submissions`, `securities_user_state`
  (daily_goal, milestone_snapshot, srs).
- Gamificación derivada server-side vía `GET /api/securities/cybersec/summary`.
- Motores puros: `xp`, `progressStats`, `habit`, `achievements`, `milestones`, `srs`,
  `examSession`, `rubrics`, `markdown` — todos con tests.

---

## Fase A — Quizzes por nivel (maestría profunda)  ·  esfuerzo: XL

**Problema:** los 3 niveles de cada módulo (básico/intermedio/avanzado, `levels.b/i/a`)
son etiquetas; no se ejercitan. Hoy hay **1 quiz por lección** y la maestría (#3) usa
ese único quiz + flags. La "maestría" no es progresiva de verdad.

**Objetivo:** 3 quizzes por módulo (uno por nivel), desbloqueables en orden, que
alimenten una maestría real (b → i → a → Legendary).

**Modelo de datos (contenido):**
- Cambiar `QUIZZES` de `Record<lessonId, QuizQuestion[]>` a
  `Record<lessonId, { b: QuizQuestion[]; i: QuizQuestion[]; a: QuizQuestion[] }>`
  (o un id compuesto `"{lessonId}:{level}"`). Mantener back-compat con un adaptador
  durante la migración del contenido.
- `securities_quiz_results`: agregar columna `level text CHECK (level IN ('b','i','a'))`
  (migration). Default `'b'` para filas históricas.

**API:** `quiz-results` POST/GET aceptan `level`. `summary` computa maestría por nivel.

**Lógica:** `moduleMastery()` pasa a: +1 por cada nivel aprobado (b/i/a) + 1 Legendary
si los 3 + research. XP por nivel.

**UI:** `QuizRunner` recibe `level`; la página `quizzes/[id]` permite elegir nivel
(desbloqueado si el anterior está aprobado). El nodo del Path muestra 3 sub-niveles.

**Contenido:** **el gran costo** — ~164 quizzes nuevos (82 módulos × 2 niveles extra),
4–5 preguntas c/u. Estrategia: generar por bloques (como el contenido de lecciones),
con tests de integridad (todo nivel tiene quiz, `c` válido, sin duplicados).

**Tests:** integridad de quizzes por nivel; `moduleMastery` por nivel; QuizRunner con level.
**Riesgos:** volumen de contenido; migración del shape de QUIZZES (romper consumidores).
**Dependencias:** ninguna (base lista).

---

## Fase B — Exámenes por sección / checkpoints  ·  esfuerzo: L

**Problema:** solo hay **1 examen final** de toda la academia. No hay evaluación por
bloque (el "Legendary por unidad" de Duolingo).

**Objetivo:** un examen/checkpoint por cada una de las 19 categorías/bloques, que
certifique el dominio de esa sección.

**Modelo de datos:**
- Banco por sección: muestrear de los quizzes de las lecciones de esa categoría
  (reusar `prepareExam` con el subconjunto) → **sin contenido nuevo**.
- `securities_exam_results`: agregar `section text NULL` (NULL = examen global) +
  índice. Migration.

**API:** `exam-results` POST/GET con `section`. `summary` expone `sectionExams: {cat → bestPct, passed}`.
**UI:** botón "Examen de sección" en cada bloque del Path/Syllabus; reusar `ExamRunner`
parametrizado por banco. Badge de sección aprobada en el header del bloque.
**Tests:** muestreo por sección; `ExamRunner` con banco parametrizado.
**Riesgos:** bajos (reusa motor de examen).
**Dependencias:** se potencia con Fase A (más preguntas por sección) pero no la requiere.

---

## Fase C — Expandir práctica + homework a todos los módulos  ·  esfuerzo: XL (contenido)

**Problema:** práctica cubre ~7 lecciones (15 ejercicios) y homework ~18 de 82.
La mayoría de los módulos no tiene práctica ni tarea.

**Objetivo:** ≥1 ejercicio de matching y ≥1 homework por módulo (o al menos por bloque).

**Modelo de datos:** ninguno nuevo (estructuras existen: `PRACTICE`, `HW` + rúbricas).
**Contenido:** ~67 ejercicios de práctica + ~64 homeworks nuevos, por bloques.
**Tests:** integridad (ya existe para práctica: respuesta ∈ opts, lección válida);
actualizar el conteo exacto de homework en `securities.test.ts` por cada batch.
**Riesgos:** volumen; el test de conteo de homework hay que actualizarlo en cada tanda.
**Dependencias:** ninguna.

---

## Fase D — Notificaciones de hábito (push)  ·  esfuerzo: M

**Problema:** hay infra VAPID (`push_subscriptions`, `web-push`, `/api/push/*`) pero
no se usa para el hábito.

**Objetivo:** push "no pierdas tu racha" + recordatorio si no se cumplió la meta diaria.

**Diseño:**
- Cron diario (Vercel/`/api/cron/*` con `CRON_SECRET`) que, por usuario suscripto,
  computa con los motores (server) `streakWithFreeze` + `xpEarnedToday` vs `daily_goal`;
  si la racha está en riesgo (sin actividad hoy y racha > 0) o falta meta → envía push.
- Respetar **quiet hours** y un opt-in en `securities_user_state` (nuevo campo
  `notify_streak boolean default false`) → migration menor.
- Dedup por día (no spamear) vía `app_logs.fingerprint` o un campo `last_notified_on`.

**API/UI:** toggle de notificaciones en el hub; endpoint para guardar la preferencia.
**Tests:** lógica de "racha en riesgo" pura (dado actividad + hora → ¿notificar?).
**Riesgos:** spam si la dedup falla; husos horarios (usar TZ del usuario o UTC con ventana amplia).
**Dependencias:** infra push ya existe.

---

## Fase E — Placement test (nivelación)  ·  esfuerzo: M

**Problema:** no hay diagnóstico inicial; el "próximo paso" siempre arranca en M1.

**Objetivo:** un test corto (1–2 preguntas por bloque, ~19–25) que estime el nivel y
recomiende por dónde empezar (saltar módulos ya dominados / marcar como "test out").

**Diseño:**
- Banco = muestreo de quizzes existentes, 1 por categoría.
- Resultado → marca módulos de categorías dominadas como `completed`/maestría base en
  `securities_progress` (o solo recomienda, sin auto-completar — decisión de producto).
- Se ofrece una sola vez (flag en `securities_user_state`, p.ej. `placement_done`).

**UI:** pantalla de onboarding al entrar por primera vez; CTA "Hacer test de nivelación".
**Tests:** scoring del placement → categorías recomendadas.
**Riesgos:** decidir si auto-marca progreso o solo sugiere (recomendado: solo sugiere).
**Dependencias:** ninguna.

---

## Fase F — Búsqueda  ·  esfuerzo: S

**Problema:** 82 módulos sin buscador de temas/lecciones.

**Objetivo:** búsqueda instantánea sobre títulos de módulos, `topics`, títulos de
lección y `sub`.

**Diseño:** índice en cliente (los datos son estáticos) — filtro sobre `SYLLABUS` +
`LESSONS`. Componente `SearchBox` + página/route `/search` o un overlay (Cmd-K).
**Tests:** función pura de match/ranking.
**Riesgos:** mínimos.
**Dependencias:** ninguna.

---

## Fase G — Gating configurable (opcional)  ·  esfuerzo: S

Hoy el Path usa **bloqueo suave** (elegido). Como opción futura: un setting
(`gating: 'soft' | 'strict' | 'block'`) en `securities_user_state` que cambie si los
módulos/bloques siguientes quedan realmente bloqueados hasta dominar el actual.
Implementación: el `summary`/UI marca `locked` según el modo. Bajo esfuerzo; se deja
como toggle para no imponer el modo estricto en contenido técnico.

---

## Fase H — Higiene de datos  ·  esfuerzo: S

`securities_quiz_results` crece sin límite (una fila por intento). Opciones:
- Cron de limpieza (retención N meses) sumado al `/api/cron/db/cleanup` existente, o
- Mantener solo el mejor intento + un contador (cambia el modelo; más invasivo).
Recomendado: retención por antigüedad en el cron de cleanup (bajo riesgo).

---

## Orden recomendado y resumen

| Fase | Qué | Esfuerzo | Valor | Dependencias |
|------|-----|----------|-------|--------------|
| **F** | Búsqueda | S | Medio | — |
| **D** | Notificaciones de hábito | M | Alto (retención) | infra push |
| **B** | Exámenes por sección | L | Alto | (mejor con A) |
| **E** | Placement test | M | Medio | — |
| **A** | Quizzes por nivel (maestría) | XL | Alto | — |
| **C** | Práctica + homework completos | XL | Medio | — |
| **G** | Gating configurable | S | Bajo | — |
| **H** | Higiene de datos | S | Bajo | cron cleanup |

**Recomendación de secuencia:** empezar por **F + D** (quick wins de alto valor de
retención), luego **B** (evaluación por sección, reusa motor), después el contenido
pesado **A** y **C** por bloques, y dejar **E/G/H** como complementos.

**Notas transversales:**
- Cada fase con migración (A: level, B: section, D: notify flag) es **aditiva**; correr
  por el pipeline normal, nunca aplicar a prod a mano.
- Mantener el patrón: lógica pura testeada + endpoint `summary` como fuente de verdad
  server-side + componentes que solo renderizan.
- Las fases de contenido (A/C) siguen el flujo de batches con tests de integridad,
  como se hizo con las lecciones del Doctorate Track.
