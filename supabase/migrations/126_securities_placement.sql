-- Flag de test de nivelación de CyberSec Academy: marca si el usuario ya lo hizo
-- (para no volver a ofrecerlo de forma proactiva). Aditiva e idempotente.

alter table public.securities_user_state
  add column if not exists placement_done boolean not null default false;
