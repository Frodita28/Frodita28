-- =============================================================================
-- Gallo Negro Licencias — Rango con doble candado (XP + ventas verificadas + identidad).
-- Una sola función (rank_state) calcula el rango para canjes y pantallas; su espejo
-- puro está en src/lib/gn.ts (nivelCalculado / nivelMostrado). El rango nunca baja:
-- cada nivel alcanzado queda en rank_achievements (solo inserción).
-- Los GN gastados no afectan XP ni rango.
-- =============================================================================

create table public.identity_requirements (
  code         text primary key check (code ~ '^[A-Z0-9_]{2,40}$'),
  rank_level   integer not null check (rank_level between 1 and 5),
  name         text not null check (char_length(name) between 2 and 120),
  description  text not null default '',
  -- Regla automática (null = la aprueba el administrador).
  auto_rule    text check (auto_rule is null or auto_rule in ('registro_lote')),
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  is_draft     boolean not null default true
);

-- BORRADOR: requisitos de identidad por rango, pendientes de confirmar.
insert into public.identity_requirements (code, rank_level, name, description, auto_rule, sort_order) values
  ('UMBRAL_REGISTRO', 1, 'Registro y Lote inicial', 'Licencia activa y primera entrega de prendas registrada.', 'registro_lote', 1),
  ('VIGIA_ADN', 2, 'Módulo «ADN Gallo Negro»', 'Completar el módulo de identidad de marca.', null, 1),
  ('CENTURION_CALIDAD', 3, 'Certificación de Calidad', 'Aprobar la certificación de calidad de Gallo Negro.', null, 1),
  ('CENTURION_ENTREGAS', 3, '3 reportes de entrega impecables', 'Tres reportes de entrega sin observaciones.', null, 2),
  ('SOBERANO_AUDITORIA', 4, 'Auditoría remota aprobada', 'Auditoría remota de la tienda aprobada.', null, 1);

create type public.identity_status as enum ('aprobado', 'revocado');

create table public.identity_approvals (
  user_id           uuid not null references public.profiles (id) on delete restrict,
  requirement_code  text not null references public.identity_requirements (code) on delete restrict,
  status            public.identity_status not null,
  decided_by        uuid not null references auth.users (id) on delete restrict,
  decided_at        timestamptz not null default now(),
  note              text check (note is null or char_length(note) <= 500),
  primary key (user_id, requirement_code),
  check (decided_by <> user_id)
);

create table public.rank_achievements (
  user_id      uuid not null references public.profiles (id) on delete restrict,
  level        integer not null check (level between 2 and 5),
  achieved_at  timestamptz not null default now(),
  primary key (user_id, level)
);
create trigger rank_achievements_immutable before update or delete on public.rank_achievements
  for each row execute function public.forbid_mutation();

-- Ventas verificadas (PVP oficial) que cuentan para el rango: las liberadas tras la espera
-- o aprobadas en revisión; las anuladas después dejan de contar (el rango ya alcanzado se queda).
create or replace function public.gn_verified_sales_usd(p_user uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(pvp_total), 0) from public.gn_sale_holds where licensee_id = p_user and status = 'liberada';
$$;

create or replace function public.identity_requirement_met(p_user uuid, p_code text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  r public.identity_requirements;
begin
  select * into r from public.identity_requirements where code = p_code;
  if not found or not r.is_active then
    return true;
  end if;
  if exists (select 1 from public.identity_approvals a where a.user_id = p_user and a.requirement_code = p_code and a.status = 'aprobado') then
    return true;
  end if;
  if r.auto_rule = 'registro_lote' then
    return (public.active_license(p_user)).id is not null
       and exists (select 1 from public.store_stock_movements m where m.licensee_id = p_user and m.kind = 'delivery');
  end if;
  return false;
end;
$$;

-- Estado del rango. Registra los niveles nuevos alcanzados y avisa la subida.
create or replace function public.rank_state(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_xp bigint;
  v_sales numeric;
  v_rangos jsonb := coalesce(public.gn_cfg('rangos'), '[]'::jsonb);
  r jsonb;
  v_level integer := 1;
  v_stored integer;
  v_shown integer;
  v_reqs jsonb;
  v_ok boolean;
begin
  select coalesce(sum(amount), 0) into v_xp from public.xp_ledger where user_id = p_user;
  v_sales := public.gn_verified_sales_usd(p_user);

  for r in select value from jsonb_array_elements(v_rangos) order by (value ->> 'nivel')::integer loop
    continue when (r ->> 'nivel')::integer <= 1;
    v_ok := v_xp >= (r ->> 'xp')::numeric and v_sales >= (r ->> 'ventas')::numeric
      and not exists (select 1 from public.identity_requirements q
                      where q.rank_level = (r ->> 'nivel')::integer and q.is_active
                        and not public.identity_requirement_met(p_user, q.code));
    exit when not v_ok;
    v_level := (r ->> 'nivel')::integer;
  end loop;

  select coalesce(max(level), 1) into v_stored from public.rank_achievements where user_id = p_user;
  if v_level > v_stored then
    insert into public.rank_achievements (user_id, level)
    select p_user, g from generate_series(v_stored + 1, v_level) g
    on conflict do nothing;
    perform public.gn_notify(p_user, 'subida_rango', 'Subiste de rango',
      'Ya tienes acceso a los premios y beneficios de tu nuevo rango.', '/panel/recompensas',
      'subida_rango:' || p_user || ':' || v_level);
  end if;
  v_shown := greatest(v_level, v_stored);

  select coalesce(jsonb_agg(jsonb_build_object('code', q.code, 'level', q.rank_level, 'name', q.name,
           'description', q.description, 'auto', q.auto_rule is not null,
           'met', public.identity_requirement_met(p_user, q.code)) order by q.rank_level, q.sort_order), '[]'::jsonb)
    into v_reqs
  from public.identity_requirements q where q.is_active;

  return jsonb_build_object('level', v_shown, 'computed_level', v_level, 'achieved_level', greatest(v_stored, v_level),
                            'xp', v_xp, 'sales_usd', v_sales, 'requirements', v_reqs, 'rangos', v_rangos);
end;
$$;

create or replace function public.my_rank_state()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;
  perform public.gn_settle(auth.uid());
  return public.rank_state(auth.uid());
end;
$$;

create or replace function public.admin_rank_state(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador' using errcode = '42501';
  end if;
  return public.rank_state(p_user);
end;
$$;

-- Aprobar o revocar un requisito de identidad (solo administrador, auditado).
create or replace function public.admin_set_identity(p_user uuid, p_code text, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede aprobar requisitos' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'No puedes aprobar tus propios requisitos' using errcode = '42501';
  end if;
  if not exists (select 1 from public.identity_requirements where code = p_code) then
    raise exception 'Requisito desconocido' using errcode = 'P0002';
  end if;
  if not p_approve and coalesce(trim(p_note), '') = '' then
    raise exception 'Indica el motivo' using errcode = '22023';
  end if;
  insert into public.identity_approvals (user_id, requirement_code, status, decided_by, note)
  values (p_user, p_code, case when p_approve then 'aprobado'::public.identity_status else 'revocado'::public.identity_status end,
          auth.uid(), nullif(trim(p_note), ''))
  on conflict (user_id, requirement_code) do update
  set status = excluded.status, decided_by = excluded.decided_by, decided_at = now(), note = excluded.note;
  perform public.write_audit(case when p_approve then 'identity.approved' else 'identity.revoked' end, 'profile', p_user::text,
    jsonb_build_object('requirement', p_code, 'note', p_note));
  perform public.rank_state(p_user);
end;
$$;

alter table public.identity_requirements enable row level security;
alter table public.identity_approvals enable row level security;
alter table public.rank_achievements enable row level security;
create policy identity_requirements_select on public.identity_requirements for select to authenticated using (true);
create policy identity_approvals_select on public.identity_approvals for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy rank_achievements_select on public.rank_achievements for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete, truncate on public.identity_requirements, public.identity_approvals, public.rank_achievements from anon, authenticated;
revoke all on public.identity_requirements, public.identity_approvals, public.rank_achievements from anon;

revoke execute on function public.gn_verified_sales_usd(uuid) from public, anon, authenticated;
revoke execute on function public.identity_requirement_met(uuid, text) from public, anon, authenticated;
revoke execute on function public.rank_state(uuid) from public, anon, authenticated;
revoke execute on function public.my_rank_state() from public, anon;
revoke execute on function public.admin_rank_state(uuid) from public, anon;
revoke execute on function public.admin_set_identity(uuid, text, boolean, text) from public, anon;
grant execute on function public.my_rank_state() to authenticated;
grant execute on function public.admin_rank_state(uuid) to authenticated;
grant execute on function public.admin_set_identity(uuid, text, boolean, text) to authenticated;
