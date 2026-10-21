-- =============================================================================
-- Gallo Negro Licencias — Acceso solo con cuentas asignadas
-- No hay registro público: el administrador crea cada cuenta con un nombre de
-- usuario y una contraseña. Supabase Auth trabaja con correos, así que cada
-- usuario se guarda con un correo interno (usuario@usuarios.gallonegro.local)
-- que nadie ve ni recibe. Estas funciones solo las ejecuta el servidor con la
-- service role (o el SQL Editor de Supabase), nunca un usuario de la app.
-- =============================================================================

alter table public.profiles
  add column username text check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,29}$');
create unique index profiles_username_key on public.profiles (username);

-- Auditoría con el administrador que actúa (la service role no tiene auth.uid()).
create or replace function public.write_audit_as(p_actor uuid, p_action text, p_entity_type text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (p_actor, p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- Completa una cuenta recién creada en Supabase Auth: nombre de usuario, datos
-- de la tienda y rol. Para un licenciado crea su licencia activa (por defecto en
-- el primer plan disponible); el trigger de licencias lo convierte en licenciado.
create or replace function public.provision_account(
  p_user uuid,
  p_username text,
  p_role public.app_role,
  p_full_name text default null,
  p_store_name text default null,
  p_plan_id uuid default null,
  p_actor uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_username text := lower(trim(p_username));
  v_plan uuid := p_plan_id;
begin
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'La cuenta no existe' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profiles where username = v_username and id <> p_user) then
    raise exception 'El nombre de usuario ya está en uso' using errcode = '23505';
  end if;

  update public.profiles
  set username = v_username,
      full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      store_name = coalesce(nullif(trim(p_store_name), ''), store_name)
  where id = p_user;

  if p_role = 'admin' then
    update public.profiles set role = 'admin' where id = p_user;
  elsif p_role = 'licensee' and (public.active_license(p_user)).id is null then
    if v_plan is null then
      select id into v_plan from public.license_plans where status <> 'inactive' order by sort_order limit 1;
    end if;
    if v_plan is null then
      raise exception 'No hay un plan disponible para la licencia' using errcode = 'P0002';
    end if;
    insert into public.licenses (user_id, plan_id, status, starts_at, created_by)
    values (p_user, v_plan, 'active', current_date, p_actor);
  end if;

  perform public.write_audit_as(p_actor, 'account.provisioned', 'profile', p_user::text,
    jsonb_build_object('username', v_username, 'role', p_role, 'plan_id', v_plan));
end;
$$;

revoke execute on function public.write_audit_as(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.provision_account(uuid, text, public.app_role, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.write_audit_as(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.provision_account(uuid, text, public.app_role, text, text, uuid, uuid) to service_role;
