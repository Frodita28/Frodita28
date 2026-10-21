-- =============================================================================
-- Gallo Negro Licencias — Base de la aplicación principal
-- Usuarios y roles, planes, licencias, catálogo mínimo, ventas y auditoría.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('applicant', 'licensee', 'admin');
create type public.plan_status as enum ('pending_confirmation', 'active', 'inactive');
create type public.license_status as enum ('pending', 'active', 'suspended', 'expired', 'cancelled');
create type public.sale_status as enum ('pending', 'verified', 'rejected', 'cancelled');
create type public.sale_channel as enum ('instagram', 'whatsapp', 'tiktok', 'presencial', 'evento', 'otro');

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfiles (1:1 con auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          public.app_role not null default 'applicant',
  full_name     text,
  -- Nombre comercial o alias autorizado: es lo único que se muestra en rankings.
  public_alias  text check (public_alias is null or char_length(public_alias) between 2 and 40),
  timezone      text not null default 'America/Caracas',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- El rol nunca se toma de los metadatos del registro: todo usuario nuevo es solicitante.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- -----------------------------------------------------------------------------
-- Auditoría de acciones críticas (solo se inserta desde funciones del servidor)
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid references auth.users (id) on delete set null,
  action       text not null,
  entity_type  text not null,
  entity_id    text,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_created_idx on public.audit_log (created_at desc);

create or replace function public.write_audit(p_action text, p_entity_type text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- El historial de auditoría no se modifica ni se borra.
create or replace function public.forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'La tabla % es de solo inserción', tg_table_name using errcode = '42501';
end;
$$;
create trigger audit_log_immutable before update or delete on public.audit_log
  for each row execute function public.forbid_mutation();

-- Los cambios de rol también quedan auditados.
create or replace function public.audit_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role then
    perform public.write_audit('profile.role_changed', 'profile', new.id::text,
      jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  return new;
end;
$$;
create trigger profiles_audit_role after update of role on public.profiles
  for each row execute function public.audit_profile_role();

-- -----------------------------------------------------------------------------
-- Planes de licencia. Nombres, precios y condiciones son configurables;
-- mientras no estén confirmados quedan en estado pending_confirmation.
-- -----------------------------------------------------------------------------
create table public.license_plans (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  name              text not null,
  description       text,
  price             numeric(12, 2) check (price is null or price >= 0),
  currency          text check (currency is null or currency ~ '^[A-Z]{3}$'),
  duration_months   integer check (duration_months is null or duration_months > 0),
  territory         text,
  units_included    integer check (units_included is null or units_included >= 0),
  status            public.plan_status not null default 'pending_confirmation',
  is_demo           boolean not null default false,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger license_plans_touch before update on public.license_plans
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Licencias
-- -----------------------------------------------------------------------------
create table public.licenses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete restrict,
  plan_id       uuid not null references public.license_plans (id) on delete restrict,
  territory     text,
  status        public.license_status not null default 'pending',
  starts_at     date,
  ends_at       date,
  contract_ref  text,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);
create unique index licenses_one_active_per_user on public.licenses (user_id) where status = 'active';
create index licenses_user_idx on public.licenses (user_id);
create trigger licenses_touch before update on public.licenses
  for each row execute function public.touch_updated_at();

create or replace function public.audit_license()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.write_audit(
    case when tg_op = 'INSERT' then 'license.created' else 'license.updated' end,
    'license', new.id::text,
    jsonb_build_object('user_id', new.user_id, 'plan_id', new.plan_id, 'status', new.status,
                       'previous_status', case when tg_op = 'UPDATE' then old.status end));
  -- Activar una licencia convierte al solicitante en licenciado.
  if new.status = 'active' then
    update public.profiles set role = 'licensee' where id = new.user_id and role = 'applicant';
  end if;
  return new;
end;
$$;
create trigger licenses_audit after insert or update on public.licenses
  for each row execute function public.audit_license();

-- Licencia activa vigente del usuario (o null).
create or replace function public.active_license(p_user uuid)
returns public.licenses
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.* from public.licenses l
  where l.user_id = p_user
    and l.status = 'active'
    and (l.starts_at is null or l.starts_at <= current_date)
    and (l.ends_at is null or l.ends_at >= current_date)
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Catálogo mínimo (categorías y productos)
-- -----------------------------------------------------------------------------
create table public.product_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  is_active   boolean not null default true,
  sort_order  integer not null default 0
);

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.product_categories (id) on delete restrict,
  sku          text not null unique,
  name         text not null,
  description  text,
  -- Precio de venta autorizado: configurable, null mientras no esté confirmado.
  authorized_price numeric(12, 2) check (authorized_price is null or authorized_price >= 0),
  is_active    boolean not null default true,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index products_category_idx on public.products (category_id);
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Ventas del licenciado. Se registran como pendientes y solo cuentan
-- (para resúmenes y misiones) cuando un administrador las verifica.
-- -----------------------------------------------------------------------------
create table public.sales (
  id                    uuid primary key default gen_random_uuid(),
  licensee_id           uuid not null references public.profiles (id) on delete restrict,
  reference             text not null check (char_length(trim(reference)) between 1 and 80),
  reference_normalized  text generated always as (lower(regexp_replace(reference, '[^[:alnum:]]', '', 'g'))) stored,
  sold_at               timestamptz not null,
  channel               public.sale_channel not null,
  -- Identificador privado del comprador (alias, teléfono parcial…). Nunca se muestra a otros licenciados.
  customer_ref          text check (customer_ref is null or char_length(customer_ref) <= 120),
  customer_key          text generated always as (nullif(lower(regexp_replace(coalesce(customer_ref, ''), '\s+', '', 'g')), '')) stored,
  notes                 text check (notes is null or char_length(notes) <= 1000),
  status                public.sale_status not null default 'pending',
  verified_by           uuid references auth.users (id) on delete set null,
  verified_at           timestamptz,
  rejection_reason      text,
  cancelled_at          timestamptz,
  cancel_reason         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Una misma referencia no puede registrarse dos veces por el mismo licenciado.
  unique (licensee_id, reference_normalized),
  check (status <> 'verified' or (verified_by is not null and verified_at is not null)),
  check (verified_by is null or verified_by <> licensee_id)
);
create index sales_licensee_sold_idx on public.sales (licensee_id, sold_at) where status = 'verified';
create index sales_status_idx on public.sales (status, created_at);
create trigger sales_touch before update on public.sales
  for each row execute function public.touch_updated_at();

create table public.sale_items (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.sales (id) on delete cascade,
  product_id   uuid not null references public.products (id) on delete restrict,
  -- Copia de la categoría en el momento de la venta, para que reclasificar
  -- un producto no altere métricas históricas.
  category_id  uuid not null references public.product_categories (id) on delete restrict,
  quantity     integer not null check (quantity > 0 and quantity <= 1000),
  unit_price   numeric(12, 2) not null check (unit_price >= 0)
);
create index sale_items_sale_idx on public.sale_items (sale_id);

-- Registrar una venta (licenciado con licencia activa).
-- p_items: [{"product_id": "...", "quantity": 2, "unit_price": 20}]
create or replace function public.create_sale(
  p_reference text,
  p_sold_at timestamptz,
  p_channel public.sale_channel,
  p_customer_ref text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_sale uuid;
  v_item jsonb;
  v_category uuid;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;
  if (public.active_license(v_user)).id is null then
    raise exception 'Necesitas una licencia activa para registrar ventas' using errcode = '42501';
  end if;
  if p_sold_at > now() + interval '5 minutes' then
    raise exception 'La fecha de la venta no puede estar en el futuro' using errcode = '22023';
  end if;
  if p_sold_at < now() - interval '60 days' then
    raise exception 'Solo se pueden registrar ventas de los últimos 60 días' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe incluir al menos un producto' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Demasiados productos en una venta' using errcode = '22023';
  end if;

  begin
    insert into public.sales (licensee_id, reference, sold_at, channel, customer_ref, notes)
    values (v_user, trim(p_reference), p_sold_at, p_channel, nullif(trim(p_customer_ref), ''), nullif(trim(p_notes), ''))
    returning id into v_sale;
  exception when unique_violation then
    raise exception 'Ya registraste una venta con la referencia "%"', trim(p_reference) using errcode = '23505';
  end;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select p.category_id into v_category
    from public.products p
    where p.id = (v_item ->> 'product_id')::uuid and p.is_active;
    if v_category is null then
      raise exception 'Producto no válido o inactivo' using errcode = '22023';
    end if;
    insert into public.sale_items (sale_id, product_id, category_id, quantity, unit_price)
    values (v_sale, (v_item ->> 'product_id')::uuid, v_category,
            (v_item ->> 'quantity')::integer, (v_item ->> 'unit_price')::numeric);
  end loop;

  return v_sale;
end;
$$;

-- Verificar o rechazar una venta (solo administradores, nunca la propia).
create or replace function public.review_sale(p_sale_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale public.sales;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede revisar ventas' using errcode = '42501';
  end if;
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Venta no encontrada' using errcode = 'P0002';
  end if;
  if v_sale.licensee_id = auth.uid() then
    raise exception 'No puedes verificar tus propias ventas' using errcode = '42501';
  end if;
  if v_sale.status <> 'pending' then
    raise exception 'La venta ya fue revisada' using errcode = '22023';
  end if;
  if not p_approve and coalesce(trim(p_reason), '') = '' then
    raise exception 'Indica el motivo del rechazo' using errcode = '22023';
  end if;

  update public.sales
  set status = case when p_approve then 'verified'::public.sale_status else 'rejected'::public.sale_status end,
      verified_by = case when p_approve then auth.uid() end,
      verified_at = case when p_approve then now() end,
      rejection_reason = case when p_approve then null else trim(p_reason) end
  where id = p_sale_id;

  perform public.write_audit(case when p_approve then 'sale.verified' else 'sale.rejected' end,
    'sale', p_sale_id::text, jsonb_build_object('licensee_id', v_sale.licensee_id, 'reason', p_reason));
end;
$$;

-- Anular una venta. El licenciado puede anular sus ventas pendientes;
-- solo un administrador puede anular una venta ya verificada.
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
    if v_sale.status <> 'pending' then
      raise exception 'Solo puedes anular ventas pendientes. Contacta a Gallo Negro para corregir una venta verificada.' using errcode = '42501';
    end if;
  else
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  update public.sales
  set status = 'cancelled', cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = p_sale_id;

  perform public.write_audit('sale.cancelled', 'sale', p_sale_id::text,
    jsonb_build_object('licensee_id', v_sale.licensee_id, 'previous_status', v_sale.status, 'reason', p_reason));
end;
$$;

-- Actualizar el propio perfil (sin poder tocar el rol).
create or replace function public.update_my_profile(p_full_name text, p_public_alias text)
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
  set full_name = nullif(trim(p_full_name), ''),
      public_alias = nullif(trim(p_public_alias), '')
  where id = auth.uid();
end;
$$;

-- -----------------------------------------------------------------------------
-- Seguridad a nivel de fila (RLS)
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;
alter table public.license_plans enable row level security;
alter table public.licenses enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

-- Perfiles: cada quien ve el suyo; el administrador ve y edita todos.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy audit_admin_select on public.audit_log for select to authenticated
  using (public.is_admin());

-- Planes: visibles públicamente salvo los inactivos; solo el admin los edita.
create policy plans_public_select on public.license_plans for select to anon, authenticated
  using (status <> 'inactive' or public.is_admin());
create policy plans_admin_write on public.license_plans for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy licenses_select on public.licenses for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy licenses_admin_write on public.licenses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy categories_select on public.product_categories for select to authenticated using (true);
create policy categories_admin_write on public.product_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy products_select on public.products for select to authenticated
  using (is_active or public.is_admin());
create policy products_admin_write on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Ventas: lectura propia o admin. Ninguna escritura directa (solo funciones).
create policy sales_select on public.sales for select to authenticated
  using (licensee_id = auth.uid() or public.is_admin());
create policy sale_items_select on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id and (s.licensee_id = auth.uid() or public.is_admin())));

-- Defensa en profundidad: aunque RLS ya lo impide, retiramos los privilegios de escritura.
revoke insert, update, delete, truncate on public.sales, public.sale_items, public.audit_log from anon, authenticated;
revoke insert, delete, truncate on public.profiles from anon, authenticated;

-- Funciones internas: no invocables desde la API.
revoke execute on function public.write_audit(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.active_license(uuid) from public, anon, authenticated;
revoke execute on function public.create_sale(text, timestamptz, public.sale_channel, text, text, jsonb) from public, anon;
revoke execute on function public.review_sale(uuid, boolean, text) from public, anon;
revoke execute on function public.cancel_sale(uuid, text) from public, anon;
revoke execute on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.create_sale(text, timestamptz, public.sale_channel, text, text, jsonb) to authenticated;
grant execute on function public.review_sale(uuid, boolean, text) to authenticated;
grant execute on function public.cancel_sale(uuid, text) to authenticated;
grant execute on function public.update_my_profile(text, text) to authenticated;
