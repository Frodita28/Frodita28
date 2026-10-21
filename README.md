# Gallo Negro Licencias

Plataforma de licenciados de Gallo Negro ("Ropa exclusiva con identidad propia"): cuentas y roles, licencias,
página pública con planes y preguntas frecuentes, **solicitudes de licencia** con seguimiento y revisión, edición de
planes sin código, registro y verificación de ventas, y el **módulo de misiones y XP (Fase 1)**.

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

Correos locales (verificación, recuperación): Mailpit en http://127.0.0.1:54324.

Crear el primer administrador: regístrate en `/registro`, confirma el correo y ejecuta en la base de datos:

```sql
update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'tu@correo.com');
```

Flujo de licencias: la persona se registra y envía su solicitud en `/panel/solicitud`; el admin la revisa en
`/admin/solicitudes` (en revisión, pedir correcciones, aprobar con plan o rechazar) y, con contrato y pago
formalizados, activa la licencia desde la misma solicitud. Los planes y sus beneficios se editan en `/admin/planes`.

## Pruebas

| Comando | Qué prueba |
| --- | --- |
| `npm run test:db` | 62 pruebas de reglas en Postgres real: RLS, idempotencia de XP, períodos, evidencias, fraude, permisos. Usa `TEST_DATABASE_URL` (un Postgres local vacío; crea bases temporales). |
| `npm run test:unit` | Utilidades (zonas horarias, formulario de misiones, progreso). |
| `node tests/e2e/flow.mjs` | Flujo completo en navegador contra Supabase local y la app en :3000 (ver cabecera del archivo para variables). |
| `node tests/e2e/applications.mjs` | Página pública, solicitud, correcciones, aprobación, activación de licencia y edición de planes en navegador. |
| `npm run lint` · `npm run typecheck` · `npm run build` | Calidad y compilación. |

## Estructura

```
supabase/migrations/   esquema, funciones y políticas RLS (fuente de verdad de las reglas)
supabase/seed.sql      planes provisionales, categorías, productos DEMO, las 30 misiones, niveles e insignias
src/app/page.tsx       página pública (marca, modelo, planes, preguntas frecuentes, contacto)
src/app/panel/         panel del solicitante y licenciado (inicio, solicitud, misiones, ventas)
src/app/admin/         panel administrativo (solicitudes, misiones, evidencias, ventas, licencias, planes, XP, auditoría)
src/lib/               cliente Supabase, sesión, utilidades
tests/db/              pruebas de base de datos       tests/e2e/  prueba de punta a punta
docs/                  especificación, arquitectura, base de datos, seguridad, reglas, hoja de ruta
```

## Mantenimiento

- **Tarea diaria:** programar `select public.run_mission_maintenance();` (pg_cron en Supabase, 00:05 hora de Caracas)
  para abrir períodos y vencer los cerrados. Sin ella todo sigue funcionando: los períodos se abren al entrar al panel
  o al verificar una venta.
- **Respaldo:** Supabase hace copias diarias en planes de pago; además `npx supabase db dump --data-only > backup.sql`.
- **Publicar:** crear el proyecto en Supabase, `npx supabase link` y `npx supabase db push`; en Vercel configurar las
  variables de `.env.example`. Activar en Supabase Auth la confirmación de correo y añadir la URL del sitio a
  *Redirect URLs*.

Documentación: [PROJECT_SPEC](docs/PROJECT_SPEC.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) ·
[DATABASE](docs/DATABASE.md) · [SECURITY](docs/SECURITY.md) · [BUSINESS_RULES](docs/BUSINESS_RULES.md) ·
[MISSIONS](docs/MISSIONS.md) · [ROADMAP](docs/ROADMAP.md) · [CHANGELOG](CHANGELOG.md)
