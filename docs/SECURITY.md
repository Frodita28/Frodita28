# Seguridad

- **RLS en todas las tablas.** Licenciado: solo sus filas. Admin: todo. Anónimo: solo planes no inactivos.
- **Sin escritura directa** en ventas, participaciones, evidencias, XP, alertas ni auditoría: privilegios revocados
  y operaciones solo por funciones que comprueban rol y propiedad.
- **Nadie se aprueba a sí mismo:** restricciones `CHECK` impiden que el verificador de una venta o el revisor de una
  evidencia sea su dueño; el admin no puede ajustarse sus propios XP.
- **Idempotencia:** `unique` en participación por período, un premio por participación, `idempotency_key` en
  ajustes (el formulario genera una clave nueva cada vez), revisiones solo sobre estado pendiente.
- **Inmutabilidad:** triggers impiden modificar o borrar `xp_ledger`, `audit_log` y `user_badges`, incluso al admin.
- **Evidencias:** enlaces solo `http(s)`; capturas PNG/JPG/WEBP ≤5 MB en bucket privado, carpeta por usuario,
  huella SHA-256 para detectar reutilización; el admin las ve con enlaces firmados de 10 minutos.
  Nunca se piden contraseñas de redes sociales.
- **Sesión:** validada con `auth.getUser()` en el servidor; redirecciones internas saneadas; mensajes de login y
  recuperación que no revelan si un correo existe; contraseña mínima de 10 caracteres; confirmación de correo.
- **Secretos:** solo `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` llegan al navegador. La service role key no se usa en la web.
- **Solicitudes:** sin escritura directa; solo cuentas de solicitante envían (máx. 5 por persona, una abierta);
  validación de cada campo en el servidor y otra vez en Postgres; el solicitante ve solo sus solicitudes y los
  eventos no internos; nadie revisa ni activa su propia solicitud (`CHECK` y verificación en las funciones);
  activar una licencia es una función aparte, solo admin, auditada. Los visitantes no leen solicitudes ni eventos.
- **Planes públicos:** el precio solo se publica con el plan `active` (restricción en la BD); los beneficios
  `pending_approval` no son legibles por anónimos ni licenciados (RLS).
- **Pruebas de autorización:** `tests/db/applications.test.ts`, `tests/db/security.test.ts`, `sales.test.ts` y el paso 10 de `tests/e2e/flow.mjs`.
