-- =============================================================================
-- Gallo Negro Licencias — Tu Tienda
-- Cada licenciado opera una tienda virtual bajo su licencia. Esta migración
-- añade el nombre de la tienda, el inventario entregado por Gallo Negro y la
-- inversión acumulada, más un resumen calculado solo con datos reales.
-- Inventario e inversión los registra únicamente el administrador.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Nombre de la tienda (1:1 con el perfil del licenciado)
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column store_name text check (store_name is null or char_length(store_name) between 2 and 60);

-- Actualizar los datos de la propia tienda (sin poder tocar el rol).
create or replace function public.update_my_store(p_store_name text, p_full_name text, p_public_alias text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;
  update public.profiles
  set store_name = nullif(trim(p_store_name), ''),
      full_name = nullif(trim(p_full_name), ''),
      public_alias = nullif(trim(p_public_alias), '')
  where id = auth.uid();
end;
$$;

-- -----------------------------------------------------------------------------
-- Inventario de la tienda: movimientos de solo inserción.
-- Existencias = entregas + devoluciones + ajustes − unidades de ventas verificadas.
-- -----------------------------------------------------------------------------
create type public.stock_movement_kind as enum ('delivery', 'return', 'adjustment');

create table public.store_stock_movements (
  id           uuid primary key default gen_random_uuid(),
  licensee_id  uuid not null references public.profiles (id) on delete restrict,
  product_id   uuid not null references public.products (id) on delete restrict,
  kind         public.stock_movement_kind not null,
  -- Positivo suma prendas a la tienda; negativo las retira.
  quantity     integer not null check (quantity <> 0 and abs(quantity) <= 10000),
  note         text check (note is null or char_length(note) <= 500),
  created_by   uuid not null references auth.users (id) on delete restrict,
  created_at   timestamptz not null default now(),
  check (kind <> 'delivery' or quantity > 0),
  check (kind <> 'return' or quantity < 0)
);
create index store_stock_movements_licensee_idx on public.store_stock_movements (licensee_id, created_at desc);
create trigger store_stock_movements_immutable before update or delete on public.store_stock_movements
  for each row execute function public.forbid_mutation();

-- -----------------------------------------------------------------------------
-- Inversión acumulada: pagos del licenciado a Gallo Negro (licencia, mercancía…).
-- Montos en la moneda de operación de la marca; las correcciones son negativas.
-- -----------------------------------------------------------------------------
create type public.investment_concept as enum ('license', 'merchandise', 'other', 'correction');

create table public.store_investments (
  id           uuid primary key default gen_random_uuid(),
  licensee_id  uuid not null references public.profiles (id) on delete restrict,
  concept      public.investment_concept not null,
  amount       numeric(12, 2) not null check (amount <> 0 and abs(amount) <= 100000000),
  invested_at  date not null,
  note         text check (note is null or char_length(note) <= 500),
  created_by   uuid not null references auth.users (id) on delete restrict,
  created_at   timestamptz not null default now(),
  check (concept = 'correction' or amount > 0)
);
create index store_investments_licensee_idx on public.store_investments (licensee_id, invested_at desc);
create trigger store_investments_immutable before update or delete on public.store_investments
  for each row execute function public.forbid_mutation();

-- Registrar un movimiento de inventario (solo administrador, auditado).
create or replace function public.record_stock_movement(
  p_licensee uuid, p_product uuid, p_kind public.stock_movement_kind, p_quantity integer, p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede registrar inventario' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_licensee and role = 'licensee') then
    raise exception 'La tienda indicada no pertenece a un licenciado' using errcode = '22023';
  end if;
  insert into public.store_stock_movements (licensee_id, product_id, kind, quantity, note, created_by)
  values (p_licensee, p_product, p_kind, p_quantity, nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;
  perform public.write_audit('store.stock_movement', 'profile', p_licensee::text,
    jsonb_build_object('movement_id', v_id, 'product_id', p_product, 'kind', p_kind, 'quantity', p_quantity));
  return v_id;
end;
$$;

-- Registrar una inversión (solo administrador, auditado).
create or replace function public.record_store_investment(
  p_licensee uuid, p_concept public.investment_concept, p_amount numeric, p_invested_at date, p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede registrar inversiones' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_licensee and role = 'licensee') then
    raise exception 'La tienda indicada no pertenece a un licenciado' using errcode = '22023';
  end if;
  if p_invested_at > current_date then
    raise exception 'La fecha de la inversión no puede estar en el futuro' using errcode = '22023';
  end if;
  insert into public.store_investments (licensee_id, concept, amount, invested_at, note, created_by)
  values (p_licensee, p_concept, p_amount, p_invested_at, nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;
  perform public.write_audit('store.investment', 'profile', p_licensee::text,
    jsonb_build_object('investment_id', v_id, 'concept', p_concept, 'amount', p_amount));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Resumen de Tu Tienda. Solo ventas verificadas cuentan para ventas, prendas
-- vendidas, total generado y existencias. El propio licenciado o un admin.
-- -----------------------------------------------------------------------------
create or replace function public.store_summary(p_user uuid, p_months integer default 6)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz text;
  v_xp bigint;
  v_level public.user_levels;
  v_next public.user_levels;
  v_levels_configured boolean;
  v_units_sold bigint;
  v_revenue numeric;
  v_stock_in bigint;
  v_investment numeric;
  v_monthly jsonb;
begin
  if auth.uid() is null or (p_user <> auth.uid() and not public.is_admin()) then
    raise exception 'No puedes ver el resumen de otra tienda' using errcode = '42501';
  end if;
  p_months := least(greatest(coalesce(p_months, 6), 1), 24);

  select timezone into v_tz from public.profiles where id = p_user;
  if not found then
    raise exception 'Tienda no encontrada' using errcode = 'P0002';
  end if;

  select coalesce(sum(amount), 0) into v_xp from public.xp_ledger where user_id = p_user;

  select exists (select 1 from public.user_levels where status = 'active') into v_levels_configured;
  select * into v_level from public.user_levels
    where status = 'active' and minimum_xp <= v_xp order by minimum_xp desc, position desc limit 1;
  select * into v_next from public.user_levels
    where status = 'active' and minimum_xp > v_xp order by minimum_xp, position limit 1;

  select coalesce(sum(i.quantity), 0), coalesce(sum(i.quantity * i.unit_price), 0)
    into v_units_sold, v_revenue
  from public.sales s join public.sale_items i on i.sale_id = s.id
  where s.licensee_id = p_user and s.status = 'verified';

  select coalesce(sum(quantity), 0) into v_stock_in from public.store_stock_movements where licensee_id = p_user;
  select coalesce(sum(amount), 0) into v_investment from public.store_investments where licensee_id = p_user;

  select coalesce(jsonb_agg(jsonb_build_object(
           'month', to_char(m.month, 'YYYY-MM'),
           'revenue', coalesce(t.revenue, 0),
           'units', coalesce(t.units, 0)) order by m.month), '[]'::jsonb)
    into v_monthly
  from generate_series(
         date_trunc('month', (now() at time zone v_tz)) - make_interval(months => p_months - 1),
         date_trunc('month', (now() at time zone v_tz)),
         interval '1 month') as m(month)
  left join (
    select date_trunc('month', s.sold_at at time zone v_tz) as month,
           sum(i.quantity * i.unit_price) as revenue,
           sum(i.quantity) as units
    from public.sales s join public.sale_items i on i.sale_id = s.id
    where s.licensee_id = p_user and s.status = 'verified'
    group by 1
  ) t on t.month = m.month;

  return jsonb_build_object(
    'total_xp', v_xp,
    'levels_configured', v_levels_configured,
    'level', case when v_level.id is null then null
                  else jsonb_build_object('name', v_level.name, 'position', v_level.position, 'minimum_xp', v_level.minimum_xp) end,
    'next_level', case when v_next.id is null then null
                       else jsonb_build_object('name', v_next.name, 'position', v_next.position, 'minimum_xp', v_next.minimum_xp) end,
    'units_sold', v_units_sold,
    'revenue', v_revenue,
    -- Puede ser negativo si hay ventas verificadas sin entrega registrada.
    'stock_balance', v_stock_in - v_units_sold,
    'units_delivered', v_stock_in,
    'investment', v_investment,
    'monthly', v_monthly
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Seguridad
-- -----------------------------------------------------------------------------
alter table public.store_stock_movements enable row level security;
alter table public.store_investments enable row level security;

create policy store_stock_select on public.store_stock_movements for select to authenticated
  using (licensee_id = auth.uid() or public.is_admin());
create policy store_investments_select on public.store_investments for select to authenticated
  using (licensee_id = auth.uid() or public.is_admin());

-- Sin escritura directa: todo pasa por las funciones de arriba.
revoke insert, update, delete, truncate on public.store_stock_movements, public.store_investments from anon, authenticated;
revoke all on public.store_stock_movements, public.store_investments from anon;

revoke execute on function public.update_my_store(text, text, text) from public, anon;
revoke execute on function public.record_stock_movement(uuid, uuid, public.stock_movement_kind, integer, text) from public, anon;
revoke execute on function public.record_store_investment(uuid, public.investment_concept, numeric, date, text) from public, anon;
revoke execute on function public.store_summary(uuid, integer) from public, anon;
grant execute on function public.update_my_store(text, text, text) to authenticated;
grant execute on function public.record_stock_movement(uuid, uuid, public.stock_movement_kind, integer, text) to authenticated;
grant execute on function public.record_store_investment(uuid, public.investment_concept, numeric, date, text) to authenticated;
grant execute on function public.store_summary(uuid, integer) to authenticated;
