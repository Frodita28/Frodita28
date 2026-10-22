-- =============================================================================
-- Gallo Negro Licencias — Tabla de clasificación entre tiendas.
-- Solo expone el nombre visible (public_alias) y los XP totales de cada tienda
-- con licencia activa: ni ventas, ni ingresos, ni datos personales de otras tiendas.
-- =============================================================================

create or replace function public.store_leaderboard(p_limit integer default 50)
returns table (
  place      bigint,
  alias      text,
  total_xp   bigint,
  is_me      boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with ranked as (
    select p.id,
           p.public_alias,
           coalesce(b.total_xp, 0)::bigint as total_xp,
           rank() over (order by coalesce(b.total_xp, 0) desc) as place
    from public.profiles p
    left join (select user_id, sum(amount) as total_xp from public.xp_ledger group by user_id) b on b.user_id = p.id
    where p.role = 'licensee'
      and exists (select 1 from public.licenses l where l.user_id = p.id and l.status = 'active')
  )
  select r.place,
         -- Sin alias, la tienda aparece anónima: el nombre visible es lo único que se comparte.
         coalesce(r.public_alias, 'Tienda Gallo Negro') as alias,
         r.total_xp,
         r.id = auth.uid() as is_me
  from ranked r
  where auth.uid() is not null
    and (r.place <= least(greatest(coalesce(p_limit, 50), 1), 200) or r.id = auth.uid())
  order by r.place, r.public_alias nulls last;
$$;

revoke execute on function public.store_leaderboard(integer) from public, anon;
grant execute on function public.store_leaderboard(integer) to authenticated;
