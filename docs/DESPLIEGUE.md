# Despliegue (entorno de prueba)

Guía para publicar la app en Supabase + Vercel sin usar la terminal. Todo se hace desde el navegador.

> **Secretos:** la app necesita la URL del proyecto y la clave pública (*anon* / *publishable*). La *service role
> key* es opcional: solo sirve para crear cuentas desde **Administración → Usuarios** y va en Vercel como variable
> sensible, nunca con prefijo `NEXT_PUBLIC_`. La contraseña de la base de datos no se usa. No compartas ninguna
> clave por chat.
>
> **Acceso:** no hay registro público. Solo se entra con el usuario y la contraseña que asigna el administrador.

## 1. Crear el proyecto en Supabase

1. Entra a <https://supabase.com/dashboard> y pulsa **New project**.
2. Nombre: `gallo-negro-prueba`. Región: la más cercana a Venezuela (**East US**).
3. Inventa una contraseña de base de datos y guárdala en tu gestor de contraseñas. No la necesitarás en esta guía.
4. Si aparece **Security options**, deja marcados *Data API* y *Automatically expose new tables*.
5. Pulsa **Create new project** y espera a que termine (1–2 minutos).

## 2. Instalar la base de datos (un solo SQL)

El archivo `instalar.sql` contiene todas las migraciones de `supabase/migrations/` y los datos iniciales de
`supabase/seed.sql`, dentro de una transacción. Se genera con:

```bash
node scripts/sql-unico.mjs > instalar.sql
```

1. En el proyecto, menú izquierdo → **SQL Editor** → **New query**.
2. Abre `instalar.sql`, copia todo su contenido y pégalo en el editor.
3. Pulsa **Run**. Debe terminar con *Success. No rows returned*.
4. Comprueba: **Table Editor** muestra tablas como `missions` (29 filas) y `license_plans` (4 filas), y en
   **Storage** existe el bucket `evidences`.

Si el SQL da error no se aplica nada; copia el mensaje de error y compártelo. Ejecútalo solo una vez por proyecto.

## 3. Copiar la URL y la clave pública

1. Menú izquierdo → **Project Settings** → **API Keys** (o el botón **Connect** arriba).
2. Anota la **Project URL** (`https://xxxx.supabase.co`) y la clave **anon public** o **publishable**
   (`sb_publishable_...`). No uses la *service_role* ni la *secret key*.

## 4. Publicar en Vercel

> **Región:** `vercel.json` fija las funciones en `pdx1` (Oregón) porque el proyecto de Supabase está en `us-west-2`
> (Oregón). Si creas el proyecto de Supabase en otra región, cambia `regions` en `vercel.json` por la más cercana
> (p. ej. `us-east-1` → `iad1`, `sa-east-1` → `gru1`): tenerlas lejos hace lenta cada página.

1. Entra a <https://vercel.com/signup> y crea la cuenta con **Continue with GitHub**.
2. **Add New… → Project** → busca `Frodita28` → **Import**. Si no aparece, pulsa *Adjust GitHub App
   Permissions* y dale acceso a ese repositorio.
3. Project Name: `gallo-negro-prueba`. Framework: Next.js (se detecta solo). No cambies los comandos.
4. Abre **Environment Variables** y agrega estas variables con *Type* **Config** (no *Secret*: Vercel no expone
   como secretas las variables `NEXT_PUBLIC_` y la app falla con *Internal Server Error*):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | la Project URL del paso 3 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clave pública del paso 3 |
   | `SUPABASE_SERVICE_ROLE_KEY` | *(opcional)* la clave **service_role** / **secret** de **Project Settings → API Keys**. Esta sí con *Type* **Sensitive** / **Secret**. Sin ella todo funciona, pero las cuentas se crean como en el paso 6. |

   `NEXT_PUBLIC_SITE_URL` es opcional: si pones la dirección pública de la app (la de **Domains**, con `https://`),
   las etiquetas QR la usan siempre. Si no, usan la dirección desde la que el administrador las imprime.
5. Pulsa **Deploy** y espera. Al terminar, pulsa **Continue to Dashboard** y anota la dirección en **Domains**.
6. Si cambias variables después, vuelve a desplegar (**Deployments** → ⋯ en el último → **Redeploy**).

## 5. Desactivar el registro en Supabase

1. **Authentication → Sign In / Providers** (en algunos paneles, **Authentication → Settings**): **apaga** *Allow new
   users to sign up* y pulsa **Save**. Así nadie puede crear una cuenta por su cuenta, ni siquiera llamando a la API.
2. En la misma pantalla, en **Email**, deja el proveedor activado (es el que usa el inicio de sesión). *Confirm email*
   no afecta: las cuentas asignadas se crean ya confirmadas.
3. **Authentication → Sign In / Providers → Password** (o *Auth Settings*): la **longitud mínima de contraseña**
   debe ser **6** (el valor por defecto) para poder asignar contraseñas temporales como `123456`.
4. Ya no hacen falta plantillas de correo, SMTP ni *Redirect URLs*: no se envían correos de verificación ni de
   recuperación. Si alguien olvida su contraseña, el administrador le asigna una nueva.

## 6. Crear las cuentas (primer administrador y la tienda de prueba)

Cada usuario se guarda en Supabase con un correo interno: `usuario@usuarios.gallonegro.local`. Ese correo no
existe ni recibe nada; en la app solo se escribe el **usuario**.

### 6.1 Si el proyecto ya estaba instalado: aplicar la actualización

Si instalaste la base de datos antes de esta versión, en **SQL Editor → New query** pega el contenido de
`actualizar-usuarios.sql` (es la migración `supabase/migrations/20261021000007_assigned_accounts.sql`) y pulsa
**Run**. En un proyecto nuevo no hace falta: ya viene dentro de `instalar.sql`.

### 6.2 Crear la cuenta en Authentication

1. **Authentication → Users → Add user → Create new user**.
2. **Email:** `tiendita@usuarios.gallonegro.local`. **Password:** `123456`. Marca **Auto Confirm User**.
3. Pulsa **Create user**.

Repite con tu propio usuario de administrador, por ejemplo `fernando@usuarios.gallonegro.local` y una contraseña
fuerte (si ya tienes una cuenta creada con tu correo real, puedes seguir entrando con ese correo completo y saltarte
este paso).

### 6.3 Asignar usuario, rol y tienda (SQL Editor)

En **SQL Editor → New query**, pega y pulsa **Run**:

```sql
-- Tienda de prueba: licenciado con licencia activa en el primer plan disponible.
select public.provision_account(
  (select id from auth.users where email = 'tiendita@usuarios.gallonegro.local'),
  'tiendita', 'licensee', null, 'Tiendita');

-- Tu cuenta de administrador (cambia "fernando" si usaste otro usuario).
select public.provision_account(
  (select id from auth.users where email = 'fernando@usuarios.gallonegro.local'),
  'fernando', 'admin', 'Fernando');
```

Si ya eras administrador con tu correo real, omite la segunda consulta. Cada alta queda en `audit_log`
(`account.provisioned`).

### 6.4 Entrar

Abre la dirección de Vercel → **Portal de licenciados** → usuario `tiendita`, contraseña `123456`.

> **Importante:** `123456` es una contraseña **solo temporal para pruebas**. Antes de cualquier uso real, cámbiala
> con el botón **Cambiar contraseña** de la cabecera del panel (mínimo 10 caracteres) o asígnale una nueva desde **Administración → Usuarios**.

### Después: crear cuentas desde la app

Con `SUPABASE_SERVICE_ROLE_KEY` configurada en Vercel, entra como administrador a **Administración → Usuarios**:
ahí creas cuentas (usuario, contraseña, rol, tienda y plan) y asignas contraseñas nuevas sin pasar por Supabase.
Desde una computadora con el repositorio también sirve el script (pide la contraseña por teclado):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
  npm run crear-usuario -- --usuario tiendita --rol licensee --tienda "Tiendita"
```

## 6.5 Actualización del punto de venta con QR (2026-10-22)

Si la base de datos se instaló antes de esta versión, en **SQL Editor → New query** pega el contenido de
`actualizar-punto-de-venta.sql` (es la migración `supabase/migrations/20261022000008_pos_qr.sql`) y pulsa **Run**.
Retira la misión "La segunda oportunidad" y crea el punto de venta. En un proyecto nuevo no hace falta: ya viene
dentro de `instalar.sql`.

Para probarlo: como administrador, **Administración → Etiquetas QR** → elige la tienda, el producto, cuántas prendas y
el precio de venta → **Generar etiquetas** → **Imprimir etiquetas**. Como tienda, **Ventas** → **Escanear QR de la
prenda** (el navegador pide permiso para la cámara) o escribe el código → **Cerrar venta**. La cámara del navegador
necesita `https://` (Vercel ya lo da).

## 6.6 Actualización de la tabla de clasificación (2026-10-22)

Si la base de datos se instaló antes de esta versión, en **SQL Editor → New query** pega el contenido de
`actualizar-clasificacion.sql` (es la migración `supabase/migrations/20261022000009_leaderboard.sql`) y pulsa **Run**.
Sin ella, la pestaña **Clasificación** sale vacía y Tu Tienda muestra «—» en el ranking. En un proyecto nuevo no hace
falta: ya viene dentro de `instalar.sql`.

## 7. Opcional: tarea diaria de misiones

**Integrations → Cron** → activa *pg_cron* → **Create job**: nombre `misiones-diarias`, horario `5 4 * * *`
(00:05 en Caracas = 04:05 UTC), tipo *SQL snippet*: `select public.run_mission_maintenance();`.
Sin esta tarea la app funciona igual: los períodos se abren al entrar al panel o al registrar una venta.

## Actualizaciones posteriores

Cada cambio que se fusione en `main` se publica solo en Vercel. Si el cambio trae una migración nueva en
`supabase/migrations/`, hay que ejecutarla en el SQL Editor (solo ese archivo) o con `npx supabase db push`.
