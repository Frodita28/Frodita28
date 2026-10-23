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
- **Sin registro público:** no existen `/registro` ni la recuperación por correo; el registro está desactivado también
  en Supabase Auth (`enable_signup = false` en local y *Allow new users to sign up* apagado en el proyecto), así que
  nadie puede crear una cuenta con la anon key. Solo entra quien tenga una cuenta creada por el administrador.
- **Cuentas asignadas:** el usuario se guarda como correo interno (`usuario@usuarios.gallonegro.local`, sin buzón). Se
  crean con la API de administración de Auth y `provision_account`, función ejecutable **solo por la service role**
  (revocada a `anon` y `authenticated`) que asigna usuario, rol y licencia y lo audita (`account.provisioned`, con el
  admin que actúa). Asignar contraseña también queda auditado (`account.password_set`).
- **Contraseñas:** las asignadas por el admin tienen un mínimo de 6 (el de Supabase) y son **temporales**: la persona
  debe cambiarla con el botón *Cambiar contraseña* de la cabecera del panel (`/nueva-clave`, mínimo 10). La contraseña de prueba `123456` de la cuenta
  `tiendita` es solo para el entorno de prueba y debe cambiarse antes de cualquier uso real. Ninguna contraseña está
  escrita en migraciones, semillas ni código: el script `crear-usuario` la pide por teclado.
- **Sesión:** validada con `auth.getUser()` en el servidor; redirecciones internas saneadas; el login responde
  "Usuario o contraseña incorrectos" sin revelar si el usuario existe.
- **Secretos:** solo `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` llegan al navegador. La service role key
  (`SUPABASE_SERVICE_ROLE_KEY`, sin prefijo `NEXT_PUBLIC_`) solo se lee en el servidor (`src/lib/supabase/admin.ts`,
  importa `server-only`) y únicamente en las acciones de `/admin/usuarios`, después de `requireAdmin()`. Es opcional:
  sin ella la app funciona y las cuentas se crean desde el panel de Supabase.
- **Solicitudes:** sin escritura directa; solo cuentas de solicitante envían (máx. 5 por persona, una abierta);
  validación de cada campo en el servidor y otra vez en Postgres; el solicitante ve solo sus solicitudes y los
  eventos no internos; nadie revisa ni activa su propia solicitud (`CHECK` y verificación en las funciones);
  activar una licencia es una función aparte, solo admin, auditada. Los visitantes no leen solicitudes ni eventos.
- **Planes públicos:** el precio solo se publica con el plan `active` (restricción en la BD); los beneficios
  `pending_approval` no son legibles por anónimos ni licenciados (RLS).
- **Punto de venta con QR:** las prendas (`garment_units`) no admiten escritura directa; solo el admin las emite o
  devuelve. `pos_checkout` bloquea las prendas (`FOR UPDATE`) y valida en el servidor que cada QR sea de la tienda que
  vende y siga disponible, así un QR no puede venderse dos veces ni desde otra tienda, ni siquiera con dos cajas a la
  vez. El precio sale de la prenda, nunca del navegador. `create_sale` (registro manual) ya no se puede llamar desde
  la API.
- **Tu Tienda:** inventario e inversión sin escritura directa y de solo inserción; solo el admin los registra
  (auditado) y solo para cuentas licenciadas; cada licenciado lee únicamente los suyos (RLS); `store_summary`
  rechaza consultar otra tienda salvo al admin; el nombre de la tienda se cambia solo con `update_my_store`.
- **Clasificación:** `store_leaderboard` (security definer, sin acceso anónimo) solo expone el nombre visible
  (`public_alias`) y los XP de cada tienda; nunca el nombre de la tienda, ventas, ingresos, stock ni datos personales.
- **Pruebas de autorización:** `tests/db/accounts.test.ts`, `tests/db/stores.test.ts`, `tests/db/applications.test.ts`, `tests/db/security.test.ts`, `tests/db/leaderboard.test.ts`, `sales.test.ts` y el paso 10 de `tests/e2e/flow.mjs`.
