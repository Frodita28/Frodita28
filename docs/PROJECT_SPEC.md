# Especificación del proyecto

Fuente: documento maestro "Gallo Negro Licencias" v1.0 y "Sistema de misiones y recompensas" v1.1 (octubre 2026).

## Alcance implementado (entrega 1)

| Área | Estado |
| --- | --- |
| Registro, verificación de correo, inicio de sesión, recuperación de contraseña | Hecho |
| Roles solicitante / licenciado / administrador; cada licenciado ve solo sus datos | Hecho |
| Planes 1–4 configurables (provisionales, sin precio) y licencias con estado, plan, territorio, vigencia | Hecho (alta y cambio de estado desde admin) |
| Registro de ventas con referencia única y verificación por el administrador | Hecho |
| Misiones Fase 1: catálogo en BD, diarias/semanales/mensuales, participaciones por período, progreso, evidencias, revisión manual, XP, historial, panel del licenciado y del administrador | Hecho |
| Auditoría de acciones críticas y alertas de posible fraude | Hecho |
| Página pública: marca, cómo funciona, planes 1–4 desde la BD, beneficios confirmados, reglas claras, preguntas frecuentes, contacto configurable | Hecho (entrega 2) |
| Solicitudes de licencia: formulario, estados (pendiente, en revisión, requiere información, aprobada, rechazada, retirada), historial y mensajes para el solicitante | Hecho (entrega 2) |
| Revisión administrativa: en revisión, pedir correcciones, aprobar con plan, rechazar, notas internas; activación de licencia separada y auditada | Hecho (entrega 2) |
| Edición de planes sin código (nombre, precio, moneda, duración, territorio, unidades, productos, exclusividad, materiales, renovación, estado) y beneficios clasificados | Hecho (entrega 2) |

## Pendiente del MVP principal

Catálogo con tallas/colores/precios autorizados, inventario
central, pedidos a Gallo Negro con pago, registro de gastos y resumen financiero, biblioteca de marca, anuncios.

Limitaciones de la entrega 2: la solicitud no admite adjuntar documentos (llegará con `license_documents` y
almacenamiento privado); el catálogo visual público espera el catálogo real con fotos; los avisos por correo de
cambios de estado no están activos (el solicitante los ve en su panel); el contacto público solo aparece si se
configuran las variables `NEXT_PUBLIC_CONTACT_*`.

## Datos comerciales pendientes de confirmación

Nombres, precios, moneda, duración, territorio, unidades y beneficios de los Planes 1–4; definición contractual de
exclusividad; precios autorizados y catálogo real; umbrales de XP por nivel; recompensas y su costo; datos de contacto públicos (correo, WhatsApp, Instagram); zona horaria
oficial de campañas (se usa America/Caracas).
