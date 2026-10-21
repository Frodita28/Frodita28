# Base de datos

Migraciones en `supabase/migrations/` (orden por nombre). Tablas principales:

| Tabla | Propósito |
| --- | --- |
| `profiles` | 1:1 con `auth.users`; rol, nombre, alias público. El rol nunca se toma del registro. |
| `license_plans` | Planes configurables (`pending_confirmation` hasta confirmar condiciones). |
| `licenses` | Licencia por usuario; una activa como máximo. Activarla convierte al solicitante en licenciado. |
| `product_categories`, `products` | Catálogo mínimo (productos DEMO marcados). |
| `sales`, `sale_items` | Ventas del licenciado; `unique(licensee_id, reference_normalized)`; la categoría se copia en la línea. |
| `missions` | Catálogo de misiones (código, frecuencia, métrica, objetivo, XP, vigencia, planes, territorios, zona horaria). |
| `mission_participations` | Una por misión + usuario + período (`unique`). Copia objetivo y XP al crearse. |
| `mission_evidences` | Evidencias; `unique(mission_id, evidence_key)` salvo rechazadas. |
| `xp_ledger` | Historial de XP de solo inserción; `idempotency_key` única y un premio por participación. |
| `user_xp_balances` | Vista: saldo = suma del historial (respeta RLS). |
| `fraud_flags` | Alertas: evidencia repetida, premio afectado por venta anulada. |
| `audit_log` | Auditoría inmutable. |
| `user_levels`, `badges`, `user_badges`, `rewards`, `reward_redemptions` | Esquema preparado para Fases 2 y 3. |

Funciones expuestas a la API: `create_sale`, `review_sale`, `cancel_sale`, `update_my_profile`,
`refresh_my_missions`, `submit_mission_evidence`, `review_mission_evidence`, `admin_adjust_xp`,
`duplicate_mission`, `resolve_fraud_flag`. Internas (sin permiso de ejecución para usuarios):
`ensure_participations`, `compute_mission_progress`, `recompute_participation`, `recompute_user_missions`,
`expire_participations`, `run_mission_maintenance`.

Adaptación al modelo de la spec v1.1: se añadieron `code`, `metric`, `metric_params`, `plan_targets`, `timezone`,
`review_grace_days` e `inactive_reason` a `missions`; las evidencias van en su propia tabla (una participación
puede necesitar varias, p. ej. 3 Reels); `evidence_url` de la participación guarda la última enviada.
