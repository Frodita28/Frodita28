# Base de datos

Migraciones en `supabase/migrations/` (orden por nombre). Tablas principales:

| Tabla | Propósito |
| --- | --- |
| `profiles` | 1:1 con `auth.users`; rol, nombre, alias público. El rol nunca se toma del registro. |
| `license_plans` | Planes configurables (`pending_confirmation` hasta confirmar condiciones). Incluye productos autorizados, exclusividad, materiales y renovación. Un plan `active` exige precio y moneda. Cambios auditados. |
| `plan_benefits` | Beneficios por plan: `confirmed`, `contract_only` o `pending_approval` (este último nunca es público). |
| `license_applications` | Solicitudes: datos comerciales, canales, plan de interés, plan asignado, último mensaje al solicitante, `license_id` al activarse. Una abierta por persona (índice único parcial). |
| `application_events` | Historial inmutable de cada solicitud; las notas internas (`is_internal`) no las ve el solicitante. |
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
`duplicate_mission`, `resolve_fraud_flag`, `submit_license_application`, `update_license_application`,
`withdraw_license_application`, `review_license_application` (start_review, request_info, approve, reject, note) y
`activate_application_license`. Internas (sin permiso de ejecución para usuarios):
`ensure_participations`, `compute_mission_progress`, `recompute_participation`, `recompute_user_missions`,
`expire_participations`, `run_mission_maintenance`, `log_application_event`, `application_from_payload`.

Estados de una solicitud: `submitted` → `in_review` → `needs_info` (vuelve a `submitted` al corregir) → `approved`
o `rejected`; el solicitante puede retirarla (`withdrawn`) mientras no tenga licencia. Aprobar exige plan; activar
exige solicitud aprobada, referencia de contrato y fecha de inicio, crea la licencia (`created_by` = admin) y el
trigger de `licenses` convierte al solicitante en licenciado.

Adaptación al modelo de la spec v1.1: se añadieron `code`, `metric`, `metric_params`, `plan_targets`, `timezone`,
`review_grace_days` e `inactive_reason` a `missions`; las evidencias van en su propia tabla (una participación
puede necesitar varias, p. ej. 3 Reels); `evidence_url` de la participación guarda la última enviada.
