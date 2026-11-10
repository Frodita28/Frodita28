-- =============================================================================
-- Gallo Negro Licencias — Panel Admin de Recompensas y Tienda Clan (Fase 3):
-- catálogo y ediciones, cola de canjes, validación de misiones (en revisión,
-- requiere corrección, límite semanal y duplicados) y resumen de costos.
-- Todo exige el rol admin en el servidor y queda en audit_log.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Catálogo
-- -----------------------------------------------------------------------------
create or replace function public.clan_admin_save_product(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_before jsonb;
  v_tier public.clan_tier := (p ->> 'tier')::public.clan_tier;
  v_photos text[];
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador gestiona el catálogo' using errcode = '42501';
  end if;
  select coalesce(array_agg(x), '{}') into v_photos
  from jsonb_array_elements_text(coalesce(p -> 'photos', '[]'::jsonb)) x
  where x ~ '^(https://|/)\S+$' and char_length(x) <= 500;

  if v_id is null then
    insert into public.clan_products (name, description, photos, tier, min_rank, price_gn, stock, limit_per_user, is_permanent,
      available_from, available_until, status, kind, supplier, lead_days, needs_address, edition_id, created_by)
    values (trim(p ->> 'name'), coalesce(trim(p ->> 'description'), ''), v_photos, v_tier,
      coalesce(nullif(p ->> 'min_rank', '')::integer, public.clan_tier_level(v_tier)), (p ->> 'price_gn')::integer,
      nullif(p ->> 'stock', '')::integer, nullif(p ->> 'limit_per_user', '')::integer, coalesce((p ->> 'is_permanent')::boolean, false),
      nullif(p ->> 'available_from', '')::timestamptz, nullif(p ->> 'available_until', '')::timestamptz,
      coalesce(nullif(p ->> 'status', ''), 'borrador')::public.clan_product_status,
      coalesce(nullif(p ->> 'kind', ''), 'fisico')::public.clan_product_kind, nullif(trim(p ->> 'supplier'), ''),
      nullif(p ->> 'lead_days', '')::integer, coalesce((p ->> 'needs_address')::boolean, true),
      nullif(p ->> 'edition_id', '')::uuid, auth.uid())
    returning id into v_id;
  else
    select to_jsonb(x) into v_before from public.clan_products x where id = v_id for update;
    if v_before is null then
      raise exception 'Producto no encontrado' using errcode = 'P0002';
    end if;
    update public.clan_products set
      name = trim(p ->> 'name'), description = coalesce(trim(p ->> 'description'), ''), photos = v_photos, tier = v_tier,
      min_rank = coalesce(nullif(p ->> 'min_rank', '')::integer, public.clan_tier_level(v_tier)),
      price_gn = (p ->> 'price_gn')::integer, stock = nullif(p ->> 'stock', '')::integer,
      limit_per_user = nullif(p ->> 'limit_per_user', '')::integer, is_permanent = coalesce((p ->> 'is_permanent')::boolean, false),
      available_from = nullif(p ->> 'available_from', '')::timestamptz, available_until = nullif(p ->> 'available_until', '')::timestamptz,
      status = coalesce(nullif(p ->> 'status', ''), 'borrador')::public.clan_product_status,
      kind = coalesce(nullif(p ->> 'kind', ''), 'fisico')::public.clan_product_kind, supplier = nullif(trim(p ->> 'supplier'), ''),
      lead_days = nullif(p ->> 'lead_days', '')::integer, needs_address = coalesce((p ->> 'needs_address')::boolean, true),
      edition_id = nullif(p ->> 'edition_id', '')::uuid
    where id = v_id;
  end if;

  if nullif(p ->> 'cost_usd', '') is not null then
    insert into public.clan_product_costs (product_id, cost_usd) values (v_id, (p ->> 'cost_usd')::numeric)
    on conflict (product_id) do update set cost_usd = excluded.cost_usd;
  end if;

  perform public.write_audit(case when v_before is null then 'clan.product_created' else 'clan.product_updated' end,
    'clan_product', v_id::text, jsonb_build_object('before', v_before, 'after', p));
  return v_id;
end;
$$;

-- Duplicar un premio a otra edición (queda en borrador).
create or replace function public.clan_admin_duplicate_product(p_product uuid, p_edition uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador gestiona el catálogo' using errcode = '42501';
  end if;
  insert into public.clan_products (name, description, photos, tier, min_rank, price_gn, stock, limit_per_user, is_permanent,
    available_from, available_until, status, kind, supplier, lead_days, needs_address, edition_id, is_demo, created_by)
  select name, description, photos, tier, min_rank, price_gn, stock, limit_per_user, is_permanent,
    null, null, 'borrador', kind, supplier, lead_days, needs_address, coalesce(p_edition, edition_id), is_demo, auth.uid()
  from public.clan_products where id = p_product
  returning id into v_id;
  if v_id is null then
    raise exception 'Producto no encontrado' using errcode = 'P0002';
  end if;
  insert into public.clan_product_costs (product_id, cost_usd)
  select v_id, cost_usd from public.clan_product_costs where product_id = p_product;
  perform public.write_audit('clan.product_duplicated', 'clan_product', v_id::text,
    jsonb_build_object('from', p_product, 'edition_id', p_edition));
  return v_id;
end;
$$;

-- Crear o actualizar la edición de un mes. Al publicarla se avisa a los licenciatarios.
create or replace function public.clan_admin_save_edition(p_month date, p_title text, p_status public.clan_edition_status, p_publish_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_old public.clan_edition_status;
  v_month date := date_trunc('month', p_month)::date;
  v_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador gestiona las ediciones' using errcode = '42501';
  end if;
  select status into v_old from public.clan_editions where month = v_month;
  insert into public.clan_editions (month, title, status, publish_at, created_by)
  values (v_month, coalesce(trim(p_title), ''), p_status, p_publish_at, auth.uid())
  on conflict (month) do update set title = excluded.title, status = excluded.status, publish_at = excluded.publish_at
  returning id into v_id;
  perform public.write_audit('clan.edition_saved', 'clan_edition', v_id::text,
    jsonb_build_object('month', v_month, 'from', v_old, 'to', p_status, 'publish_at', p_publish_at));
  if p_status = 'publicado' and v_old is distinct from 'publicado' then
    for v_user in select l.user_id from public.licenses l where l.status = 'active' loop
      continue when not public.gn_v3_enabled(v_user);
      perform public.gn_notify(v_user, 'nueva_edicion', 'Nuevos premios en Tienda Clan',
        'Ya está la edición de ' || to_char(v_month, 'TMMonth') || '.', '/panel/tienda-clan', 'edicion:' || v_id || ':' || v_user);
    end loop;
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cola de canjes
-- -----------------------------------------------------------------------------
create or replace function public.clan_admin_set_status(
  p_redemption uuid, p_status public.clan_redemption_status, p_note text default null, p_substitute text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.clan_redemptions;
  v_allowed public.clan_redemption_status[];
  v_title text;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador gestiona los canjes' using errcode = '42501';
  end if;
  select * into r from public.clan_redemptions where id = p_redemption for update;
  if not found then
    raise exception 'Canje no encontrado' using errcode = 'P0002';
  end if;
  if r.user_id = auth.uid() then
    raise exception 'No puedes gestionar tus propios canjes' using errcode = '42501';
  end if;
  v_allowed := case r.status
    when 'solicitado' then array['aprobado', 'rechazado']::public.clan_redemption_status[]
    when 'aprobado' then array['en_preparacion', 'sustituido', 'enviado', 'rechazado', 'cancelado']::public.clan_redemption_status[]
    when 'sustituido' then array['en_preparacion', 'enviado', 'cancelado']::public.clan_redemption_status[]
    when 'en_preparacion' then array['sustituido', 'enviado', 'rechazado', 'cancelado']::public.clan_redemption_status[]
    when 'enviado' then array['entregado']::public.clan_redemption_status[]
    else array[]::public.clan_redemption_status[]
  end;
  if not (p_status = any (v_allowed)) then
    raise exception 'No se puede pasar de % a %', r.status, p_status using errcode = '22023';
  end if;
  if p_status in ('rechazado', 'cancelado') and coalesce(trim(p_note), '') = '' then
    raise exception 'Indica el motivo' using errcode = '22023';
  end if;
  if p_status = 'sustituido' and coalesce(trim(p_substitute), '') = '' then
    raise exception 'Indica por qué premio se sustituye' using errcode = '22023';
  end if;

  update public.clan_redemptions
  set status = p_status, admin_note = coalesce(nullif(trim(p_note), ''), admin_note),
      substitute_note = case when p_status = 'sustituido' then trim(p_substitute) else substitute_note end,
      delivered_at = case when p_status = 'entregado' then now() else delivered_at end
  where id = r.id;
  perform public.clan_log(r.id, r.status, p_status, coalesce(nullif(trim(p_substitute), ''), p_note));

  if p_status in ('rechazado', 'cancelado') then
    perform public.clan_release_hold(r.id, p_note);
  elsif p_status = 'entregado' then
    perform public.clan_confirm_hold(r.id);
  end if;

  v_title := case p_status
    when 'aprobado' then 'Tu canje fue aprobado'
    when 'en_preparacion' then 'Estamos preparando tu premio'
    when 'sustituido' then 'Tu premio fue sustituido'
    when 'enviado' then 'Tu premio va en camino'
    when 'entregado' then 'Premio entregado'
    when 'rechazado' then 'Tu canje fue rechazado: te devolvimos los GN'
    else 'Tu canje fue cancelado: te devolvimos los GN' end;
  perform public.gn_notify(r.user_id, 'canje_estado', v_title, r.product_name, '/panel/tienda-clan?seccion=canjes',
    'canje:' || r.id || ':' || p_status);
  perform public.write_audit('clan.redemption_' || p_status, 'clan_redemption', r.id::text,
    jsonb_build_object('user_id', r.user_id, 'from', r.status, 'to', p_status, 'note', p_note, 'substitute', p_substitute));
end;
$$;

-- -----------------------------------------------------------------------------
-- Validación de misiones: estados extra sin cambiar el flujo existente
--   enviado          = evidencia pending sin revisión iniciada
--   en revisión      = pending con review_started_at
--   requiere corrección = rejected con needs_changes
-- -----------------------------------------------------------------------------
alter table public.mission_evidences add column review_started_at timestamptz;
alter table public.mission_evidences add column review_started_by uuid references auth.users (id) on delete set null;
alter table public.mission_evidences add column needs_changes boolean not null default false;

create table public.mission_validation_rules (
  category      text primary key check (char_length(category) between 2 and 40),
  criteria      text not null default '' check (char_length(criteria) <= 2000),
  -- BORRADOR: evidencias por semana y tipo; null = el valor general de gn_config.
  weekly_limit  integer check (weekly_limit is null or weekly_limit between 1 and 100),
  sla_hours     integer check (sla_hours is null or sla_hours between 1 and 720),
  updated_by    uuid references auth.users (id) on delete set null,
  updated_at    timestamptz not null default now()
);
insert into public.mission_validation_rules (category, criteria)
select distinct category, '' from public.missions where validation_method = 'manual'
on conflict do nothing;

create or replace function public.evidence_rules_check()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category text;
  v_limit integer;
  v_count integer;
begin
  select category into v_category from public.missions where id = new.mission_id;
  select coalesce(r.weekly_limit, public.gn_num('validacion_limite_semanal', 10)::integer) into v_limit
  from (select 1) x left join public.mission_validation_rules r on r.category = v_category;
  select count(*) into v_count from public.mission_evidences e join public.missions m on m.id = e.mission_id
  where e.user_id = new.user_id and m.category = v_category and e.status <> 'rejected'
    and e.submitted_at > now() - interval '7 days';
  if v_count >= v_limit then
    raise exception 'Llegaste al límite semanal de evidencias de %', v_category using errcode = '22023';
  end if;
  -- La misma evidencia en otra misión o de otra tienda: solo se marca.
  if exists (select 1 from public.mission_evidences e
             where e.evidence_key = new.evidence_key and e.status <> 'rejected'
               and (e.user_id <> new.user_id or e.mission_id <> new.mission_id)) then
    insert into public.fraud_flags (user_id, kind, entity_type, entity_id, details)
    values (new.user_id, 'duplicate_evidence_cross', 'mission', new.mission_id::text,
            jsonb_build_object('evidence_key', new.evidence_key));
  end if;
  return new;
end;
$$;
create trigger mission_evidences_rules before insert on public.mission_evidences
  for each row execute function public.evidence_rules_check();

create or replace function public.admin_start_evidence_review(p_evidence uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador revisa evidencias' using errcode = '42501';
  end if;
  update public.mission_evidences set review_started_at = now(), review_started_by = auth.uid()
  where id = p_evidence and status = 'pending' and review_started_at is null;
  perform public.write_audit('evidence.review_started', 'mission_evidence', p_evidence::text, '{}'::jsonb);
end;
$$;

-- Decisión: aprobar (acredita XP y GN con el flujo existente), rechazar o pedir corrección.
create or replace function public.admin_decide_evidence(p_evidence uuid, p_decision text, p_reason text default null)
returns public.participation_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.participation_status;
  e public.mission_evidences;
begin
  if p_decision not in ('aprobar', 'rechazar', 'corregir') then
    raise exception 'Decisión no válida' using errcode = '22023';
  end if;
  v_status := public.review_mission_evidence(p_evidence, p_decision = 'aprobar', p_reason);
  if p_decision = 'corregir' then
    update public.mission_evidences set needs_changes = true where id = p_evidence;
  end if;
  select * into e from public.mission_evidences where id = p_evidence;
  if p_decision <> 'aprobar' then
    perform public.gn_notify(e.user_id, 'validacion', case when p_decision = 'corregir' then 'Tu evidencia requiere corrección' else 'Tu evidencia fue rechazada' end,
      coalesce(p_reason, ''), '/panel/misiones?tab=rejected', 'evidencia:' || p_evidence);
  end if;
  return v_status;
end;
$$;

create or replace function public.admin_save_validation_rule(p_category text, p_criteria text, p_weekly_limit integer, p_sla_hours integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador' using errcode = '42501';
  end if;
  insert into public.mission_validation_rules (category, criteria, weekly_limit, sla_hours, updated_by)
  values (trim(p_category), coalesce(p_criteria, ''), p_weekly_limit, p_sla_hours, auth.uid())
  on conflict (category) do update set criteria = excluded.criteria, weekly_limit = excluded.weekly_limit,
    sla_hours = excluded.sla_hours, updated_by = excluded.updated_by, updated_at = now();
  perform public.write_audit('validation_rule.saved', 'mission_validation_rule', p_category,
    jsonb_build_object('weekly_limit', p_weekly_limit, 'sla_hours', p_sla_hours));
end;
$$;

-- -----------------------------------------------------------------------------
-- Resumen y control de costo del mes
-- -----------------------------------------------------------------------------
create or replace function public.admin_gn_dashboard(p_month date default (now() at time zone 'America/Caracas')::date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_from timestamptz := (date_trunc('month', p_month::timestamp)) at time zone 'America/Caracas';
  v_to timestamptz := (date_trunc('month', p_month::timestamp) + interval '1 month') at time zone 'America/Caracas';
  v_emitted bigint;
  v_redeemed bigint;
  v_expired bigint;
  v_pending bigint;
  v_cost_delivered numeric;
  v_sales numeric;
  v_garments bigint;
  v_target numeric := public.gn_num('costo_objetivo_pct', 6);
  v_base numeric := public.gn_num('precio_base_licenciado_usd', 25);
  v_prod numeric := public.gn_num('costo_produccion_usd', 15);
  v_pct numeric;
  v_alerts jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador' using errcode = '42501';
  end if;
  select coalesce(sum(case when kind in ('venta_pendiente', 'mision_pendiente') then d_pending
                           when kind in ('mision_disponible', 'ajuste_admin') and d_pending = 0 and d_available + (-d_debt) > 0 then d_available - d_debt
                           else 0 end), 0)
    into v_emitted from public.gn_ledger where created_at >= v_from and created_at < v_to;
  select coalesce(sum(-d_held), 0) into v_redeemed from public.gn_ledger where kind = 'canje_confirmado' and created_at >= v_from and created_at < v_to;
  select coalesce(sum(-d_available), 0) into v_expired from public.gn_ledger where kind = 'vencimiento' and created_at >= v_from and created_at < v_to;
  select coalesce(sum(pending), 0) into v_pending from public.gn_accounts;
  select coalesce(sum(c.cost_usd), 0) into v_cost_delivered
  from public.clan_redemptions r join public.clan_redemption_costs c on c.redemption_id = r.id
  where r.status = 'entregado' and r.delivered_at >= v_from and r.delivered_at < v_to;
  select coalesce(sum(pvp_total), 0), coalesce(sum(garments), 0) into v_sales, v_garments
  from public.gn_sale_holds where status = 'liberada' and released_at >= v_from and released_at < v_to;
  v_pct := case when v_sales > 0 then round(v_cost_delivered / v_sales * 100, 2) else 0 end;
  if v_pct > v_target then
    v_alerts := v_alerts || jsonb_build_object('kind', 'costo', 'text', format('El costo de premios (%s%%) supera el objetivo (%s%%)', v_pct, v_target));
  end if;
  if public.clan_paused() then
    v_alerts := v_alerts || jsonb_build_object('kind', 'tope', 'text', 'Se alcanzó el tope mensual de costo: el catálogo está en pausa');
  end if;
  return jsonb_build_object(
    'month', date_trunc('month', p_month::timestamp)::date,
    'gn_emitted', v_emitted, 'gn_redeemed', v_redeemed, 'gn_expired', v_expired, 'gn_pending', v_pending,
    'gn_available', (select coalesce(sum(available), 0) from public.gn_accounts),
    'gn_debt', (select coalesce(sum(debt), 0) from public.gn_accounts),
    'cost_delivered_usd', v_cost_delivered, 'cost_month_usd', public.clan_month_cost_usd(p_month),
    'cap_usd', public.gn_cfg('tope_mensual_canjes_usd'), 'paused', public.clan_paused(),
    'verified_sales_usd', v_sales, 'garments', v_garments, 'cost_pct', v_pct, 'target_pct', v_target,
    'cost_per_garment_usd', case when v_garments > 0 then round(v_cost_delivered / v_garments, 2) else 0 end,
    'profit_before_usd', v_base - v_prod,
    'profit_after_usd', v_base - v_prod - case when v_garments > 0 then v_cost_delivered / v_garments else 0 end,
    'gn_internal_usd', public.gn_num('gn_valor_interno_usd', 0.18),
    'pending_redemptions', (select count(*) from public.clan_redemptions where status in ('solicitado', 'aprobado', 'en_preparacion', 'sustituido')),
    'pending_validations', (select count(*) from public.mission_evidences where status = 'pending'),
    'sales_in_review', (select count(*) from public.gn_sale_holds where status = 'en_revision'),
    'alerts', v_alerts);
end;
$$;

alter table public.mission_validation_rules enable row level security;
create policy mission_validation_rules_select on public.mission_validation_rules for select to authenticated using (true);
revoke insert, update, delete, truncate on public.mission_validation_rules from anon, authenticated;
revoke all on public.mission_validation_rules from anon;

revoke execute on function public.evidence_rules_check() from public, anon, authenticated;
revoke execute on function public.clan_admin_save_product(jsonb) from public, anon;
revoke execute on function public.clan_admin_duplicate_product(uuid, uuid) from public, anon;
revoke execute on function public.clan_admin_save_edition(date, text, public.clan_edition_status, timestamptz) from public, anon;
revoke execute on function public.clan_admin_set_status(uuid, public.clan_redemption_status, text, text) from public, anon;
revoke execute on function public.admin_start_evidence_review(uuid) from public, anon;
revoke execute on function public.admin_decide_evidence(uuid, text, text) from public, anon;
revoke execute on function public.admin_save_validation_rule(text, text, integer, integer) from public, anon;
revoke execute on function public.admin_gn_dashboard(date) from public, anon;
grant execute on function public.clan_admin_save_product(jsonb) to authenticated;
grant execute on function public.clan_admin_duplicate_product(uuid, uuid) to authenticated;
grant execute on function public.clan_admin_save_edition(date, text, public.clan_edition_status, timestamptz) to authenticated;
grant execute on function public.clan_admin_set_status(uuid, public.clan_redemption_status, text, text) to authenticated;
grant execute on function public.admin_start_evidence_review(uuid) to authenticated;
grant execute on function public.admin_decide_evidence(uuid, text, text) to authenticated;
grant execute on function public.admin_save_validation_rule(text, text, integer, integer) to authenticated;
grant execute on function public.admin_gn_dashboard(date) to authenticated;

-- Tarea diaria con pg_cron (si la extensión está disponible): liquida esperas, vencimientos y avisos.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'gn_daily_maintenance';
    -- 04:10 UTC = 00:10 en Caracas.
    perform cron.schedule('gn_daily_maintenance', '10 4 * * *', 'select public.gn_daily_maintenance()');
  else
    raise notice 'pg_cron no está instalado: la tarea diaria de GN no se programó';
  end if;
end;
$$;

-- Fotos de los premios: bucket público de solo lectura; solo el administrador sube archivos.
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    raise notice 'Esquema storage no disponible: se omite el bucket de fotos de premios';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('clan', 'clan', true, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
  execute $p$
    create policy clan_photos_admin_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'clan' and public.is_admin())
  $p$;
end;
$$;
