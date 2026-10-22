# Gallo Negro Licencias

Plataforma de licenciados de Gallo Negro ("Ropa exclusiva con identidad propia"): cuentas y roles, licencias,
página pública con planes y preguntas frecuentes, **solicitudes de licencia** con seguimiento y revisión, edición de
planes sin código, **ventas por punto de venta con QR por prenda**, y el **módulo de misiones y XP (Fase 1)**.

Stack: Next.js 16 (App Router, Server Actions) + TypeScript + Tailwind 4, Supabase (Postgres, Auth, RLS, Storage).
Despliegue previsto: Vercel + Supabase.

## Puesta en marcha local

Requisitos: Node 20+, Docker (para Supabase local) y `psql`.

```bash
npm install
npx supabase start                # Postgres, Auth, API, Storage y Mailpit locales; aplica migraciones y seed
cp .env.example .env.local        # pega la URL y la anon key que muestra `supabase start`
npm run dev                       # http://127.0.0.1:3000
```

**Acceso:** no hay registro público. Cada persona entra con el **usuario y la contraseña que le asigna el
administrador** (Supabase Auth guarda el usuario como el correo interno `usuario@usuarios.gallonegro.local`).
El admin crea cuentas y asigna contraseñas en `/admin/usuarios` (requiere `SUPABASE_SERVICE_ROLE_KEY` en el servidor),
o con el script de uso manual:

```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run crear-usuario -- --usuario fernando --rol admin
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run crear-usuario -- --usuario tiendita --rol licensee --tienda "Tiendita"
```

La contraseña se pide por teclado (o se toma de la variable `CLAVE`); nunca se guarda en el código. Sin terminal,
ver [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) §6 (panel de Supabase + SQL Editor).

Flujo de licencias: el admin crea la cuenta (como solicitante) y la persona envía su solicitud en `/panel/solicitud`; el admin la revisa en
`/admin/solicitudes` (en revisión, pedir correcciones, aprobar con plan o rechazar) y, con contrato y pago
formalizados, activa la licencia desde la misma solicitud. Los planes y sus beneficios se editan en `/admin/planes`.
Cada licenciado opera una tienda virtual: su inicio es **Tu Tienda** (`/panel`), con ventas, XP, rango, stock,
prendas vendidas, total generado e inversión. El admin registra entregas de prendas e inversiones en `/admin/tiendas`.

Ventas: el admin entrega prendas con **QR único y precio** desde `/admin/etiquetas` e imprime las etiquetas. La tienda
vende en **Ventas** (`/panel/ventas`) escaneando cada QR con la cámara del móvil (o escribiendo el código): al cerrar
la venta la prenda sale del stock y cuenta al instante para Tu Tienda y las misiones. Un QR no se vende dos veces.

## Pruebas

| Comando | Qué prueba |
| --- | --- |
| `npm run test:db` | 89 pruebas de reglas en Postgres real: RLS, idempotencia de XP, períodos, evidencias, fraude, permisos, punto de venta con QR. Usa `TEST_DATABASE_URL` (un Postgres local vacío; crea bases temporales). |
| `npm run test:unit` | Utilidades (zonas horarias, formulario de misiones, progreso, lector de códigos QR). |
| `node tests/e2e/flow.mjs` | Flujo completo en navegador contra Supabase local y la app en :3000 (ver cabecera del archivo para variables). |
| `node tests/e2e/applications.mjs` | Página pública, solicitud, correcciones, aprobación, activación de licencia y edición de planes en navegador. |
| `npm run lint` · `npm run typecheck` · `npm run build` | Calidad y compilación. |

## Estructura

```
supabase/migrations/   esquema, funciones y políticas RLS (fuente de verdad de las reglas)
supabase/seed.sql      planes provisionales, categorías, productos DEMO, las misiones de la spec (sin D09, retirada), niveles e insignias
src/app/page.tsx       página pública (marca, modelo, planes, preguntas frecuentes, contacto)
src/app/panel/         panel del solicitante y licenciado (Tu Tienda, misiones, punto de venta)
scripts/               SQL único de instalación y creación manual de cuentas
src/app/admin/         panel administrativo (usuarios, solicitudes, misiones, evidencias, ventas, etiquetas QR, licencias, tiendas, planes, XP, auditoría)
src/lib/               cliente Supabase, sesión, utilidades
tests/db/              pruebas de base de datos       tests/e2e/  prueba de punta a punta
docs/                  especificación, arquitectura, base de datos, seguridad, reglas, hoja de ruta
```

## Mantenimiento

- **Tarea diaria:** programar `select public.run_mission_maintenance();` (pg_cron en Supabase, 00:05 hora de Caracas)
  para abrir períodos y vencer los cerrados. Sin ella todo sigue funcionando: los períodos se abren al entrar al panel
  o al registrar una venta.
- **Respaldo:** Supabase hace copias diarias en planes de pago; además `npx supabase db dump --data-only > backup.sql`.
- **Publicar:** ver [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md). En Supabase Auth hay que **desactivar el registro**
  (*Allow new users to sign up*).

Documentación: [PROJECT_SPEC](docs/PROJECT_SPEC.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) ·
[DATABASE](docs/DATABASE.md) · [SECURITY](docs/SECURITY.md) · [BUSINESS_RULES](docs/BUSINESS_RULES.md) ·
[MISSIONS](docs/MISSIONS.md) · [DESPLIEGUE](docs/DESPLIEGUE.md) · [ROADMAP](docs/ROADMAP.md) · [CHANGELOG](CHANGELOG.md)
