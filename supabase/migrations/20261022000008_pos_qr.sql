-- =============================================================================
-- Gallo Negro Licencias — Punto de venta con QR
-- 1. Retira la misión D09 "La segunda oportunidad" sin tocar el historial de XP.
-- 2. Cada prenda entregada a una tienda recibe un código QR único (garment_units).
-- 3. Toda venta nueva se registra en el punto de venta escaneando esos QR: la
--    prenda sale del stock, la venta queda verificada y alimenta misiones y
--    Tu Tienda al instante. El registro manual de ventas se retira.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Misiones retiradas
-- -----------------------------------------------------------------------------
-- Archivada: no se abren períodos nuevos. Las participaciones abiertas caducan;
-- las completadas, las que esperan revisión y el XP ya otorgado se conservan.
update public.missions
set status = 'archived',
    inactive_reason = 'Retirada por Gallo Negro el 2026-10-22.'
where code = 'D09' and status <> 'archived';

update public.mission_participations p
set status = 'expired'
from public.missions m
where m.id = p.mission_id and m.code = 'D09' and p.status in ('available', 'in_progress');

-- El licenciado sigue viendo las misiones en las que participó aunque se
-- archiven, para que su historial de misiones y XP no quede incompleto.
drop policy missions_select on public.missions;
create policy missions_select on public.missions for select to authenticated
  using (
    public.is_admin()
    or (status = 'active' and public.mission_applies_to(missions, auth.uid()))
    or exists (select 1 from public.mission_participations p where p.mission_id = missions.id and p.user_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 2. Origen de cada venta
-- -----------------------------------------------------------------------------
create type public.sale_source as enum ('manual', 'pos');

-- 'manual' = registro anterior al punto de venta (lo verificaba un administrador).
-- 'pos' = punto de venta con QR: la verificación es el propio QR emitido por Gallo Negro.
alter table public.sales add column source public.sale_source not null default 'manual';

alter table public.sales drop constraint sales_check;
alter table public.sales add constraint sales_verified_check
  check (status <> 'verified' or (verified_at is not null and (verified_by is not null or source = 'pos')));

-- -----------------------------------------------------------------------------
-- 3. Prendas con QR
-- -----------------------------------------------------------------------------
create type public.garment_unit_status as enum ('in_store', 'sold', 'returned');

create table public.garment_units (
  id                 uuid primary key default gen_random_uuid(),
  -- Lo que codifica el QR. Alfabeto sin letras ambiguas (I, L, O, U) para poder escribirlo a mano.
  code               text not null unique check (code ~ '^GN-[0-9A-HJKMNP-TV-Z]{8}$'),
  licensee_id        uuid not null references public.profiles (id) on delete restrict,
  product_id         uuid not null references public.products (id) on delete restrict,
  -- Precio de venta de esta prenda, fijado por el administrador al emitir la etiqueta.
  unit_price         numeric(12, 2) not null check (unit_price >= 0 and unit_price <= 100000),
  status             public.garment_unit_status not null default 'in_store',
  -- Venta vigente en la que salió (se libera si la venta se anula).
  sale_id            uuid references public.sales (id) on delete restrict,
  -- Entrega de inventario que la originó; null si se etiquetó stock ya entregado.
  stock_movement_id  uuid references public.store_stock_movements (id) on delete restrict,
  -- Lote de etiquetas emitidas juntas (para imprimirlas).
  batch_id           uuid not null,
  created_by         uuid not null references auth.users (id) on delete restrict,
  created_at         timestamptz not null default now(),
  sold_at            timestamptz,
  returned_at        timestamptz,
  check ((status = 'sold') = (sale_id is not null)),
  check ((status = 'sold') = (sold_at is not null)),
  check ((status = 'returned') = (returned_at is not null))
);
create index garment_units_store_idx on public.garment_units (licensee_id, status);
create index garment_units_batch_idx on public.garment_units (batch_id);
create index garment_units_sale_idx on public.garment_units (sale_id) where sale_id is not null;

-- Cada línea de una venta del punto de venta es una prenda concreta.
alter table public.sale_items add column garment_unit_id uuid references public.garment_units (id) on delete restrict;
create index sale_items_garment_idx on public.sale_items (garment_unit_id) where garment_unit_id is not null;

-- Normaliza lo que llega del lector: el código solo, en minúsculas, o la URL completa del QR.
create or replace function public.normalize_garment_code(p_input text)
returns text
language sql
immutable
as $$
  select 'GN-' || coalesce(
    (regexp_match(upper(trim(coalesce(p_input, ''))), '^GN-?([0-9A-HJKMNP-TV-Z]{8})$'))[1],
    (regexp_match(upper(coalesce(p_input, '')), '(?:^|[^0-9A-Z])GN-([0-9A-HJKMNP-TV-Z]{8})(?![0-9A-Z])'))[1]);
$$;

create or replace function public.new_garment_code()
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  -- Bytes aleatorios de un UUID v4 (gen_random_uuid es del núcleo de Postgres; se evitan
  -- los bytes 6 y 8, que llevan la versión y la variante).
  v_positions constant integer[] := array[0, 1, 2, 3, 4, 5, 10, 11];
  v_bytes bytea;
  v_code text;
begin
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := 'GN-';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_positions[i]) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.garment_units where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Prendas de un producto que la tienda tiene en stock pero aún sin QR.
create or replace function public.untagged_stock(p_licensee uuid, p_product uuid)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce((select sum(quantity) from public.store_stock_movements where licensee_id = p_licensee and product_id = p_product), 0)
    - coalesce((select sum(i.quantity) from public.sales s join public.sale_items i on i.sale_id = s.id
                where s.licensee_id = p_licensee and s.status = 'verified' and i.product_id = p_product), 0)
    - (select count(*) from public.garment_units where licensee_id = p_licensee and product_id = p_product and status = 'in_store');
$$;

-- Emitir prendas con QR para una tienda (solo administrador, auditado).
-- p_register_delivery = true: registra además la entrega en el inventario.
-- p_register_delivery = false: etiqueta prendas que la tienda ya tenía en stock.
create or replace function public.issue_garment_units(
  p_licensee uuid, p_product uuid, p_quantity integer, p_unit_price numeric, p_register_delivery boolean, p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_movement uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede emitir etiquetas QR' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_licensee and role = 'licensee') then
    raise exception 'La tienda indicada no pertenece a un licenciado' using errcode = '22023';
  end if;
  if not exists (select 1 from public.products where id = p_product and is_active) then
    raise exception 'Producto no válido o inactivo' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 500 then
    raise exception 'Emite entre 1 y 500 prendas por lote' using errcode = '22023';
  end if;
  if p_unit_price is null or p_unit_price < 0 then
    raise exception 'Indica el precio de venta de la prenda' using errcode = '22023';
  end if;

  if coalesce(p_register_delivery, true) then
    v_movement := public.record_stock_movement(p_licensee, p_product, 'delivery', p_quantity,
      coalesce(nullif(trim(p_note), ''), 'Entrega con etiquetas QR'));
  elsif public.untagged_stock(p_licensee, p_product) < p_quantity then
    raise exception 'La tienda solo tiene % prendas de ese producto sin QR', greatest(public.untagged_stock(p_licensee, p_product), 0)
      using errcode = '22023';
  end if;

  insert into public.garment_units (code, licensee_id, product_id, unit_price, stock_movement_id, batch_id, created_by)
  select public.new_garment_code(), p_licensee, p_product, p_unit_price, v_movement, v_batch, auth.uid()
  from generate_series(1, p_quantity);

  perform public.write_audit('garment_units.issued', 'profile', p_licensee::text,
    jsonb_build_object('batch_id', v_batch, 'product_id', p_product, 'quantity', p_quantity,
                       'unit_price', p_unit_price, 'stock_movement_id', v_movement));
  return v_batch;
end;
$$;

-- Devolver a Gallo Negro una prenda con QR que sigue en la tienda (solo administrador).
create or replace function public.return_garment_unit(p_code text, p_note text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit public.garment_units;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede registrar devoluciones' using errcode = '42501';
  end if;
  select * into v_unit from public.garment_units where code = public.normalize_garment_code(p_code) for update;
  if not found then
    raise exception 'Código QR no encontrado' using errcode = 'P0002';
  end if;
  if v_unit.status <> 'in_store' then
    raise exception 'Solo se devuelven prendas que siguen en la tienda' using errcode = '22023';
  end if;
  perform public.record_stock_movement(v_unit.licensee_id, v_unit.product_id, 'return', -1,
    'Devolución ' || v_unit.code || coalesce(' · ' || nullif(trim(p_note), ''), ''));
  update public.garment_units set status = 'returned', returned_at = now() where id = v_unit.id;
  perform public.write_audit('garment_unit.returned', 'garment_unit', v_unit.id::text,
    jsonb_build_object('code', v_unit.code, 'licensee_id', v_unit.licensee_id, 'note', p_note));
end;
$$;

-- Consultar una prenda desde el punto de venta (solo prendas de la propia tienda).
create or replace function public.pos_lookup(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := public.normalize_garment_code(p_code);
  v_row record;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;
  if v_code is null then
    raise exception 'Ese código no es un QR de Gallo Negro' using errcode = '22023';
  end if;
  select u.code, u.status, u.unit_price, p.name, p.sku, c.name as category
    into v_row
  from public.garment_units u
  join public.products p on p.id = u.product_id
  join public.product_categories c on c.id = p.category_id
  where u.code = v_code and u.licensee_id = auth.uid();
  if not found then
    raise exception 'La prenda % no está registrada en tu tienda', v_code using errcode = 'P0002';
  end if;
  if v_row.status = 'sold' then
    raise exception 'La prenda % ya se vendió', v_code using errcode = '22023';
  end if;
  if v_row.status = 'returned' then
    raise exception 'La prenda % fue devuelta a Gallo Negro', v_code using errcode = '22023';
  end if;
  return jsonb_build_object('code', v_row.code, 'name', v_row.name, 'sku', v_row.sku,
                            'category', v_row.category, 'unit_price', v_row.unit_price);
end;
$$;

-- Cerrar una venta en el punto de venta. Cada QR solo puede venderse una vez:
-- las prendas se bloquean, se validan y se marcan vendidas en la misma transacción.
create or replace function public.pos_checkout(
  p_codes text[], p_channel public.sale_channel, p_customer_ref text, p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_tz text;
  v_codes text[];
  v_bad text;
  v_unit record;
  v_sale uuid;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;
  if (public.active_license(v_user)).id is null then
    raise exception 'Necesitas una licencia activa para vender' using errcode = '42501';
  end if;
  if p_channel is null then
    raise exception 'Indica el canal de la venta' using errcode = '22023';
  end if;
  if p_codes is null or cardinality(p_codes) = 0 then
    raise exception 'Escanea al menos una prenda' using errcode = '22023';
  end if;
  if cardinality(p_codes) > 50 then
    raise exception 'Máximo 50 prendas por venta' using errcode = '22023';
  end if;

  select c into v_bad from unnest(p_codes) c where public.normalize_garment_code(c) is null limit 1;
  if found then
    raise exception 'El código "%" no es un QR de Gallo Negro', v_bad using errcode = '22023';
  end if;
  select array_agg(public.normalize_garment_code(c)) into v_codes from unnest(p_codes) c;
  select c into v_bad from unnest(v_codes) c group by c having count(*) > 1 limit 1;
  if found then
    raise exception 'La prenda % está repetida en la venta', v_bad using errcode = '22023';
  end if;

  -- Bloquea las prendas para que dos ventas simultáneas no puedan usar el mismo QR.
  perform 1 from public.garment_units where code = any (v_codes) order by code for update;

  select c into v_bad from unnest(v_codes) c
  where not exists (select 1 from public.garment_units u where u.code = c and u.licensee_id = v_user) limit 1;
  if found then
    raise exception 'La prenda % no está registrada en tu tienda', v_bad using errcode = 'P0002';
  end if;
  select code into v_bad from public.garment_units where code = any (v_codes) and status <> 'in_store' order by code limit 1;
  if found then
    raise exception 'La prenda % ya no está disponible (vendida o devuelta)', v_bad using errcode = '22023';
  end if;

  select timezone into v_tz from public.profiles where id = v_user;
  insert into public.sales (licensee_id, reference, sold_at, channel, customer_ref, notes, source)
  values (v_user,
          'POS-' || to_char(now() at time zone coalesce(v_tz, 'America/Caracas'), 'YYYYMMDD-HH24MISS') || '-'
            || substr(replace(public.new_garment_code(), 'GN-', ''), 1, 4),
          now(), p_channel, nullif(trim(p_customer_ref), ''), nullif(trim(p_notes), ''), 'pos')
  returning id into v_sale;

  for v_unit in
    select u.id, u.product_id, u.unit_price, p.category_id
    from public.garment_units u join public.products p on p.id = u.product_id
    where u.code = any (v_codes)
  loop
    insert into public.sale_items (sale_id, product_id, category_id, quantity, unit_price, garment_unit_id)
    values (v_sale, v_unit.product_id, v_unit.category_id, 1, v_unit.unit_price, v_unit.id);
  end loop;

  update public.garment_units set status = 'sold', sale_id = v_sale, sold_at = now()
  where code = any (v_codes);

  -- El paso a "verificada" dispara el recálculo de misiones (on_sale_status_change).
  update public.sales set status = 'verified', verified_at = now() where id = v_sale;

  perform public.write_audit('sale.pos_checkout', 'sale', v_sale::text,
    jsonb_build_object('licensee_id', v_user, 'codes', to_jsonb(v_codes), 'channel', p_channel));
  return v_sale;
end;
$$;

-- -----------------------------------------------------------------------------
-- Anulación: ahora libera las prendas con QR y permite al licenciado corregir
-- un error de caja en los primeros 15 minutos de una venta del punto de venta.
-- -----------------------------------------------------------------------------
create or replace function public.cancel_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale public.sales;
begin
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venta no encontrada' using errcode = 'P0002';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Indica el motivo de la anulación' using errcode = '22023';
  end if;
  if public.is_admin() then
    if v_sale.status not in ('pending', 'verified') then
      raise exception 'La venta no se puede anular en su estado actual' using errcode = '22023';
    end if;
  elsif v_sale.licensee_id = auth.uid() then
    if v_sale.source = 'pos' then
      if v_sale.status <> 'verified' or v_sale.created_at < now() - interval '15 minutes' then
        raise exception 'Solo puedes anular una venta del punto de venta en sus primeros 15 minutos. Contacta a Gallo Negro para corregirla.' using errcode = '42501';
      end if;
    elsif v_sale.status <> 'pending' then
      raise exception 'Solo puedes anular ventas pendientes. Contacta a Gallo Negro para corregir una venta verificada.' using errcode = '42501';
    end if;
  else
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  update public.sales
  set status = 'cancelled', cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = p_sale_id;

  -- Las prendas vuelven a la tienda y su QR puede venderse de nuevo.
  update public.garment_units set status = 'in_store', sale_id = null, sold_at = null
  where sale_id = p_sale_id;

  perform public.write_audit('sale.cancelled', 'sale', p_sale_id::text,
    jsonb_build_object('licensee_id', v_sale.licensee_id, 'previous_status', v_sale.status, 'reason', p_reason));
end;
$$;

-- -----------------------------------------------------------------------------
-- Seguridad
-- -----------------------------------------------------------------------------
alter table public.garment_units enable row level security;
create policy garment_units_select on public.garment_units for select to authenticated
  using (licensee_id = auth.uid() or public.is_admin());

revoke insert, update, delete, truncate on public.garment_units from anon, authenticated;
revoke all on public.garment_units from anon;

-- El registro manual de ventas se retira: solo queda como función interna.
revoke execute on function public.create_sale(text, timestamptz, public.sale_channel, text, text, jsonb) from authenticated;

revoke execute on function public.new_garment_code() from public, anon, authenticated;
revoke execute on function public.untagged_stock(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.issue_garment_units(uuid, uuid, integer, numeric, boolean, text) from public, anon;
revoke execute on function public.return_garment_unit(text, text) from public, anon;
revoke execute on function public.pos_lookup(text) from public, anon;
revoke execute on function public.pos_checkout(text[], public.sale_channel, text, text) from public, anon;
grant execute on function public.issue_garment_units(uuid, uuid, integer, numeric, boolean, text) to authenticated;
grant execute on function public.return_garment_unit(text, text) to authenticated;
grant execute on function public.pos_lookup(text) to authenticated;
grant execute on function public.pos_checkout(text[], public.sale_channel, text, text) to authenticated;
