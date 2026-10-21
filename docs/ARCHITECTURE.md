# Arquitectura

```
Navegador ──► Next.js (Vercel) ── Server Components / Server Actions ──► Supabase
                 proxy.ts: refresca sesión, protege /panel y /admin       ├─ Auth (usuario asignado + contraseña)
                                                                          ├─ PostgREST + RLS (datos)
                                                                          ├─ Funciones SQL (reglas de negocio)
                                                                          └─ Storage privado (evidencias)
```

Decisiones:

- **Las reglas viven en Postgres.** Conceder XP, verificar ventas, revisar evidencias y ajustar puntos son funciones
  `security definer` que comprueban el rol con `auth.uid()`. La app no puede saltárselas aunque tenga un error,
  y cualquier cliente futuro (app móvil, integraciones) hereda las mismas reglas.
- **La app usa la sesión del usuario** (anon key + JWT) para todo, salvo crear cuentas y asignar contraseñas en
  `/admin/usuarios`, que usa la service role solo en el servidor tras comprobar que quien actúa es admin.
- **Acceso solo con cuentas asignadas:** sin registro público. El usuario se mapea a un correo interno
  (`src/lib/accounts.ts`) porque Supabase Auth trabaja con correos; el formulario solo pide usuario y contraseña.
- **Server Actions + validación con zod** antes de llamar a la base de datos; la base de datos valida otra vez.
- **Sin Cache Components:** las páginas son privadas y dinámicas; se usa el renderizado dinámico clásico.
- **Formularios sin JavaScript obligatorio:** las acciones redirigen con `?ok=` / `?error=`. Rápido en móvil.
- Coste: plan gratuito de Supabase y Vercel alcanza para la fase inicial (≤100 licenciados).

Rutas públicas: `/` (marca, planes y preguntas frecuentes) se renderiza con la anon key, que solo puede leer planes no
inactivos y beneficios publicables. Solicitar exige una cuenta asignada: el botón lleva a los visitantes al contacto
y `/panel/solicitud` está protegida por `proxy.ts`.

Tarea programada: `run_mission_maintenance()` (pg_cron) abre períodos y vence los cerrados; es idempotente.
