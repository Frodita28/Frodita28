# Changelog

## 0.3.0 — 2026-10-21

- El licenciado ahora opera una **tienda virtual**: el inicio del panel pasa a ser **Tu Tienda**, con el nombre de la
  tienda (campo nuevo `profiles.store_name`) en el título y en la cabecera, y textos de tienda en vez de usuario.
- Tu Tienda muestra: gráfica de ventas verificadas de los últimos 6 meses (con tabla de datos), puntos de XP, nivel
  de rango, prendas en stock, prendas vendidas, total generado con la licencia e inversión acumulada. Todo sale de la
  base de datos (`store_summary`); donde no hay datos se muestra 0 o un estado vacío.
- Inventario de la tienda (`store_stock_movements`) e inversión acumulada (`store_investments`): registros de solo
  inserción que solo el administrador crea desde `/admin/tiendas`, auditados.
- Migración `20261021000006_stores.sql`, 9 pruebas de base de datos nuevas (71 en total) y pruebas unitarias.

## 0.2.0 — 2026-10-21

- Página pública renovada: marca, cómo funciona, planes 1–4 desde la base de datos con valores pendientes marcados,
  beneficios confirmados, reglas claras, preguntas frecuentes y contacto configurable.
- Solicitudes de licencia: formulario, seguimiento de estado, mensajes del equipo, correcciones y retiro.
- Revisión administrativa (`/admin/solicitudes`): en revisión, pedir correcciones, aprobar con plan, rechazar, notas
  internas y activación de licencia como acción separada y auditada.
- Edición de planes y beneficios sin código (`/admin/planes`), con auditoría de cambios.
- 16 pruebas de base de datos nuevas (62 en total), pruebas unitarias y prueba de punta a punta `applications.mjs`.
- Se añade `.env.example`.

## 0.1.0 — 2026-10-21

- Proyecto Next.js 16 + Supabase con identidad visual Gallo Negro.
- Auth: registro, verificación de correo, login, recuperación de contraseña. Roles y RLS.
- Planes 1–4 provisionales, licencias, catálogo DEMO, ventas con verificación del administrador.
- Módulo de misiones Fase 1 con las 30 misiones de la spec v1.1, evidencias (enlace o captura privada), revisión
  manual, historial de XP inmutable e idempotente, ajustes auditados y alertas de fraude.
- Esquema preparado para niveles, insignias y recompensas.
- 46 pruebas de base de datos, pruebas unitarias y prueba de punta a punta en navegador.
