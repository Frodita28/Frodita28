-- =============================================================================
-- Datos iniciales. Todo lo comercial (planes, productos) es DEMOSTRACIÓN y está
-- marcado como tal: nombres provisionales, sin precios ni condiciones inventadas.
-- Las misiones, sus XP y objetivos provienen de la especificación v1.1.
-- =============================================================================

-- Planes provisionales (spec maestra §3.2): sin precio hasta su confirmación.
insert into public.license_plans (code, name, description, status, is_demo, sort_order) values
  ('PLAN_1', 'Plan 1', 'Plan provisional. Nombre, precio y condiciones pendientes de confirmación.', 'pending_confirmation', true, 1),
  ('PLAN_2', 'Plan 2', 'Plan provisional. Nombre, precio y condiciones pendientes de confirmación.', 'pending_confirmation', true, 2),
  ('PLAN_3', 'Plan 3', 'Plan provisional. Nombre, precio y condiciones pendientes de confirmación.', 'pending_confirmation', true, 3),
  ('PLAN_4', 'Plan 4', 'Plan provisional. Nombre, precio y condiciones pendientes de confirmación.', 'pending_confirmation', true, 4)
on conflict (code) do nothing;

-- Categorías mencionadas en la especificación maestra §3.3.
insert into public.product_categories (slug, name, sort_order) values
  ('camisetas', 'Camisetas', 1),
  ('polos', 'Polos', 2),
  ('hoodies', 'Poleras y hoodies', 3),
  ('gorras', 'Gorras', 4),
  ('shorts', 'Shorts', 5)
on conflict (slug) do nothing;

-- Productos de demostración (sin precio autorizado).
insert into public.products (category_id, sku, name, description, is_demo)
select c.id, v.sku, v.name, 'Producto de demostración. Reemplazar por el catálogo real.', true
from (values
  ('camisetas', 'DEMO-CAM-01', '[DEMO] Camiseta Ayam Cemani'),
  ('polos', 'DEMO-POL-01', '[DEMO] Polo Disciplina'),
  ('hoodies', 'DEMO-HOO-01', '[DEMO] Hoodie Obsidiana'),
  ('gorras', 'DEMO-GOR-01', '[DEMO] Gorra Bronce'),
  ('shorts', 'DEMO-SHO-01', '[DEMO] Short Urbano')
) as v(cat, sku, name)
join public.product_categories c on c.slug = v.cat
on conflict (sku) do nothing;

-- -----------------------------------------------------------------------------
-- Misiones (spec v1.1 §3–5)
-- -----------------------------------------------------------------------------
insert into public.missions (code, title, description, category, frequency, target_value, target_unit, metric,
  metric_params, xp_reward, difficulty, evidence_required, evidence_instructions, validation_method, status, inactive_reason)
values
  -- Diarias
  ('D01', 'Primera venta del día', 'Registra al menos una venta real y confirmada de un producto Gallo Negro durante el día.',
   'Ventas', 'daily', 1, 'venta', 'verified_sales_count', '{}', 100, 'media', false,
   'Se valida automáticamente cuando Gallo Negro verifica tu venta. No cuentan ventas duplicadas, canceladas ni rechazadas.', 'auto', 'active', null),
  ('D02', 'El primer Reel', 'Publica un Reel original mostrando un producto Gallo Negro.',
   'Contenido', 'daily', 1, 'Reel', 'approved_evidence_count', '{}', 80, 'media', true,
   'Envía el enlace público del Reel. Debe ser original y no puede usarse de nuevo para esta misión.', 'manual', 'active', null),
  ('D03', 'Presencia en redes', 'Publica una historia promocionando un producto Gallo Negro.',
   'Marketing', 'daily', 1, 'historia', 'approved_evidence_count', '{}', 30, 'baja', true,
   'Sube una captura de la historia publicada. El producto debe identificarse claramente.', 'manual', 'active', null),
  ('D04', 'El catálogo en movimiento', 'Comparte el catálogo con cinco clientes potenciales diferentes.',
   'Prospección', 'daily', 5, 'clientes potenciales', 'manual_approval', '{}', 50, 'baja', true,
   'Envía una captura o nota que muestre los cinco envíos. No se permiten contactos ficticios ni mensajes masivos.', 'manual', 'active', null),
  ('D05', 'Cazador de oportunidades', 'Contacta a cinco clientes potenciales mediante mensajes personalizados.',
   'Ventas', 'daily', 5, 'contactos', 'manual_approval', '{}', 60, 'media', true,
   'Envía evidencia razonable de los cinco contactos, diferentes y legítimos.', 'manual', 'active', null),
  ('D06', 'Producto protagonista', 'Crea una publicación dedicada a un producto específico.',
   'Contenido', 'daily', 1, 'publicación', 'approved_evidence_count', '{}', 50, 'media', true,
   'Envía el enlace de la publicación. Debe identificar el producto y usar información comercial correcta.', 'manual', 'active', null),
  ('D07', 'Responder sin demora', 'Responde las consultas comerciales pendientes durante tu horario de atención.',
   'Atención al cliente', 'daily', 1, 'jornada', 'manual_approval', '{}', 40, 'baja', true,
   'Requiere integración con la mensajería del licenciado.', 'manual', 'inactive',
   'Requiere integración con mensajería (Fase 4). No se exige atención fuera del horario declarado.'),
  ('D08', 'Conoce tu inventario', 'Actualiza las existencias y la disponibilidad de tus productos.',
   'Gestión', 'daily', 1, 'actualización', 'manual_approval', '{}', 30, 'baja', true,
   'Requiere el inventario propio del licenciado.', 'manual', 'inactive',
   'Requiere el módulo de inventario del licenciado, fuera del MVP.'),
  ('D10', 'Disciplina Gallo Negro', 'Completa tres misiones diarias diferentes durante una misma jornada.',
   'Disciplina', 'daily', 3, 'misiones diarias', 'daily_missions_completed', '{}', 100, 'alta', false,
   'Se valida automáticamente con tus misiones diarias completadas del día.', 'auto', 'active', null),

  -- Semanales
  ('S01', 'La semana productiva', 'Consigue cinco ventas reales y confirmadas durante la semana.',
   'Ventas', 'weekly', 5, 'ventas', 'verified_sales_count', '{}', 500, 'media', false,
   'Se valida automáticamente con tus ventas verificadas.', 'auto', 'active', null),
  ('S02', 'Creador de contenido', 'Publica tres Reels originales de Gallo Negro durante la semana.',
   'Contenido', 'weekly', 3, 'Reels', 'approved_evidence_count', '{}', 350, 'media', true,
   'Envía el enlace de cada Reel por separado.', 'manual', 'active', null),
  ('S03', 'El escaparate digital', 'Publica cinco historias y dos publicaciones de productos diferentes.',
   'Marketing', 'weekly', 7, 'publicaciones', 'approved_evidence_count', '{}', 250, 'media', true,
   'Envía una evidencia por publicación: cinco historias y dos publicaciones de productos diferentes.', 'manual', 'active', null),
  ('S04', 'Expansión de territorio', 'Contacta a 25 clientes potenciales nuevos durante la semana.',
   'Prospección', 'weekly', 25, 'contactos', 'manual_approval', '{}', 300, 'alta', true,
   'Envía el registro de contactos. No cuentan contactos ficticios ni duplicados.', 'manual', 'active', null),
  ('S05', 'Embajador de la marca', 'Consigue que un cliente publique una foto o video real con una compra Gallo Negro.',
   'Comunidad', 'weekly', 1, 'contenido de cliente', 'approved_evidence_count', '{}', 300, 'media', true,
   'Envía el enlace de la publicación del cliente. Obtén su autorización antes de reutilizar el contenido.', 'manual', 'active', null),
  ('S06', 'Especialista en hoodies', 'Vende diez hoodies durante la semana.',
   'Ventas', 'weekly', 10, 'hoodies', 'verified_units_category', '{"category": "hoodies"}', 700, 'alta', false,
   'Se valida automáticamente con unidades verificadas de la categoría hoodies.', 'auto', 'active', null),
  ('S07', 'Clientes que regresan', 'Consigue dos compras confirmadas de clientes recurrentes.',
   'Fidelización', 'weekly', 2, 'compras', 'recurring_customer_sales', '{}', 350, 'media', false,
   'Se valida con el identificador de cliente de tus ventas verificadas y su historial de compras.', 'auto', 'active', null),
  ('S08', 'La vitrina impecable', 'Actualiza fotografías, precios y disponibilidad de al menos diez productos.',
   'Gestión', 'weekly', 10, 'productos', 'manual_approval', '{}', 250, 'media', true,
   'Requiere el inventario propio del licenciado.', 'manual', 'inactive',
   'Requiere el módulo de inventario del licenciado, fuera del MVP.'),
  ('S09', 'El cierre de la semana', 'Registra las ventas y gastos de la semana y revisa tus resultados comerciales.',
   'Finanzas', 'weekly', 1, 'cierre', 'manual_approval', '{}', 200, 'baja', true,
   'Requiere el registro de gastos del licenciado.', 'manual', 'inactive',
   'Requiere el registro de gastos y el resumen financiero del licenciado (siguiente entrega del MVP).'),
  ('S10', 'Racha de disciplina', 'Completa al menos una misión diaria en cinco días diferentes de la semana.',
   'Disciplina', 'weekly', 5, 'días', 'days_with_completed_daily', '{}', 400, 'alta', false,
   'Se valida automáticamente con tu historial de misiones diarias.', 'auto', 'active', null),

  -- Mensuales
  ('M01', 'Centurión de las ventas', 'Vende 100 unidades de productos durante el mes.',
   'Ventas', 'monthly', 100, 'unidades', 'verified_units', '{}', 3000, 'alta', false,
   'Se mide en unidades vendidas y verificadas, no en número de transacciones.', 'auto', 'active', null),
  ('M02', 'El rey de los hoodies', 'Vende 100 hoodies durante el mes.',
   'Ventas', 'monthly', 100, 'hoodies', 'verified_units_category', '{"category": "hoodies"}', 5000, 'alta', false,
   'Se valida con unidades verificadas. Gallo Negro ajusta la meta a la mercancía disponible.', 'auto', 'active', null),
  ('M03', 'Máquina de contenido', 'Publica 12 Reels originales durante el mes.',
   'Contenido', 'monthly', 12, 'Reels', 'approved_evidence_count', '{}', 2000, 'alta', true,
   'Envía el enlace de cada Reel por separado.', 'manual', 'active', null),
  ('M04', 'Comunidad en crecimiento', 'Consigue 100 nuevos seguidores relevantes en tus canales comerciales.',
   'Audiencia', 'monthly', 100, 'seguidores', 'manual_approval', '{}', 1500, 'alta', true,
   'Envía capturas de las estadísticas al inicio y al final del mes. No se aceptan seguidores comprados. Nunca compartas contraseñas.', 'manual', 'active', null),
  ('M05', 'La cartera de clientes', 'Consigue diez clientes diferentes con compras confirmadas durante el mes.',
   'Fidelización', 'monthly', 10, 'clientes', 'distinct_customers', '{}', 2000, 'alta', false,
   'Se valida con el identificador de cliente de tus ventas verificadas.', 'auto', 'active', null),
  ('M06', 'El vendedor consistente', 'Genera ventas confirmadas en al menos 20 días diferentes del mes.',
   'Constancia', 'monthly', 20, 'días', 'distinct_sale_days', '{}', 2500, 'alta', false,
   'Se valida con las fechas de tus ventas verificadas.', 'auto', 'active', null),
  ('M07', 'Embajador de élite', 'Consigue cinco contenidos originales de clientes mostrando productos Gallo Negro.',
   'Comunidad', 'monthly', 5, 'contenidos', 'approved_evidence_count', '{}', 2000, 'alta', true,
   'Envía cada contenido por separado. Obtén los permisos para reutilizarlos.', 'manual', 'active', null),
  ('M08', 'Dominio de colección', 'Vende al menos cinco unidades de cada una de cuatro categorías de productos diferentes.',
   'Catálogo', 'monthly', 4, 'categorías', 'categories_with_min_units', '{"min_units": 5}', 2500, 'alta', false,
   'Se valida con tus ventas verificadas por categoría.', 'auto', 'active', null),
  ('M09', 'Crecimiento comercial', 'Aumenta al menos un 25 % tus ventas netas frente al mes anterior.',
   'Crecimiento', 'monthly', 25, '% de crecimiento', 'net_sales_growth_pct', '{}', 3000, 'alta', false,
   'Compara ventas verificadas con el mes anterior. Sin ventas el mes anterior no hay datos comparables y la misión no se activa.', 'auto', 'active', null),
  ('M10', 'Leyenda Gallo Negro', 'Completa ocho misiones semanales diferentes durante el mes.',
   'Maestría', 'monthly', 8, 'misiones semanales', 'weekly_missions_completed', '{}', 3500, 'alta', false,
   'Se valida con tu historial de misiones semanales completadas en el mes.', 'auto', 'active', null)
on conflict (code) do nothing;

-- Niveles (spec v1.1 §7): umbrales pendientes de configurar en el panel.
insert into public.user_levels (position, name) values
  (1, 'Aspirante'), (2, 'Emprendedor'), (3, 'Comerciante'), (4, 'Estratega'),
  (5, 'Embajador'), (6, 'Élite'), (7, 'Maestro'), (8, 'Leyenda Gallo Negro')
on conflict (position) do nothing;

-- Insignias (spec v1.1 §6): se otorgarán en Fase 2.
insert into public.badges (code, name, description, unlock_rule) values
  ('primera_pluma', 'Primera Pluma', 'Primera venta verificada.', '{"type": "verified_sales", "min": 1}'),
  ('creador_urbano', 'Creador Urbano', 'Primer Reel aprobado.', '{"type": "mission_completed", "missions": ["D02", "S02", "M03"]}'),
  ('vendedor_constante', 'Vendedor Constante', 'Ventas en cinco días diferentes.', '{"type": "distinct_sale_days", "min": 5}'),
  ('especialista_hoodies', 'Especialista en Hoodies', 'Primera misión de hoodies completada.', '{"type": "mission_completed", "missions": ["S06", "M02"]}'),
  ('embajador', 'Embajador Gallo Negro', 'Primer contenido autorizado de un cliente.', '{"type": "mission_completed", "missions": ["S05", "M07"]}'),
  ('maestro_catalogo', 'Maestro del Catálogo', 'Ventas verificadas en cuatro categorías.', '{"type": "distinct_categories", "min": 4}'),
  ('centurion', 'Centurión', 'Alcanzar 100 unidades vendidas.', '{"type": "verified_units", "min": 100}'),
  ('leyenda', 'Leyenda Gallo Negro', 'Completar ocho misiones semanales durante un mes.', '{"type": "mission_completed", "missions": ["M10"]}')
on conflict (code) do nothing;
