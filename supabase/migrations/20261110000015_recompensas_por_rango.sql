-- Gallo Negro definió las recompensas de Vigía, Centurión, Soberano y AYAM CEMANI (2026-11-10).
--
--  * Beneficios que se activan solos al desbloquear el rango → gn_config.beneficios_rango
--    (se conserva el marco del avatar de cada rango; en Recompensas se acumulan los de rangos anteriores).
--  * Premios que se canjean con GN → clan_products permanentes del rango.
--    Precio en GN SUGERIDO (pendiente de confirmar): el 6 % de las ventas que pide el rango, a $0,18 por GN
--    (Vigía $1.500 → 500 GN, Centurión $4.500 → 1.500 GN, Soberano $12.000 → 4.000 GN, AYAM CEMANI $30.000 → 10.000 GN).
--    El Viaje usa la cifra ya confirmada (22.000 GN, costo $3.960). Sin costo real cargado en los demás.

update public.gn_config set value = $json${
  "1": ["Marco simple en el avatar"],
  "2": ["Marco amarillo en el avatar",
        "Acceso Anticipado: ver nuevas colecciones 48 horas antes del lanzamiento.",
        "Insignia Vigía: distintivo digital exclusivo para tu perfil y publicaciones."],
  "3": ["Marco doble con rojo en el avatar",
        "Acceso a Colecciones Limitadas: reserva unidades antes de su lanzamiento público."],
  "4": ["Marco con brasas en el avatar",
        "Experiencia VIP: invitación preferencial a eventos oficiales de Gallo Negro.",
        "Colección Soberana: acceso a prendas de edición limitada exclusivas de este rango.",
        "Premio al Liderazgo: reconocimiento como referente regional dentro de la comunidad de licenciatarios."],
  "5": ["Marco dorado en el avatar",
        "Reconocimiento Leyenda: placa física personalizada y reconocimiento permanente en el Mando Central.",
        "Experiencia Privada: invitación a una reunión o evento exclusivo con el equipo directivo de Gallo Negro para conocer antes proyectos y colecciones."]
}$json$::jsonb, is_draft = false
where key = 'beneficios_rango';

insert into public.clan_products (name, description, tier, min_rank, price_gn, limit_per_user, is_permanent, status, kind, needs_address)
select v.name, v.description, v.tier::public.clan_tier, v.min_rank, v.price_gn, v.limit_per_user, true, 'activo', v.kind::public.clan_product_kind, v.needs_address
from (values
  ('Kit de Identidad', 'Stickers, pines y material gráfico oficial Gallo Negro.', 'medio', 2, 500, null::integer, 'fisico', true),
  ('Prenda de Cortesía', 'Una franela exclusiva de la marca.', 'medio', 2, 500, null, 'fisico', true),
  ('Pack de Contenido', 'Fotografías y videos profesionales de productos para tus redes sociales.', 'medio', 2, 500, null, 'digital', false),
  ('Kit Comercial Premium', 'Exhibidor, material publicitario y prendas de muestra.', 'alto', 3, 1500, null, 'fisico', true),
  ('Prenda Edición Especial', 'Hoodie o buzo exclusivo para Centuriones.', 'alto', 3, 1500, null, 'fisico', true),
  ('Publicidad Patrocinada', 'Apoyo de Gallo Negro para promocionar tu punto de venta.', 'alto', 3, 1500, null, 'experiencia', false),
  ('Cofre Soberano', 'Paquete de prendas, accesorios y artículos exclusivos.', 'premium', 4, 4000, null, 'fisico', true),
  ('Campaña Publicitaria Personalizada', 'Producción de contenido para promocionar tu negocio.', 'premium', 4, 4000, null, 'experiencia', false),
  ('Cofre AYAM CEMANI', 'Colección exclusiva de prendas, accesorios y artículos premium que no se venden al público.', 'elite', 5, 10000, null, 'fisico', true),
  ('Viaje Élite Gallo Negro', 'Experiencia anual para ti y un acompañante, con alojamiento y accesos VIP. Sujeta a cupos y presupuesto.', 'elite', 5, 22000, 1, 'experiencia', false),
  ('Campaña de Marca Personal', 'Sesión fotográfica y audiovisual profesional para posicionarte como referente de la marca.', 'elite', 5, 10000, null, 'experiencia', false)
) as v(name, description, tier, min_rank, price_gn, limit_per_user, kind, needs_address)
where not exists (select 1 from public.clan_products p where p.name = v.name and not p.is_demo);

insert into public.clan_product_costs (product_id, cost_usd)
select id, 3960 from public.clan_products where name = 'Viaje Élite Gallo Negro' and not is_demo
on conflict (product_id) do nothing;

-- El viaje de demostración queda reemplazado por el real.
update public.clan_products set status = 'archivado' where is_demo and name = '[DEMO] Viaje';
