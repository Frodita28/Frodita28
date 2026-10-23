# Sistema de diseño del panel de licenciatarios

Alcance: todo lo que se ve dentro del panel (`/panel/*` y el cambio de contraseña, `/nueva-clave`, enlazado desde la cabecera). El panel de
administración (`/admin`), el acceso y la página pública conservan su estilo anterior (tokens `obsidian`, `ivory`,
`bronze`… en `globals.css`) y no se tocaron.

Principio: streetwear premium con claridad de app financiera. Oscuro, sobrio, pocos colores, números siempre legibles.

## Tokens (`src/app/globals.css`, bloque `:root`)

| Token | Valor | Alias Tailwind | Uso |
|---|---|---|---|
| `--bg` | `#0B0B0C` | `bg-bg`, `text-bg` | Fondo de página; texto sobre amarillo |
| `--surface` | `#141416` | `bg-surface` | Tarjetas |
| `--surface-2` | `#1C1C1F` | `bg-surface-2` | Capas dentro de tarjetas, hover |
| `--border` | `#2A2A2E` | `border-line` | Bordes de 1 px |
| `--text` | `#F5F5F4` | `text-fg` | Texto principal |
| `--text-2` | `#A1A1A6` | `text-fg-2` | Texto secundario (mínimo permitido para texto) |
| `--text-3` | `#6B6B72` | `text-fg-3` | Solo placeholders y subrayados decorativos (3.5:1) |
| `--accent` | `#E9B824` | `accent` | Pestaña activa, botón principal, barras, destacados |
| `--brand-red` | `#E5484D` | `brand-red` | Borde del banner de página y alertas |
| `--success` | `#3FB950` | `success` | Metas alcanzadas |
| `--radius` | `4px` | `rounded-ui` | Esquinas |
| `--font-heading` | Barlow Condensed | `font-title` | Títulos, pestañas, botones |
| `--font-body` | Inter | `font-text` | Texto y cifras |

Las fuentes se cargan con `next/font` (display swap) en `src/app/panel/fonts.ts`, solo en las rutas del panel,
y escriben directamente `--font-heading` y `--font-body`.

Contraste medido (WCAG): texto 18:1 / 16.9:1 / 15.6:1 sobre bg / surface / surface-2; texto-2 7.7 / 7.2 / 6.6;
amarillo 10.6 / 9.9 / 9.2; texto oscuro sobre amarillo 10.6; verde 7.7 / 7.2 / 6.7. El rojo solo se usa en bordes e
iconos (sobre surface-2 daría 4.3:1, por eso nunca como color de texto).

## Utilidades (`@utility` en `globals.css`)

- Tipografía: `ui-title-page` (36/44 px), `ui-title-section` (24 px), `ui-title-card` (20 px), `ui-label`
  (12 px mayúsculas), `ui-num` (Inter 600, `tabular-nums`), `ui-link`.
- Superficies: `ui-card`, `ui-card-inset`.
- Botones (mín. 44 px): `ui-btn-primary`, `ui-btn-secondary`, `ui-btn-sm`.
- Formularios: `ui-input`, `ui-field-label`.
- Navegación: `ui-tab` (pestañas del panel y selector de plan), `ui-chip` (filtros dentro de una página).
- Tabla: `ui-table-wrap` + `ui-table` (cabecera pequeña en mayúsculas, filas con línea fina).
- Raíz `.gn-panel`: texto base de 15 px, foco amarillo de 2 px, placeholders y apertura suave de `<details>`;
  respeta `prefers-reduced-motion`.

## Componentes

- `src/components/club.tsx`: `StoreShell` (cabecera con avatar enmarcado según el rango y botón «Cambiar
  contraseña» junto a «Salir» + pestañas + contenido a 1152 px, secciones a 48 px), `panelTabs(role)`, `ROLE_LABEL`.
- `src/components/club-tabs.tsx`: pestañas con `aria-current`, scroll horizontal en móvil.
- `src/components/ui.tsx`: `PageBanner`, `SectionHeader`, `StatCard`, `Figure`, `ProgressBar` (8 px, % a la
  derecha, verde al llegar a la meta), `Badge` (neutral, accent, success, alert), `Accordion`, `Alert`,
  `ComingSoon`, `EmptyState`.
- Rangos (contenido y cifras en `src/content/rangos.ts`, cálculo en `src/lib/rangos.ts`):
  `src/components/rangos.tsx` (`RankEmblem`, `RankAvatar` con el marco de cada rango, `RankBadge`,
  `MaxRankInsignia`, `Embers`), `rank-hero.tsx` (anillo radial, «+N XP» y subida de rango), `rank-route.tsx`
  (ruta de rangos), `rank-unlocks.tsx` («Liberado en tu rango» y «Cómo ganar XP»).
- `src/components/license-card.tsx`: credencial de la licencia en Tu tienda (textos en `src/content/licencia-tienda.ts`).
- Clasificación: podio, lista con movimientos y nombre visible en `src/app/panel/clasificacion/`.
- Animaciones `gn-*` en `globals.css`; con `prefers-reduced-motion` no se anima nada y se ocultan las brasas y el
  brillo (`gn-motion-only`). El brillo rotatorio (`gn-halo`, conic-gradient) es la única excepción a «sin
  degradados» y solo aparece en el rango 5.
- `Flash` acepta `variant="panel"`.
- Iconos: `src/components/icons.tsx` (SVG lineal propio, trazo 1.75 px, sin emojis).

## Auditoría previa (22 oct 2026)

Estilos sueltos que había en el panel y dónde:

- Paleta propia del panel en `@theme` (`gold #e2b23c`, `gold-soft`, `blood`, `violet #9b6bff`, `pit`, `slab`)
  mezclada con la paleta general (`ash`, `smoke`, `parchment`, `linen`, `ivory`, `ok`, `warn`, `bad`): todas las
  pestañas.
- Hex sueltos: `text-[#c98a4b]` (bronce del 3.er puesto, Clasificación); sombras duras `shadow-[4px_4px_0_0_#000]`
  (utilidad `slab`, tabla de Clasificación y de Ventas).
- Tres fuentes de título (Archivo Black, Bebas Neue y Archivo): todas las pestañas.
- Tamaños de 10-11 px en etiquetas y textos de ayuda (`text-[10px]`, `text-[11px]`, `kicker`): Tu Tienda,
  Clasificación, Recompensas, Misiones, Licencia.
- Rojo y violeta como acentos decorativos (XP, tarjetas, banners de Recompensas, Misiones y Licencia, etiquetas de
  beneficios); amarillo en iconos, enlaces y cifras.
- Barras de progreso de 6 px (`Bar`) y de 8 px redondeadas (`ProgressBar`, admin) conviviendo.
- Botones del panel sin altura mínima (`btn-slab`, enlaces "Anular" y "Quitar" de texto).
- Contraseña (`/nueva-clave`) fuera del panel, con la tarjeta de acceso.

## Pendiente o fuera de alcance

- Las cifras de ventas (`money()` de `src/lib/store.ts`) siguen en formato es-VE (1.500,00) sin símbolo de moneda:
  la moneda de las ventas no está configurada y `money()` también lo usa admin. La Licencia ya muestra "$1,500 USD".
- `ApplicationStatusPill` y `ApplicationTimeline` (Mi solicitud) se comparten con admin y conservan su estilo.
