# Arquitectura

```
Navegador ──► Next.js (Vercel) ── Server Components / Server Actions ──► Supabase
                 proxy.ts: refresca sesión, protege /panel y /admin       ├─ Auth (correo + contraseña)
                                                                          ├─ PostgREST + RLS (datos)
                                                                          ├─ Funciones SQL (reglas de negocio)
                                                                          └─ Storage privado (evidencias)
```

Decisiones:

- **Las reglas viven en Postgres.** Conceder XP, verificar ventas, revisar evidencias y ajustar puntos son funciones
  `security definer` que comprueban el rol con `auth.uid()`. La app no puede saltárselas aunque tenga un error,
  y cualquier cliente futuro (app móvil, integraciones) hereda las mismas reglas.
- **La app usa siempre la sesión del usuario** (anon key + JWT). La service role key no se usa en la web.
- **Server Actions + validación con zod** antes de llamar a la base de datos; la base de datos valida otra vez.
- **Sin Cache Components:** las páginas son privadas y dinámicas; se usa el renderizado dinámico clásico.
- **Formularios sin JavaScript obligatorio:** las acciones redirigen con `?ok=` / `?error=`. Rápido en móvil.
- Coste: plan gratuito de Supabase y Vercel alcanza para la fase inicial (≤100 licenciados).

Tarea programada: `run_mission_maintenance()` (pg_cron) abre períodos y vence los cerrados; es idempotente.
