-- =============================================================================
-- Gallo Negro Licencias — Tienda Clan (Fase 2): ediciones mensuales, premios,
-- canjes con retención inmediata de GN, metas, términos con versión y fotos.
--
--  * El costo real de cada premio vive en tablas aparte que solo lee el admin.
--  * Un canje bloquea la cuenta GN y luego el producto (siempre en ese orden),
--    usa una clave de idempotencia por licenciatario y limita la frecuencia.
--  * Los premios que salen del catálogo no afectan los GN guardados.
-- =============================================================================

create type public.clan_edition_status as enum ('borrador', 'programado', 'publicado', 'cerrado');
create type public.clan_product_status as enum ('borrador', 'programado', 'activo', 'pausado', 'archivado');
create type public.clan_product_kind as enum ('fisico', 'experiencia', 'digital');
create type public.clan_tier as enum ('calle', 'medio', 'alto', 'premium', 'elite');
create type public.clan_redemption_status as enum (
  'solicitado', 'aprobado', 'en_preparacion', 'sustituido', 'enviado', 'entregado', 'rechazado', 'cancelado'
);

-- Nivel del premio → rango mínimo por defecto (Calle = Umbral … Élite = AYAM CEMANI).
create or replace function public.clan_tier_level(p_tier public.clan_tier)
returns integer
language sql
immutable
as $$
  select case p_tier when 'calle' then 1 when 'medio' then 2 when 'alto' then 3 when 'premium' then 4 else 5 end;
$$;

create table public.clan_editions (
  id          uuid primary key default gen_random_uuid(),
  month       date not null unique check (extract(day from month) = 1),
  title       text not null default '' check (char_length(title) <= 80),
  status      public.clan_edition_status not null default 'borrador',
  publish_at  timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (status <> 'programado' or publish_at is not null)
);

create table public.clan_products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 2 and 80),
  description     text not null default '' check (char_length(description) <= 1000),
  photos          text[] not null default '{}' check (cardinality(photos) <= 6),
  tier            public.clan_tier not null,
  min_rank        integer not null check (min_rank between 1 and 5),
  price_gn        integer not null check (price_gn > 0 and price_gn <= 10000000),
  -- null = sin límite de unidades.
  stock           integer check (stock is null or stock >= 0),
  limit_per_user  integer check (limit_per_user is null or limit_per_user > 0),
  is_permanent    boolean not null default false,
  available_from  timestamptz,
  available_until timestamptz,
  status          public.clan_product_status not null default 'borrador',
  kind            public.clan_product_kind not null default 'fisico',
  supplier        text check (supplier is null or char_length(supplier) <= 120),
  lead_days       integer check (lead_days is null or lead_days between 0 and 365),
  needs_address   boolean not null default true,
  edition_id      uuid references public.clan_editions (id) on delete restrict,
  is_demo         boolean not null default false,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (available_until is null or available_from is null or available_until > available_from),
  check (is_permanent or edition_id is not null or is_demo)
);
create index clan_products_status_idx on public.clan_products (status, min_rank);
create trigger clan_products_touch before update on public.clan_products
  for each row execute function public.touch_updated_at();

-- Solo administración: el licenciatario nunca ve el costo real.
create table public.clan_product_costs (
  product_id  uuid primary key references public.clan_products (id) on delete cascade,
  cost_usd    numeric(12, 2) not null check (cost_usd >= 0)
);

create table public.clan_redemptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete restrict,
  product_id       uuid not null references public.clan_products (id) on delete restrict,
  product_name     text not null,
  price_gn         integer not null check (price_gn > 0),
  status           public.clan_redemption_status not null default 'solicitado',
  delivery         jsonb not null default '{}'::jsonb,
  substitute_note  text,
  admin_note       text,
  flags            jsonb not null default '[]'::jsonb,
  idempotency_key  text not null check (char_length(idempotency_key) between 8 and 80),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  delivered_at     timestamptz,
  unique (user_id, idempotency_key),
  check (jsonb_typeof(delivery) = 'object'),
  check (jsonb_typeof(flags) = 'array')
);
create index clan_redemptions_status_idx on public.clan_redemptions (status, created_at);
create index clan_redemptions_user_idx on public.clan_redemptions (user_id, created_at desc);
create trigger clan_redemptions_touch before update on public.clan_redemptions
  for each row execute function public.touch_updated_at();

-- Costo real del canje (copia al pedirlo), solo administración.
create table public.clan_redemption_costs (
  redemption_id  uuid primary key references public.clan_redemptions (id) on delete cascade,
  cost_usd       numeric(12, 2) not null check (cost_usd >= 0)
);

create table public.clan_redemption_events (
  id             bigint generated always as identity primary key,
  redemption_id  uuid not null references public.clan_redemptions (id) on delete restrict,
  from_status    public.clan_redemption_status,
  to_status      public.clan_redemption_status not null,
  note           text,
  actor_id       uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index clan_redemption_events_idx on public.clan_redemption_events (redemption_id, created_at);
create trigger clan_redemption_events_immutable before update or delete on public.clan_redemption_events
  for each row execute function public.forbid_mutation();

create table public.clan_goals (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  product_id  uuid not null references public.clan_products (id) on delete cascade,
  set_at      timestamptz not null default now()
);

-- Términos de GN con versión (BORRADOR hasta la revisión legal).
create table public.gn_terms (
  version       integer primary key check (version > 0),
  clauses       jsonb not null check (jsonb_typeof(clauses) = 'array'),
  is_draft      boolean not null default true,
  published_at  timestamptz not null default now()
);

create table public.gn_terms_acceptances (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  version      integer not null references public.gn_terms (version) on delete restrict,
  accepted_at  timestamptz not null default now(),
  primary key (user_id, version)
);

-- BORRADOR: pendientes de revisión legal (esBorrador = true).
insert into public.gn_terms (version, clauses, is_draft) values (1, $json$[
  "Los GN son un sistema de reconocimiento del club, sin valor en efectivo ni garantía de beneficios económicos.",
  "No se transfieren, no se cambian por efectivo y no se compran.",
  "Se ganan con ventas verificadas y misiones aprobadas; los de ventas quedan disponibles a los 7 días.",
  "Vencen 12 meses después de quedar disponibles, con aviso.",
  "Las anulaciones y devoluciones descuentan los GN asociados; con saldo negativo se bloquean los canjes.",
  "Los premios se desbloquean por rango, están sujetos a disponibilidad y límites, y pueden sustituirse por otro de valor similar; los plazos de entrega son estimados.",
  "El catálogo cambia cada mes.",
  "El uso indebido (ventas ficticias o autoventas) anula los GN y puede excluir del programa.",
  "Los cambios se avisan con 30 días de anticipación y no afectan los GN ya disponibles.",
  "Los premios en especie pueden tener implicaciones fiscales para quien los recibe."
]$json$, true);

-- Productos de demostración: solo los ven los licenciatarios de prueba. Sin fotos ni costos reales.
insert into public.clan_products (name, description, tier, min_rank, price_gn, stock, limit_per_user, is_permanent, status, kind, needs_address, is_demo)
values
  ('[DEMO] Consola PS5', 'Producto de demostración para pruebas.', 'alto', 3, 2800, 2, 1, false, 'activo', 'fisico', true, true),
  ('[DEMO] Viaje', 'Producto de demostración para pruebas.', 'elite', 5, 22000, 1, 1, false, 'activo', 'experiencia', false, true),
  ('[DEMO] Gorra', 'Producto de demostración para pruebas.', 'calle', 1, 44, 50, 3, true, 'activo', 'fisico', true, true);
-- BORRADOR: costos de demostración para probar el control de costo.
insert into public.clan_product_costs (product_id, cost_usd)
select id, case name when '[DEMO] Consola PS5' then 500 when '[DEMO] Viaje' then 3960 else 8 end
from public.clan_products where is_demo;

-- =============================================================================
-- Visibilidad
-- =============================================================================
create or replace function public.clan_edition_live(p_edition uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_edition is null or exists (
    select 1 from public.clan_editions e
    where e.id = p_edition and (e.status = 'publicado' or (e.status = 'programado' and e.publish_at <= now())));
$$;

create or replace function public.clan_product_visible(p public.clan_products, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.gn_v3_enabled(p_user)
     and (not p.is_demo or public.gn_is_tester(p_user))
     and (p.status = 'activo' or (p.status = 'programado' and coalesce(p.available_from, now()) <= now()))
     and (p.available_from is null or p.available_from <= now())
     and (p.available_until is null or p.available_until >= now())
     and public.clan_edition_live(p.edition_id);
$$;

-- ¿Está pausado el catálogo por el tope mensual de costo?
create or replace function public.clan_month_cost_usd(p_month date default (now() at time zone 'America/Caracas')::date)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(c.cost_usd), 0)
  from public.clan_redemptions r join public.clan_redemption_costs c on c.redemption_id = r.id
  where r.status not in ('rechazado', 'cancelado')
    and date_trunc('month', r.created_at at time zone 'America/Caracas') = date_trunc('month', p_month::timestamp);
$$;

create or replace function public.clan_paused()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when jsonb_typeof(public.gn_cfg('tope_mensual_canjes_usd')) = 'number'
              then public.clan_month_cost_usd() >= public.gn_num('tope_mensual_canjes_usd', 0)
              else false end;
$$;

-- Último texto de términos y si el usuario ya lo aceptó.
create or replace function public.gn_terms_status()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('version', t.version, 'clauses', t.clauses, 'is_draft', t.is_draft,
           'accepted_at', (select a.accepted_at from public.gn_terms_acceptances a where a.user_id = auth.uid() and a.version = t.version))
  from public.gn_terms t order by t.version desc limit 1;
$$;

create or replace function public.gn_accept_terms(p_version integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;
  if p_version <> (select max(version) from public.gn_terms) then
    raise exception 'Esa versión de los términos ya no es la vigente' using errcode = '22023';
  end if;
  insert into public.gn_terms_acceptances (user_id, version) values (auth.uid(), p_version) on conflict do nothing;
end;
$$;

-- =============================================================================
-- Canjes
-- =============================================================================
create or replace function public.clan_log(p_redemption uuid, p_from public.clan_redemption_status, p_to public.clan_redemption_status, p_note text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.clan_redemption_events (redemption_id, from_status, to_status, note, actor_id)
  values (p_redemption, p_from, p_to, nullif(trim(coalesce(p_note, '')), ''), auth.uid());
$$;

create or replace function public.clan_redeem(p_product uuid, p_delivery jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  a public.gn_accounts;
  p public.clan_products;
  v_existing public.clan_redemptions;
  v_level integer;
  v_count integer;
  v_last timestamptz;
  v_cost numeric;
  v_cap jsonb;
  v_id uuid;
  v_ledger bigint;
  v_flags jsonb := '[]'::jsonb;
  f jsonb := coalesce(public.gn_cfg('fraude'), '{}'::jsonb);
  v_delivery jsonb;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;
  if coalesce(char_length(p_idempotency_key), 0) not between 8 and 80 then
    raise exception 'Falta la clave del canje' using errcode = '22023';
  end if;
  -- Petición repetida (doble toque o reintento): devuelve el canje original.
  select * into v_existing from public.clan_redemptions where user_id = v_user and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('ok', true, 'redemption_id', v_existing.id, 'repeated', true);
  end if;
  if not public.gn_v3_enabled(v_user) then
    raise exception 'La Tienda Clan aún no está disponible para tu tienda' using errcode = '42501';
  end if;
  if (public.active_license(v_user)).id is null then
    raise exception 'Necesitas una licencia activa para canjear' using errcode = '42501';
  end if;
  if not exists (select 1 from public.gn_terms_acceptances x where x.user_id = v_user
                 and x.version = (select max(version) from public.gn_terms)) then
    raise exception 'Acepta los términos de GN antes de canjear' using errcode = '42501';
  end if;

  perform public.gn_settle(v_user);
  a := public.gn_lock_account(v_user);
  select * into p from public.clan_products where id = p_product for update;
  if not found or not public.clan_product_visible(p, v_user) then
    raise exception 'Ese premio no está disponible' using errcode = 'P0002';
  end if;
  if public.clan_paused() then
    raise exception 'Los canjes están en pausa este mes. Vuelve a intentarlo el próximo mes.' using errcode = '42501';
  end if;

  v_level := (public.rank_state(v_user) ->> 'level')::integer;
  if v_level < p.min_rank then
    raise exception 'Este premio se desbloquea en un rango superior' using errcode = '42501';
  end if;
  if p.stock is not null and p.stock <= 0 then
    raise exception 'Premio agotado' using errcode = '22023';
  end if;
  if p.limit_per_user is not null then
    select count(*) into v_count from public.clan_redemptions
    where user_id = v_user and product_id = p.id and status not in ('rechazado', 'cancelado');
    if v_count >= p.limit_per_user then
      raise exception 'Ya canjeaste este premio el máximo de veces' using errcode = '22023';
    end if;
  end if;
  if a.debt > 0 then
    raise exception 'Tienes % GN por cubrir. Los canjes se reactivan cuando se cubran.', a.debt using errcode = '42501';
  end if;

  select count(*), max(created_at) into v_count, v_last from public.clan_redemptions
  where user_id = v_user and created_at > now() - interval '24 hours';
  if v_count >= public.gn_num('canjes_por_dia', 3) then
    raise exception 'Llegaste al máximo de canjes por día. Inténtalo mañana.' using errcode = '42501';
  end if;
  if v_last is not null and v_last > now() - make_interval(secs => public.gn_num('canje_segundos_entre', 30)) then
    raise exception 'Espera unos segundos antes de otro canje' using errcode = '42501';
  end if;

  if a.available < p.price_gn then
    raise exception 'Te faltan % GN para este premio', p.price_gn - a.available using errcode = '22023';
  end if;

  -- Datos de entrega.
  v_delivery := jsonb_build_object(
    'nombre', left(trim(coalesce(p_delivery ->> 'nombre', '')), 120),
    'telefono', left(trim(coalesce(p_delivery ->> 'telefono', '')), 40),
    'ciudad', left(trim(coalesce(p_delivery ->> 'ciudad', '')), 80),
    'direccion', left(trim(coalesce(p_delivery ->> 'direccion', '')), 300),
    'notas', left(trim(coalesce(p_delivery ->> 'notas', '')), 500));
  if char_length(v_delivery ->> 'nombre') < 2 or char_length(v_delivery ->> 'telefono') < 7 then
    raise exception 'Indica tu nombre y un teléfono de contacto' using errcode = '22023';
  end if;
  if p.needs_address and (char_length(v_delivery ->> 'ciudad') < 2 or char_length(v_delivery ->> 'direccion') < 5) then
    raise exception 'Indica la ciudad y la dirección de entrega' using errcode = '22023';
  end if;

  -- Señales: canje grande con ventas recientes aún en espera (solo marcan).
  if p.price_gn >= coalesce((f ->> 'canje_grande_gn')::integer, 1000)
     and exists (select 1 from public.gn_sale_holds h where h.licensee_id = v_user and h.status in ('en_espera', 'en_revision')
                 and h.created_at > now() - make_interval(hours => coalesce((f ->> 'canje_horas')::integer, 48))) then
    v_flags := v_flags || '"ventas_recientes_en_espera"'::jsonb;
    perform public.gn_flag_pending_sales(v_user, 'antes_de_canje', now() - make_interval(hours => coalesce((f ->> 'canje_horas')::integer, 48)));
  end if;
  if exists (select 1 from public.fraud_flags x where x.user_id = v_user and x.resolved_at is null) then
    v_flags := v_flags || '"alertas_abiertas"'::jsonb;
  end if;

  insert into public.clan_redemptions (user_id, product_id, product_name, price_gn, delivery, flags, idempotency_key)
  values (v_user, p.id, p.name, p.price_gn, v_delivery, v_flags, p_idempotency_key)
  returning id into v_id;
  select cost_usd into v_cost from public.clan_product_costs where product_id = p.id;
  insert into public.clan_redemption_costs (redemption_id, cost_usd) values (v_id, coalesce(v_cost, 0));

  v_ledger := public.gn_post(v_user, 'canje_retenido', 0, -p.price_gn, p.price_gn, 0, 'canje:' || v_id,
    'Canje: ' || p.name, null, null, v_id);
  perform public.gn_consume_lots(v_user, p.price_gn, v_ledger);
  if p.stock is not null then
    update public.clan_products set stock = stock - 1 where id = p.id;
  end if;
  perform public.clan_log(v_id, null, 'solicitado', null);
  delete from public.clan_goals where user_id = v_user and product_id = p.id;

  return jsonb_build_object('ok', true, 'redemption_id', v_id, 'available_before', a.available,
                            'available_after', a.available - p.price_gn);
end;
$$;

-- Devuelve los GN retenidos de un canje a sus lotes originales (misma fecha de vencimiento).
create or replace function public.clan_release_hold(p_redemption uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.clan_redemptions;
  v_ledger bigint;
  m record;
begin
  select * into r from public.clan_redemptions where id = p_redemption;
  perform public.gn_lock_account(r.user_id);
  v_ledger := public.gn_post(r.user_id, 'canje_devuelto', 0, r.price_gn, -r.price_gn, 0, 'canje_devuelto:' || r.id,
    'Devolución de canje: ' || r.product_name || coalesce(' · ' || nullif(trim(p_reason), ''), ''), null, null, r.id);
  if v_ledger is null then
    return;
  end if;
  for m in
    select mv.lot_id, -mv.amount as amount from public.gn_lot_moves mv
    join public.gn_ledger l on l.id = mv.ledger_id
    where l.idempotency_key = 'canje:' || r.id and mv.amount < 0
  loop
    update public.gn_lots set remaining = remaining + m.amount where id = m.lot_id;
    insert into public.gn_lot_moves (lot_id, ledger_id, amount) values (m.lot_id, v_ledger, m.amount);
  end loop;
  update public.clan_products set stock = stock + 1 where id = r.product_id and stock is not null;
  -- Si algún lote ya venció mientras estaba retenido, vence ahora.
  perform public.gn_settle(r.user_id);
end;
$$;

create or replace function public.clan_confirm_hold(p_redemption uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.clan_redemptions;
begin
  select * into r from public.clan_redemptions where id = p_redemption;
  perform public.gn_post(r.user_id, 'canje_confirmado', 0, 0, -r.price_gn, 0, 'canje_confirmado:' || r.id,
    'Canje entregado: ' || r.product_name, null, null, r.id);
end;
$$;

-- El licenciatario cancela su canje mientras está «solicitado».
create or replace function public.clan_cancel_my_redemption(p_redemption uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.clan_redemptions;
begin
  select * into r from public.clan_redemptions where id = p_redemption for update;
  if not found or r.user_id <> auth.uid() then
    raise exception 'Canje no encontrado' using errcode = 'P0002';
  end if;
  if r.status <> 'solicitado' then
    raise exception 'Este canje ya está en proceso y no se puede cancelar' using errcode = '22023';
  end if;
  update public.clan_redemptions set status = 'cancelado' where id = r.id;
  perform public.clan_log(r.id, r.status, 'cancelado', 'Cancelado por el licenciatario');
  perform public.clan_release_hold(r.id, 'cancelado');
end;
$$;

-- El licenciatario confirma que recibió el premio.
create or replace function public.clan_confirm_received(p_redemption uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.clan_redemptions;
begin
  select * into r from public.clan_redemptions where id = p_redemption for update;
  if not found or r.user_id <> auth.uid() then
    raise exception 'Canje no encontrado' using errcode = 'P0002';
  end if;
  if r.status <> 'enviado' then
    raise exception 'Solo puedes confirmar un canje enviado' using errcode = '22023';
  end if;
  update public.clan_redemptions set status = 'entregado', delivered_at = now() where id = r.id;
  perform public.clan_log(r.id, r.status, 'entregado', 'Recibido por el licenciatario');
  perform public.clan_confirm_hold(r.id);
end;
$$;

create or replace function public.clan_set_goal(p_product uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.clan_products;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;
  if p_product is null then
    delete from public.clan_goals where user_id = auth.uid();
    return;
  end if;
  select * into p from public.clan_products where id = p_product;
  if not found or not public.clan_product_visible(p, auth.uid()) then
    raise exception 'Ese premio no está disponible' using errcode = 'P0002';
  end if;
  insert into public.clan_goals (user_id, product_id) values (auth.uid(), p_product)
  on conflict (user_id) do update set product_id = excluded.product_id, set_at = now();
end;
$$;

-- =============================================================================
-- Seguridad
-- =============================================================================
alter table public.clan_editions enable row level security;
alter table public.clan_products enable row level security;
alter table public.clan_product_costs enable row level security;
alter table public.clan_redemptions enable row level security;
alter table public.clan_redemption_costs enable row level security;
alter table public.clan_redemption_events enable row level security;
alter table public.clan_goals enable row level security;
alter table public.gn_terms enable row level security;
alter table public.gn_terms_acceptances enable row level security;

create policy clan_editions_select on public.clan_editions for select to authenticated
  using (public.is_admin() or (public.gn_v3_enabled() and public.clan_edition_live(id)));
create policy clan_products_select on public.clan_products for select to authenticated
  using (public.is_admin() or public.clan_product_visible(clan_products, auth.uid()));
create policy clan_product_costs_admin on public.clan_product_costs for select to authenticated using (public.is_admin());
create policy clan_redemptions_select on public.clan_redemptions for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy clan_redemption_costs_admin on public.clan_redemption_costs for select to authenticated using (public.is_admin());
create policy clan_redemption_events_select on public.clan_redemption_events for select to authenticated
  using (public.is_admin() or exists (select 1 from public.clan_redemptions r where r.id = redemption_id and r.user_id = auth.uid()));
create policy clan_goals_select on public.clan_goals for select to authenticated using (user_id = auth.uid());
create policy gn_terms_select on public.gn_terms for select to authenticated using (true);
create policy gn_terms_acceptances_select on public.gn_terms_acceptances for select to authenticated using (user_id = auth.uid() or public.is_admin());

revoke insert, update, delete, truncate on public.clan_editions, public.clan_products, public.clan_product_costs,
  public.clan_redemptions, public.clan_redemption_costs, public.clan_redemption_events, public.clan_goals,
  public.gn_terms, public.gn_terms_acceptances from anon, authenticated;
revoke all on public.clan_editions, public.clan_products, public.clan_product_costs, public.clan_redemptions,
  public.clan_redemption_costs, public.clan_redemption_events, public.clan_goals, public.gn_terms,
  public.gn_terms_acceptances from anon;

revoke execute on function public.clan_edition_live(uuid) from public, anon;
revoke execute on function public.clan_product_visible(public.clan_products, uuid) from public, anon;
revoke execute on function public.clan_month_cost_usd(date) from public, anon, authenticated;
revoke execute on function public.clan_log(uuid, public.clan_redemption_status, public.clan_redemption_status, text) from public, anon, authenticated;
revoke execute on function public.clan_release_hold(uuid, text) from public, anon, authenticated;
revoke execute on function public.clan_confirm_hold(uuid) from public, anon, authenticated;
revoke execute on function public.clan_paused() from public, anon;
revoke execute on function public.gn_terms_status() from public, anon;
revoke execute on function public.gn_accept_terms(integer) from public, anon;
revoke execute on function public.clan_redeem(uuid, jsonb, text) from public, anon;
revoke execute on function public.clan_cancel_my_redemption(uuid) from public, anon;
revoke execute on function public.clan_confirm_received(uuid) from public, anon;
revoke execute on function public.clan_set_goal(uuid) from public, anon;
grant execute on function public.clan_edition_live(uuid) to authenticated;
grant execute on function public.clan_product_visible(public.clan_products, uuid) to authenticated;
grant execute on function public.clan_paused() to authenticated;
grant execute on function public.gn_terms_status() to authenticated;
grant execute on function public.gn_accept_terms(integer) to authenticated;
grant execute on function public.clan_redeem(uuid, jsonb, text) to authenticated;
grant execute on function public.clan_cancel_my_redemption(uuid) to authenticated;
grant execute on function public.clan_confirm_received(uuid) to authenticated;
grant execute on function public.clan_set_goal(uuid) to authenticated;
