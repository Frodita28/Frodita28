# Base de datos

Migraciones en `supabase/migrations/` (orden por nombre). Tablas principales:

| Tabla | Propósito |
| --- | --- |
| `profiles` | 1:1 con `auth.users`; rol, nombre del responsable, alias público, `store_name` (nombre de la tienda virtual) y `username` (único, minúsculas, 3–30 caracteres `a-z 0-9 . _ -`; el usuario con el que se inicia sesión). El rol nunca se toma de los metadatos de Auth. |
| `license_plans` | Planes configurables (`pending_confirmation` hasta confirmar condiciones). Incluye productos autorizados, exclusividad, materiales y renovación. Un plan `active` exige precio y moneda. Cambios auditados. |
| `plan_benefits` | Beneficios por plan: `confirmed`, `contract_only` o `pending_approval` (este último nunca es público). |
| `license_applications` | Solicitudes: datos comerciales, canales, plan de interés, plan asignado, último mensaje al solicitante, `license_id` al activarse. Una abierta por persona (índice único parcial). |
| `application_events` | Historial inmutable de cada solicitud; las notas internas (`is_internal`) no las ve el solicitante. |
| `licenses` | Licencia por usuario; una activa como máximo. Activarla convierte al solicitante en licenciado. |
| `product_categories`, `products` | Catálogo mínimo (productos DEMO marcados). |
| `sales`, `sale_items` | Ventas de la tienda; `unique(licensee_id, reference_normalized)`; la categoría se copia en la línea. `sales.source`: `pos` (punto de venta con QR, verificada al cerrarse, referencia `POS-AAAAMMDD-HHMMSS-XXXX`, `verified_by` nulo) o `manual` (registro anterior, verificado por un admin). `sale_items.garment_unit_id` apunta a la prenda vendida (una línea por prenda). |
| `garment_units` | Una fila por prenda física con QR: `code` único (`GN-` + 8 caracteres sin I, L, O, U), tienda, producto, `unit_price` fijado por el admin, `status` (`in_store`, `sold`, `returned`), `sale_id` de la venta vigente, `stock_movement_id` de la entrega que la originó y `batch_id` del lote de etiquetas. Sin escritura directa. |
| `missions` | Catálogo de misiones (código, frecuencia, métrica, objetivo, XP, vigencia, planes, territorios, zona horaria). |
| `mission_participations` | Una por misión + usuario + período (`unique`). Copia objetivo y XP al crearse. |
| `mission_evidences` | Evidencias; `unique(mission_id, evidence_key)` salvo rechazadas. |
| `xp_ledger` | Historial de XP de solo inserción; `idempotency_key` única y un premio por participación. |
| `user_xp_balances` | Vista: saldo = suma del historial (respeta RLS). |
| `fraud_flags` | Alertas: evidencia repetida, premio afectado por venta anulada. |
| `store_stock_movements` | Inventario de cada tienda, solo inserción: `delivery` (+), `return` (−), `adjustment` (±). Solo el admin registra. |
| `store_investments` | Inversión del licenciado (licencia, mercancía, otro; `correction` negativa). Solo inserción, solo el admin registra. |
| `audit_log` | Auditoría inmutable. |
| `user_levels`, `badges`, `user_badges`, `rewards`, `reward_redemptions` | Esquema preparado para Fases 2 y 3. |

Funciones expuestas a la API: `pos_lookup(p_code)` y `pos_checkout(p_codes, p_channel, p_customer_ref, p_notes)`
(punto de venta de la propia tienda), `issue_garment_units(p_licensee, p_product, p_quantity, p_unit_price,
p_register_delivery, p_note)` y `return_garment_unit(p_code, p_note)` (solo admin), `review_sale`, `cancel_sale`, `update_my_profile`,
`refresh_my_missions`, `submit_mission_evidence`, `review_mission_evidence`, `admin_adjust_xp`,
`duplicate_mission`, `resolve_fraud_flag`, `submit_license_application`, `update_license_application`,
`withdraw_license_application`, `review_license_application` (start_review, request_info, approve, reject, note) y
`activate_application_license`, `update_my_store`, `record_stock_movement`, `record_store_investment`,
`store_summary` y `store_leaderboard`. Internas (sin permiso de ejecución para usuarios):
`ensure_participations`, `compute_mission_progress`, `recompute_participation`, `recompute_user_missions`,
`expire_participations`, `run_mission_maintenance`, `log_application_event`, `application_from_payload`,
`new_garment_code`, `untagged_stock` y `create_sale` (registro manual retirado de la API el 2026-10-22; se conserva
para datos históricos y pruebas).

Punto de venta: `issue_garment_units` crea las prendas de un lote y, si es una entrega nueva, el movimiento
`delivery` en `store_stock_movements`; si se etiqueta stock ya entregado, no puede superar las prendas sin QR
(`untagged_stock`). `pos_checkout` normaliza los códigos (acepta la URL del QR), bloquea las prendas con
`FOR UPDATE`, exige que todas sean de la tienda y estén `in_store`, crea la venta `pos` con una línea por prenda,
las marca `sold` y pasa la venta a `verified`, lo que dispara el recálculo de misiones. `cancel_sale` devuelve las
prendas a `in_store`. `return_garment_unit` registra un movimiento `return` de −1 y deja la prenda `returned`.
Todo queda en `audit_log` (`garment_units.issued`, `sale.pos_checkout`, `sale.cancelled`, `garment_unit.returned`).

Misiones archivadas: la política `missions_select` deja al licenciado ver las misiones en las que ya participó
aunque estén archivadas, para no romper su historial.
Solo service role (servidor de la app, script `crear-usuario` o SQL Editor): `provision_account(p_user, p_username,
p_role, p_full_name, p_store_name, p_plan_id, p_actor)`, que completa una cuenta creada en Auth (usuario, nombres,
rol; a un licenciado le crea su licencia activa en el plan indicado o el primero disponible) y `write_audit_as`.

Estados de una solicitud: `submitted` → `in_review` → `needs_info` (vuelve a `submitted` al corregir) → `approved`
o `rejected`; el solicitante puede retirarla (`withdrawn`) mientras no tenga licencia. Aprobar exige plan; activar
exige solicitud aprobada, referencia de contrato y fecha de inicio, crea la licencia (`created_by` = admin) y el
trigger de `licenses` convierte al solicitante en licenciado.

Adaptación al modelo de la spec v1.1: se añadieron `code`, `metric`, `metric_params`, `plan_targets`, `timezone`,
`review_grace_days` e `inactive_reason` a `missions`; las evidencias van en su propia tabla (una participación
puede necesitar varias, p. ej. 3 Reels); `evidence_url` de la participación guarda la última enviada.

Resumen de Tu Tienda (`store_summary(p_user, p_months)`, propio o admin): XP (suma de `xp_ledger`), rango (nivel
`active` con mayor `minimum_xp` alcanzado y el siguiente), prendas vendidas y total generado (solo ventas
`verified`), existencias = suma de `store_stock_movements` (incluye entregas con QR y devoluciones) − prendas de ventas verificadas (puede ser negativo si
faltan entregas por registrar), inversión = suma de `store_investments`, y serie mensual en la zona horaria del perfil.

Tabla de clasificación (`store_leaderboard(p_limit)`, cualquier usuario autenticado): tiendas `licensee` con licencia
`active` ordenadas por XP con `rank()` (empates comparten puesto). Devuelve solo `place`, `alias` (`public_alias`, o
«Tienda Gallo Negro» si no tiene), `total_xp` e `is_me`; incluye siempre la fila propia aunque quede fuera del límite.
