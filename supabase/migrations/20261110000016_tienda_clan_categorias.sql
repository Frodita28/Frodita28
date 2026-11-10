-- Tienda Clan: categorías del catálogo y los 20 productos iniciales que definió Gallo Negro (2026-11-10).
--
--  * Cuatro categorías: Accesorios, Vestimenta exclusiva, Herramientas comerciales y Exclusivos del Clan.
--  * Los 20 productos se canjean solo con GN, desde el rango de entrada, sin límite de unidades
--    (el admin carga fotos, existencias y cambia precios en Admin › Recompensas GN › Catálogo).
--  * Las descripciones son un texto inicial para editar. Las reglas de GN y de canje no cambian.

create type public.clan_category as enum ('accesorios', 'vestimenta', 'herramientas', 'exclusivos');
alter table public.clan_products add column category public.clan_category not null default 'exclusivos';

-- Categoría al guardar un premio desde el panel (admin, con auditoría).
create or replace function public.clan_admin_set_product_category(p_product uuid, p_category public.clan_category)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.clan_category;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador gestiona el catálogo' using errcode = '42501';
  end if;
  select category into v_before from public.clan_products where id = p_product for update;
  if not found then
    raise exception 'Producto no encontrado' using errcode = 'P0002';
  end if;
  if v_before is distinct from p_category then
    update public.clan_products set category = p_category where id = p_product;
    perform public.write_audit('clan.product_category', 'clan_product', p_product::text,
      jsonb_build_object('before', v_before, 'after', p_category));
  end if;
end;
$$;
revoke execute on function public.clan_admin_set_product_category(uuid, public.clan_category) from public, anon;
grant execute on function public.clan_admin_set_product_category(uuid, public.clan_category) to authenticated;

-- Premios por rango (000015) en su categoría.
update public.clan_products set category = 'accesorios' where not is_demo and name in ('Kit de Identidad');
update public.clan_products set category = 'vestimenta' where not is_demo and name in ('Prenda de Cortesía', 'Prenda Edición Especial');
update public.clan_products set category = 'herramientas'
where not is_demo and name in ('Pack de Contenido', 'Kit Comercial Premium', 'Publicidad Patrocinada', 'Campaña Publicitaria Personalizada');
update public.clan_products set category = 'accesorios' where is_demo and name = '[DEMO] Gorra';

insert into public.clan_products (name, description, category, tier, min_rank, price_gn, is_permanent, status, kind, needs_address)
select v.name, v.description, v.category::public.clan_category, 'calle', 1, v.price_gn, true, 'activo', v.kind::public.clan_product_kind, v.needs_address
from (values
  ('Pack de Stickers Gallo Negro', 'Stickers oficiales Gallo Negro.', 'accesorios', 30, 'fisico', true),
  ('Pin Metálico Gallo Negro', 'Pin metálico con el emblema Gallo Negro.', 'accesorios', 50, 'fisico', true),
  ('Parche Bordado Clan', 'Parche bordado del Clan.', 'accesorios', 65, 'fisico', true),
  ('Llavero Oficial', 'Llavero oficial Gallo Negro.', 'accesorios', 75, 'fisico', true),
  ('Gorra Clan Edition', 'Gorra edición Clan.', 'accesorios', 185, 'fisico', true),
  ('Franela Clan', 'Franela exclusiva del Clan.', 'vestimenta', 145, 'fisico', true),
  ('Franela Edición Limitada', 'Franela de edición limitada.', 'vestimenta', 200, 'fisico', true),
  ('Buzo Clan', 'Buzo exclusivo del Clan.', 'vestimenta', 250, 'fisico', true),
  ('Hoodie Clan', 'Hoodie exclusivo del Clan.', 'vestimenta', 385, 'fisico', true),
  ('Short Deportivo Clan', 'Short deportivo del Clan.', 'vestimenta', 370, 'fisico', true),
  ('Kit de Empaque Premium', 'Empaques premium Gallo Negro para entregar tus ventas.', 'herramientas', 120, 'fisico', true),
  ('Pack de Exhibición', 'Material para exhibir las prendas en tu punto de venta.', 'herramientas', 180, 'fisico', true),
  ('Mini Exhibidor Oficial', 'Exhibidor oficial de tamaño compacto.', 'herramientas', 250, 'fisico', true),
  ('Sesión de Fotos de Productos', 'Sesión de fotos profesional de tus productos.', 'herramientas', 350, 'experiencia', false),
  ('Pack de Contenido Comercial', 'Fotos y videos de producto listos para tus redes.', 'herramientas', 400, 'digital', false),
  ('Caja Misteriosa del Clan', 'Caja sorpresa con artículos del Clan.', 'exclusivos', 500, 'fisico', true),
  ('Chaqueta Edición Especial', 'Chaqueta de edición especial.', 'exclusivos', 650, 'fisico', true),
  ('Campaña Personalizada', 'Campaña de contenido para promocionar tu punto de venta.', 'exclusivos', 800, 'experiencia', false),
  ('Trofeo del Clan', 'Trofeo oficial del Clan.', 'exclusivos', 1000, 'fisico', true),
  ('Experiencia VIP Gallo Negro', 'Experiencia VIP con Gallo Negro. Sujeta a cupos.', 'exclusivos', 1500, 'experiencia', false)
) as v(name, description, category, price_gn, kind, needs_address)
where not exists (select 1 from public.clan_products p where p.name = v.name and not p.is_demo);
