-- =============================================================================
-- Gallo Negro Licencias — Solicitudes de licencia y planes configurables
-- (spec maestra módulos A y C). Una solicitud nunca es una licencia: aprobarla
-- solo habilita al administrador a activar la licencia, una vez formalizados
-- contrato y pago, como acción separada y auditada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Planes: condiciones configurables desde el panel (spec §3.2)
-- -----------------------------------------------------------------------------
alter table public.license_plans
  add column authorized_products text check (authorized_products is null or char_length(authorized_products) <= 1000),
  add column exclusivity_terms text check (exclusivity_terms is null or char_length(exclusivity_terms) <= 2000),
  add column materials_included text check (materials_included is null or char_length(materials_included) <= 2000),
  add column renewal_terms text check (renewal_terms is null or char_length(renewal_terms) <= 2000),
  -- Un plan solo puede publicarse como disponible con precio y moneda definidos.
  add constraint license_plans_active_has_price check (status <> 'active' or (price is not null and currency is not null));

create or replace function public.audit_license_plan()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.write_audit(case when tg_op = 'INSERT' then 'plan.created' else 'plan.updated' end,
    'license_plan', new.id::text,
    jsonb_build_object('name', new.name, 'status', new.status, 'price', new.price, 'currency', new.currency,
                       'previous', case when tg_op = 'UPDATE' then jsonb_build_object(
                         'name', old.name, 'status', old.status, 'price', old.price, 'currency', old.currency) end));
  return new;
end;
$$;
create trigger license_plans_audit after insert or update on public.license_plans
  for each row execute function public.audit_license_plan();

-- Beneficios por plan, clasificados (spec §3.3). Los pendientes no se publican.
create type public.benefit_status as enum ('confirmed', 'pending_approval', 'contract_only');

create table public.plan_benefits (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.license_plans (id) on delete cascade,
  description text not null check (char_length(trim(description)) between 3 and 300),
  status      public.benefit_status not null default 'pending_approval',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index plan_benefits_plan_idx on public.plan_benefits (plan_id, sort_order);
create trigger plan_benefits_touch before update on public.plan_benefits
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Solicitudes
-- -----------------------------------------------------------------------------
create type public.application_status as enum ('submitted', 'in_review', 'needs_info', 'approved', 'rejected', 'withdrawn');

create table public.license_applications (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete restrict,
  -- Copia del correo de la cuenta al enviar, para que el equipo pueda contactar.
  email              text,
  status             public.application_status not null default 'submitted',
  full_name          text not null check (char_length(full_name) between 2 and 120),
  phone              text not null check (phone ~ '^\+?[0-9 ()-]{6,25}$'),
  country            text not null check (char_length(country) between 2 and 60),
  city               text not null check (char_length(city) between 2 and 80),
  business_name      text check (business_name is null or char_length(business_name) <= 120),
  experience         text not null check (char_length(experience) between 10 and 2000),
  sales_channels     text[] not null check (
    cardinality(sales_channels) between 1 and 8
    and sales_channels <@ array['instagram', 'tiktok', 'whatsapp', 'presencial', 'recurrentes', 'eventos', 'tienda_online', 'otro']),
  social_links       text check (social_links is null or char_length(social_links) <= 500),
  motivation         text check (motivation is null or char_length(motivation) <= 2000),
  preferred_plan_id  uuid references public.license_plans (id) on delete set null,
  assigned_plan_id   uuid references public.license_plans (id) on delete restrict,
  -- Último mensaje del equipo para el solicitante (correcciones, motivo de rechazo…).
  admin_message      text check (admin_message is null or char_length(admin_message) <= 2000),
  reviewed_by        uuid references auth.users (id) on delete set null,
  reviewed_at        timestamptz,
  license_id         uuid unique references public.licenses (id) on delete restrict,
  acknowledged_at    timestamptz not null,
  submitted_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (reviewed_by is null or reviewed_by <> user_id),
  check (status <> 'approved' or assigned_plan_id is not null),
  check (license_id is null or status = 'approved')
);
-- Una sola solicitud abierta (o aprobada) por persona.
create unique index license_applications_one_open on public.license_applications (user_id)
  where status in ('submitted', 'in_review', 'needs_info', 'approved');
create index license_applications_status_idx on public.license_applications (status, submitted_at);
create trigger license_applications_touch before update on public.license_applications
  for each row execute function public.touch_updated_at();

-- Historial de la solicitud (inmutable). Las notas internas no las ve el solicitante.
create table public.application_events (
  id              bigint generated always as identity primary key,
  application_id  uuid not null references public.license_applications (id) on delete restrict,
  actor_id        uuid references auth.users (id) on delete set null,
  event           text not null check (event in ('submitted', 'updated', 'resubmitted', 'review_started', 'info_requested',
                                                 'approved', 'rejected', 'withdrawn', 'license_activated', 'note')),
  from_status     public.application_status,
  to_status       public.application_status,
  message         text check (message is null or char_length(message) <= 2000),
  is_internal     boolean not null default false,
  created_at      timestamptz not null default now()
);
create index application_events_app_idx on public.application_events (application_id, created_at);
create trigger application_events_immutable before update or delete on public.application_events
  for each row execute function public.forbid_mutation();

create or replace function public.log_application_event(
  p_application uuid, p_event text, p_from public.application_status, p_to public.application_status,
  p_message text default null, p_internal boolean default false)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.application_events (application_id, actor_id, event, from_status, to_status, message, is_internal)
  values (p_application, auth.uid(), p_event, p_from, p_to, nullif(trim(p_message), ''), p_internal);
  perform public.write_audit('application.' || p_event, 'license_application', p_application::text,
    jsonb_build_object('from', p_from, 'to', p_to, 'internal', p_internal));
end;
$$;

-- Normaliza y valida los datos del formulario. Devuelve una fila sin guardar.
create or replace function public.application_from_payload(p jsonb)
returns public.license_applications
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v public.license_applications;
  v_channels text[];
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Datos de la solicitud no válidos' using errcode = '22023';
  end if;
  v.full_name := nullif(trim(p ->> 'full_name'), '');
  v.phone := nullif(trim(p ->> 'phone'), '');
  v.country := nullif(trim(p ->> 'country'), '');
  v.city := nullif(trim(p ->> 'city'), '');
  v.business_name := nullif(trim(p ->> 'business_name'), '');
  v.experience := nullif(trim(p ->> 'experience'), '');
  v.social_links := nullif(trim(p ->> 'social_links'), '');
  v.motivation := nullif(trim(p ->> 'motivation'), '');

  if v.full_name is null or char_length(v.full_name) not between 2 and 120 then
    raise exception 'Indica tu nombre completo' using errcode = '22023';
  end if;
  if v.phone is null or v.phone !~ '^\+?[0-9 ()-]{6,25}$' then
    raise exception 'Indica un teléfono válido' using errcode = '22023';
  end if;
  if v.country is null or char_length(v.country) not between 2 and 60 then
    raise exception 'Indica tu país' using errcode = '22023';
  end if;
  if v.city is null or char_length(v.city) not between 2 and 80 then
    raise exception 'Indica tu ciudad' using errcode = '22023';
  end if;
  if v.experience is null or char_length(v.experience) not between 10 and 2000 then
    raise exception 'Describe tu experiencia comercial (mínimo 10 caracteres)' using errcode = '22023';
  end if;

  if jsonb_typeof(p -> 'sales_channels') <> 'array' then
    raise exception 'Elige al menos un canal de venta' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct c), '{}') into v_channels from jsonb_array_elements_text(p -> 'sales_channels') c;
  if cardinality(v_channels) = 0
     or not v_channels <@ array['instagram', 'tiktok', 'whatsapp', 'presencial', 'recurrentes', 'eventos', 'tienda_online', 'otro'] then
    raise exception 'Elige al menos un canal de venta válido' using errcode = '22023';
  end if;
  v.sales_channels := v_channels;

  if nullif(p ->> 'preferred_plan_id', '') is not null then
    select id into v.preferred_plan_id from public.license_plans
    where id = (p ->> 'preferred_plan_id')::uuid and status <> 'inactive';
    if v.preferred_plan_id is null then
      raise exception 'El plan elegido no está disponible' using errcode = '22023';
    end if;
  end if;
  return v;
end;
$$;

-- Enviar una solicitud (solo cuentas de solicitante, sin licencia activa).
create or replace function public.submit_license_application(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v public.license_applications;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión para enviar una solicitud' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_user and role = 'applicant') then
    raise exception 'Tu cuenta ya es de licenciado o administrador' using errcode = '42501';
  end if;
  if coalesce((p ->> 'acknowledged')::boolean, false) is not true then
    raise exception 'Debes confirmar que entiendes que la solicitud no es una licencia ni garantiza ganancias' using errcode = '22023';
  end if;
  if (select count(*) from public.license_applications where user_id = v_user) >= 5 then
    raise exception 'Alcanzaste el máximo de solicitudes. Contacta a Gallo Negro.' using errcode = '42501';
  end if;

  v := public.application_from_payload(p);
  begin
    insert into public.license_applications (user_id, email, full_name, phone, country, city, business_name, experience,
      sales_channels, social_links, motivation, preferred_plan_id, acknowledged_at)
    values (v_user, (select email from auth.users where id = v_user), v.full_name, v.phone, v.country, v.city,
      v.business_name, v.experience, v.sales_channels, v.social_links, v.motivation, v.preferred_plan_id, now())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Ya tienes una solicitud en curso' using errcode = '23505';
  end;
  perform public.log_application_event(v_id, 'submitted', null, 'submitted');
  return v_id;
end;
$$;

-- Corregir la propia solicitud: mientras está pendiente o cuando se piden correcciones.
create or replace function public.update_license_application(p_id uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_app public.license_applications;
  v public.license_applications;
begin
  select * into v_app from public.license_applications where id = p_id for update;
  if not found or v_app.user_id is distinct from auth.uid() then
    raise exception 'Solicitud no encontrada' using errcode = 'P0002';
  end if;
  if v_app.status not in ('submitted', 'needs_info') then
    raise exception 'La solicitud ya no se puede modificar' using errcode = '22023';
  end if;
  v := public.application_from_payload(p);
  update public.license_applications
  set full_name = v.full_name, phone = v.phone, country = v.country, city = v.city, business_name = v.business_name,
      experience = v.experience, sales_channels = v.sales_channels, social_links = v.social_links,
      motivation = v.motivation, preferred_plan_id = v.preferred_plan_id,
      status = 'submitted',
      submitted_at = case when v_app.status = 'needs_info' then now() else submitted_at end
  where id = p_id;
  perform public.log_application_event(p_id,
    case when v_app.status = 'needs_info' then 'resubmitted' else 'updated' end, v_app.status, 'submitted');
end;
$$;

-- Retirar la propia solicitud (si aún no tiene licencia).
create or replace function public.withdraw_license_application(p_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_app public.license_applications;
begin
  select * into v_app from public.license_applications where id = p_id for update;
  if not found or v_app.user_id is distinct from auth.uid() then
    raise exception 'Solicitud no encontrada' using errcode = 'P0002';
  end if;
  if v_app.status not in ('submitted', 'in_review', 'needs_info', 'approved') or v_app.license_id is not null then
    raise exception 'La solicitud ya no se puede retirar' using errcode = '22023';
  end if;
  update public.license_applications set status = 'withdrawn' where id = p_id;
  perform public.log_application_event(p_id, 'withdrawn', v_app.status, 'withdrawn', left(p_reason, 2000));
end;
$$;

-- Revisión administrativa. p_action: start_review | request_info | approve | reject | note.
create or replace function public.review_license_application(
  p_id uuid, p_action text, p_message text default null, p_plan_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_app public.license_applications;
  v_to public.application_status;
  v_event text;
  v_message text := nullif(trim(p_message), '');
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede revisar solicitudes' using errcode = '42501';
  end if;
  select * into v_app from public.license_applications where id = p_id for update;
  if not found then
    raise exception 'Solicitud no encontrada' using errcode = 'P0002';
  end if;
  if v_app.user_id = auth.uid() then
    raise exception 'No puedes revisar tu propia solicitud' using errcode = '42501';
  end if;
  if char_length(v_message) > 2000 then
    raise exception 'El mensaje es demasiado largo' using errcode = '22023';
  end if;

  if p_action = 'note' then
    if v_message is null then
      raise exception 'Escribe la nota' using errcode = '22023';
    end if;
    perform public.log_application_event(p_id, 'note', v_app.status, v_app.status, v_message, true);
    return;
  end if;

  case p_action
    when 'start_review' then
      if v_app.status <> 'submitted' then
        raise exception 'Solo se puede iniciar la revisión de una solicitud pendiente' using errcode = '22023';
      end if;
      v_to := 'in_review'; v_event := 'review_started';
    when 'request_info' then
      if v_app.status not in ('submitted', 'in_review') then
        raise exception 'La solicitud no admite pedir correcciones en su estado actual' using errcode = '22023';
      end if;
      if v_message is null then
        raise exception 'Indica qué información o corrección necesitas' using errcode = '22023';
      end if;
      v_to := 'needs_info'; v_event := 'info_requested';
    when 'approve' then
      if v_app.status not in ('submitted', 'in_review') then
        raise exception 'La solicitud no se puede aprobar en su estado actual' using errcode = '22023';
      end if;
      if p_plan_id is null or not exists (select 1 from public.license_plans where id = p_plan_id and status <> 'inactive') then
        raise exception 'Asigna un plan disponible para aprobar' using errcode = '22023';
      end if;
      v_to := 'approved'; v_event := 'approved';
    when 'reject' then
      if v_app.status not in ('submitted', 'in_review', 'needs_info') then
        raise exception 'La solicitud no se puede rechazar en su estado actual' using errcode = '22023';
      end if;
      if v_message is null then
        raise exception 'Indica el motivo del rechazo' using errcode = '22023';
      end if;
      v_to := 'rejected'; v_event := 'rejected';
    else
      raise exception 'Acción no válida' using errcode = '22023';
  end case;

  update public.license_applications
  set status = v_to,
      assigned_plan_id = case when p_action = 'approve' then p_plan_id else assigned_plan_id end,
      admin_message = coalesce(v_message, case when p_action = 'start_review' then admin_message end),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_id;
  perform public.log_application_event(p_id, v_event, v_app.status, v_to, v_message);
end;
$$;

-- Activar la licencia de una solicitud aprobada, tras formalizar contrato y pago.
-- El trigger de licenses convierte al solicitante en licenciado y lo audita.
create or replace function public.activate_application_license(
  p_id uuid, p_territory text, p_starts_at date, p_ends_at date, p_contract_ref text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_app public.license_applications;
  v_license uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede activar licencias' using errcode = '42501';
  end if;
  select * into v_app from public.license_applications where id = p_id for update;
  if not found then
    raise exception 'Solicitud no encontrada' using errcode = 'P0002';
  end if;
  if v_app.user_id = auth.uid() then
    raise exception 'No puedes activar tu propia licencia' using errcode = '42501';
  end if;
  if v_app.status <> 'approved' then
    raise exception 'Solo se activa la licencia de una solicitud aprobada' using errcode = '22023';
  end if;
  if v_app.license_id is not null then
    raise exception 'Esta solicitud ya tiene una licencia activada' using errcode = '22023';
  end if;
  if coalesce(trim(p_contract_ref), '') = '' or char_length(trim(p_contract_ref)) > 120 then
    raise exception 'Indica la referencia del contrato firmado' using errcode = '22023';
  end if;
  if p_starts_at is null then
    raise exception 'Indica la fecha de inicio de la licencia' using errcode = '22023';
  end if;
  if p_ends_at is not null and p_ends_at < p_starts_at then
    raise exception 'El vencimiento no puede ser anterior al inicio' using errcode = '22023';
  end if;

  begin
    insert into public.licenses (user_id, plan_id, territory, status, starts_at, ends_at, contract_ref, created_by)
    values (v_app.user_id, v_app.assigned_plan_id, nullif(trim(left(p_territory, 120)), ''), 'active',
            p_starts_at, p_ends_at, trim(p_contract_ref), auth.uid())
    returning id into v_license;
  exception when unique_violation then
    raise exception 'Esa persona ya tiene una licencia activa' using errcode = '23505';
  end;
  update public.license_applications set license_id = v_license where id = p_id;
  perform public.log_application_event(p_id, 'license_activated', 'approved', 'approved',
    'Licencia activada. Contrato: ' || trim(p_contract_ref));
  return v_license;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS y privilegios
-- -----------------------------------------------------------------------------
alter table public.plan_benefits enable row level security;
alter table public.license_applications enable row level security;
alter table public.application_events enable row level security;

-- Beneficios: el público ve los confirmados y los "según contrato" de planes visibles.
create policy plan_benefits_public_select on public.plan_benefits for select to anon, authenticated
  using (public.is_admin() or (status <> 'pending_approval'
         and exists (select 1 from public.license_plans lp where lp.id = plan_id and lp.status <> 'inactive')));
create policy plan_benefits_admin_write on public.plan_benefits for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy applications_select on public.license_applications for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy application_events_select on public.application_events for select to authenticated
  using (public.is_admin() or (not is_internal and exists (
    select 1 from public.license_applications a where a.id = application_id and a.user_id = auth.uid())));

-- Sin escritura directa: todo pasa por las funciones de arriba.
revoke insert, update, delete, truncate on public.license_applications, public.application_events from anon, authenticated;
revoke all on public.license_applications, public.application_events from anon;
revoke insert, update, delete, truncate on public.plan_benefits from anon;

revoke execute on function public.audit_license_plan() from public, anon, authenticated;
revoke execute on function public.log_application_event(uuid, text, public.application_status, public.application_status, text, boolean) from public, anon, authenticated;
revoke execute on function public.application_from_payload(jsonb) from public, anon, authenticated;
revoke execute on function public.submit_license_application(jsonb) from public, anon;
revoke execute on function public.update_license_application(uuid, jsonb) from public, anon;
revoke execute on function public.withdraw_license_application(uuid, text) from public, anon;
revoke execute on function public.review_license_application(uuid, text, text, uuid) from public, anon;
revoke execute on function public.activate_application_license(uuid, text, date, date, text) from public, anon;
grant execute on function public.submit_license_application(jsonb) to authenticated;
grant execute on function public.update_license_application(uuid, jsonb) to authenticated;
grant execute on function public.withdraw_license_application(uuid, text) to authenticated;
grant execute on function public.review_license_application(uuid, text, text, uuid) to authenticated;
grant execute on function public.activate_application_license(uuid, text, date, date, text) to authenticated;
