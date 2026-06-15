-- Exámenes por sección/categoría en CyberSec Academy.
-- securities_exam_results.section: NULL = examen final global; un texto = examen
-- de esa categoría. attempt_no se scope por (user, section) en la app.
-- Aditiva e idempotente.

alter table public.securities_exam_results
  add column if not exists section text;

create index if not exists idx_securities_exam_results_user_section
  on public.securities_exam_results (user_id, section);
