# Sistema de diseño del panel de licenciatarios

Alcance: todo lo que se ve dentro del panel (`/panel/*` y el cambio de contraseña, `/nueva-clave`, enlazado desde la cabecera). El panel de
administración (`/admin`), el acceso y la página pública conservan su estilo anterior (tokens `obsidian`, `ivory`,
`bronze`… en `globals.css`) y no se tocaron.

Principio: tema «Mando Central» (referencia: Gallo Negro Mando Central V2.6, oct 2026). Monocromo: fondo casi negro,
tarjetas gris oscuro con borde fino y esquinas muy redondeadas, texto blanco, botones y pills blancos con texto negro.
Sin amarillo ni rojo de acento (sustituye las reglas de acento amarillo/rojo/verde anteriores, a pedido de Fernando
el 28 oct 2026).

## Tokens (`src/app/globals.css`, bloque `:root`)

| Token | Valor | Alias Tailwind | Uso |
|---|---|---|---|
| `--bg` | `#121212` | `bg-bg`, `text-bg` | Fondo de página, cabecera y barra inferior |
| `--surface` | `#1A1A1A` | `bg-surface` | Tarjetas |
| `--surface-2` | `#262626` | `bg-surface-2` | Hover, pista de las barras, esqueletos de carga |
| `--inset` | `#000000` | `bg-inset` | Bloques negros dentro de tarjetas (`ui-card-inset`), badges neutros |
| `--border` | `#2A2A2A` | `border-line` | Bordes de 1 px |
| `--text` | `#FFFFFF` | `text-fg` | Texto principal |
| `--text-2` | `#A3A3A3` | `text-fg-2` | Texto secundario (mínimo permitido para texto) |
| `--text-3` | `#737373` | `text-fg-3` | Solo placeholders y detalles decorativos |
| `--accent` | `#FFFFFF` | `accent` | Botón principal, pestaña y filtro activos, barras de progreso (siempre con texto negro encima) |
| `--accent-hover` | `#E5E5E5` | `accent-hover` | Hover del botón principal |
| `--brand-red` | `#D4D4D4` | `brand-red` | Nombre heredado: borde de alertas y detalles de emblemas, ahora gris claro |
| `--success` | `#FFFFFF` | `success` | Nombre heredado: metas alcanzadas, ahora blanco |
| `--radius` | `12px` | `rounded-ui` | Botones, filtros, campos, bloques internos |
| `--radius-card` | `16px` | `rounded-card` | Tarjetas, acordeones y tablas |
| `--font-heading` | Inter 800-900 | `font-title` | Títulos en mayúsculas |
| `--font-body` | Inter | `font-text` | Texto, botones y cifras |
| `--font-mono` | JetBrains Mono | `font-code` (`ui-mono`) | Etiquetas técnicas: badges neutros («Lote #4092», «1000 PGN») |

Las fuentes se cargan con `next/font` (display swap) en `src/app/panel/fonts.ts`, solo en las rutas del panel;
escriben `--font-body` y `--font-mono`, y `.gn-panel` apunta `--font-heading` a la misma Inter.

Contraste medido (WCAG): blanco 18.7:1 / 17.4:1 / 15.1:1 sobre bg / surface / surface-2; texto-2 7.4:1 / 6.9:1 / 6:1
(8.3:1 sobre negro); negro sobre botón blanco 21:1. Al no haber color, los estados se distinguen por relleno (blanco
sólido = activo o destacado), por iconos (alerta, check) y por texto.

## Utilidades (`@utility` en `globals.css`)

- Tipografía: `ui-title-page` (`clamp()` de 24 a 32 px, Inter 900 mayúsculas), `ui-title-section` (18 px, 800 mayúsculas),
  `ui-title-card` (18 px, 700), `ui-label` (12 px mayúsculas), `ui-num` (Inter 600, `tabular-nums`), `ui-mono`, `ui-link`.
- Superficies: `ui-card` (16 px de radio), `ui-card-inset` (bloque negro).
- Botones (mín. 44 px, Inter 700 sin mayúsculas): `ui-btn-primary` (blanco, texto negro), `ui-btn-secondary` (gris con borde), `ui-btn-sm`.
- Formularios: `ui-input` (16 px para que iOS no haga zoom), `ui-field-label`.
- Navegación: `ui-tab` (pestañas del panel y selector de plan; activa en blanco), `ui-chip` (filtros dentro de una página; activo
  relleno blanco con texto negro, como «Todos» en la referencia).
- Tabla: `ui-table-wrap` + `ui-table` (cabecera pequeña en mayúsculas, filas con línea fina).
- Listas horizontales: `gn-snap-x` (scroll-snap por elemento, deja ver el siguiente).
- Raíz `.gn-panel`: resaltado táctil sutil, texto base de 15 px, foco blanco de 2 px, placeholders y apertura suave de `<details>`;
  respeta `prefers-reduced-motion`.

## Componentes

- `src/components/club.tsx`: `StoreShell` (cabecera con logo blanco «GN», «GALLO NEGRO» y subtítulo gris en mayúsculas, avatar enmarcado según el rango y botón «Cambiar
  contraseña» junto a «Salir» + pestañas + contenido a 1152 px, secciones a 48 px), `panelTabs(role)`, `ROLE_LABEL`.
- `src/components/club-tabs.tsx`: pestañas con `aria-current` (solo desde 768 px).
- Móvil primero (< 768 px): cabecera compacta (logo, tienda truncada y avatar), `bottom-nav.tsx` (barra
  inferior Perfil · Misiones · Tienda Clan · Recompensas · Más: iconos de 20 px y etiquetas de 11 px en mayúsculas,
  gris y blanco la activa; punto blanco si hay diarias pendientes,
  `src/lib/panel-nav.ts`), `bottom-sheet.tsx` (panel inferior en móvil y ventana en escritorio sobre `<dialog>`,
  cierre visible y al tocar fuera), `rank-compact.tsx` (tarjeta compacta de rango en Perfil).
  `main` deja sitio al final para la barra (`env(safe-area-inset-bottom)`). Las tablas pasan a listas de dos
  líneas en móvil (ventas, historial de XP).
- Perfil (`/panel`, vista en `src/app/panel/perfil-view.tsx`): botón del punto de venta, 4 indicadores, ventas y
  `rank-compact.tsx`; en acordeones plegados `tienda-juego.tsx` («Misiones de hoy», racha, «Tu siguiente jugada» y
  panel de evidencia; cálculos en `src/lib/misiones-hoy.ts`, vuelo «+N XP» hasta la tarjeta de rango con
  `src/lib/xp-celebracion.ts`) y la ruta de rangos. Textos en `TEXTOS_TIENDA` y `TEXTOS_NAV` de `src/content/rangos.ts`.
- `src/components/ui.tsx`: `PageBanner` (sin borde lateral), `SectionHeader`, `StatCard`, `Figure`, `ProgressBar` (8 px
  redondeada, blanca sobre gris, % a la derecha), `Badge` (neutral: monoespaciada sobre negro; accent: blanca con texto
  negro; success y alert: borde claro), `Accordion`, `Alert`,
  `ComingSoon`, `EmptyState`.
- Rangos (contenido y cifras en `src/content/rangos.ts`, cálculo en `src/lib/rangos.ts`):
  `src/components/rangos.tsx` (`RankEmblem`, `RankAvatar` con el marco de cada rango, `RankBadge`,
  `MaxRankInsignia`, `Embers`), `rank-compact.tsx` (tarjeta compacta), `rank-route.tsx`
  (ruta de rangos), `rank-unlocks.tsx` («Liberado en tu rango»).
- `src/components/license-card.tsx`: credencial de la licencia en Tu tienda (textos en `src/content/licencia-tienda.ts`).
- Ventas vive dentro de Perfil (`/panel/ventas`, sin pestaña propia). Tienda Clan (`/panel/tienda-clan`) está en
  «Próximamente». Clasificación y Licencia se retiraron del panel (sus rutas llevan a Perfil).
- Animaciones `gn-*` en `globals.css`; con `prefers-reduced-motion` no se anima nada y se ocultan las brasas y el
  brillo (`gn-motion-only`). El brillo rotatorio (`gn-halo`, conic-gradient) es la única excepción a «sin
  degradados» y solo aparece en el rango 5.
- `Flash` acepta `variant="panel"`.
- Iconos: `src/components/icons.tsx` (SVG lineal propio, trazo 1.75 px, sin emojis).

## Auditoría previa (22 oct 2026, antes del tema «Mando Central»)

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

- Algunos textos de contenido describen colores del tema anterior (p. ej. «Marco amarillo», «detalle rojo» en
  `src/content/rangos.ts`); no se tocaron porque el cambio de tema fue solo visual.
