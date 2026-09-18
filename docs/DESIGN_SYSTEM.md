# morrow Enterprise Web App Design System

**Estado:** Obligatorio

**Alcance:** Toda interfaz web de morrow

**Referencia conceptual:** Claridad, sobriedad y eficiencia operativa de productos enterprise como Verkada Command

**Identidad:** Propia de morrow; no se copian marca, logotipo, textos, ilustraciones ni componentes propietarios de Verkada

## 1. Propósito

Este documento define las reglas visuales, de interacción y de implementación para todas las pantallas de morrow. Su objetivo es producir una aplicación enterprise consistente, confiable, eficiente y fácil de operar durante jornadas de trabajo reales.

Estas reglas son obligatorias para:

- Nuevas páginas, componentes y flujos.
- Rediseños y correcciones visuales.
- Estados vacíos, carga, éxito, error y permisos insuficientes.
- Interfaces Superadmin, Administrador, Encargado y Empleado.
- Web Card y registro público cuando la regla sea compatible con su contexto.

Una desviación requiere instrucción explícita del usuario y debe documentarse en `docs/DECISIONS.md`.

## 2. Dirección de diseño

morrow debe sentirse como un centro de control enterprise moderno:

- Sobrio, preciso y seguro.
- Amplio sin desperdiciar espacio.
- Denso cuando presenta datos, simple cuando solicita una acción.
- Con navegación predecible y jerarquía evidente.
- Con superficies limpias, bordes discretos y contraste alto.
- Con color reservado para acción, selección y estado.

La inspiración de Verkada se limita a principios generales: navegación clara, composición limpia, tipografía contenida, controles directos y sensación de producto operativo premium. morrow conserva su paleta, voz y patrones propios.

### 2.1 Identidad de marca

- El nombre visible del producto es `morrow`, siempre en minúsculas salvo restricciones técnicas de una plataforma.
- El símbolo es un bloque navy con esquinas suaves y la esquina inferior izquierda más cerrada. En su interior aparece una `m` minúscula en Georgia itálica blanca.
- El wordmark usa Inter o Arial semibold, tracking negativo ligero y se alinea ópticamente con el símbolo.
- Tamaño estándar del símbolo: `32px` en aplicación autenticada y `26–27px` en marketing compacto.
- En sidebar navy, el símbolo invierte a superficie blanca con `m` navy. En superficies claras usa fondo navy y `m` blanca.
- El monograma no se sustituye por iconos genéricos de wallet, gráficas o tarjetas.
- Los activos canónicos son `public/icon.svg`, `public/icons/icon-maskable.svg` y sus derivados PNG para PWA y Apple.

## 3. Principios no negociables

### 3.1 Claridad antes que decoración

Cada elemento debe ayudar a comprender el estado del sistema o completar una tarea. No agregar gradientes ornamentales, gráficos decorativos, vidrio, brillos, fondos ilustrados ni animaciones sin función.

### 3.2 Una jerarquía inequívoca

Cada pantalla debe tener, en este orden:

1. Contexto o breadcrumb.
2. Título de página.
3. Descripción breve cuando aporte información.
4. Acción primaria, si existe.
5. Estado o métricas relevantes.
6. Contenido operativo.

### 3.3 Una acción primaria por contexto

Una vista puede tener varias acciones, pero solo una debe dominar visualmente. Las demás deben ser secundarias, terciarias o estar dentro de un menú contextual.

### 3.4 Datos antes que tarjetas decorativas

Usar tablas, listas estructuradas y métricas compactas para información operativa. No convertir cada dato en una tarjeta grande. Las tarjetas se reservan para agrupaciones con una relación clara.

### 3.5 Consistencia antes que novedad

Reutilizar tokens y patrones existentes. No introducir un color, radio, sombra, espaciado o variante de control para resolver una sola pantalla.

### 3.6 Accesibilidad incorporada

La accesibilidad no es una etapa posterior. Contraste, foco, teclado, semántica, mensajes y objetivos táctiles forman parte de la definición de terminado.

## 4. Arquitectura visual

### 4.1 Aplicación autenticada de escritorio

Las áreas Superadmin y Administrador deben utilizar un shell consistente:

- Sidebar persistente de `240px` a `256px`.
- Barra superior o encabezado de contenido de `64px` cuando sea necesario.
- Fondo de aplicación gris frío muy claro.
- Área principal fluida con ancho máximo de `1440px`.
- Padding de contenido de `32px` en escritorio y `20px` en tablet.
- Separación vertical principal de `24px` o `32px`.

El sidebar debe incluir:

- Marca morrow.
- Navegación agrupada por función.
- Estado activo inequívoco.
- Identidad y rol del usuario en la zona inferior cuando estén disponibles.
- Cerrar sesión como acción visible, no escondida.

### 4.2 Interfaces operativas móviles

La PWA de empleados debe priorizar velocidad y uso con una mano:

- Ancho completo.
- Navegación inferior o encabezado compacto según el flujo.
- Acciones principales cercanas al pulgar.
- Objetivos táctiles mínimos de `44px`.
- Formularios en una sola columna.
- Confirmación explícita para compras y canjes.

### 4.3 Páginas públicas

Login, registro y Web Card pueden usar una composición centrada y más ligera, pero deben compartir tipografía, colores, controles, radios y estados con la aplicación autenticada.

### 4.4 Landing de marketing y adquisición

La ruta pública raíz tiene un objetivo distinto a las interfaces operativas: educar a una persona no técnica, volver tangible el producto y conducirla a solicitar una demo. Su referencia viva se conserva en `docs/design/design-system(1)` y define la identidad visual de morrow; su contenido ficticio solo sirve como ejemplo de composición.

#### Dirección visual

- Sensación editorial, calmada y premium, con espacio negativo generoso.
- Producto al centro: el hero debe mostrar una vista reconocible del panel y una tarjeta digital, no ilustraciones abstractas como elemento principal.
- Navy para confianza y grandes momentos de contraste; teal para interacción, progreso y estados positivos.
- Superficies claras tipo Apple con radios amplios y sombras difusas, siempre subordinadas al contenido.
- Una palabra o frase breve en serif itálica puede aportar calidez a titulares de marketing. Inter sigue siendo la fuente funcional y de cuerpo.
- No trasladar esta escala, tipografía serif ni radios amplios a la consola autenticada.

#### Tokens de marketing

| Token | Valor | Uso |
|---|---:|---|
| `--mkt-navy` | `#10253D` | CTA principal, previews de producto y bloques oscuros |
| `--mkt-navy-deep` | `#0B1B2C` | Contraste interno en superficies navy |
| `--mkt-teal` | `#0F766E` | Progreso, iconos, enlaces activos y hover |
| `--mkt-teal-soft` | `#DCEEEA` | Fondos de iconos y feedback positivo |
| `--mkt-canvas` | `#F8F8F6` | Fondo editorial de la página |
| `--mkt-card` | `#FFFFFF` | Tarjetas y superficies de producto |
| `--mkt-cream` | `#EEEDE8` | Secciones de apoyo |
| `--mkt-text` | `#17212D` | Texto principal de marketing |
| `--mkt-muted` | `#687180` | Descripciones y metadatos |
| `--mkt-border` | `#E1E5E5` | Divisores y controles discretos |

Estos tokens son una extensión semántica para marketing y no reemplazan la paleta operativa de la sección 6. No introducir gradientes; profundidad, dirección y movimiento se resuelven con capas de color sólido, líneas, transformaciones y sombras.

#### Tipografía y jerarquía

- Hero en escritorio: `48–72px`, peso `600–650`, line-height cercano a `1.03` y tracking negativo.
- Títulos de sección: `40–56px`, peso `600–650`, con máximo una frase breve en Georgia itálica.
- Cuerpo destacado: `16–17px`, line-height entre `1.65` y `1.7`, ancho máximo aproximado de `460px`.
- Eyebrow: `10px`, semibold, tracking `0.12em` y mayúsculas solo para esta etiqueta breve.
- Mantener un solo `h1`; las secciones principales usan `h2` y las tarjetas `h3`.

#### Composición de la ruta raíz

La secuencia recomendada es:

1. Header ligero con marca, anclas, acceso secundario y CTA de demo.
2. Hero dividido: propuesta de valor y CTA a la izquierda; composición tangible de producto a la derecha.
3. Franja de tipos de negocio para ayudar al visitante a reconocerse.
4. Tres beneficios centrados en resultados, no en nombres técnicos de funciones.
5. Vista del producto acompañada de una explicación simple.
6. Experiencia de la tarjeta dentro de un teléfono.
7. Proceso de tres pasos.
8. Bloque navy dedicado a Apple Wallet, Google Wallet y tarjeta web.
9. Preguntas frecuentes.
10. Cierre con un único CTA de demo y aclaración comercial honesta.

#### Componentes de marketing

- **Hero de producto:** dashboard, tarjeta y notificación pueden superponerse; la lectura central debe sobrevivir sin animación.
- **Dashboard preview:** representación simplificada con sidebar navy, tres métricas y dos paneles. Los datos son demostrativos y no deben presentarse como resultados garantizados.
- **Wallet card:** superficie navy con marca ficticia de comercio, progreso, sellos y próximo premio; debe sentirse como un pase real.
- **Teléfono:** marco oscuro y pantalla clara que contextualizan la tarjeta. Es una demostración visual, no un control interactivo.
- **Benefit card:** fondo neutral, radio de `24–28px`, icono lineal en círculo blanco, texto centrado y elevación sutil en hover.
- **Proceso:** tres columnas separadas por divisores en escritorio y una lista vertical en móvil.
- **CTA:** navy sobre superficie clara o blanco sobre navy. `Solicitar una demo` es la única acción primaria de conversión; iniciar sesión y anclas son secundarias.

#### Movimiento

- La entrada al viewport usa opacity y desplazamientos de hasta `28px`, con duración de `600–700ms`.
- Dashboard, teléfono y tarjeta pueden flotar entre `7–10px` en ciclos lentos de `7–8s`.
- Las piezas superpuestas deben moverse a ritmos distintos para producir profundidad sin distraer.
- Hover de cards y botones puede elevar hasta `5px` durante `180–220ms`.
- No usar parallax, rebotes continuos, rotaciones intensas ni animaciones que dificulten la lectura.
- Todo movimiento ambiental se elimina con `prefers-reduced-motion`.

#### Responsive y contenido

- El contenedor de marketing tiene ancho máximo de `1160px` y padding lateral de `24px` en escritorio, `16px` en móvil.
- A menos de `1024px`, hero, producto, teléfono, wallet y FAQ pasan a una columna.
- A menos de `768px`, se oculta la navegación de anclas, el CTA permanece visible y las acciones del hero ocupan el ancho disponible.
- Los mockups pueden escalarse o recortarse de forma controlada, pero nunca causar overflow horizontal en el viewport.
- El texto explica beneficios con lenguaje cotidiano; términos como PWA, tenant, RPC, RLS o pass class no aparecen en adquisición.
- No mostrar precios, checkout ni lenguaje de compra mientras pagos y planes públicos no estén habilitados.
- Toda promesa debe corresponder a capacidad existente o alcance aprobado. El CTA de demo no debe fingir un flujo de agenda si la URL aún no está configurada.

## 5. Sistema de espaciado

Usar una retícula base de `4px` y preferir estos valores:

| Token | Valor | Uso |
|---|---:|---|
| `space-1` | `4px` | Separación mínima e iconos |
| `space-2` | `8px` | Controles internos compactos |
| `space-3` | `12px` | Etiqueta y control |
| `space-4` | `16px` | Separación estándar |
| `space-5` | `20px` | Padding móvil |
| `space-6` | `24px` | Bloques y tarjetas |
| `space-8` | `32px` | Secciones principales |
| `space-12` | `48px` | Separación excepcional |

Reglas:

- No usar valores arbitrarios si uno de estos tokens resuelve el caso.
- La relación interna de un componente debe ser menor que la separación entre componentes.
- Evitar espacios verticales mayores de `48px` dentro de una consola operativa.

## 6. Color

### 6.1 Paleta base

| Rol | Valor inicial | Uso |
|---|---|---|
| Fondo app | `#F5F7F8` | Lienzo principal |
| Superficie | `#FFFFFF` | Paneles, tablas y formularios |
| Superficie sutil | `#F9FAFB` | Encabezados y filas alternas |
| Texto principal | `#111827` | Títulos y contenido |
| Texto secundario | `#667085` | Ayuda y metadatos |
| Borde | `#E4E7EC` | Divisiones y controles |
| Sidebar | `#0C1618` | Navegación enterprise |
| Primario morrow | `#149C91` | Acción principal y selección |
| Primario hover | `#0F7E75` | Hover y pressed |
| Focus | `#2563EB` | Anillo de foco accesible |

### 6.2 Estados semánticos

| Estado | Texto | Fondo | Borde |
|---|---|---|---|
| Éxito/activo | `#087A55` | `#ECFDF3` | `#ABEFC6` |
| Advertencia/pausa | `#B54708` | `#FFFAEB` | `#FEDF89` |
| Error/suspendido | `#B42318` | `#FEF3F2` | `#FECDCA` |
| Información | `#175CD3` | `#EFF8FF` | `#B2DDFF` |
| Neutral | `#475467` | `#F2F4F7` | `#D0D5DD` |

Reglas:

- Nunca comunicar estado únicamente mediante color; agregar texto e icono cuando corresponda.
- Reservar el teal para acción o selección, no para grandes fondos decorativos.
- El rojo se usa para acciones destructivas y errores, nunca como acento general.
- Verificar contraste WCAG AA: `4.5:1` para texto normal y `3:1` para texto grande y controles.

## 7. Tipografía

Fuente principal: `Inter`, con fallbacks de sistema.

| Rol | Tamaño | Peso | Interlineado |
|---|---:|---:|---:|
| Título de página | `28–32px` | `650–700` | `1.2` |
| Título de sección | `18–20px` | `650` | `1.3` |
| Título de tarjeta | `15–16px` | `600` | `1.4` |
| Cuerpo | `14–16px` | `400` | `1.5` |
| Etiqueta | `13–14px` | `550–600` | `1.4` |
| Metadato | `12–13px` | `400–500` | `1.4` |

Reglas:

- Usar sentence case; evitar títulos completamente en mayúsculas.
- No usar headings gigantes de marketing dentro de áreas autenticadas.
- Limitar texto descriptivo a `60–75` caracteres por línea.
- Los números operativos deben usar cifras tabulares cuando sea posible.
- No depender de pesos `800–900` para crear jerarquía.

## 8. Bordes, radios y elevación

- Radio de controles: `8px`.
- Radio de paneles: `10px` o `12px`.
- Pills completos solo para badges, filtros compactos y estados.
- Borde estándar: `1px solid #E4E7EC`.
- Sombra estándar: `0 1px 2px rgba(16, 24, 40, 0.05)`.
- Sombra elevada, solo para overlays: `0 12px 24px rgba(16, 24, 40, 0.12)`.
- No combinar borde fuerte y sombra fuerte en el mismo componente.

## 9. Navegación

- El elemento activo debe tener fondo, contraste e indicador persistente.
- Cada entrada usa icono consistente de `18–20px` y etiqueta textual.
- No usar iconos sin etiqueta en navegación primaria.
- Agrupar por dominio: Operación, Configuración, Datos y Sistema.
- Mantener acciones globales fuera de tablas y acciones de fila dentro de su fila.
- Breadcrumbs obligatorios a partir del segundo nivel de profundidad.
- En móvil, el sidebar se convierte en drawer; no se comprime a iconos ambiguos.

## 10. Encabezado de página

Cada página autenticada debe usar el mismo patrón:

- Eyebrow o breadcrumb discreto.
- Título descriptivo orientado a la tarea.
- Descripción de una línea cuando sea necesaria.
- Acción primaria alineada a la derecha en escritorio y a ancho completo en móvil.
- Filtros debajo del encabezado, no mezclados con el título.

Ejemplos correctos:

- `Tenants` — `Administra acceso, estado y configuración de cada negocio.`
- `Programa de fidelidad` — `Define cómo se acumulan sellos y se generan recompensas.`

Evitar títulos vagos como `Configuración`, `Inicio` o frases promocionales dentro de la consola.

## 11. Botones y acciones

### Primario

- Fondo teal, texto blanco.
- Altura estándar `40px`; `44–48px` en móvil crítico.
- Solo una acción primaria visible por bloque.

### Secundario

- Fondo blanco, borde neutral, texto principal.
- No usar borde teal para todas las acciones secundarias.

### Terciario

- Sin superficie permanente; aparece como texto o icono con estado hover.

### Destructivo

- Rojo y confirmación explícita.
- El texto debe nombrar la consecuencia: `Suspender tenant`, no `Aceptar`.

Todos los botones deben incluir estados hover, focus, active, disabled y pending. Una acción pendiente debe impedir doble envío y conservar una etiqueta comprensible.

## 12. Formularios

- Etiqueta visible sobre cada control.
- Ayuda debajo del control solo cuando sea necesaria.
- Validación cerca del campo y resumen global cuando existan varios errores.
- No usar placeholder como sustituto de etiqueta.
- Altura mínima de control `40px`; móvil `44px`.
- Formularios cortos en una columna; dos columnas únicamente cuando los campos tengan relación clara.
- Acciones alineadas al final del formulario y separadas por `24px` del último campo.
- Marcar campos opcionales; no llenar la pantalla de asteriscos.
- Conservar valores capturados después de errores siempre que sea seguro.

## 13. Tablas y listas operativas

- Encabezado de tabla visible y fijo cuando la longitud lo justifique.
- Altura de fila objetivo: `52–60px`.
- Alineación izquierda para texto y derecha para números.
- Estados mediante badge textual.
- Acción principal de fila visible; acciones adicionales en menú contextual.
- Hover de fila sutil, sin transformar ni elevar.
- En móvil, convertir filas en bloques estructurados; no depender solo de scroll horizontal.
- Incluir búsqueda y filtros cuando el volumen esperado lo requiera.
- Mostrar conteo de resultados y estado de filtros aplicados.

## 14. Métricas y dashboards

- Presentar primero las métricas que ayudan a decidir o detectar problemas.
- Cada métrica incluye etiqueta, valor, periodo/contexto y tendencia solo si existe comparación real.
- No inventar tendencias ni porcentajes.
- Usar máximo cuatro métricas principales por fila.
- Los gráficos deben tener título, unidad, rango temporal, leyenda y alternativa textual.
- Evitar gráficas 3D, gauges decorativos y colores excesivos.

## 15. Estados del sistema

Toda vista con datos remotos debe diseñar explícitamente:

- Carga: skeleton que conserve la estructura; evitar spinners a pantalla completa.
- Vacío inicial: explicar qué falta y ofrecer la siguiente acción.
- Sin resultados: conservar filtros y permitir limpiarlos.
- Error recuperable: explicar y ofrecer reintento.
- Error de permisos: indicar que el acceso está restringido sin revelar datos.
- Éxito: confirmación breve cerca del contexto modificado.
- Offline en PWA: indicar estado y bloquear operaciones que requieren red.

No mostrar páginas vacías, tablas sin explicación ni errores técnicos sin traducir.

## 16. Iconografía

- Usar una sola familia de iconos lineales.
- Tamaños estándar: `16px`, `18px`, `20px` y `24px`.
- Stroke consistente entre `1.75` y `2`.
- Los iconos complementan texto; no reemplazan etiquetas críticas.
- No usar emoji como iconografía de producto.
- Todo botón de solo icono necesita `aria-label` y tooltip.

## 17. Movimiento

- Duración estándar: `120–200ms`.
- Curva: `ease-out` para entrada y `ease-in` para salida.
- Animar opacity y transform; evitar animar dimensiones grandes.
- No usar parallax, rebotes ni movimiento ambiental en la consola.
- Respetar `prefers-reduced-motion`.
- Una operación crítica nunca depende de una animación para comunicar su resultado.

## 18. Responsive

Breakpoints de referencia:

- Móvil: `< 640px`.
- Tablet: `640–1023px`.
- Escritorio: `>= 1024px`.
- Escritorio amplio: `>= 1440px`.

Reglas:

- Diseñar y comprobar como mínimo en `375px`, `768px`, `1280px` y `1440px`.
- Ningún texto, control o acción debe quedar fuera del viewport.
- No ocultar funcionalidad crítica en móvil.
- El orden visual y el orden del DOM deben coincidir.
- Evitar media queries específicas para un solo dispositivo.

## 19. Accesibilidad

Requisitos mínimos:

- HTML semántico y landmarks.
- Un solo `h1` por pantalla y jerarquía de headings sin saltos arbitrarios.
- Navegación completa por teclado.
- Foco visible de al menos `2px`.
- Labels asociados a inputs.
- Mensajes con `role="alert"` o `role="status"` cuando corresponda.
- Objetivos táctiles de al menos `44 × 44px` en móvil.
- Contraste WCAG AA.
- No usar color como único indicador.
- Texto alternativo útil para imágenes informativas y `alt=""` para decoración.
- Tablas con encabezados y captions accesibles cuando aporten contexto.

## 20. Voz y contenido

- Español claro, directo y profesional.
- Sentence case en títulos, botones y navegación.
- Usar verbos específicos: `Crear tenant`, `Guardar cambios`, `Revertir canje`.
- Evitar tecnicismos cuando el usuario no necesita conocerlos.
- No usar texto promocional dentro de tareas operativas.
- Los errores indican qué ocurrió y qué puede hacer el usuario.
- Confirmaciones destructivas nombran la entidad y la consecuencia.
- Mantener consistencia terminológica con `docs/PRODUCT.md`.

## 21. Reglas de implementación

- Centralizar tokens visuales como variables CSS o configuración compartida.
- Reutilizar componentes antes de crear variantes locales.
- No usar estilos inline salvo valores dinámicos de marca validados.
- No introducir librerías visuales sin justificar tamaño, licencia y consistencia.
- Evitar dependencias para iconos aislados si el proyecto ya tiene una solución.
- Los componentes interactivos deben cubrir disabled, pending, error y teclado.
- Las páginas no deben duplicar shells, encabezados o navegación.
- Mantener Server Components por defecto; usar Client Components solo cuando la interacción lo requiera.
- No debilitar permisos, RLS ni autoridad backend por conveniencia visual.
- No mostrar información que el rol no puede consultar.

## 22. Patrones prohibidos

- Encabezados gigantes tipo landing page dentro de la consola.
- Más de una acción primaria compitiendo en el mismo bloque.
- Cards grandes para cada enlace de navegación.
- Sombras intensas, gradientes decorativos o glassmorphism.
- Radios excesivos o todos los controles en forma de pill.
- Texto gris con contraste insuficiente.
- Acciones destructivas junto a acciones frecuentes sin separación.
- Tablas sin estado vacío, carga o error.
- Iconos de familias diferentes.
- Valores visuales arbitrarios repetidos fuera de tokens.
- Diseño desktop encogido sin adaptación móvil.
- Copiar nombres, logotipos, ilustraciones o UI propietaria de Verkada.

## 23. Lista de verificación obligatoria

Antes de considerar terminada cualquier tarea de interfaz, verificar:

- [ ] La página usa el shell y jerarquía estándar de su área.
- [ ] Existe una sola acción primaria por contexto.
- [ ] Espaciado, color, tipografía, radios y sombras usan tokens aprobados.
- [ ] Se implementaron los estados relevantes: carga, vacío, error, éxito y pending.
- [ ] La interfaz funciona por teclado y tiene foco visible.
- [ ] El contraste cumple WCAG AA y el estado no depende solo del color.
- [ ] La vista fue revisada en `375px`, `768px`, `1280px` y `1440px` cuando aplica.
- [ ] Los objetivos táctiles críticos miden al menos `44 × 44px` en móvil.
- [ ] Los textos son específicos, consistentes y orientados a la acción.
- [ ] No se agregó un patrón visual único que deba convertirse en componente compartido.
- [ ] No se expusieron datos o acciones fuera del permiso del rol.
- [ ] Las pruebas, lint, typecheck y build relevantes pasan.
- [ ] El diff fue revisado contra este documento.

## 24. Gobierno del sistema

- Este documento es la fuente de verdad visual del proyecto.
- Las nuevas decisiones visuales reutilizables deben actualizar este archivo antes o junto con su implementación.
- Los cambios que contradigan una regla requieren autorización explícita del usuario y una decisión registrada.
- Una pantalla existente que no cumpla estas reglas debe mejorar de forma incremental cuando sea modificada; no se debe propagar su inconsistencia.
- Las referencias externas sirven para estudiar principios, nunca para sustituir el criterio, la identidad o los requisitos de morrow.
