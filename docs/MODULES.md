# Módulos por tenant

Estado: **propuesto** (DEC-0072). Ningún cambio de código ni migración aplicado.

## Objetivo

Las funciones del producto se agrupan en **módulos**. Un tenant tiene un
módulo activo **según lo que paga** (su paquete y sus complementos), y el
Superadmin puede:

- **Otorgar** un módulo a un tenant aunque su paquete no lo incluya (cortesía,
  piloto, venta manual), con fecha de vencimiento opcional.
- **Quitar** un módulo a un tenant aunque lo pague (mal funcionamiento, abuso).
- **Apagar** un módulo para todos los tenants de inmediato (interruptor de
  emergencia), o liberarlo solo a tenants seleccionados (beta).

SwiftPOS implementa el mismo diseño en su propio Superadmin y con sus propios
planes (`subscription_plans.features`). Cada sistema administra sus módulos.

## Principios

1. **Cada función nueva nace como módulo o dentro de uno.** El módulo envuelve
   solo el código nuevo; lo existente no se condiciona a un módulo nuevo.
2. **Sin módulo = comportamiento de antes.** Si un tenant no tiene el módulo,
   su ruta de código no se ejecuta y el resto de la aplicación funciona igual.
3. **Falla hacia lo seguro.** Si el estado no se puede leer, el módulo se
   evalúa como inactivo. Un problema con los módulos nunca rompe una operación
   existente.
4. **Se aplica en el servidor.** La interfaz muestra u oculta, pero la decisión
   se valida en server actions, rutas y RPCs.
5. **Lo pagado se respeta.** El acceso sale de la copia congelada de la
   suscripción (`entitlements_snapshot`): un cambio en el catálogo de paquetes
   no quita módulos a quien ya pagó; aplica al renovar o cambiar de paquete.
6. **La seguridad no es un módulo.** Autenticación, aislamiento entre tenants,
   permisos, límites y validaciones nunca se apagan.

## Modelo

### Catálogo en código

`src/lib/modules/catalog.ts` declara cada módulo:

| Campo | Ejemplo |
|---|---|
| `key` | `swiftpos_integration` |
| `name` / `description` | «Integración SwiftPOS» / qué incluye |
| `kind` | `MODULE` (se vende) o `SWITCH` (interruptor interno de un módulo) |
| `parent` | Para `SWITCH`: el módulo al que pertenece |
| `addedIn` | `DEC-0071` |

Solo se aceptan claves del catálogo. El editor de paquetes del Superadmin
muestra la lista de módulos del catálogo (sustituye las casillas fijas de
«Capacidades») y guarda los elegidos en `billing_packages.entitlements`:
`{ "modules": ["campaigns", "advanced_statistics", "swiftpos_integration"] }`.

### Estado global por módulo (Superadmin)

| Modo | Efecto |
|---|---|
| `OFF` | Inactivo para **todos**, aunque lo paguen. Interruptor de emergencia. |
| `BETA` | Activo solo en tenants con otorgamiento manual (`GRANTED`). |
| `ON` | Disponible según lo que pague cada tenant (operación normal). |

### Estado por tenant (Superadmin)

| Estado | Efecto |
|---|---|
| `INHERIT` | Por defecto: depende de su suscripción. |
| `GRANTED` | Activo aunque su paquete no lo incluya; `expires_at` opcional. |
| `REVOKED` | Inactivo aunque lo pague. |

### Evaluación

```
global OFF                                   → inactivo
tenant REVOKED                               → inactivo
tenant GRANTED (vigente)                     → activo
global BETA                                  → inactivo
suscripción ACTIVE/TRIALING sin terminar
  y módulo en entitlements_snapshot.modules  → activo
otro caso o error al leer                    → inactivo
```

Un `SWITCH` está activo solo si su módulo padre está activo **y** su propio
estado global no es `OFF`. Los `SWITCH` sirven para apagar una parte de un
módulo sin apagarlo entero (por ejemplo, solo el envío de compras de SwiftPOS)
y también admiten `REVOKED` por tenant.

## Almacenamiento (SwiftCard)

- `public.module_states (key, mode, updated_by, updated_at)`.
- `public.tenant_module_overrides (key, tenant_id, state, expires_at, reason)`.
- Sin acceso directo para `authenticated`. Escritura solo con
  `app.set_module_global(key, mode, reason)` y
  `app.set_tenant_module(key, tenant_id, state, expires_at, reason)`,
  exclusivas de Superadmin.
- `app.tenant_has_module(key, tenant_id)` para RPCs y
  `app.current_tenant_modules()` para la interfaz del tenant.
- En Next.js, `tenantHasModule(key, tenantId)` con caché de 30 s; un cambio
  tarda como máximo 30 s en aplicarse.
- Todo cambio exige motivo y queda en `audit_logs`.

## Superadmin

- **«Módulos»** (`/superadmin/modules`): catálogo con modo global, tenants que
  lo tienen por paquete, otorgados y revocados; botón de apagado inmediato con
  confirmación; historial de cambios.
- **Paquetes** (`/superadmin/billing/packages`): selección de módulos incluidos
  en cada paquete, desde el catálogo.
- **Detalle del tenant**: sección «Módulos» con estado efectivo, origen
  (paquete, otorgado, revocado, apagado global) y acciones otorgar/revocar.

## Migración de lo existente

Hoy campañas y estadísticas avanzadas dependen de `package_code_snapshot =
'empresarial'` o de `tenants.campaigns_enabled` (DEC-0068, DEC-0069). Se
convierten en los módulos `campaigns` y `advanced_statistics`:

1. Agregar ambos a `entitlements.modules` del paquete Empresarial y a las
   suscripciones vigentes de ese paquete.
2. Tenants con `campaigns_enabled = true` → `GRANTED` en ambos módulos.
3. `app.tenant_campaigns_available` pasa a llamar a `tenant_has_module`
   conservando su firma, para que el código actual no cambie.
4. Verificar antes y después que cada tenant conserva exactamente el mismo
   acceso.

Las casillas actuales de «Capacidades» (Apple Wallet, Google Wallet,
white-label, analítica avanzada) se revisan una por una antes de convertirlas;
hoy se guardan pero no todas se aplican, así que encenderlas de golpe podría
quitar funciones a tenants actuales.

## Cómo agregar una función nueva

1. Declararla en el catálogo (nuevo `MODULE` o `SWITCH` dentro de uno).
2. Envolver solo el código nuevo con `tenantHasModule`; sin módulo → camino
   anterior.
3. Pruebas con el módulo activo **e** inactivo; la prueba inactiva debe dar el
   mismo resultado que antes del cambio.
4. Desplegar en `OFF`, pasar a `BETA` con un tenant piloto (`GRANTED`), después
   `ON` e incluirlo en los paquetes que lo vendan.

## Primeros módulos del catálogo

| Clave | Tipo | Notas |
|---|---|---|
| `campaigns` | MODULE | Migrado de DEC-0068 |
| `advanced_statistics` | MODULE | Migrado de DEC-0069 |
| `swiftpos_integration` | MODULE | DEC-0071 |
| `swiftpos_integration.card_resolve` | SWITCH | Identificar tarjetas desde el POS |
| `swiftpos_integration.purchases` | SWITCH | Recibir compras del POS |
| `swiftpos_integration.wallet_refresh` | SWITCH | Refrescar Wallet tras compras del POS |
| `swiftpos_integration.location_validation` | SWITCH | Validar la ubicación enviada |

## Complejidad

| Pieza | Esfuerzo |
|---|---|
| Migración, RPCs y evaluación | 1–2 días |
| Catálogo, caché y pruebas | 1 día |
| Pantallas de Superadmin (módulos, paquetes, tenant) | 2–3 días |
| Migración de campañas y estadísticas con verificación | 1 día |
| **Total SwiftCard** | **~5–7 días** |
| Equivalente en SwiftPOS | ~5 días |
