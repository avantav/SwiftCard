# Integración SwiftPOS → SwiftCard

Estado: **lado SwiftCard implementado** (DEC-0071, migración `0081`, pendiente de
aplicar en producción). Falta el lado SwiftPOS.

## Objetivo y alcance

Que las ventas de SwiftPOS acumulen sellos/puntos en la tarjeta de SwiftCard
del cliente sin recapturar el ticket en la PWA. SwiftCard es el **sistema final
de lealtad** y el único que calcula sellos, puntos, remanentes y recompensas.

En esta fase el POS solo hace dos cosas:

1. **Identificar al cliente** (escaneando el QR de su tarjeta).
2. **Enviar la compra**: monto, ticket y, si la tiene, ubicación.

Se autentica con una **API key** por vínculo. **No** se crea ningún usuario ni
perfil de empleado adicional en SwiftCard.

Fuera de esta fase: canje de recompensas desde el POS, cancelaciones
automáticas, ventas online y ventas sin tarjeta.

## Decisiones del dueño (2026-11-13)

| # | Decisión | Consecuencia |
|---|---|---|
| D1 | Ambos sistemas tienen el mismo dueño. | El Superadmin de SwiftCard crea el vínculo y emite la API key. |
| D2 | Genera puntos el **monto pagado por el cliente**. | Total final de la venta (después de descuentos, con impuestos, sin el cambio), en centavos. |
| D3 | SwiftCard es el sistema final de lealtad. | SwiftPOS desactiva su descuento por nivel de membresía en tenants vinculados. |
| D4 | Ventas sin tarjeta escaneada se ignoran. | No se envían. Sin backfill. |
| D5 | Sin usuario adicional; autenticación con API key. | Las compras de la integración no tienen empleado de SwiftCard (`staff_profile_id` vacío, `source = 'SWIFTPOS'`). |
| D6 | Ubicación solo si es necesaria. | Opcional en la petición; si llega, se valida con la geocerca de la sucursal. |
| D7 | Por ahora solo identificar y enviar la compra. | Si una venta se cancela en el POS, el administrador cancela la compra en SwiftCard como hoy. |

## Contrato de la API

Base: `/api/integrations/swiftpos/v1`. JSON (máximo 8 KB), HTTPS, `no-store`.
Cabecera: `Authorization: Bearer sc_live_<prefijo>_<secreto>`. Límite: 120
peticiones por minuto por llave. Requiere `SWIFTPOS_SCAN_TICKET_SECRET` en el
servidor (32 bytes en base64); sin ella responde `503 NOT_CONFIGURED`.

### `POST /cards/resolve` — identificar al cliente

```json
{ "storeId": "<id de sucursal en el POS>", "scan": "<texto leído del QR>" }
```

`scan` acepta la URL `/scan/q1_…` del QR o el token directo. Respuesta `200`:

```json
{
  "scanTicket": "v1.<…>.<firma>",
  "customer": { "firstName": "Ana" },
  "card": {
    "name": "Café frecuente",
    "programType": "STAMPS_PER_PURCHASE",
    "balance": 7,
    "unit": { "singular": "sello", "plural": "sellos" },
    "availableRewards": 1
  }
}
```

El `scanTicket` dura 72 h y une tarjeta, vínculo y sucursal. No se devuelve
teléfono, correo, token ni identificador del cliente.

### `POST /purchases` — enviar la compra

```json
{
  "storeId": "<id de sucursal en el POS>",
  "scanTicket": "<de /cards/resolve>",
  "externalSaleId": "<id único de la venta en el POS>",
  "ticketNumber": "A-001234",
  "amountMinor": 18550,
  "occurredAt": "2026-11-13T18:20:00Z",
  "cashier": { "id": "<id del empleado en el POS>", "name": "Luis P." },
  "location": { "latitude": 29.07, "longitude": -110.95 }
}
```

- `cashier` es obligatorio: en SwiftPOS toda venta lleva al empleado que la
  cobró y cualquier empleado puede registrar ventas. SwiftCard lo guarda solo
  como trazabilidad (`external_operator_id`, `external_operator_name`); no
  valida permisos ni lo crea como usuario.
- `location` es opcional (ver «Ubicación»).
- El ticket se guarda tal cual, sin prefijo: si el mismo ticket se captura
  también en la PWA de la sucursal, el segundo intento responde
  `DUPLICATE_TICKET` y no se acumula dos veces.
- Reintentar con el mismo `externalSaleId` es seguro: responde
  `ALREADY_RECORDED` con el resultado original. Con otro monto o tarjeta
  responde `IDEMPOTENCY_CONFLICT`.

Respuesta `200`:
`{ "result": "CONFIRMED" | "ALREADY_RECORDED", "stampsAwarded": 1, "rewardsGenerated": 0, "balance": 8 }`.

### `GET /status`

`{ "modules": { "swiftpos_integration": true, "swiftpos_integration.card_resolve": true, … } }`.
Funciona aunque el módulo esté apagado, para que SwiftPOS muestre el estado.

### Errores

Cuerpo `{ "error": "<código>" }`.

| Código | HTTP | Qué hacer en SwiftPOS |
|---|---|---|
| `UNAUTHORIZED` | 401 | Llave inválida, revocada o tenant suspendido. No reintentar. |
| `RATE_LIMITED` | 429 | Reintentar después. |
| `MODULE_NOT_ACTIVE` | 403 | Módulo o interruptor apagado. Conservar envíos y reintentar más tarde. |
| `BRANCH_NOT_LINKED` | 422 | Falta vincular la sucursal en el Superadmin. |
| `CARD_NOT_FOUND` | 404 | Tarjeta inexistente, de otro negocio o no válida en esa sucursal. |
| `PROGRAM_PAUSED` | 409 | Programa en pausa; cobrar sin acumular. |
| `SCAN_TICKET_INVALID` / `SCAN_TICKET_EXPIRED` / `SCAN_TICKET_MISMATCH` | 422 | Volver a escanear la tarjeta. |
| `INVALID_REQUEST` | 400 | Corregir el envío. No reintentar igual. |
| `LIMIT_EXCEEDED` | 422 | Monto, frecuencia o fecha fuera de límites. No reintentar. |
| `OUTSIDE_GEOFENCE` | 422 | Ubicación fuera de la sucursal. |
| `DUPLICATE_TICKET` | 409 | Ese ticket ya está registrado en la sucursal. No reintentar. |
| `IDEMPOTENCY_CONFLICT` | 409 | Misma venta con otros datos. Revisar. |
| `UNAVAILABLE` | 409 | El saldo llegó a su máximo técnico. |
| `NOT_CONFIGURED` / `SERVICE_UNAVAILABLE` | 503 | Reintentar con espera creciente. |

## Implementado en SwiftCard (2026-11-13)

### Migración `0081_swiftpos_integration`

- Tablas `tenant_integrations` (una por tenant, con límites),
  `integration_keys` (prefijo + SHA-256; hasta dos activas para rotar),
  `integration_branch_links` (ID de sucursal del POS → sucursal, mismo tenant)
  e `integration_request_windows` (límite de peticiones). RLS forzado; solo el
  Superadmin lee, nunca el hash.
- `purchases`: `source` (`STAFF` | `SWIFTPOS`), `integration_id`,
  `external_sale_id`, `external_operator_id`, `external_operator_name`;
  `staff_profile_id` vacío solo para `SWIFTPOS` (restricción
  `purchases_source_actor`); `unique (integration_id, external_sale_id)`.
- `app.confirm_card_purchase` y la PWA **no cambian**.
  `app.integration_confirm_purchase` copia el bloque de cálculo de `0049`
  (marcado `BEGIN/END calculation block`); `supabase/tests/0081` compara ambas
  rutas en los tres tipos de programa (sellos, recompensas, saldo, remanente,
  puntos). Cualquier cambio futuro al motor debe hacerse en las dos.
- Único cambio a una función existente: `app.enforce_purchase_location` deja
  pasar las compras `SWIFTPOS`; las compras `STAFF` se validan igual que antes.
- RPCs solo para `service_role`: `integration_status`,
  `integration_resolve_card`, `integration_confirm_purchase`. RPCs del
  Superadmin con motivo y auditoría: `issue_integration_key`,
  `revoke_integration_key`, `set_integration_branch_link`,
  `set_integration_limits`.

### Ubicación

Si SwiftPOS envía ubicación y el interruptor `location_validation` está
activo, se valida con la geocerca de la sucursal (`OUTSIDE_GEOFENCE`). Si el
interruptor está detenido, la ubicación se ignora y no se guarda. Sin
ubicación, la compra se acepta aun en tenants con geolocalización estricta,
porque la sucursal la fija el vínculo de la llave.

### API y Superadmin

- Rutas en `src/app/api/integrations/swiftpos/v1/`, librería en
  `src/lib/integrations/swiftpos/`.
- Tras `CONFIRMED`, si `wallet_refresh` está activo, se actualiza Wallet y se
  envían los correos de recompensa, igual que en la PWA. Un fallo ahí no
  afecta la compra.
- Superadmin → Tenants → «Integración SwiftPOS»: emitir API key (se muestra una
  vez), revocar, vincular sucursales y ajustar límites (iniciales: $20,000.00
  por venta, 5 compras por tarjeta por hora, 20 por día).

### Pendiente en SwiftCard

- Mostrar el origen «SwiftPOS» y el cajero en exportaciones y en
  `/admin/security` (hoy esas compras aparecen sin empleado). Se dejó fuera
  porque cambia salidas que hoy se usan.
- MFA para Superadmin (SEC-003) y `CARD_SCAN_SECRET_BASE64` dedicada (SEC-012)
  antes de emitir la primera llave en producción.

## Lado SwiftPOS (resumen)

- Botón «Tarjeta de lealtad» en caja → `resolve` desde su backend. Si falla o
  tarda más de 3 s, la caja sigue cobrando sin tarjeta.
- La venta se registra exactamente como hoy (`record_sale` sin cambios). Si
  trae tarjeta, se agrega un registro de vínculo venta↔tarjeta dentro de un
  `SAVEPOINT`; si ese insert falla, se revierte solo el savepoint y la venta
  continúa.
- Un proceso aparte lee las ventas completadas con vínculo pendiente, arma el
  envío desde la fila de la venta y lo manda con reintentos.
- La API key vive cifrada en el backend del POS, nunca en el navegador.

## Módulos

La integración es un **módulo** del sistema de módulos por tenant
(`MODULES.md`, DEC-0072): el tenant la tiene activa según lo que paga, el
Superadmin puede otorgarla o revocarla por tenant y apagarla globalmente. Con
el módulo inactivo, la operación actual funciona igual que hoy. SwiftCard
expone `GET /api/integrations/swiftpos/v1/status` con el estado efectivo para
que el Superadmin de SwiftPOS vea el otro lado.

### SwiftCard

| Clave | Tipo | Al estar inactivo |
|---|---|---|
| `swiftpos_integration` | MODULE | Las rutas `/api/integrations/swiftpos/*` responden `403 MODULE_NOT_ACTIVE` (salvo `status`). |
| `swiftpos_integration.card_resolve` | SWITCH | No se identifican tarjetas; la caja cobra sin tarjeta. |
| `swiftpos_integration.purchases` | SWITCH | No se aceptan compras; el POS las reintenta al reactivarse. |
| `swiftpos_integration.wallet_refresh` | SWITCH | Se registran compras sin actualizar Wallet ni enviar correos de recompensa por esa compra. |
| `swiftpos_integration.location_validation` | SWITCH | Se ignora la ubicación enviada. |

### SwiftPOS

| Clave | Tipo | Al estar inactivo |
|---|---|---|
| `loyalty_integration` | MODULE | Sin botón de tarjeta, sin vínculos, sin envíos. |
| `loyalty_integration.card_scan` | SWITCH | Se oculta el botón «Tarjeta de lealtad». |
| `loyalty_integration.delivery` | SWITCH | Se pausan los envíos; se acumulan y salen al reactivarse. |
| `loyalty_integration.native_tiers_off` | SWITCH | Activo: desactiva los descuentos por membresía del POS (D3). Inactivo: operan como hoy. |

## Complejidad

Estimación orientativa para una persona.

| Pieza | Complejidad | Esfuerzo |
|---|---|---|
| PR-1 migración (función propia de integración + prueba de paridad + columnas) | Media | 2–3 días |
| PR-2 API, API key y límites de peticiones (no existen hoy en SwiftCard) | Media | 2–3 días |
| Sistema de módulos de SwiftCard (`MODULES.md`) | Media | ~5–7 días |
| PR-3 Superadmin y etiquetas de la integración | Baja | 1–2 días |
| Lado SwiftPOS | Media | 3–4 días |
| Sistema de módulos de SwiftPOS | Media | ~5 días |
| Staging punta a punta (incluye apagar/encender cada flag) | Media | 2 días |
| **Total** | **Media** | **~3.5–4 semanas** |

## Riesgos

| # | Riesgo | Impacto | Prob. | Mitigación |
|---|---|---|---|---|
| R1 | API key filtrada → compras falsas | Alto | Media | H1, H3, H4 |
| R2 | El cálculo de la integración diverge del de la PWA | Medio | Media | H8 (prueba de paridad); la ruta actual no se modifica |
| R7 | Falla de la integración afecta la venta o la PWA | Alto | Baja | Módulos, `SAVEPOINT`, envío asíncrono, falla cerrada |
| R3 | Cruce de tenants (precedente SEC-002) | Crítico | Baja | H2 |
| R4 | Cajero escanea su tarjeta en ventas ajenas | Medio | Alta | H4, H5 |
| R5 | Venta cancelada en el POS conserva sus puntos | Bajo | Media | Cancelación manual en SwiftCard (D7) |
| R6 | Toma de cuenta Superadmin sin MFA (SEC-003) → emitir API keys | Alto | Baja | H7 |

## Hardening

- **H1 · API key.** 32 bytes aleatorios, mostrada una vez, guardada solo como
  SHA-256 (búsqueda exacta por hash), solo HTTPS, rotación con dos llaves
  activas, revocación inmediata, último uso visible, 120 peticiones por minuto
  y auditoría de emisión y revocación. Los logs nunca registran la cabecera
  `Authorization`, el QR ni datos del cliente. Mejora futura si se desea: firma
  HMAC por petición.
- **H2 · Aislamiento.** Tenant derivado de la API key; RPCs con `revoke` de
  `public`, `anon` y `authenticated`; pruebas negativas entre dos tenants.
- **H3 · Comprobante de escaneo.** `/purchases` exige el `scanTicket` firmado
  por SwiftCard (tarjeta + vínculo + sucursal, 72 h). Con una API key robada no
  se acumula en tarjetas arbitrarias: hace falta el QR real de cada una.
- **H4 · Límites.** Monto máximo por venta, compras por tarjeta por hora y día,
  peticiones por vínculo, `occurredAt` no futuro ni de hace más de 72 h.
- **H5 · Trazabilidad.** Cada compra guarda el cajero del POS que la cobró.
  Pendiente: mostrarlo en `/admin/security` y en las exportaciones.
- **H6 · Datos mínimos.** `resolve` devuelve nombre de pila, tarjeta, saldo y
  recompensas; nunca teléfono, correo, token ni UUID de cliente.
- **H7 · Prerrequisitos.** MFA para Superadmin (SEC-003) y
  `CARD_SCAN_SECRET_BASE64` dedicada en producción (SEC-012) antes de emitir la
  primera API key.
- **H8 · Paridad del cálculo.** Prueba que compara `confirm_card_purchase` e
  `integration_confirm_purchase` con los mismos escenarios (sellos por compra
  y por monto, remanente, niveles, puntos de por vida, bienvenida); debe pasar
  antes de cada despliegue.
- **H9 · Módulos.** Sistema de módulos por tenant (`MODULES.md`) en ambos
  Superadmins: según lo pagado, con otorgar/revocar por tenant y apagado
  global, auditado y evaluado como inactivo ante cualquier error.

## Orden de despliegue

1. Sistema de módulos en ambos lados. Después SwiftCard PR-1 + PR-2, con el
   módulo en `OFF`; verificar que la PWA
   registra compras igual que antes.
2. Lado SwiftPOS con sus flags apagados; verificar que la caja cobra igual.
3. SwiftCard PR-3; vincular el primer tenant, otorgar el módulo en ambos
   lados y probar una venta real. Probar también apagar cada módulo y switch con ventas
   en curso.
