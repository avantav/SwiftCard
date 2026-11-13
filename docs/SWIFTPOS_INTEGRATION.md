# Integración SwiftPOS → SwiftCard

Estado: **propuesto** (DEC-0071). Ningún cambio de código ni migración aplicado.

## Objetivo

Que las ventas de un tenant de SwiftPOS acumulen sellos/puntos directamente en
la tarjeta de SwiftCard del cliente, sin que el empleado vuelva a capturar el
ticket en la PWA. SwiftCard es el **sistema final de lealtad**: calcula sellos,
puntos, remanentes y recompensas; SwiftPOS solo informa ventas.

## Decisiones del dueño (2026-11-13)

| # | Decisión | Consecuencia |
|---|---|---|
| D1 | Ambos sistemas tienen el mismo dueño. | El vínculo lo crea el Superadmin de SwiftCard; no hay flujo de consentimiento entre empresas. Se usa una credencial de servicio **por vínculo** (una fuga afecta a un solo tenant). |
| D2 | Genera puntos el **monto pagado por el cliente**. | Se envía el total final de la venta (después de descuentos y promociones, con impuestos), sin el cambio entregado. En unidades menores (centavos). |
| D3 | SwiftCard es el sistema final de lealtad. | En los tenants vinculados, SwiftPOS desactiva su descuento por nivel de membresía y oculta su administración de membresías. |
| D4 | Las ventas sin tarjeta escaneada se ignoran por ahora. | No se envían ni se guardan para asignación posterior. Sin backfill. |

## Flujo

```
Caja SwiftPOS                          SwiftCard
 escanea QR de la tarjeta ──────────►  POST /api/integrations/swiftpos/v1/cards/resolve
                          ◄──────────  { customerCardId, nombre, tarjeta, saldo, recompensas }
 registra la venta + outbox (misma transacción)
 worker con reintentos ─────────────►  POST /api/integrations/swiftpos/v1/purchases
 cancela/reembolsa + outbox ────────►  POST /api/integrations/swiftpos/v1/purchases/{externalSaleId}/cancel
```

- El QR sigue siendo el `/scan/q1_…` sellado (ver `PUBLIC_CARD_QR.md`). Solo el
  servidor de SwiftCard lo descifra; SwiftPOS envía el texto escaneado tal cual.
- Si SwiftCard no está disponible, la venta en caja **nunca** se bloquea: el
  outbox reintenta con backoff.
- Idempotencia: `externalSaleId` (UUID de la venta en SwiftPOS) es único por
  vínculo. Reintentos devuelven el resultado original (`ALREADY_RECORDED`).

## Cambios en SwiftCard

### PR-1 · Migración `0080_swiftpos_integration`

1. `public.tenant_integrations`: `id`, `tenant_id`, `provider` (`SWIFTPOS`),
   `external_tenant_id`, `key_prefix`, `key_hash` (SHA-256 de una llave
   aleatoria de 32 bytes; la llave se muestra una sola vez), `status`
   (`ACTIVE`/`REVOKED`), `created_by`, `last_used_at`, `revoked_at`.
   Únicos: `(provider, external_tenant_id)` y un vínculo activo por tenant y
   proveedor. Sin acceso RLS para `authenticated`; solo Superadmin por RPC.
2. `public.integration_branch_links`: `(integration_id, external_store_id) →
   branch_id`, con trigger de consistencia de tenant. Una sucursal del POS sin
   vínculo devuelve `BRANCH_NOT_LINKED`.
3. `public.purchases`:
   - `source` (`STAFF` por defecto, `SWIFTPOS`), `integration_id`,
     `external_sale_id`.
   - `staff_profile_id` pasa a nullable con
     `check ((source = 'STAFF') = (staff_profile_id is not null))`.
   - `unique (integration_id, external_sale_id)`.
4. Extraer el núcleo de cálculo de `app.confirm_card_purchase` a una función
   interna (`app.record_card_purchase_core`, sin `grant`) que reciba el actor
   (empleado o integración). La RPC de empleados conserva firma y
   comportamiento; ambas rutas comparten exactamente las mismas reglas de
   sellos, puntos de por vida, remanente y niveles de recompensa.
5. `app.enforce_purchase_location`: omitir la geocerca solo cuando
   `source = 'SWIFTPOS'` (la sucursal la determina el vínculo, no un
   dispositivo).
6. RPCs `security definer` ejecutables solo por `service_role`:
   - `app.integration_resolve_card(integration_id, card_token)`
   - `app.integration_confirm_purchase(integration_id, external_store_id,
     external_sale_id, ticket_number, amount_minor, occurred_at,
     customer_card_id)`. Ticket guardado como `POS-{número de venta}`.
   - `app.integration_cancel_purchase(integration_id, external_sale_id, reason)`
   Todas validan vínculo activo, tenant activo, que la tarjeta pertenezca al
   tenant del vínculo y que la tarjeta participe en la sucursal vinculada.
7. Auditoría: los triggers existentes registran el origen `SWIFTPOS`; la
   atribución de operador PIN no aplica.

### PR-2 · API de integración (Next.js)

- Rutas en `src/app/api/integrations/swiftpos/v1/…`, solo `POST`, `no-store`.
- Autenticación `Authorization: Bearer <llave>`: búsqueda por prefijo y
  comparación en tiempo constante del hash. Límite de peticiones por vínculo.
- Cliente Supabase de servidor con `service_role`; el tenant sale del vínculo,
  **nunca** del cuerpo de la petición.
- `cards/resolve` reutiliza el descifrado del escáner de empleados y devuelve
  lo mínimo para la caja: `customerCardId`, nombre de pila, nombre de la
  tarjeta, saldo y recompensas disponibles. Nunca teléfono, correo ni token.
- Después de confirmar o cancelar: `dispatchCustomerActivityBestEffort` para
  refrescar Apple/Google Wallet.
- Errores estables: `CARD_NOT_FOUND`, `BRANCH_NOT_LINKED`, `PROGRAM_PAUSED`,
  `ALREADY_RECORDED`, `HAS_LATER_ACTIVITY`, `INTEGRATION_REVOKED`.

### PR-3 · Superadmin y paneles

- Detalle del tenant → «Integración SwiftPOS»: crear vínculo (muestra la llave
  una vez), mapear sucursales, rotar y revocar.
- Compras, exportaciones y estadísticas muestran el origen «SwiftPOS».
- La revisión de ubicación (`/admin/security`) etiqueta estas compras como
  «Integración» en lugar de «sin coordenadas».

## Cancelaciones (pendiente de confirmar)

`app.cancel_purchase` rechaza la reversión si el cliente tuvo actividad
posterior (`HAS_LATER_ACTIVITY`). Propuesta por defecto para cancelaciones que
llegan del POS:

1. Sin actividad posterior → reversión normal.
2. Con actividad posterior → asiento compensatorio en `stamp_ledger` que resta
   lo otorgado (sin bajar de cero ni revocar recompensas ya canjeadas) y queda
   marcado para revisión del administrador.

## Validación prevista

- Pruebas de las RPCs: aislamiento entre tenants, sucursal no vinculada,
  idempotencia, cálculo idéntico a la ruta de empleados para los tres tipos de
  programa, geocerca solo omitida para `SWIFTPOS`.
- Pruebas de rutas: llave inválida/revocada, cuerpo con tenant ajeno ignorado,
  respuesta sin datos personales.
- Prueba de punta a punta en staging con un tenant SwiftPOS de demo antes de
  aplicar `0080` en producción.

## Orden de despliegue

1. SwiftCard PR-1 + PR-2 (migración aplicada antes del código que la usa).
2. Lado SwiftPOS (outbox, escaneo en caja, desactivar lealtad nativa).
3. SwiftCard PR-3.
4. Vincular el primer tenant y su(s) sucursal(es); prueba real con una venta y
   una cancelación.
