-- =============================================================================
-- Gallo Negro Licencias — Módulo de misiones (Fase 1)
-- Catálogo de misiones, participaciones por período, evidencias,
-- revisión manual, historial de XP (ledger) y alertas de fraude.
-- =============================================================================

create type public.mission_frequency as enum ('daily', 'weekly', 'monthly');
create type public.mission_status as enum ('draft', 'active', 'inactive', 'archived');
create type public.validation_method as enum ('auto', 'manual');
create type public.participation_status as enum ('available', 'in_progress', 'pending_review', 'completed', 'rejected', 'expired');
create type public.evidence_status as enum ('pending', 'approved', 'rejected');
create type public.xp_transaction_type as enum ('mission_reward', 'admin_adjustment', 'reversal');

-- Métricas que el sistema sabe calcular. Las automáticas se derivan de
-- ventas verificadas o de otras misiones; las manuales, de evidencias aprobadas.
--   auto:   verified_sales_count, verified_units, verified_units_category,
--           distinct_customers, recurring_customer_sales, distinct_sale_days,
--           categories_with_min_units, net_sales_growth_pct,
--           daily_missions_completed, days_with_completed_daily, weekly_missions_completed
--   manual: approved_evidence_count (cada evidencia aprobada suma 1),
--           manual_approval (una evidencia aprobada completa el objetivo)

create table public.missions (
  id                        uuid primary key default gen_random_uuid(),
  code                      text not null unique check (code ~ '^[A-Z0-9_-]{2,20}$'),
  title                     text not null check (char_length(title) between 3 and 120),
  description               text not null default '',
  category                  text not null check (char_length(category) between 2 and 40),
  frequency                 public.mission_frequency not null,
  target_value              numeric(12, 2) not null check (target_value > 0),
  target_unit               text not null check (char_length(target_unit) between 1 and 40),
  metric                    text not null,
  metric_params             jsonb not null default '{}'::jsonb,
  -- Objetivo distinto por plan: {"<plan_id>": 5}. Permite ajustar metas al tipo de licencia.
  plan_targets              jsonb not null default '{}'::jsonb,
  xp_reward                 integer not null check (xp_reward > 0 and xp_reward <= 100000),
  difficulty                text not null default 'media' check (difficulty in ('baja', 'media', 'alta')),
  start_at                  timestamptz,
  end_at                    timestamptz,
  evidence_required         boolean not null default false,
  evidence_instructions     text not null default '',
  validation_method         public.validation_method not null,
  applicable_license_plans  uuid[],          -- null = todos los planes
  territory_rules           text[],          -- null = todos los territorios
  timezone                  text not null default 'America/Caracas',
  review_grace_days         integer not null default 3 check (review_grace_days between 0 and 30),
  status                    public.mission_status not null default 'draft',
  inactive_reason           text,
  created_by                uuid references auth.users (id) on delete set null,
  updated_by                uuid references auth.users (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  check (end_at is null or start_at is null or end_at > start_at),
  check (metric in ('verified_sales_count', 'verified_units', 'verified_units_category', 'distinct_customers',
                    'recurring_customer_sales', 'distinct_sale_days', 'categories_with_min_units',
                    'net_sales_growth_pct', 'daily_missions_completed', 'days_with_completed_daily',
                    'weekly_missions_completed', 'approved_evidence_count', 'manual_approval')),
  -- Las misiones manuales siempre exigen evidencia y se validan con ella;
  -- las automáticas nunca dependen de evidencias del usuario.
  check ((validation_method = 'manual') = (metric in ('approved_evidence_count', 'manual_approval'))),
  check (validation_method = 'auto' or evidence_required),
  check (metric <> 'verified_units_category' or metric_params ? 'category'),
  check (metric <> 'categories_with_min_units' or metric_params ? 'min_units'),
  -- Las métricas compuestas solo tienen sentido en la frecuencia para la que se diseñaron.
  check (metric <> 'daily_missions_completed' or frequency = 'daily'),
  check (metric <> 'days_with_completed_daily' or frequency in ('weekly', 'monthly')),
  check (metric <> 'weekly_missions_completed' or frequency = 'monthly'),
  check (jsonb_typeof(plan_targets) = 'object'),
  check (jsonb_typeof(metric_params) = 'object')
);
create index missions_status_idx on public.missions (status, frequency);

-- Validar la zona horaria (una zona inválida rompería el cálculo de períodos).
create or replace function public.missions_validate()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Zona horaria no válida: %', new.timezone using errcode = '22023';
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  return new;
end;
$$;
create trigger missions_validate before insert or update on public.missions
  for each row execute function public.missions_validate();

create or replace function public.audit_missions()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.write_audit('mission.deleted', 'mission', old.id::text, to_jsonb(old));
    return old;
  end if;
  perform public.write_audit(
    case when tg_op = 'INSERT' then 'mission.created' else 'mission.updated' end,
    'mission', new.id::text,
    case when tg_op = 'INSERT' then to_jsonb(new)
         else jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)) end);
  return new;
end;
$$;
create trigger missions_audit after insert or update or delete on public.missions
  for each row execute function public.audit_missions();

-- -----------------------------------------------------------------------------
-- Participaciones: una por misión, usuario y período.
-- target_value y xp_reward se copian al crearla, así cambiar la misión
-- no altera retroactivamente participaciones ya abiertas o premiadas.
-- -----------------------------------------------------------------------------
create table public.mission_participations (
  id                uuid primary key default gen_random_uuid(),
  mission_id        uuid not null references public.missions (id) on delete restrict,
  user_id           uuid not null references public.profiles (id) on delete restrict,
  period_start      date not null,
  period_end        date not null,            -- último día incluido del período
  target_value      numeric(12, 2) not null check (target_value > 0),
  xp_reward         integer not null check (xp_reward > 0),
  current_progress  numeric(12, 2),           -- null = sin datos comparables
  status            public.participation_status not null default 'available',
  evidence_url      text,
  submitted_at      timestamptz,
  reviewed_by       uuid references auth.users (id) on delete set null,
  reviewed_at       timestamptz,
  rejection_reason  text,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (mission_id, user_id, period_start),
  check (period_end >= period_start),
  check (status <> 'completed' or completed_at is not null)
);
create index participations_user_idx on public.mission_participations (user_id, status, period_start desc);
create index participations_mission_idx on public.mission_participations (mission_id, period_start);
create trigger participations_touch before update on public.mission_participations
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Evidencias. Una misma evidencia (enlace normalizado o huella del archivo)
-- no puede usarse dos veces para la misma misión, por nadie, salvo que haya
-- sido rechazada y se vuelva a presentar.
-- -----------------------------------------------------------------------------
create table public.mission_evidences (
  id                uuid primary key default gen_random_uuid(),
  participation_id  uuid not null references public.mission_participations (id) on delete restrict,
  mission_id        uuid not null references public.missions (id) on delete restrict,
  user_id           uuid not null references public.profiles (id) on delete restrict,
  url               text,
  storage_path      text,
  evidence_key      text not null,
  note              text check (note is null or char_length(note) <= 1000),
  status            public.evidence_status not null default 'pending',
  submitted_at      timestamptz not null default now(),
  reviewed_by       uuid references auth.users (id) on delete set null,
  reviewed_at       timestamptz,
  rejection_reason  text,
  check (url is not null or storage_path is not null),
  check (status = 'pending' or (reviewed_by is not null and reviewed_at is not null)),
  check (status <> 'rejected' or coalesce(trim(rejection_reason), '') <> ''),
  check (reviewed_by is null or reviewed_by <> user_id)
);
create unique index evidences_unique_per_mission on public.mission_evidences (mission_id, evidence_key)
  where status <> 'rejected';
create index evidences_participation_idx on public.mission_evidences (participation_id);
create index evidences_pending_idx on public.mission_evidences (submitted_at) where status = 'pending';

-- -----------------------------------------------------------------------------
-- Historial de XP: solo inserción. El saldo se deriva de la suma de movimientos.
-- idempotency_key evita conceder dos veces el mismo premio o ajuste.
-- -----------------------------------------------------------------------------
create table public.xp_ledger (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references public.profiles (id) on delete restrict,
  amount            integer not null check (amount <> 0),
  transaction_type  public.xp_transaction_type not null,
  mission_id        uuid references public.missions (id) on delete restrict,
  participation_id  uuid references public.mission_participations (id) on delete restrict,
  reference_type    text,
  reference_id      text,
  description       text not null,
  idempotency_key   text not null unique,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  check (transaction_type <> 'mission_reward' or (participation_id is not null and amount > 0)),
  check (transaction_type = 'mission_reward' or created_by is not null)
);
-- Un único premio por participación, aunque cambie la clave de idempotencia.
create unique index xp_ledger_one_reward_per_participation on public.xp_ledger (participation_id)
  where transaction_type = 'mission_reward';
create index xp_ledger_user_idx on public.xp_ledger (user_id, created_at desc);
create trigger xp_ledger_immutable before update or delete on public.xp_ledger
  for each row execute function public.forbid_mutation();

create view public.user_xp_balances with (security_invoker = true) as
  select user_id, sum(amount)::bigint as total_xp, count(*) as movements
  from public.xp_ledger
  group by user_id;

-- -----------------------------------------------------------------------------
-- Alertas de posible fraude o de revisión necesaria.
-- -----------------------------------------------------------------------------
create table public.fraud_flags (
  id           bigint generated always as identity primary key,
  user_id      uuid references public.profiles (id) on delete set null,
  kind         text not null,
  entity_type  text,
  entity_id    text,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  resolved_by  uuid references auth.users (id) on delete set null,
  resolved_at  timestamptz,
  resolution   text
);
create index fraud_flags_open_idx on public.fraud_flags (created_at desc) where resolved_at is null;

-- =============================================================================
-- Períodos
-- =============================================================================

-- Período (fechas locales de la campaña) que contiene el instante p_at.
-- Semanas de lunes a domingo.
create or replace function public.mission_period(p_frequency public.mission_frequency, p_tz text, p_at timestamptz)
returns table (period_start date, period_end date)
language sql
immutable
as $$
  with l as (select (p_at at time zone p_tz)::date as d)
  select
    case p_frequency
      when 'daily' then l.d
      when 'weekly' then date_trunc('week', l.d)::date
      else date_trunc('month', l.d)::date
    end,
    case p_frequency
      when 'daily' then l.d
      when 'weekly' then date_trunc('week', l.d)::date + 6
      else (date_trunc('month', l.d) + interval '1 month' - interval '1 day')::date
    end
  from l;
$$;

-- Instantes [inicio, fin) de un período en la zona horaria de la campaña.
create or replace function public.period_bounds(p_start date, p_end date, p_tz text, out starts_at timestamptz, out ends_at timestamptz)
language sql
immutable
as $$
  select (p_start::timestamp at time zone p_tz), ((p_end + 1)::timestamp at time zone p_tz);
$$;

-- ¿Aplica la misión a este usuario según su licencia activa?
create or replace function public.mission_applies_to(p_mission public.missions, p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_license public.licenses := public.active_license(p_user);
begin
  if v_license.id is null then
    return false;
  end if;
  if p_mission.applicable_license_plans is not null
     and not (v_license.plan_id = any (p_mission.applicable_license_plans)) then
    return false;
  end if;
  if p_mission.territory_rules is not null
     and (v_license.territory is null or not (lower(v_license.territory) = any (
           select lower(t) from unnest(p_mission.territory_rules) t))) then
    return false;
  end if;
  return true;
end;
$$;

-- Crea (si no existen) las participaciones del período que contiene p_at
-- para todas las misiones activas que aplican al usuario.
create or replace function public.ensure_participations(p_user uuid, p_at timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_m public.missions;
  v_period record;
  v_license public.licenses := public.active_license(p_user);
  v_target numeric;
  v_created integer := 0;
  v_rows integer;
begin
  if v_license.id is null then
    return 0;
  end if;
  for v_m in
    select * from public.missions
    where status = 'active'
      and (start_at is null or start_at <= p_at)
      and (end_at is null or end_at > p_at)
  loop
    if not public.mission_applies_to(v_m, p_user) then
      continue;
    end if;
    select * into v_period from public.mission_period(v_m.frequency, v_m.timezone, p_at);
    -- No abrir períodos cuyo plazo de revisión ya terminó.
    if (v_period.period_end + v_m.review_grace_days) < (now() at time zone v_m.timezone)::date then
      continue;
    end if;
    v_target := coalesce((v_m.plan_targets ->> v_license.plan_id::text)::numeric, v_m.target_value);
    insert into public.mission_participations (mission_id, user_id, period_start, period_end, target_value, xp_reward)
    values (v_m.id, p_user, v_period.period_start, v_period.period_end, v_target, v_m.xp_reward)
    on conflict (mission_id, user_id, period_start) do nothing;
    get diagnostics v_rows = row_count;
    v_created := v_created + v_rows;
  end loop;
  return v_created;
end;
$$;

-- =============================================================================
-- Cálculo del progreso
-- =============================================================================

-- Rango de dependencia de cada métrica: las compuestas se recalculan después
-- de las misiones de las que dependen.
create or replace function public.metric_rank(p_metric text)
returns integer
language sql
immutable
as $$
  select case p_metric
    when 'daily_missions_completed' then 1
    when 'days_with_completed_daily' then 2
    when 'weekly_missions_completed' then 3
    else 0
  end;
$$;

create or replace function public.compute_mission_progress(p_participation_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  p public.mission_participations;
  m public.missions;
  b record;
  v numeric;
  v_prev numeric;
  v_prev_start date;
  v_prev_bounds record;
begin
  select * into p from public.mission_participations where id = p_participation_id;
  select * into m from public.missions where id = p.mission_id;
  select * into b from public.period_bounds(p.period_start, p.period_end, m.timezone);

  case m.metric
    when 'verified_sales_count' then
      select count(*) into v from public.sales s
      where s.licensee_id = p.user_id and s.status = 'verified'
        and s.sold_at >= b.starts_at and s.sold_at < b.ends_at;

    when 'verified_units' then
      select coalesce(sum(i.quantity), 0) into v
      from public.sales s join public.sale_items i on i.sale_id = s.id
      where s.licensee_id = p.user_id and s.status = 'verified'
        and s.sold_at >= b.starts_at and s.sold_at < b.ends_at;

    when 'verified_units_category' then
      select coalesce(sum(i.quantity), 0) into v
      from public.sales s
      join public.sale_items i on i.sale_id = s.id
      join public.product_categories c on c.id = i.category_id
      where s.licensee_id = p.user_id and s.status = 'verified'
        and s.sold_at >= b.starts_at and s.sold_at < b.ends_at
        and c.slug = m.metric_params ->> 'category';

    when 'distinct_customers' then
      select count(distinct s.customer_key) into v from public.sales s
      where s.licensee_id = p.user_id and s.status = 'verified' and s.customer_key is not null
        and s.sold_at >= b.starts_at and s.sold_at < b.ends_at;

    when 'recurring_customer_sales' then
      -- Compras del período de clientes que ya tenían una compra verificada anterior.
      select count(*) into v from public.sales s
      where s.licensee_id = p.user_id and s.status = 'verified' and s.customer_key is not null
        and s.sold_at >= b.starts_at and s.sold_at < b.ends_at
        and exists (
          select 1 from public.sales prev
          where prev.licensee_id = s.licensee_id and prev.status = 'verified'
            and prev.customer_key = s.customer_key
            and prev.id <> s.id
            and (prev.sold_at < s.sold_at or (prev.sold_at = s.sold_at and prev.id < s.id)));

    when 'distinct_sale_days' then
      select count(distinct (s.sold_at at time zone m.timezone)::date) into v from public.sales s
      where s.licensee_id = p.user_id and s.status = 'verified'
        and s.sold_at >= b.starts_at and s.sold_at < b.ends_at;

    when 'categories_with_min_units' then
      select count(*) into v from (
        select i.category_id
        from public.sales s join public.sale_items i on i.sale_id = s.id
        where s.licensee_id = p.user_id and s.status = 'verified'
          and s.sold_at >= b.starts_at and s.sold_at < b.ends_at
        group by i.category_id
        having sum(i.quantity) >= (m.metric_params ->> 'min_units')::numeric
      ) x;

    when 'net_sales_growth_pct' then
      v_prev_start := case m.frequency
        when 'monthly' then (p.period_start - interval '1 month')::date
        when 'weekly' then p.period_start - 7
        else p.period_start - 1 end;
      select * into v_prev_bounds from public.period_bounds(v_prev_start, p.period_start - 1, m.timezone);
      select coalesce(sum(i.quantity * i.unit_price), 0) into v_prev
      from public.sales s join public.sale_items i on i.sale_id = s.id
      where s.licensee_id = p.user_id and s.status = 'verified'
        and s.sold_at >= v_prev_bounds.starts_at and s.sold_at < v_prev_bounds.ends_at;
      if v_prev = 0 then
        return null;  -- sin datos comparables: la misión no puede cumplirse
      end if;
      select coalesce(sum(i.quantity * i.unit_price), 0) into v
      from public.sales s join public.sale_items i on i.sale_id = s.id
      where s.licensee_id = p.user_id and s.status = 'verified'
        and s.sold_at >= b.starts_at and s.sold_at < b.ends_at;
      v := round((v - v_prev) / v_prev * 100, 2);

    when 'daily_missions_completed' then
      select count(distinct op.mission_id) into v
      from public.mission_participations op join public.missions om on om.id = op.mission_id
      where op.user_id = p.user_id and op.status = 'completed'
        and om.frequency = 'daily' and public.metric_rank(om.metric) = 0
        and op.period_start between p.period_start and p.period_end;

    when 'days_with_completed_daily' then
      select count(distinct op.period_start) into v
      from public.mission_participations op join public.missions om on om.id = op.mission_id
      where op.user_id = p.user_id and op.status = 'completed'
        and om.frequency = 'daily'
        and op.period_start between p.period_start and p.period_end;

    when 'weekly_missions_completed' then
      select count(distinct op.mission_id) into v
      from public.mission_participations op join public.missions om on om.id = op.mission_id
      where op.user_id = p.user_id and op.status = 'completed'
        and om.frequency = 'weekly' and om.metric <> 'weekly_missions_completed'
        and (op.completed_at at time zone m.timezone)::date between p.period_start and p.period_end;

    when 'approved_evidence_count' then
      select count(*) into v from public.mission_evidences e
      where e.participation_id = p.id and e.status = 'approved';

    when 'manual_approval' then
      select case when exists (select 1 from public.mission_evidences e
                               where e.participation_id = p.id and e.status = 'approved')
                  then p.target_value else 0 end into v;

    else
      raise exception 'Métrica desconocida: %', m.metric;
  end case;

  return v;
end;
$$;

-- Recalcula una participación y, si alcanzó el objetivo, la completa y
-- concede los XP. Es idempotente: llamarla de nuevo no duplica nada.
create or replace function public.recompute_participation(p_participation_id uuid)
returns public.participation_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.mission_participations;
  m public.missions;
  v_progress numeric;
  v_status public.participation_status;
  v_has_pending boolean;
  v_last_evidence public.mission_evidences;
begin
  select * into p from public.mission_participations where id = p_participation_id for update;
  if not found then
    raise exception 'Participación no encontrada' using errcode = 'P0002';
  end if;
  if p.status in ('completed', 'expired') then
    return p.status;
  end if;
  select * into m from public.missions where id = p.mission_id;

  v_progress := public.compute_mission_progress(p.id);

  if v_progress is not null and v_progress >= p.target_value then
    update public.mission_participations
    set current_progress = v_progress, status = 'completed', completed_at = now()
    where id = p.id;

    insert into public.xp_ledger (user_id, amount, transaction_type, mission_id, participation_id,
                                  reference_type, reference_id, description, idempotency_key, created_by)
    values (p.user_id, p.xp_reward, 'mission_reward', p.mission_id, p.id,
            'mission_participation', p.id::text,
            format('%s · %s (%s a %s)', m.code, m.title, p.period_start, p.period_end),
            'mission_reward:' || p.id, null)
    on conflict do nothing;
    return 'completed';
  end if;

  select exists (select 1 from public.mission_evidences e where e.participation_id = p.id and e.status = 'pending')
    into v_has_pending;
  select * into v_last_evidence from public.mission_evidences e
    where e.participation_id = p.id order by e.submitted_at desc, e.id desc limit 1;

  v_status := case
    when v_has_pending then 'pending_review'
    when v_last_evidence.status = 'rejected' and coalesce(v_progress, 0) = 0 then 'rejected'
    when coalesce(v_progress, 0) > 0 then 'in_progress'
    else 'available'
  end;

  update public.mission_participations
  set current_progress = v_progress, status = v_status
  where id = p.id and (current_progress is distinct from v_progress or status is distinct from v_status);
  return v_status;
end;
$$;

-- Marca como vencidas las participaciones cuyo período y plazo de revisión terminaron.
create or replace function public.expire_participations(p_user uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.mission_participations p
  set status = 'expired'
  from public.missions m
  where m.id = p.mission_id
    and (p_user is null or p.user_id = p_user)
    and p.status in ('available', 'in_progress', 'rejected', 'pending_review')
    and (p.period_end + m.review_grace_days) < (now() at time zone m.timezone)::date
    -- Una evidencia pendiente nunca vence sin revisión: el admin debe resolverla.
    and not exists (select 1 from public.mission_evidences e where e.participation_id = p.id and e.status = 'pending');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Recalcula en orden de dependencia todas las participaciones abiertas del usuario.
create or replace function public.recompute_user_missions(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  perform public.expire_participations(p_user);
  for v_id in
    select p.id from public.mission_participations p join public.missions m on m.id = p.mission_id
    where p.user_id = p_user and p.status not in ('completed', 'expired')
    order by public.metric_rank(m.metric), p.period_start
  loop
    perform public.recompute_participation(v_id);
  end loop;
end;
$$;

-- =============================================================================
-- Integración con ventas: al verificar o anular una venta se recalculan las misiones.
-- =============================================================================
create or replace function public.on_sale_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_affected record;
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'verified' then
    -- La venta puede ser de un período anterior que el licenciado no abrió.
    perform public.ensure_participations(new.licensee_id, new.sold_at);
    perform public.ensure_participations(new.licensee_id, now());
    perform public.recompute_user_missions(new.licensee_id);
  elsif old.status = 'verified' then
    perform public.recompute_user_missions(new.licensee_id);
    -- Premios ya concedidos que dependían de esta venta: se marcan para revisión.
    -- Las correcciones de XP las hace un administrador con un ajuste auditado.
    for v_affected in
      select p.id, m.code from public.mission_participations p
      join public.missions m on m.id = p.mission_id
      cross join lateral public.period_bounds(p.period_start, p.period_end, m.timezone) b
      where p.user_id = new.licensee_id and p.status = 'completed'
        and m.validation_method = 'auto'
        and public.metric_rank(m.metric) = 0
        and new.sold_at >= b.starts_at and new.sold_at < b.ends_at
        and coalesce(public.compute_mission_progress(p.id), 0) < p.target_value
    loop
      insert into public.fraud_flags (user_id, kind, entity_type, entity_id, details)
      values (new.licensee_id, 'reward_review_needed', 'mission_participation', v_affected.id::text,
              jsonb_build_object('mission', v_affected.code, 'sale_id', new.id, 'sale_reference', new.reference,
                                 'reason', 'Se anuló una venta verificada que contaba para una misión ya premiada'));
    end loop;
  end if;
  return new;
end;
$$;
create trigger sales_status_missions after update of status on public.sales
  for each row execute function public.on_sale_status_change();

-- =============================================================================
-- API para el licenciado
-- =============================================================================

-- Abre las participaciones del período actual y actualiza estados. Se llama al cargar el panel.
create or replace function public.refresh_my_missions()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;
  perform public.ensure_participations(auth.uid(), now());
  perform public.recompute_user_missions(auth.uid());
end;
$$;

-- Normaliza un enlace para detectar evidencias repetidas
-- (sin protocolo, www, fragmento, barra final ni parámetros de rastreo).
create or replace function public.normalize_evidence_url(p_url text)
returns text
language plpgsql
immutable
as $$
declare
  v text := lower(trim(p_url));
  v_query text;
  v_keep text;
begin
  v := regexp_replace(v, '#.*$', '');
  v := regexp_replace(v, '^[a-z]+://', '');
  v := regexp_replace(v, '^(www\.|m\.)', '');
  v_query := substring(v from '\?(.*)$');
  v := regexp_replace(v, '\?.*$', '');
  v := regexp_replace(v, '/+$', '');
  -- YouTube identifica el video en el parámetro v.
  if v ~ '^youtube\.com/watch' and v_query is not null then
    v_keep := substring(v_query from '(?:^|&)v=([^&]+)');
    if v_keep is not null then
      v := v || '?v=' || v_keep;
    end if;
  end if;
  return 'url:' || v;
end;
$$;

-- Presentar una evidencia. Devuelve {"ok": true, "evidence_id": ...} o {"ok": false, "error": ...}.
-- Los intentos de reutilizar evidencias se registran como alerta.
create or replace function public.submit_mission_evidence(
  p_participation_id uuid,
  p_url text,
  p_storage_path text default null,
  p_file_sha256 text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  p public.mission_participations;
  m public.missions;
  b record;
  v_key text;
  v_url text := nullif(trim(p_url), '');
  v_open_count integer;
  v_evidence uuid;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;

  select * into p from public.mission_participations where id = p_participation_id for update;
  if not found or p.user_id <> v_user then
    raise exception 'Participación no encontrada' using errcode = 'P0002';
  end if;
  select * into m from public.missions where id = p.mission_id;
  select * into b from public.period_bounds(p.period_start, p.period_end, m.timezone);

  if m.validation_method <> 'manual' then
    return jsonb_build_object('ok', false, 'error', 'Esta misión se valida automáticamente con tus ventas verificadas.');
  end if;
  if p.status in ('completed', 'expired') then
    return jsonb_build_object('ok', false, 'error', 'Esta participación ya está cerrada.');
  end if;
  if now() >= b.ends_at then
    return jsonb_build_object('ok', false, 'error', 'El período de esta misión ya terminó.');
  end if;

  if p_storage_path is not null then
    if p_file_sha256 is null or p_file_sha256 !~ '^[0-9a-f]{64}$' then
      raise exception 'Huella del archivo no válida' using errcode = '22023';
    end if;
    -- Los archivos solo pueden estar en la carpeta del propio usuario.
    if p_storage_path !~ ('^' || v_user::text || '/[A-Za-z0-9._-]+$') then
      raise exception 'Ruta de archivo no válida' using errcode = '42501';
    end if;
    v_key := 'sha256:' || p_file_sha256;
  elsif v_url is not null then
    if v_url !~* '^https?://[^\s/$.?#][^\s]*$' or char_length(v_url) > 500 then
      return jsonb_build_object('ok', false, 'error', 'El enlace no es válido. Usa una dirección que empiece por https://');
    end if;
    v_key := public.normalize_evidence_url(v_url);
  else
    return jsonb_build_object('ok', false, 'error', 'Adjunta un enlace o un archivo como evidencia.');
  end if;

  -- No admitir más evidencias abiertas de las necesarias para el objetivo.
  select count(*) into v_open_count from public.mission_evidences e
  where e.participation_id = p.id and e.status in ('pending', 'approved');
  if (m.metric = 'manual_approval' and v_open_count >= 1)
     or (m.metric = 'approved_evidence_count' and v_open_count >= p.target_value) then
    return jsonb_build_object('ok', false, 'error', 'Ya enviaste las evidencias necesarias. Espera la revisión.');
  end if;

  begin
    insert into public.mission_evidences (participation_id, mission_id, user_id, url, storage_path, evidence_key, note)
    values (p.id, p.mission_id, v_user, v_url, p_storage_path, v_key, nullif(trim(p_note), ''))
    returning id into v_evidence;
  exception when unique_violation then
    insert into public.fraud_flags (user_id, kind, entity_type, entity_id, details)
    values (v_user, 'duplicate_evidence', 'mission', m.id::text,
            jsonb_build_object('mission', m.code, 'participation_id', p.id, 'evidence_key', v_key));
    return jsonb_build_object('ok', false, 'error', 'Esta evidencia ya se utilizó para esta misión.');
  end;

  update public.mission_participations
  set evidence_url = coalesce(v_url, 'archivo:' || p_storage_path), submitted_at = now(), rejection_reason = null
  where id = p.id;
  perform public.recompute_participation(p.id);

  return jsonb_build_object('ok', true, 'evidence_id', v_evidence);
end;
$$;

-- =============================================================================
-- API administrativa
-- =============================================================================

create or replace function public.review_mission_evidence(p_evidence_id uuid, p_approve boolean, p_reason text default null)
returns public.participation_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e public.mission_evidences;
  v_status public.participation_status;
  v_meta uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede revisar evidencias' using errcode = '42501';
  end if;
  select * into e from public.mission_evidences where id = p_evidence_id for update;
  if not found then
    raise exception 'Evidencia no encontrada' using errcode = 'P0002';
  end if;
  if e.user_id = auth.uid() then
    raise exception 'No puedes aprobar tus propias evidencias' using errcode = '42501';
  end if;
  if e.status <> 'pending' then
    raise exception 'La evidencia ya fue revisada' using errcode = '22023';
  end if;
  if not p_approve and coalesce(trim(p_reason), '') = '' then
    raise exception 'Indica el motivo del rechazo' using errcode = '22023';
  end if;

  update public.mission_evidences
  set status = case when p_approve then 'approved'::public.evidence_status else 'rejected'::public.evidence_status end,
      reviewed_by = auth.uid(), reviewed_at = now(),
      rejection_reason = case when p_approve then null else trim(p_reason) end
  where id = e.id;

  update public.mission_participations
  set reviewed_by = auth.uid(), reviewed_at = now(),
      rejection_reason = case when p_approve then null else trim(p_reason) end
  where id = e.participation_id;

  perform public.write_audit(case when p_approve then 'evidence.approved' else 'evidence.rejected' end,
    'mission_evidence', e.id::text,
    jsonb_build_object('user_id', e.user_id, 'mission_id', e.mission_id, 'participation_id', e.participation_id, 'reason', p_reason));

  v_status := public.recompute_participation(e.participation_id);
  -- Misiones compuestas (D10, S10, M10…) que dependen de esta.
  if v_status = 'completed' then
    perform public.recompute_user_missions(e.user_id);
  end if;
  return v_status;
end;
$$;

-- Ajuste manual de XP (positivo o negativo), siempre motivado, auditado e idempotente.
create or replace function public.admin_adjust_xp(
  p_user uuid,
  p_amount integer,
  p_reason text,
  p_idempotency_key text,
  p_participation_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
  v_mission uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede ajustar XP' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'No puedes ajustar tus propios XP' using errcode = '42501';
  end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 100000 then
    raise exception 'Cantidad de XP no válida' using errcode = '22023';
  end if;
  if coalesce(trim(p_reason), '') = '' or char_length(trim(p_reason)) < 5 then
    raise exception 'Describe el motivo del ajuste' using errcode = '22023';
  end if;
  if coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'Falta la clave de idempotencia' using errcode = '22023';
  end if;
  if p_participation_id is not null then
    select mission_id into v_mission from public.mission_participations
    where id = p_participation_id and user_id = p_user;
    if v_mission is null then
      raise exception 'La participación no pertenece a ese usuario' using errcode = '22023';
    end if;
  end if;

  insert into public.xp_ledger (user_id, amount, transaction_type, mission_id, participation_id,
                                reference_type, reference_id, description, idempotency_key, created_by)
  values (p_user, p_amount, case when p_participation_id is not null and p_amount < 0 then 'reversal'::public.xp_transaction_type
                                 else 'admin_adjustment'::public.xp_transaction_type end,
          v_mission, p_participation_id, 'admin', auth.uid()::text, trim(p_reason),
          'admin:' || trim(p_idempotency_key), auth.uid())
  on conflict (idempotency_key) do nothing
  returning id into v_id;

  if v_id is null then
    -- Petición repetida: devolvemos el movimiento original sin duplicarlo.
    select id into v_id from public.xp_ledger where idempotency_key = 'admin:' || trim(p_idempotency_key);
    return v_id;
  end if;

  perform public.write_audit('xp.adjusted', 'xp_ledger', v_id::text,
    jsonb_build_object('user_id', p_user, 'amount', p_amount, 'reason', p_reason, 'participation_id', p_participation_id));
  return v_id;
end;
$$;

-- Duplicar una misión como borrador.
create or replace function public.duplicate_mission(p_mission_id uuid, p_new_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede duplicar misiones' using errcode = '42501';
  end if;
  insert into public.missions (code, title, description, category, frequency, target_value, target_unit, metric,
    metric_params, plan_targets, xp_reward, difficulty, start_at, end_at, evidence_required, evidence_instructions,
    validation_method, applicable_license_plans, territory_rules, timezone, review_grace_days, status)
  select upper(trim(p_new_code)), title || ' (copia)', description, category, frequency, target_value, target_unit, metric,
    metric_params, plan_targets, xp_reward, difficulty, start_at, end_at, evidence_required, evidence_instructions,
    validation_method, applicable_license_plans, territory_rules, timezone, review_grace_days, 'draft'
  from public.missions where id = p_mission_id
  returning id into v_id;
  if v_id is null then
    raise exception 'Misión no encontrada' using errcode = 'P0002';
  end if;
  return v_id;
end;
$$;

create or replace function public.resolve_fraud_flag(p_flag_id bigint, p_resolution text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if coalesce(trim(p_resolution), '') = '' then
    raise exception 'Describe cómo se resolvió la alerta' using errcode = '22023';
  end if;
  update public.fraud_flags set resolved_by = auth.uid(), resolved_at = now(), resolution = trim(p_resolution)
  where id = p_flag_id and resolved_at is null;
  perform public.write_audit('fraud_flag.resolved', 'fraud_flag', p_flag_id::text, jsonb_build_object('resolution', p_resolution));
end;
$$;

-- Tarea programada (cron diario): abre los períodos nuevos de todos los licenciados
-- activos y vence los que terminaron. Solo para service_role / pg_cron.
create or replace function public.run_mission_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
  v_opened integer := 0;
  v_expired integer;
begin
  v_expired := public.expire_participations(null);
  for v_user in select distinct user_id from public.licenses where status = 'active' loop
    v_opened := v_opened + public.ensure_participations(v_user, now());
  end loop;
  return jsonb_build_object('opened', v_opened, 'expired', v_expired);
end;
$$;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.missions enable row level security;
alter table public.mission_participations enable row level security;
alter table public.mission_evidences enable row level security;
alter table public.xp_ledger enable row level security;
alter table public.fraud_flags enable row level security;

-- Misiones: el licenciado ve las activas que le corresponden; el admin las gestiona todas.
create policy missions_select on public.missions for select to authenticated
  using (public.is_admin() or (status = 'active' and public.mission_applies_to(missions, auth.uid())));
create policy missions_admin_insert on public.missions for insert to authenticated
  with check (public.is_admin());
create policy missions_admin_update on public.missions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- No se borran misiones con historial (FK restrict); el admin archiva o desactiva.
create policy missions_admin_delete on public.missions for delete to authenticated
  using (public.is_admin());

create policy participations_select on public.mission_participations for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy evidences_select on public.mission_evidences for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy xp_ledger_select on public.xp_ledger for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy fraud_flags_admin_select on public.fraud_flags for select to authenticated
  using (public.is_admin());

-- Sin escritura directa: todo pasa por las funciones anteriores.
revoke insert, update, delete, truncate on public.mission_participations, public.mission_evidences,
  public.xp_ledger, public.fraud_flags from anon, authenticated;
revoke all on public.missions, public.mission_participations, public.mission_evidences,
  public.xp_ledger, public.fraud_flags, public.user_xp_balances from anon;
grant select on public.user_xp_balances to authenticated;

-- Funciones internas
revoke execute on function public.ensure_participations(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.compute_mission_progress(uuid) from public, anon, authenticated;
revoke execute on function public.recompute_participation(uuid) from public, anon, authenticated;
revoke execute on function public.recompute_user_missions(uuid) from public, anon, authenticated;
revoke execute on function public.expire_participations(uuid) from public, anon, authenticated;
revoke execute on function public.run_mission_maintenance() from public, anon, authenticated;
revoke execute on function public.on_sale_status_change() from public, anon, authenticated;

-- Funciones de la API
revoke execute on function public.refresh_my_missions() from public, anon;
revoke execute on function public.submit_mission_evidence(uuid, text, text, text, text) from public, anon;
revoke execute on function public.review_mission_evidence(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_adjust_xp(uuid, integer, text, text, uuid) from public, anon;
revoke execute on function public.duplicate_mission(uuid, text) from public, anon;
revoke execute on function public.resolve_fraud_flag(bigint, text) from public, anon;
grant execute on function public.refresh_my_missions() to authenticated;
grant execute on function public.submit_mission_evidence(uuid, text, text, text, text) to authenticated;
grant execute on function public.review_mission_evidence(uuid, boolean, text) to authenticated;
grant execute on function public.admin_adjust_xp(uuid, integer, text, text, uuid) to authenticated;
grant execute on function public.duplicate_mission(uuid, text) to authenticated;
grant execute on function public.resolve_fraud_flag(bigint, text) to authenticated;
