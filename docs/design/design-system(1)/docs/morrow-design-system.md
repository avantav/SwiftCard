# Morrow Design System

## Propósito

Morrow es una plataforma de loyalty para negocios locales. Su lenguaje visual combina claridad editorial, superficies tipo Apple y una sensación de producto confiable: mucho espacio, jerarquía precisa y componentes que dejan respirar al contenido.

## Principios visuales

- **Calma antes que ruido:** la interfaz evita adornos innecesarios y prioriza una acción clara.
- **Producto al centro:** las cards muestran el valor con superficies amplias, esquinas suaves y contenido centrado.
- **Contraste con intención:** Navy comunica confianza; Teal señala progreso, interacción y éxito.
- **Detalles funcionales:** iconos, pills y sombras existen para orientar, no para decorar.
- **Responsive primero:** los layouts se adaptan de una columna en móvil a composiciones amplias en desktop.

## Color

| Token | Valor | Uso |
|---|---|---|
| `--navy` | `#10253d` | Marca, navegación de producto, CTA principal, wallet |
| `--teal` | `#0f766e` | Acciones secundarias, estados positivos, iconografía |
| `--background` | `#f8f8f6` | Fondo general de página |
| `--card` | `#ffffff` | Cards, panels y superficies elevadas |
| `--muted-foreground` | `#6b7280` | Texto secundario y descripciones |
| `--border` | `#e5e7eb` | Divisores y controles outline |
| `--cream` | `#eeede8` | Superficies de apoyo y contraste suave |

La paleta debe mantenerse entre estos neutrales, Navy y Teal. Evita introducir gradientes o colores adicionales salvo que exista una necesidad funcional clara.

## Tipografía

- **Inter / Arial:** fuente principal para navegación, body, labels, números y controles.
- **Georgia:** acento serif en palabras clave de titulares mediante `.serif-accent`.

### Escala

| Nivel | Tamaño | Uso |
|---|---:|---|
| Display | `72px` | Hero headlines en desktop |
| Section | `56px` | Títulos de sección |
| Heading | `24px` | Subtítulos y títulos de cards |
| Body | `16px` | Párrafos principales |
| Label | `13px` | UI, metadata y footer |
| Eyebrow | `10–11px` | Categorías y labels de sección |

Los titulares usan letter-spacing negativo, line-height compacto y `text-balance` cuando sea posible. El body debe conservar line-height aproximado de `1.6`.

## Espaciado y formas

La escala base usa incrementos de 4px: `4, 8, 12, 16, 24, 32, 48px`. Usa `gap` para separar elementos en flex y grid.

- `4px`: controles compactos y select pills.
- `7px`: botones estándar.
- `16px`: panels y cards pequeñas.
- `24px`: dashboard shell.
- `26–28px`: cards de producto, beneficios y pricing.
- `999px`: pills, toggles y badges.

## Sombras

Las superficies deben usar sombras ligeras y amplias, no bordes pesados:

- Cards internas: `0 8px 20px #10253d08`.
- Dashboard / superficies principales: `0 22px 55px #10253d16`.
- Elementos flotantes: `0 25px 35px #10253d28`.

## Componentes

### Logo

`.logo-mark` es un bloque Navy de 26px con esquina inferior izquierda reducida y una `m` serif italic. Se acompaña de `morrow` en Inter/Arial semibold.

### Buttons

- `.button-dark`: acción primaria, fondo Navy y texto blanco.
- `.button-light`: acción sobre fondo Navy, fondo blanco y texto Navy.
- `.button-outline`: acción secundaria sobre superficies claras.

Los botones usan `display: inline-flex`, gap de 9px, padding aproximado `12px 17px`, radio de 7px y un desplazamiento vertical sutil en hover.

### Pills

`.pill` comunica contexto o estado. Usa borde suave, radio completo, tipografía de 11px y un `.pill-dot` Teal cuando el estado está activo.

### Benefit cards

Las cards de beneficios siguen el patrón tipo Apple: fondo gris muy claro, radio de 28px, altura generosa y contenido centrado. El icono vive en un círculo blanco; el enlace queda debajo como una acción ligera.

### Pricing cards

Las cards de pricing comparten la misma estructura: nombre, descripción, precio, acción, divisor y lista de inclusiones. El plan recomendado usa Navy, texto blanco y una elevación vertical leve en desktop.

### Dashboard panels

`.dashboard-shell` combina sidebar Navy con contenido crema/blanco. `.metric-card` y `.panel` son superficies blancas con radio de 16–18px y sombra mínima.

### Wallet card

La wallet card usa Navy, radio de 26px, texto blanco y datos de progreso en forma de stamps. Debe sentirse como un pase digital real, no como una card genérica.

### iPhone mockup

`.iphone-frame` representa un iPhone mostrando un pase de Apple Wallet: marco oscuro, Dynamic Island, barra de estado, encabezado de Wallet, tarjeta de loyalty, sellos de visitas, recompensa, código de barras y acciones del pase. Se utiliza dentro de `.iphone-section` como una prueba tangible de cómo el programa vive en el bolsillo del cliente.

En desktop el teléfono se presenta con una inclinación sutil y mucho espacio negativo. En móvil la sección pasa a una sola columna, reduce el teléfono a `270px × 550px` y mantiene los controles y textos con contraste suficiente. El mockup es decorativo desde el punto de vista funcional, pero incluye `aria-label` para describir la vista a tecnologías asistivas.

## Estados e interacción

- Hover: cambiar color a Teal o elevar la superficie de forma sutil.
- Active: usar Navy sólido para tabs, toggles y navegación seleccionada.
- Focus: conservar un indicador visible y contrastado; no eliminar `outline` sin reemplazo.
- Disabled: reducir contraste y evitar elevación.
- Motion: usar movimientos lentos y suaves únicamente en elementos flotantes o feedback de interacción.

## Responsive

- Desktop: contenedor máximo de `1160px` y grids de 2–3 columnas.
- Tablet: colapsar grids complejos y mantener cards con ancho legible.
- Móvil: contenedor horizontal de `16px`, una columna, botones apilables y dashboard escalado dentro de un viewport recortado.

## Convenciones de implementación

- Usar tokens semánticos de `globals.css`; evitar colores directos en nuevas superficies.
- Usar Flexbox para layouts lineales y Grid solo para composiciones bidimensionales.
- Mantener iconos consistentes de Lucide entre 14px y 20px.
- Usar HTML semántico (`main`, `header`, `section`, `article`, `footer`).
- Añadir `aria-label`, `role="tablist"`, `role="tab"` y `aria-selected` en controles interactivos.
- Mantener la guía viva en `/components` y esta documentación sincronizada con los tokens reales.

## Referencia viva

La ruta `/components` contiene especímenes interactivos de foundations, typography, components, cards y product UI. Es la fuente visual para diseñar nuevas pantallas de Morrow.
