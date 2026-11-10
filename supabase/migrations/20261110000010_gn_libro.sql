-- =============================================================================
-- Gallo Negro Licencias — GN del club (Fase 1): libro, saldo, ganancia por
-- ventas y misiones, espera de 7 días, reversiones y vencimiento.
--
-- Reglas:
--  * Los GN se ganan solo con ventas y misiones y se gastan solo en Tienda Clan.
--  * Todo movimiento pasa por funciones del servidor, en una transacción que
--    bloquea la cuenta del licenciatario; el navegador nunca cambia saldos.
--  * gn_ledger es de solo inserción y cada movimiento lleva una clave de
--    idempotencia única. gn_accounts guarda los saldos para bloquearlos y leerlos
--    rápido; las pruebas comprueban que coinciden con la suma del libro.
--  * El saldo disponible nunca es negativo: lo que una reversión no puede
--    descontar queda como «saldo por cubrir» (debt) y bloquea los canjes.
--  * Solo se agregan tablas, columnas y funciones: no se borra ni migra nada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Configuración editable por el administrador
-- -----------------------------------------------------------------------------
create table public.gn_config (
  key         text primary key check (key ~ '^[a-z0-9_]{2,60}$'),
  value       jsonb not null,
  -- BORRADOR: cifra pendiente de confirmar por Gallo Negro.
  is_draft    boolean not null default true,
  description text not null default '',
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

insert into public.gn_config (key, value, is_draft, description) values
  -- BORRADOR: modo de GN por venta (por_venta | por_prenda | por_dolar). Confirmado por_prenda el 2026-11-10.
  ('gn_modo_venta', '"por_prenda"', false, 'Cómo se calculan los GN de una venta: por_venta, por_prenda o por_dolar'),
  -- BORRADOR
  ('gn_por_unidad', '12', true, 'GN por prenda (por_prenda) o por ticket (por_venta)'),
  -- BORRADOR: 12 GN por cada $35 de PVP.
  ('gn_por_dolar', '0.343', true, 'GN por cada dólar de PVP oficial (solo en modo por_dolar)'),
  -- BORRADOR
  ('gn_venta_minima_usd', '15', true, 'Valor mínimo (PVP) de una prenda o ticket para ganar GN'),
  -- BORRADOR
  ('gn_max_diario', '20', true, 'Máximo de prendas (o tickets) con GN por día y licenciatario'),
  -- BORRADOR
  ('gn_misiones_tope_diario', '20', true, 'Máximo de GN por misiones por día y licenciatario'),
  -- BORRADOR
  ('gn_dias_espera', '7', true, 'Días que una venta queda en espera antes de liberar sus GN'),
  -- BORRADOR
  ('gn_meses_vencimiento', '12', true, 'Meses desde que los GN quedan disponibles hasta que vencen'),
  -- BORRADOR
  ('gn_avisos_vencimiento', '[60, 30]', true, 'Días antes del vencimiento en que se avisa'),
  -- BORRADOR: hasta que Gallo Negro entregue la lista por tipo de prenda.
  ('pvp_defecto_usd', '35', true, 'PVP oficial por defecto de una prenda'),
  -- BORRADOR: lista de PVP por categoría (slug → USD). Vacía = todo vale el PVP por defecto.
  ('pvp_por_categoria', '{}', true, 'PVP oficial por tipo de prenda'),
  -- BORRADOR
  ('gn_valor_interno_usd', '0.18', true, 'Valor interno de 1 GN en USD (solo administración)'),
  -- BORRADOR
  ('costo_objetivo_pct', '6', true, 'Porcentaje objetivo del costo de premios sobre ventas'),
  -- BORRADOR
  ('costo_produccion_usd', '15', true, 'Costo de producción por prenda'),
  -- BORRADOR
  ('precio_base_licenciado_usd', '25', true, 'Precio base de la prenda al licenciado'),
  -- BORRADOR: lo define el administrador; null = sin tope.
  ('tope_mensual_canjes_usd', 'null', true, 'Tope mensual del costo de los canjes; al alcanzarlo se pausa el catálogo'),
  -- BORRADOR
  ('margen_precio_pct', '20', true, 'Diferencia aceptada entre el precio de la etiqueta y el PVP oficial'),
  -- BORRADOR: umbrales de las señales de patrones raros.
  ('fraude', '{"rafaga_tickets": 4, "rafaga_minutos": 10, "monto_repetido": 3, "monto_horas": 24, "comprador_repetido": 3, "comprador_dias": 7, "pico_factor": 3, "pico_minimo": 10, "canje_grande_gn": 1000, "canje_horas": 48}', true, 'Señales que mandan una venta a revisión'),
  -- BORRADOR
  ('canjes_por_dia', '3', true, 'Máximo de canjes por licenciatario en 24 horas'),
  -- BORRADOR
  ('canje_segundos_entre', '30', true, 'Segundos mínimos entre dos canjes del mismo licenciatario'),
  -- BORRADOR: XP y ventas verificadas (PVP oficial, USD) para alcanzar cada rango.
  ('rangos', '[{"nivel": 1, "xp": 0, "ventas": 0}, {"nivel": 2, "xp": 2000, "ventas": 1500}, {"nivel": 3, "xp": 5000, "ventas": 4500}, {"nivel": 4, "xp": 8500, "ventas": 12000}, {"nivel": 5, "xp": 12500, "ventas": 30000}]', true, 'Requisitos de XP y ventas por rango'),
  -- BORRADOR
  ('validacion_sla_horas', '72', true, 'Plazo objetivo para responder una validación de misión'),
  -- BORRADOR
  ('validacion_limite_semanal', '10', true, 'Evidencias por semana y tipo de misión (si el tipo no tiene su propio límite)'),
  -- BORRADOR: beneficios de rango que no son del catálogo.
  ('beneficios_rango', '{"1": ["Marco simple en el avatar"], "2": ["Marco amarillo en el avatar"], "3": ["Marco doble con rojo", "Preventas exclusivas", "Prioridad en despachos"], "4": ["Marco con brasas", "Preventas exclusivas", "Prioridad en despachos"], "5": ["Marco dorado", "Insignia de rango máximo", "Preventas exclusivas", "Prioridad en despachos"]}', true, 'Beneficios de cada rango fuera de la Tienda Clan'),
  ('recompensas_v3_activa', 'false', false, 'Interruptor RECOMPENSAS_V3_ACTIVA: muestra a todos las nuevas Recompensas y Tienda Clan'),
  ('recompensas_v3_testers', '[]', false, 'Licenciatarios de prueba que ven las nuevas pestañas con el interruptor apagado');

create or replace function public.gn_cfg(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select value from public.gn_config where key = p_key;
$$;

create or replace function public.gn_num(p_key text, p_default numeric default 0)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select case when jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric end
                   from public.gn_config where key = p_key), p_default);
$$;

-- ¿Ve este usuario las nuevas Recompensas y Tienda Clan?
create or replace function public.gn_v3_enabled(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((public.gn_cfg('recompensas_v3_activa') #>> '{}')::boolean, false)
      or coalesce(public.gn_cfg('recompensas_v3_testers') ? p_user::text, false)
      or exists (select 1 from public.profiles where id = p_user and role = 'admin');
$$;

create or replace function public.gn_is_tester(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.gn_cfg('recompensas_v3_testers') ? p_user::text, false)
      or exists (select 1 from public.profiles where id = p_user and role = 'admin');
$$;

-- Cifras que el licenciatario puede conocer (nunca costos ni el valor interno del GN).
create or replace function public.gn_public_config()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_object_agg(key, value) from public.gn_config
  where key in ('gn_modo_venta', 'gn_por_unidad', 'gn_por_dolar', 'gn_venta_minima_usd', 'gn_max_diario',
                'gn_misiones_tope_diario', 'gn_dias_espera', 'gn_meses_vencimiento', 'gn_avisos_vencimiento',
                'pvp_defecto_usd', 'rangos', 'beneficios_rango', 'canjes_por_dia', 'validacion_sla_horas');
$$;

-- -----------------------------------------------------------------------------
-- Cuentas y libro
-- -----------------------------------------------------------------------------
create type public.gn_entry_kind as enum (
  'venta_pendiente', 'venta_disponible', 'mision_pendiente', 'mision_disponible',
  'canje_retenido', 'canje_confirmado', 'canje_devuelto', 'reversion', 'vencimiento', 'ajuste_admin'
);

create table public.gn_accounts (
  user_id     uuid primary key references public.profiles (id) on delete restrict,
  available   integer not null default 0 check (available >= 0),
  pending     integer not null default 0 check (pending >= 0),
  held        integer not null default 0 check (held >= 0),
  -- Saldo por cubrir: GN revertidos que no había para descontar. Bloquea los canjes.
  debt        integer not null default 0 check (debt >= 0),
  updated_at  timestamptz not null default now()
);

create table public.gn_ledger (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.profiles (id) on delete restrict,
  kind             public.gn_entry_kind not null,
  d_pending        integer not null default 0,
  d_available      integer not null default 0,
  d_held           integer not null default 0,
  d_debt           integer not null default 0,
  sale_id          uuid references public.sales (id) on delete restrict,
  participation_id uuid references public.mission_participations (id) on delete restrict,
  redemption_id    uuid,
  description      text not null check (char_length(description) between 1 and 300),
  idempotency_key  text not null unique check (char_length(idempotency_key) between 3 and 200),
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  check (d_pending <> 0 or d_available <> 0 or d_held <> 0 or d_debt <> 0)
);
create index gn_ledger_user_idx on public.gn_ledger (user_id, created_at desc, id desc);
create index gn_ledger_sale_idx on public.gn_ledger (sale_id) where sale_id is not null;
create trigger gn_ledger_immutable before update or delete on public.gn_ledger
  for each row execute function public.forbid_mutation();

-- Lotes disponibles con su vencimiento (se consumen del más antiguo al más nuevo).
create table public.gn_lots (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete restrict,
  ledger_id    bigint not null references public.gn_ledger (id) on delete restrict,
  amount       integer not null check (amount > 0),
  remaining    integer not null check (remaining >= 0),
  available_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  check (remaining <= amount),
  check (expires_at > available_at)
);
create index gn_lots_open_idx on public.gn_lots (user_id, expires_at, id) where remaining > 0;

-- Qué lote pagó cada canje, vencimiento o reversión (negativo = sale del lote, positivo = vuelve).
create table public.gn_lot_moves (
  id         bigint generated always as identity primary key,
  lot_id     bigint not null references public.gn_lots (id) on delete restrict,
  ledger_id  bigint not null references public.gn_ledger (id) on delete restrict,
  amount     integer not null check (amount <> 0),
  created_at timestamptz not null default now()
);
create index gn_lot_moves_ledger_idx on public.gn_lot_moves (ledger_id);
create trigger gn_lot_moves_immutable before update or delete on public.gn_lot_moves
  for each row execute function public.forbid_mutation();

-- Espera de 7 días de cada venta.
create type public.gn_hold_status as enum ('en_espera', 'en_revision', 'liberada', 'anulada');

create table public.gn_sale_holds (
  sale_id        uuid primary key references public.sales (id) on delete restrict,
  licensee_id    uuid not null references public.profiles (id) on delete restrict,
  status         public.gn_hold_status not null default 'en_espera',
  hold_until     timestamptz not null,
  -- Día local de la venta (para el tope diario).
  local_day      date not null,
  garments       integer not null check (garments >= 0),
  -- Prendas (o tickets en por_venta) que contaron para GN, ya con el tope diario aplicado.
  units_with_gn  integer not null default 0 check (units_with_gn >= 0),
  pvp_total      numeric(12, 2) not null check (pvp_total >= 0),
  gn_amount      integer not null check (gn_amount >= 0),
  mode           text not null,
  flags          jsonb not null default '[]'::jsonb,
  reviewed       boolean not null default false,
  reviewed_by    uuid references auth.users (id) on delete set null,
  reviewed_at    timestamptz,
  review_note    text,
  released_at    timestamptz,
  voided_at      timestamptz,
  voided_after_release boolean not null default false,
  created_at     timestamptz not null default now(),
  check (jsonb_typeof(flags) = 'array')
);
create index gn_sale_holds_status_idx on public.gn_sale_holds (status, hold_until);
create index gn_sale_holds_licensee_idx on public.gn_sale_holds (licensee_id, local_day);

-- GN de cada misión completada.
create type public.gn_mission_credit_status as enum ('pendiente', 'disponible', 'revertido', 'tope');

create table public.gn_mission_credits (
  participation_id uuid primary key references public.mission_participations (id) on delete restrict,
  user_id          uuid not null references public.profiles (id) on delete restrict,
  mission_id       uuid not null references public.missions (id) on delete restrict,
  local_day        date not null,
  amount           integer not null check (amount >= 0),
  -- GN que la misión ofrecía (si el tope diario recortó, amount < offered).
  offered          integer not null check (offered >= 0),
  status           public.gn_mission_credit_status not null,
  -- Venta de la que depende (misiones automáticas de ventas): sigue su espera.
  sale_id          uuid references public.sales (id) on delete restrict,
  created_at       timestamptz not null default now(),
  released_at      timestamptz
);
create index gn_mission_credits_user_idx on public.gn_mission_credits (user_id, local_day);
create index gn_mission_credits_sale_idx on public.gn_mission_credits (sale_id) where sale_id is not null;

-- Avisos dentro de la app.
create table public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (char_length(kind) between 2 and 40),
  title       text not null check (char_length(title) between 1 and 140),
  body        text not null default '' check (char_length(body) <= 600),
  link        text check (link is null or link ~ '^/[A-Za-z0-9/_?=&#.-]*$'),
  dedupe_key  text unique,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Misiones: GN editable por misión (los XP no cambian)
-- -----------------------------------------------------------------------------
alter table public.missions add column gn_reward integer not null default 0 check (gn_reward between 0 and 10000);
alter table public.mission_participations add column gn_reward integer not null default 0 check (gn_reward >= 0);

-- Solo estas dos tienen GN; las demás quedan en 0 hasta que el administrador las defina.
update public.missions set gn_reward = 12 where code = 'D01';
update public.missions set gn_reward = 4 where code = 'D02';
-- Las participaciones abiertas toman el GN actual de su misión.
update public.mission_participations p set gn_reward = m.gn_reward
from public.missions m
where m.id = p.mission_id and p.status not in ('completed', 'expired') and m.gn_reward > 0;

-- Igual que antes, copiando también los GN al abrir el período.
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
    if (v_period.period_end + v_m.review_grace_days) < (now() at time zone v_m.timezone)::date then
      continue;
    end if;
    v_target := coalesce((v_m.plan_targets ->> v_license.plan_id::text)::numeric, v_m.target_value);
    insert into public.mission_participations (mission_id, user_id, period_start, period_end, target_value, xp_reward, gn_reward)
    values (v_m.id, p_user, v_period.period_start, v_period.period_end, v_target, v_m.xp_reward, v_m.gn_reward)
    on conflict (mission_id, user_id, period_start) do nothing;
    get diagnostics v_rows = row_count;
    v_created := v_created + v_rows;
  end loop;
  return v_created;
end;
$$;

-- =============================================================================
-- Núcleo del libro
-- =============================================================================

-- Bloquea (y crea si falta) la cuenta GN de un licenciatario.
create or replace function public.gn_lock_account(p_user uuid)
returns public.gn_accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a public.gn_accounts;
begin
  insert into public.gn_accounts (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into a from public.gn_accounts where user_id = p_user for update;
  return a;
end;
$$;

-- Escribe un movimiento y actualiza los saldos. Devuelve null si la clave ya existía.
create or replace function public.gn_post(
  p_user uuid, p_kind public.gn_entry_kind, p_pending integer, p_available integer, p_held integer, p_debt integer,
  p_key text, p_description text,
  p_sale uuid default null, p_participation uuid default null, p_redemption uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if coalesce(p_pending, 0) = 0 and coalesce(p_available, 0) = 0 and coalesce(p_held, 0) = 0 and coalesce(p_debt, 0) = 0 then
    return null;
  end if;
  perform public.gn_lock_account(p_user);
  insert into public.gn_ledger (user_id, kind, d_pending, d_available, d_held, d_debt, sale_id, participation_id,
                                redemption_id, description, idempotency_key, created_by)
  values (p_user, p_kind, coalesce(p_pending, 0), coalesce(p_available, 0), coalesce(p_held, 0), coalesce(p_debt, 0),
          p_sale, p_participation, p_redemption, left(p_description, 300), p_key, auth.uid())
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  if v_id is null then
    return null;
  end if;
  update public.gn_accounts
  set pending = pending + coalesce(p_pending, 0),
      available = available + coalesce(p_available, 0),
      held = held + coalesce(p_held, 0),
      debt = debt + coalesce(p_debt, 0),
      updated_at = now()
  where user_id = p_user;
  return v_id;
end;
$$;

-- Consume GN de los lotes del más antiguo al más nuevo y deja la traza.
create or replace function public.gn_consume_lots(p_user uuid, p_amount integer, p_ledger bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_left integer := p_amount;
  v_lot record;
  v_take integer;
begin
  if p_amount <= 0 then
    return;
  end if;
  for v_lot in
    select id, remaining from public.gn_lots
    where user_id = p_user and remaining > 0
    order by expires_at, id
    for update
  loop
    exit when v_left <= 0;
    v_take := least(v_lot.remaining, v_left);
    update public.gn_lots set remaining = remaining - v_take where id = v_lot.id;
    insert into public.gn_lot_moves (lot_id, ledger_id, amount) values (v_lot.id, p_ledger, -v_take);
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    raise exception 'Los lotes de GN no cuadran con el saldo disponible' using errcode = 'XX000';
  end if;
end;
$$;

-- Acredita GN disponibles: primero cubre el saldo por cubrir; el resto crea un lote con vencimiento.
-- p_from_pending = true: los GN salen de pendientes (venta o misión que se libera).
create or replace function public.gn_credit_available(
  p_user uuid, p_amount integer, p_from_pending boolean, p_kind public.gn_entry_kind, p_key text, p_description text,
  p_sale uuid default null, p_participation uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a public.gn_accounts;
  v_pay integer;
  v_id bigint;
begin
  if p_amount <= 0 then
    return null;
  end if;
  a := public.gn_lock_account(p_user);
  v_pay := least(a.debt, p_amount);
  v_id := public.gn_post(p_user, p_kind,
    case when p_from_pending then -p_amount else 0 end, p_amount - v_pay, 0, -v_pay,
    p_key, p_description, p_sale, p_participation);
  if v_id is not null and p_amount - v_pay > 0 then
    insert into public.gn_lots (user_id, ledger_id, amount, remaining, expires_at)
    values (p_user, v_id, p_amount - v_pay, p_amount - v_pay,
            now() + make_interval(months => public.gn_num('gn_meses_vencimiento', 12)::integer));
  end if;
  return v_id;
end;
$$;

-- Descuenta GN disponibles (reversión o ajuste negativo). Lo que no alcanza queda como saldo por cubrir.
create or replace function public.gn_debit_available(
  p_user uuid, p_amount integer, p_kind public.gn_entry_kind, p_key text, p_description text,
  p_sale uuid default null, p_participation uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a public.gn_accounts;
  v_take integer;
  v_id bigint;
begin
  if p_amount <= 0 then
    return null;
  end if;
  a := public.gn_lock_account(p_user);
  v_take := least(a.available, p_amount);
  v_id := public.gn_post(p_user, p_kind, 0, -v_take, 0, p_amount - v_take, p_key, p_description, p_sale, p_participation);
  if v_id is not null then
    perform public.gn_consume_lots(p_user, v_take, v_id);
  end if;
  return v_id;
end;
$$;

-- Avisos sin repetir (dedupe_key).
create or replace function public.gn_notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text, p_dedupe text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  values (p_user, p_kind, p_title, coalesce(p_body, ''), p_link, p_dedupe)
  on conflict (dedupe_key) do nothing;
$$;

-- =============================================================================
-- Ventas: espera de 7 días, señales y anulación
-- =============================================================================

-- PVP oficial de una prenda: lista por categoría o, si no está, el PVP por defecto.
create or replace function public.gn_pvp(p_category uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (public.gn_cfg('pvp_por_categoria') ->> c.slug)::numeric from public.product_categories c where c.id = p_category),
    public.gn_num('pvp_defecto_usd', 35));
$$;

-- Señales de patrones raros de una venta (lista vacía = ninguna).
create or replace function public.gn_sale_signals(p_sale uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  s public.sales;
  f jsonb := coalesce(public.gn_cfg('fraude'), '{}'::jsonb);
  v_out text[] := '{}';
  v_total numeric;
  v_n integer;
  v_units_today integer;
  v_avg numeric;
  v_tz text;
  v_margin numeric := public.gn_num('margen_precio_pct', 20) / 100;
begin
  select * into s from public.sales where id = p_sale;
  select coalesce(timezone, 'America/Caracas') into v_tz from public.profiles where id = s.licensee_id;
  select coalesce(sum(unit_price * quantity), 0) into v_total from public.sale_items where sale_id = p_sale;

  select count(*) into v_n from public.sales x
  where x.licensee_id = s.licensee_id and x.status = 'verified'
    and x.created_at > s.created_at - make_interval(mins => coalesce((f ->> 'rafaga_minutos')::integer, 10))
    and x.created_at <= s.created_at;
  if v_n >= coalesce((f ->> 'rafaga_tickets')::integer, 4) then
    v_out := array_append(v_out, 'rafaga');
  end if;

  select count(*) into v_n from public.sales x
  where x.licensee_id = s.licensee_id and x.status = 'verified'
    and x.created_at > s.created_at - make_interval(hours => coalesce((f ->> 'monto_horas')::integer, 24))
    and x.created_at <= s.created_at
    and (select coalesce(sum(i.unit_price * i.quantity), 0) from public.sale_items i where i.sale_id = x.id) = v_total;
  if v_n >= coalesce((f ->> 'monto_repetido')::integer, 3) then
    v_out := array_append(v_out, 'monto_repetido');
  end if;

  if s.customer_key is not null then
    select count(*) into v_n from public.sales x
    where x.licensee_id = s.licensee_id and x.status = 'verified' and x.customer_key = s.customer_key
      and x.created_at > s.created_at - make_interval(days => coalesce((f ->> 'comprador_dias')::integer, 7))
      and x.created_at <= s.created_at;
    if v_n >= coalesce((f ->> 'comprador_repetido')::integer, 3) then
      v_out := array_append(v_out, 'mismo_comprador');
    end if;
  end if;

  select coalesce(sum(i.quantity), 0) into v_units_today
  from public.sales x join public.sale_items i on i.sale_id = x.id
  where x.licensee_id = s.licensee_id and x.status = 'verified'
    and (x.sold_at at time zone v_tz)::date = (s.sold_at at time zone v_tz)::date;
  select coalesce(sum(i.quantity), 0) / 30.0 into v_avg
  from public.sales x join public.sale_items i on i.sale_id = x.id
  where x.licensee_id = s.licensee_id and x.status = 'verified'
    and x.sold_at >= s.sold_at - interval '30 days'
    and (x.sold_at at time zone v_tz)::date < (s.sold_at at time zone v_tz)::date;
  if v_units_today >= coalesce((f ->> 'pico_minimo')::integer, 10)
     and v_units_today > coalesce((f ->> 'pico_factor')::numeric, 3) * v_avg then
    v_out := array_append(v_out, 'pico');
  end if;

  if exists (
    select 1 from public.sale_items i
    where i.sale_id = p_sale and public.gn_pvp(i.category_id) > 0
      and abs(i.unit_price - public.gn_pvp(i.category_id)) > v_margin * public.gn_pvp(i.category_id)
  ) then
    v_out := array_append(v_out, 'precio');
  end if;
  return v_out;
end;
$$;

-- GN que da una venta según el modo configurado (función pura, la usan la espera y las pruebas).
-- p_units = prendas que alcanzan el valor mínimo; p_pvp_total = PVP de esas prendas;
-- p_ticket_pvp = PVP del ticket completo; p_used = prendas/tickets con GN ya usados hoy.
create or replace function public.gn_sale_amount(
  p_mode text, p_per_unit integer, p_per_dollar numeric, p_min numeric, p_cap integer,
  p_units integer, p_pvp_total numeric, p_ticket_pvp numeric, p_used integer,
  out units_with_gn integer, out gn integer
)
language plpgsql
immutable
as $$
declare
  v_room integer := greatest(coalesce(p_cap, 0) - coalesce(p_used, 0), 0);
begin
  if p_mode = 'por_prenda' then
    units_with_gn := least(p_units, v_room);
    gn := units_with_gn * p_per_unit;
  elsif p_mode = 'por_venta' then
    units_with_gn := case when p_ticket_pvp >= p_min and v_room > 0 then 1 else 0 end;
    gn := units_with_gn * p_per_unit;
  else -- por_dolar
    units_with_gn := case when p_ticket_pvp >= p_min and v_room > 0 then 1 else 0 end;
    gn := case when units_with_gn = 1 then floor(p_pvp_total * p_per_dollar)::integer else 0 end;
  end if;
end;
$$;

-- Crea la espera de una venta recién verificada.
create or replace function public.gn_open_sale_hold(p_sale uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s public.sales;
  v_tz text;
  v_day date;
  v_mode text := coalesce(public.gn_cfg('gn_modo_venta') #>> '{}', 'por_prenda');
  v_min numeric := public.gn_num('gn_venta_minima_usd', 15);
  v_garments integer;
  v_units integer;
  v_pvp_units numeric;
  v_pvp_ticket numeric;
  v_used integer;
  v_amount record;
  v_signals text[];
  v_status public.gn_hold_status;
begin
  select * into s from public.sales where id = p_sale;
  if exists (select 1 from public.gn_sale_holds where sale_id = p_sale) then
    return;
  end if;
  perform public.gn_lock_account(s.licensee_id);
  select coalesce(timezone, 'America/Caracas') into v_tz from public.profiles where id = s.licensee_id;
  v_day := (s.sold_at at time zone v_tz)::date;

  -- PVP oficial por prenda (nunca el precio que se escribió).
  select coalesce(sum(i.quantity), 0),
         coalesce(sum(i.quantity) filter (where public.gn_pvp(i.category_id) >= v_min), 0),
         coalesce(sum(i.quantity * public.gn_pvp(i.category_id)) filter (where public.gn_pvp(i.category_id) >= v_min), 0),
         coalesce(sum(i.quantity * public.gn_pvp(i.category_id)), 0)
    into v_garments, v_units, v_pvp_units, v_pvp_ticket
  from public.sale_items i where i.sale_id = p_sale;

  select coalesce(sum(units_with_gn), 0) into v_used from public.gn_sale_holds
  where licensee_id = s.licensee_id and local_day = v_day and status <> 'anulada';

  select * into v_amount from public.gn_sale_amount(v_mode, public.gn_num('gn_por_unidad', 12)::integer,
    public.gn_num('gn_por_dolar', 0.343), v_min, public.gn_num('gn_max_diario', 20)::integer,
    v_units, v_pvp_units, v_pvp_ticket, v_used);

  v_signals := public.gn_sale_signals(p_sale);
  v_status := case when cardinality(v_signals) > 0 then 'en_revision' else 'en_espera' end;

  insert into public.gn_sale_holds (sale_id, licensee_id, status, hold_until, local_day, garments, units_with_gn,
                                    pvp_total, gn_amount, mode, flags)
  values (p_sale, s.licensee_id, v_status,
          s.created_at + make_interval(days => public.gn_num('gn_dias_espera', 7)::integer),
          v_day, v_garments, v_amount.units_with_gn, v_pvp_ticket, v_amount.gn, v_mode, to_jsonb(v_signals));

  perform public.gn_post(s.licensee_id, 'venta_pendiente', v_amount.gn, 0, 0, 0, 'venta:' || p_sale,
    format('Venta %s · %s prenda(s)', s.reference, v_garments), p_sale);

  if v_status = 'en_revision' then
    insert into public.fraud_flags (user_id, kind, entity_type, entity_id, details)
    values (s.licensee_id, 'gn_sale_review', 'sale', p_sale::text,
            jsonb_build_object('signals', to_jsonb(v_signals), 'reference', s.reference));
  end if;
end;
$$;

-- Vuelve a revisar las ventas pendientes de un licenciatario (p. ej. antes de un canje grande).
create or replace function public.gn_flag_pending_sales(p_user uuid, p_signal text, p_since timestamptz)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  update public.gn_sale_holds h
  set status = 'en_revision', flags = flags || to_jsonb(p_signal)
  where h.licensee_id = p_user and h.status = 'en_espera' and not h.reviewed and h.created_at >= p_since;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Busca otra venta válida del mismo período para una misión de ventas (o null).
create or replace function public.gn_mission_sale(p_participation uuid, p_exclude uuid default null)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id
  from public.mission_participations p
  join public.missions m on m.id = p.mission_id
  cross join lateral public.period_bounds(p.period_start, p.period_end, m.timezone) b
  join public.sales s on s.licensee_id = p.user_id and s.status = 'verified'
                     and s.sold_at >= b.starts_at and s.sold_at < b.ends_at
  join public.gn_sale_holds h on h.sale_id = s.id and h.status <> 'anulada'
  where p.id = p_participation and (p_exclude is null or s.id <> p_exclude)
  order by s.verified_at desc nulls last, s.created_at desc
  limit 1;
$$;

-- Anula los GN de una venta (anulación o devolución). Dentro de la espera salen de pendientes;
-- después, del disponible (y lo que falte queda como saldo por cubrir).
create or replace function public.gn_void_sale(p_sale uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h public.gn_sale_holds;
  c public.gn_mission_credits;
  v_other uuid;
  v_other_status public.gn_hold_status;
begin
  select * into h from public.gn_sale_holds where sale_id = p_sale for update;
  if not found or h.status = 'anulada' then
    return;
  end if;
  perform public.gn_lock_account(h.licensee_id);
  if h.status = 'liberada' then
    perform public.gn_debit_available(h.licensee_id, h.gn_amount, 'reversion', 'reversion:venta:' || p_sale,
      'Reversión por anulación de venta: ' || coalesce(p_reason, ''), p_sale);
  else
    perform public.gn_post(h.licensee_id, 'reversion', -h.gn_amount, 0, 0, 0, 'reversion:venta:' || p_sale,
      'Venta anulada durante la espera: ' || coalesce(p_reason, ''), p_sale);
  end if;
  update public.gn_sale_holds
  set status = 'anulada', voided_at = now(), voided_after_release = (h.status = 'liberada')
  where sale_id = p_sale;

  -- Bonos de misión ligados a esta venta: pasan a otra venta válida del período o se revierten.
  for c in select * from public.gn_mission_credits where sale_id = p_sale and status in ('pendiente', 'disponible') for update loop
    v_other := public.gn_mission_sale(c.participation_id, p_sale);
    if v_other is not null then
      select status into v_other_status from public.gn_sale_holds where sale_id = v_other;
      update public.gn_mission_credits set sale_id = v_other where participation_id = c.participation_id;
      if c.status = 'pendiente' and v_other_status = 'liberada' then
        perform public.gn_credit_available(c.user_id, c.amount, true, 'mision_disponible',
          'mision_disponible:' || c.participation_id, 'GN de misión liberados', null, c.participation_id);
        update public.gn_mission_credits set status = 'disponible', released_at = now() where participation_id = c.participation_id;
      end if;
    else
      if c.status = 'pendiente' then
        perform public.gn_post(c.user_id, 'reversion', -c.amount, 0, 0, 0, 'reversion:mision:' || c.participation_id,
          'Bono de misión revertido: se anuló su venta', null, c.participation_id);
      else
        perform public.gn_debit_available(c.user_id, c.amount, 'reversion', 'reversion:mision:' || c.participation_id,
          'Bono de misión revertido: se anuló su venta', null, c.participation_id);
      end if;
      update public.gn_mission_credits set status = 'revertido' where participation_id = c.participation_id;
    end if;
  end loop;
end;
$$;

-- Trigger sobre ventas: verificada → espera; verificada → anulada o rechazada → reversión.
-- (Se llama sales_gn_hold para ejecutarse antes que sales_status_missions, que concede las misiones.)
create or replace function public.gn_on_sale_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if new.status = 'verified' then
    perform public.gn_open_sale_hold(new.id);
  elsif old.status = 'verified' then
    perform public.gn_void_sale(new.id, coalesce(new.cancel_reason, new.rejection_reason, new.status::text));
  end if;
  return new;
end;
$$;
create trigger sales_gn_hold after update of status on public.sales
  for each row execute function public.gn_on_sale_status();

-- =============================================================================
-- Misiones: GN al concederse el premio de XP (mismo flujo de acreditación)
-- =============================================================================
create or replace function public.gn_credit_mission(p_participation uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.mission_participations;
  m public.missions;
  v_tz text;
  v_day date;
  v_used integer;
  v_amount integer;
  v_sale uuid;
  v_hold_status public.gn_hold_status;
begin
  select * into p from public.mission_participations where id = p_participation;
  if not found or p.gn_reward <= 0 or exists (select 1 from public.gn_mission_credits where participation_id = p.id) then
    return;
  end if;
  select * into m from public.missions where id = p.mission_id;
  perform public.gn_lock_account(p.user_id);
  select coalesce(timezone, 'America/Caracas') into v_tz from public.profiles where id = p.user_id;
  v_day := (now() at time zone v_tz)::date;

  select coalesce(sum(amount), 0) into v_used from public.gn_mission_credits
  where user_id = p.user_id and local_day = v_day and status <> 'revertido';
  v_amount := least(p.gn_reward, greatest(public.gn_num('gn_misiones_tope_diario', 20)::integer - v_used, 0));

  if m.validation_method = 'auto' and public.metric_rank(m.metric) = 0 then
    v_sale := public.gn_mission_sale(p.id);
    select status into v_hold_status from public.gn_sale_holds where sale_id = v_sale;
  end if;

  if v_amount <= 0 then
    insert into public.gn_mission_credits (participation_id, user_id, mission_id, local_day, amount, offered, status, sale_id)
    values (p.id, p.user_id, p.mission_id, v_day, 0, p.gn_reward, 'tope', v_sale);
    return;
  end if;

  if v_sale is not null and v_hold_status in ('en_espera', 'en_revision') then
    -- Sigue el plazo de su venta.
    insert into public.gn_mission_credits (participation_id, user_id, mission_id, local_day, amount, offered, status, sale_id)
    values (p.id, p.user_id, p.mission_id, v_day, v_amount, p.gn_reward, 'pendiente', v_sale);
    perform public.gn_post(p.user_id, 'mision_pendiente', v_amount, 0, 0, 0, 'mision:' || p.id,
      format('%s · %s', m.code, m.title), v_sale, p.id);
  else
    insert into public.gn_mission_credits (participation_id, user_id, mission_id, local_day, amount, offered, status, sale_id, released_at)
    values (p.id, p.user_id, p.mission_id, v_day, v_amount, p.gn_reward, 'disponible', v_sale, now());
    perform public.gn_credit_available(p.user_id, v_amount, false, 'mision_disponible', 'mision:' || p.id,
      format('%s · %s', m.code, m.title), v_sale, p.id);
  end if;
end;
$$;

create or replace function public.gn_on_xp_reward()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.transaction_type = 'mission_reward' and new.participation_id is not null then
    perform public.gn_credit_mission(new.participation_id);
  end if;
  return new;
end;
$$;
create trigger xp_ledger_gn_credit after insert on public.xp_ledger
  for each row execute function public.gn_on_xp_reward();

-- =============================================================================
-- Liquidación: libera esperas cumplidas y vence lotes. Idempotente.
-- Se llama al abrir Recompensas o Tienda Clan, antes de cada canje y a diario.
-- =============================================================================
create or replace function public.gn_settle(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h record;
  c record;
  l record;
  v_released integer := 0;
  v_expired integer := 0;
  v_id bigint;
  v_days integer;
  v_warn integer;
begin
  perform public.gn_lock_account(p_user);

  -- 1. Ventas sin alertas cuya espera terminó.
  for h in select * from public.gn_sale_holds
           where licensee_id = p_user and status = 'en_espera' and hold_until <= now()
           order by hold_until for update
  loop
    perform public.gn_credit_available(p_user, h.gn_amount, true, 'venta_disponible', 'venta_disponible:' || h.sale_id,
      'GN liberados tras la espera de la venta', h.sale_id);
    update public.gn_sale_holds set status = 'liberada', released_at = now() where sale_id = h.sale_id;
    v_released := v_released + h.gn_amount;
  end loop;

  -- 2. Bonos de misión cuya venta ya se liberó.
  for c in select mc.* from public.gn_mission_credits mc
           join public.gn_sale_holds sh on sh.sale_id = mc.sale_id
           where mc.user_id = p_user and mc.status = 'pendiente' and sh.status = 'liberada'
           for update of mc
  loop
    perform public.gn_credit_available(p_user, c.amount, true, 'mision_disponible', 'mision_disponible:' || c.participation_id,
      'GN de misión liberados', c.sale_id, c.participation_id);
    update public.gn_mission_credits set status = 'disponible', released_at = now() where participation_id = c.participation_id;
    v_released := v_released + c.amount;
  end loop;

  -- 3. Lotes vencidos (lo retenido en un canje en curso no está en ningún lote y no vence).
  for l in select * from public.gn_lots where user_id = p_user and remaining > 0 and expires_at <= now() order by expires_at, id for update loop
    v_id := public.gn_post(p_user, 'vencimiento', 0, -l.remaining, 0, 0, 'vence:' || l.id || ':' || l.remaining || ':' || extract(epoch from now())::bigint,
      format('Vencieron %s GN disponibles desde el %s', l.remaining, to_char(l.available_at, 'DD/MM/YYYY')));
    if v_id is not null then
      insert into public.gn_lot_moves (lot_id, ledger_id, amount) values (l.id, v_id, -l.remaining);
      update public.gn_lots set remaining = 0 where id = l.id;
      v_expired := v_expired + l.remaining;
    end if;
  end loop;

  -- 4. Avisos.
  if v_released > 0 then
    perform public.gn_notify(p_user, 'gn_liberados', format('Se liberaron %s GN', to_char(v_released, 'FM999G999G999')),
      'Ya puedes usarlos en Tienda Clan.', '/panel/tienda-clan',
      'gn_liberados:' || p_user || ':' || (select max(id) from public.gn_ledger where user_id = p_user));
  end if;
  if v_expired > 0 then
    perform public.gn_notify(p_user, 'gn_vencidos', format('Vencieron %s GN', to_char(v_expired, 'FM999G999G999')),
      'Los GN vencen 12 meses después de quedar disponibles.', '/panel/tienda-clan?seccion=movimientos',
      'gn_vencidos:' || p_user || ':' || (select max(id) from public.gn_ledger where user_id = p_user));
  end if;
  for v_warn in select (jsonb_array_elements_text(coalesce(public.gn_cfg('gn_avisos_vencimiento'), '[60,30]')))::integer loop
    for l in select id, remaining, expires_at from public.gn_lots
             where user_id = p_user and remaining > 0 and expires_at > now() and expires_at <= now() + make_interval(days => v_warn)
    loop
      v_days := greatest(ceil(extract(epoch from (l.expires_at - now())) / 86400)::integer, 1);
      perform public.gn_notify(p_user, 'gn_por_vencer', format('%s GN vencen en %s días', to_char(l.remaining, 'FM999G999G999'), v_days),
        'Úsalos en Tienda Clan antes del ' || to_char(l.expires_at at time zone 'America/Caracas', 'DD/MM/YYYY') || '.',
        '/panel/tienda-clan', 'gn_por_vencer:' || l.id || ':' || v_warn);
    end loop;
  end loop;

  return jsonb_build_object('released', v_released, 'expired', v_expired);
end;
$$;

-- =============================================================================
-- API del licenciatario
-- =============================================================================

-- Saldo actual (liquida antes de responder).
create or replace function public.my_gn_summary()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  a public.gn_accounts;
  v_expiring integer;
  v_next record;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;
  perform public.gn_settle(v_user);
  select * into a from public.gn_accounts where user_id = v_user;
  select coalesce(sum(remaining), 0) into v_expiring from public.gn_lots
  where user_id = v_user and remaining > 0 and expires_at <= now() + interval '30 days';
  select min(hold_until) as at into v_next from public.gn_sale_holds where licensee_id = v_user and status = 'en_espera';
  return jsonb_build_object(
    'available', coalesce(a.available, 0), 'pending', coalesce(a.pending, 0), 'held', coalesce(a.held, 0),
    'debt', coalesce(a.debt, 0), 'expiring_30', v_expiring, 'next_release_at', v_next.at,
    'in_review', (select count(*) from public.gn_sale_holds where licensee_id = v_user and status = 'en_revision'));
end;
$$;

create or replace function public.mark_my_notifications_read(p_ids bigint[] default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- =============================================================================
-- API del administrador
-- =============================================================================

-- Aprobar (se libera al cumplir la espera) o anular una venta en revisión.
create or replace function public.gn_review_sale(p_sale uuid, p_approve boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h public.gn_sale_holds;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede revisar ventas' using errcode = '42501';
  end if;
  select * into h from public.gn_sale_holds where sale_id = p_sale for update;
  if not found then
    raise exception 'Venta no encontrada' using errcode = 'P0002';
  end if;
  if h.licensee_id = auth.uid() then
    raise exception 'No puedes revisar tus propias ventas' using errcode = '42501';
  end if;
  if h.status not in ('en_espera', 'en_revision') then
    raise exception 'La venta ya no está en espera' using errcode = '22023';
  end if;
  if not p_approve and coalesce(trim(p_note), '') = '' then
    raise exception 'Indica el motivo de la anulación' using errcode = '22023';
  end if;
  if p_approve then
    update public.gn_sale_holds
    set status = 'en_espera', reviewed = true, reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(p_note), '')
    where sale_id = p_sale;
    perform public.write_audit('gn.sale_approved', 'sale', p_sale::text, jsonb_build_object('licensee_id', h.licensee_id, 'note', p_note));
    perform public.gn_settle(h.licensee_id);
  else
    update public.gn_sale_holds set reviewed = true, reviewed_by = auth.uid(), reviewed_at = now(), review_note = trim(p_note)
    where sale_id = p_sale;
    -- Anula la venta con el flujo existente: libera las prendas y dispara la reversión de GN.
    perform public.cancel_sale(p_sale, trim(p_note));
    perform public.write_audit('gn.sale_voided', 'sale', p_sale::text, jsonb_build_object('licensee_id', h.licensee_id, 'note', p_note));
  end if;
end;
$$;

-- Devolución o anulación de una venta ya liberada (solo administrador, motivo obligatorio).
create or replace function public.gn_return_sale(p_sale uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede registrar devoluciones' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Indica el motivo de la devolución' using errcode = '22023';
  end if;
  perform public.cancel_sale(p_sale, 'Devolución: ' || trim(p_reason));
  perform public.write_audit('gn.sale_returned', 'sale', p_sale::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- Ajuste manual de GN con motivo obligatorio.
create or replace function public.gn_admin_adjust(p_user uuid, p_amount integer, p_reason text, p_idempotency_key text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
  v_key text := 'ajuste:' || trim(coalesce(p_idempotency_key, ''));
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede ajustar GN' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'No puedes ajustar tus propios GN' using errcode = '42501';
  end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 1000000 then
    raise exception 'Cantidad de GN no válida' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Describe el motivo del ajuste' using errcode = '22023';
  end if;
  if v_key = 'ajuste:' then
    raise exception 'Falta la clave de idempotencia' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Usuario no encontrado' using errcode = 'P0002';
  end if;
  if p_amount > 0 then
    v_id := public.gn_credit_available(p_user, p_amount, false, 'ajuste_admin', v_key, 'Ajuste: ' || trim(p_reason));
  else
    v_id := public.gn_debit_available(p_user, -p_amount, 'ajuste_admin', v_key, 'Ajuste: ' || trim(p_reason));
  end if;
  if v_id is null then
    select id into v_id from public.gn_ledger where idempotency_key = v_key;
    return v_id;
  end if;
  perform public.write_audit('gn.adjusted', 'gn_ledger', v_id::text,
    jsonb_build_object('user_id', p_user, 'amount', p_amount, 'reason', p_reason));
  return v_id;
end;
$$;

-- Cambiar una cifra de la configuración (auditado).
create or replace function public.gn_set_config(p_key text, p_value jsonb, p_is_draft boolean default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.gn_config;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede cambiar la configuración' using errcode = '42501';
  end if;
  select * into v_old from public.gn_config where key = p_key for update;
  if not found then
    raise exception 'Configuración desconocida: %', p_key using errcode = 'P0002';
  end if;
  if p_key = 'gn_modo_venta' and p_value #>> '{}' not in ('por_venta', 'por_prenda', 'por_dolar') then
    raise exception 'Modo no válido' using errcode = '22023';
  end if;
  if jsonb_typeof(v_old.value) in ('number', 'null') and jsonb_typeof(p_value) not in ('number', 'null') then
    raise exception 'El valor de % debe ser un número', p_key using errcode = '22023';
  end if;
  if jsonb_typeof(p_value) = 'number' and (p_value #>> '{}')::numeric < 0 then
    raise exception 'El valor no puede ser negativo' using errcode = '22023';
  end if;
  update public.gn_config
  set value = p_value, is_draft = coalesce(p_is_draft, is_draft), updated_by = auth.uid(), updated_at = now()
  where key = p_key;
  perform public.write_audit('gn.config_changed', 'gn_config', p_key,
    jsonb_build_object('before', v_old.value, 'after', p_value, 'is_draft', coalesce(p_is_draft, v_old.is_draft)));
end;
$$;

-- Editar los GN de una misión (los XP no se tocan). Las participaciones abiertas toman el nuevo valor.
create or replace function public.gn_set_mission_gn(p_mission uuid, p_gn integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old integer;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede editar misiones' using errcode = '42501';
  end if;
  if p_gn is null or p_gn < 0 or p_gn > 10000 then
    raise exception 'GN no válidos (0 a 10.000)' using errcode = '22023';
  end if;
  select gn_reward into v_old from public.missions where id = p_mission for update;
  if not found then
    raise exception 'Misión no encontrada' using errcode = 'P0002';
  end if;
  update public.missions set gn_reward = p_gn where id = p_mission;
  update public.mission_participations set gn_reward = p_gn
  where mission_id = p_mission and status not in ('completed', 'expired');
  perform public.write_audit('mission.gn_changed', 'mission', p_mission::text, jsonb_build_object('before', v_old, 'after', p_gn));
end;
$$;

-- Tarea diaria (pg_cron): liquida a todos los licenciatarios.
create or replace function public.gn_daily_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
  v_n integer := 0;
begin
  for v_user in select user_id from public.gn_accounts loop
    perform public.gn_settle(v_user);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('settled', v_n);
end;
$$;

-- =============================================================================
-- Seguridad
-- =============================================================================
alter table public.gn_config enable row level security;
alter table public.gn_accounts enable row level security;
alter table public.gn_ledger enable row level security;
alter table public.gn_lots enable row level security;
alter table public.gn_lot_moves enable row level security;
alter table public.gn_sale_holds enable row level security;
alter table public.gn_mission_credits enable row level security;
alter table public.notifications enable row level security;

create policy gn_config_admin_select on public.gn_config for select to authenticated using (public.is_admin());
create policy gn_accounts_select on public.gn_accounts for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy gn_ledger_select on public.gn_ledger for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy gn_lots_select on public.gn_lots for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy gn_lot_moves_admin_select on public.gn_lot_moves for select to authenticated using (public.is_admin());
create policy gn_sale_holds_select on public.gn_sale_holds for select to authenticated using (licensee_id = auth.uid() or public.is_admin());
create policy gn_mission_credits_select on public.gn_mission_credits for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete, truncate on public.gn_config, public.gn_accounts, public.gn_ledger, public.gn_lots,
  public.gn_lot_moves, public.gn_sale_holds, public.gn_mission_credits, public.notifications from anon, authenticated;
revoke all on public.gn_config, public.gn_accounts, public.gn_ledger, public.gn_lots, public.gn_lot_moves,
  public.gn_sale_holds, public.gn_mission_credits, public.notifications from anon;

-- Internas: sin acceso desde la API.
revoke execute on function public.gn_lock_account(uuid) from public, anon, authenticated;
revoke execute on function public.gn_post(uuid, public.gn_entry_kind, integer, integer, integer, integer, text, text, uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.gn_consume_lots(uuid, integer, bigint) from public, anon, authenticated;
revoke execute on function public.gn_credit_available(uuid, integer, boolean, public.gn_entry_kind, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.gn_debit_available(uuid, integer, public.gn_entry_kind, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.gn_notify(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.gn_sale_signals(uuid) from public, anon, authenticated;
revoke execute on function public.gn_open_sale_hold(uuid) from public, anon, authenticated;
revoke execute on function public.gn_flag_pending_sales(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.gn_mission_sale(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.gn_void_sale(uuid, text) from public, anon, authenticated;
revoke execute on function public.gn_on_sale_status() from public, anon, authenticated;
revoke execute on function public.gn_credit_mission(uuid) from public, anon, authenticated;
revoke execute on function public.gn_on_xp_reward() from public, anon, authenticated;
revoke execute on function public.gn_settle(uuid) from public, anon, authenticated;
revoke execute on function public.gn_daily_maintenance() from public, anon, authenticated;
revoke execute on function public.gn_cfg(text) from public, anon, authenticated;
revoke execute on function public.gn_num(text, numeric) from public, anon, authenticated;
revoke execute on function public.gn_pvp(uuid) from public, anon, authenticated;

-- API.
revoke execute on function public.gn_v3_enabled(uuid) from public, anon;
revoke execute on function public.gn_is_tester(uuid) from public, anon;
revoke execute on function public.gn_public_config() from public, anon;
revoke execute on function public.my_gn_summary() from public, anon;
revoke execute on function public.mark_my_notifications_read(bigint[]) from public, anon;
revoke execute on function public.gn_review_sale(uuid, boolean, text) from public, anon;
revoke execute on function public.gn_return_sale(uuid, text) from public, anon;
revoke execute on function public.gn_admin_adjust(uuid, integer, text, text) from public, anon;
revoke execute on function public.gn_set_config(text, jsonb, boolean) from public, anon;
revoke execute on function public.gn_set_mission_gn(uuid, integer) from public, anon;
grant execute on function public.gn_v3_enabled(uuid) to authenticated;
grant execute on function public.gn_is_tester(uuid) to authenticated;
grant execute on function public.gn_public_config() to authenticated;
grant execute on function public.my_gn_summary() to authenticated;
grant execute on function public.mark_my_notifications_read(bigint[]) to authenticated;
grant execute on function public.gn_review_sale(uuid, boolean, text) to authenticated;
grant execute on function public.gn_return_sale(uuid, text) to authenticated;
grant execute on function public.gn_admin_adjust(uuid, integer, text, text) to authenticated;
grant execute on function public.gn_set_config(text, jsonb, boolean) to authenticated;
grant execute on function public.gn_set_mission_gn(uuid, integer) to authenticated;
