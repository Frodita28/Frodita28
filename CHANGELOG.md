# Changelog

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
