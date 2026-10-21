-- =============================================================================
-- Gallo Negro Licencias — Esquema preparado para Fase 2 (niveles, insignias)
-- y Fase 3 (recompensas). En Fase 1 solo existen las tablas y su seguridad:
-- no se conceden insignias ni se permiten canjes todavía.
-- =============================================================================

create type public.config_status as enum ('pending_config', 'active', 'inactive');
create type public.redemption_status as enum ('requested', 'approved', 'rejected', 'delivered', 'cancelled');

create table public.user_levels (
  id           uuid primary key default gen_random_uuid(),
  position     integer not null unique check (position > 0),
  name         text not null unique,
  -- Umbrales configurables desde el panel; null mientras no se definan.
  minimum_xp   integer check (minimum_xp is null or minimum_xp >= 0),
  maximum_xp   integer check (maximum_xp is null or maximum_xp >= 0),
  status       public.config_status not null default 'pending_config',
  check (minimum_xp is null or maximum_xp is null or maximum_xp > minimum_xp),
  check (status <> 'active' or minimum_xp is not null)
);

create table public.badges (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  description  text not null default '',
  icon_url     text,
  unlock_rule  jsonb not null default '{}'::jsonb,
  status       public.config_status not null default 'pending_config'
);

create table public.user_badges (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete restrict,
  badge_id          uuid not null references public.badges (id) on delete restrict,
  awarded_at        timestamptz not null default now(),
  source_reference  text,
  awarded_by        uuid references auth.users (id) on delete set null,
  -- Las insignias son permanentes y únicas por usuario.
  unique (user_id, badge_id)
);
create trigger user_badges_immutable before update or delete on public.user_badges
  for each row execute function public.forbid_mutation();

create table public.rewards (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  description          text not null default '',
  requirements         text not null default '',
  points_required      integer not null check (points_required > 0),
  estimated_cost       numeric(12, 2) check (estimated_cost is null or estimated_cost >= 0),
  stock                integer check (stock is null or stock >= 0),
  availability_start   timestamptz,
  availability_end     timestamptz,
  terms                text not null default '',
  -- Una recompensa no se muestra a licenciados hasta que Gallo Negro la aprueba.
  status               public.config_status not null default 'pending_config',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger rewards_touch before update on public.rewards
  for each row execute function public.touch_updated_at();

create table public.reward_redemptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete restrict,
  reward_id     uuid not null references public.rewards (id) on delete restrict,
  points_spent  integer not null check (points_spent > 0),
  status        public.redemption_status not null default 'requested',
  requested_at  timestamptz not null default now(),
  approved_by   uuid references auth.users (id) on delete set null,
  delivered_at  timestamptz
);
create index reward_redemptions_user_idx on public.reward_redemptions (user_id);

alter table public.user_levels enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;

create policy levels_select on public.user_levels for select to authenticated using (true);
create policy levels_admin_write on public.user_levels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy badges_select on public.badges for select to authenticated using (true);
create policy badges_admin_write on public.badges for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy user_badges_select on public.user_badges for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy rewards_select on public.rewards for select to authenticated
  using (status = 'active' or public.is_admin());
create policy rewards_admin_write on public.rewards for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy redemptions_select on public.reward_redemptions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke insert, update, delete, truncate on public.user_badges, public.reward_redemptions from anon, authenticated;
revoke all on public.user_levels, public.badges, public.user_badges, public.rewards, public.reward_redemptions from anon;
