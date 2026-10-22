# Changelog

## 0.6.2 — 2026-10-22

- **Licencia, versión 1.0:** Gallo Negro confirmó las cifras de `/panel/licencia`. `esBorrador` pasa a `false` (se
  quita la etiqueta "Versión borrador"), `version` "1.0" y `vigenteDesde` "22 de octubre de 2026". Se mantienen el
  aviso de que el contrato firmado prevalece y el descargo del simulador.

## 0.6.1 — 2026-10-22

- **Licencia** (`/panel/licencia`), pestaña nueva después de *Ventas*: explica la licencia, el selector de plan
  (Socio Fundador / Emprendedor Comercial, con escalones), "Tu inversión en números", un simulador de recuperación,
  los 8 beneficios, las reglas del programa de reconocimiento, 5 cláusulas de confianza y la salida y renovación.
- Todo el texto y las cifras viven en `src/content/licencia.ts` (`version`, `vigenteDesde`, `esBorrador`). Las cifras
  son **BORRADOR** y la página lo indica con la etiqueta "Versión borrador". El porcentaje de recuperación se calcula
  en `src/lib/licencia.ts` (inversión / PVP), con pruebas unitarias. Sin cambios de base de datos ni dependencias.

## 0.6.0 — 2026-10-22

- **Nuevo diseño del panel de la tienda ("Club de licenciatarios")**, inspirado en la referencia que compartió
  Fernando: cabecera con el emblema GN y el nombre de la tienda, pestañas grandes con iconos, bloques con borde de
  color y sombra marcada, dorado vivo con rojo y violeta de acento y tipografía condensada (Bebas Neue) en pestañas y
  botones. Administración conserva su estilo.
- **Tu Tienda:** cuatro tarjetas principales (ranking actual, XP, rango de licencia con barra al siguiente nivel y
  squad, que queda como *próximamente*), las cifras de ventas, stock e inversión, botón al punto de venta y el estado
  de la licencia en español.
- **Clasificación** (`/panel/clasificacion`): tiendas con licencia activa ordenadas por XP, con buscador. Solo muestra
  el nombre visible y los XP; la vista por squads queda como *próximamente*. Migración
  `20261022000009_leaderboard.sql` (`store_leaderboard`) y 3 pruebas de base de datos nuevas (92 en total).
- **Recompensas** (`/panel/recompensas`): muestra solo las recompensas que Gallo Negro haya aprobado, con el progreso
  de XP hacia cada una; el canje queda como *próximamente*. Hoy no hay ninguna aprobada, así que se ve el aviso.
- **Misiones:** encabezado "Misiones y desafíos", tarjetas a lo ancho con categoría, XP, barra y estado; el formulario
  de evidencia se despliega desde el botón *Enviar evidencia*. **Ventas** y el punto de venta adoptan el nuevo estilo
  sin cambiar su funcionamiento.

## 0.5.1 — 2026-10-22

- **Más velocidad.** Las funciones de Vercel corren en Oregón (`pdx1`, en `vercel.json`), la misma zona que la base de
  datos de Supabase (`us-west-2`); antes corrían en Washington (`iad1`, valor por defecto) y cada consulta cruzaba el país.
- El proxy verifica la sesión con `getClaims()` (firma del token comprobada con las claves públicas, sin llamar a
  Supabase Auth en cada petición). Las páginas siguen validando con `getUser()`, ahora en paralelo con la lectura del perfil.
- Misiones: las evidencias llegan en la misma consulta que las participaciones (un viaje menos a la base de datos).
- Pantalla de carga (`loading.tsx`) en el panel y en Administración: al tocar una sección se ve al instante.

## 0.5.0 — 2026-10-22

- **Ventas por punto de venta con QR.** La sección *Ventas* se rehízo: la tienda escanea con la cámara del móvil (o
  escribe) el QR de cada prenda que sale, revisa el total, elige canal y cliente opcional y cierra la venta. La venta
  queda registrada y verificada al instante, la prenda sale del stock y cuenta enseguida para Tu Tienda y las misiones.
  El carrito se conserva si se recarga la página. El registro manual de ventas se retiró.
- Nuevo `/admin/etiquetas`: el administrador entrega prendas con QR a una tienda (cantidad y precio de venta por
  prenda; suma la entrega al inventario o etiqueta stock ya entregado), imprime las etiquetas, reimprime lo que una
  tienda tiene y registra devoluciones. El QR lleva la URL del punto de venta, así la cámara nativa del móvil también
  abre la venta con la prenda agregada.
- Un QR solo se vende una vez (bloqueo en la base de datos, probado con dos cajas a la vez). Anular una venta devuelve
  sus prendas al stock; la tienda puede anularla en sus primeros 15 minutos y después solo el admin.
- `/admin/ventas` muestra todas las ventas registradas con su origen (QR o manual) y el código de cada prenda; las
  ventas manuales anteriores pendientes se siguen verificando.
- Se quita "Mi solicitud" del menú y del inicio del panel (la página sigue disponible desde la página pública).
- Misiones: se quita la "Racha diaria" del panel y se retira la misión D09 "La segunda oportunidad" (archivada, sin
  tocar el XP ya ganado). Las misiones archivadas siguen visibles en el historial de quien participó.
- Migración `20261022000008_pos_qr.sql`, 14 pruebas de base de datos nuevas (89 en total) y pruebas unitarias del
  lector de códigos. Dependencias nuevas: `qrcode` (etiquetas) y `jsqr` (lector en navegadores sin lector nativo).

## 0.4.0 — 2026-10-21

- **Sin registro público:** se eliminan `/registro`, `/recuperar` y `/auth/confirm` (verificación y recuperación por
  correo). Solo se entra con el **usuario y la contraseña que asigna el administrador**; el formulario de acceso pide
  usuario y contraseña (también acepta el correo completo de cuentas antiguas). El registro queda desactivado en
  `supabase/config.toml` y la guía de despliegue indica cómo desactivarlo en el proyecto.
- Nuevo `/admin/usuarios`: crear cuentas (licenciado, solicitante o administrador; al licenciado se le crea su licencia
  activa) y asignar contraseñas nuevas. Usa la service role solo en el servidor (`SUPABASE_SERVICE_ROLE_KEY`).
- Script de uso manual `npm run crear-usuario` (pide la contraseña por teclado) y guía sin terminal en
  `docs/DESPLIEGUE.md` para crear la cuenta de prueba `tiendita`.
- Los usuarios cambian su contraseña desde *Contraseña* (`/nueva-clave`) en el panel.
- La página pública lleva "Solicitar licencia" al contacto para visitantes sin cuenta.
- Migración `20261021000007_assigned_accounts.sql` (`profiles.username`, `provision_account`, `write_audit_as`),
  4 pruebas de base de datos nuevas (75 en total), pruebas unitarias y e2e actualizadas.

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
