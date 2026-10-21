# Módulo de misiones (Fase 1)

## Cómo funciona

1. Cada misión activa genera, para cada licenciado al que aplica (plan, territorio, licencia activa), una
   participación por período: día, semana (lunes a domingo) o mes, en la **zona horaria de la misión**.
2. El objetivo y los XP se copian en la participación al crearla. Editar la misión afecta a períodos nuevos, no a
   los abiertos ni a premios concedidos. `plan_targets` permite un objetivo distinto por plan (p. ej. ajustar hoodies
   al inventario).
3. **Automáticas:** el progreso se recalcula al verificar o anular ventas (y al abrir el panel). Métricas: ventas,
   unidades, unidades por categoría, clientes distintos, clientes recurrentes, días con ventas, categorías con mínimo
   de unidades, crecimiento % (sin datos del período anterior no se activa), y compuestas (D10, S10, M10).
4. **Manuales:** el licenciado envía enlace o captura; el admin aprueba o rechaza con motivo; puede reenviar.
   `approved_evidence_count` suma 1 por evidencia aprobada; `manual_approval` se completa con una aprobación.
5. Al alcanzar el objetivo, la participación pasa a *Completada* y se inserta **un** premio en `xp_ledger`.
6. Tras el cierre del período hay `review_grace_days` (3 por defecto) para verificar ventas o revisar evidencias
   enviadas a tiempo; después pasa a *Vencida*. Una evidencia pendiente nunca vence sin revisión.

Estados: Disponible, En progreso, Pendiente de revisión, Completada, Rechazada, Vencida.

## Las 30 misiones de la spec

Cargadas con sus XP y objetivos. Validación automática: D01, D10, S01, S06, S07, S10, M01, M02, M05, M06, M08, M09,
M10. Revisión manual: D02–D06, D09, S02–S05, M03, M04, M07. **Inactivas** hasta tener el dato necesario: D07
(integración con mensajería), D08 y S08 (inventario propio del licenciado), S09 (registro de gastos).
D04, D05, D09 y S04 se validan manualmente porque aún no existe un registro de contactos.

## Crear una misión nueva

`/admin/misiones/nueva`: código, título, frecuencia, cómo se mide, objetivo, XP, evidencia, vigencia, planes,
territorios y estado. No requiere código. Para una métrica nueva hay que añadirla en `compute_mission_progress`
(migración) y en `src/lib/missions.ts`.

## Fases siguientes

Fase 2: niveles (umbrales configurables), insignias, rankings por alias, rachas, temporadas, notificaciones.
Fase 3: catálogo y canje de recompensas. Fase 4: integraciones (pedidos, inventario, redes, analítica).
