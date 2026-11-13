# Integración SwiftPOS → SwiftCard

Estado: **propuesto** (DEC-0071). Ningún cambio de código ni migración aplicado.

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

Base: `/api/integrations/swiftpos/v1`. Solo `POST`, JSON, HTTPS, `no-store`.
Cabecera: `Authorization: Bearer <api key>`.

### `POST /cards/resolve` — identificar al cliente

```json
{ "storeId": "<id de sucursal en el POS>", "scan": "<texto leído del QR>" }
```

Respuesta `200`:

```json
{
  "scanTicket": "<comprobante firmado, vigencia 24 h>",
  "customer": { "firstName": "Ana" },
  "card": { "name": "Café frecuente", "balance": 7, "unit": "STAMPS", "availableRewards": 1 }
}
```

### `POST /purchases` — enviar la compra

```json
{
  "storeId": "<id de sucursal en el POS>",
  "scanTicket": "<de /cards/resolve>",
  "externalSaleId": "<UUID de la venta en el POS>",
  "ticketNumber": "A-001234",
  "amountMinor": 18550,
  "occurredAt": "2026-11-13T18:20:00Z",
  "cashier": { "id": "<id del empleado en el POS>", "name": "Luis P." },
  "location": { "latitude": 29.07, "longitude": -110.95 }
}
```

`cashier` es obligatorio: en SwiftPOS toda venta lleva al empleado que la
cobró y cualquier empleado puede registrar ventas. SwiftCard lo guarda solo
como dato de trazabilidad (`external_operator_id`, `external_operator_name`);
no valida permisos de ese empleado ni lo crea como usuario. `location` es
opcional. Respuesta `200`:
`{ "result": "CONFIRMED" | "ALREADY_RECORDED", "stampsAwarded": 1, "rewardsGenerated": 0, "balance": 8 }`.

Errores estables: `UNAUTHORIZED`, `BRANCH_NOT_LINKED`, `CARD_NOT_FOUND`,
`SCAN_TICKET_EXPIRED`, `PROGRAM_PAUSED`, `DUPLICATE_TICKET`,
`OUTSIDE_GEOFENCE`, `LIMIT_EXCEEDED`.

## Cambios en SwiftCard

### PR-1 · Migración `0080_swiftpos_integration`

1. `public.tenant_integrations`: `tenant_id`, `provider` (`SWIFTPOS`),
   `key_prefix`, `key_hash` (SHA-256 de 32 bytes aleatorios; la llave se
   muestra una sola vez), `status`, `last_used_at`, `revoked_at`,
   `created_by`. Un vínculo activo por tenant y proveedor.
2. `public.integration_branch_links`: `(integration_id, external_store_id) →
   branch_id`, con verificación de que la sucursal es del mismo tenant.
3. `public.purchases`: columnas `source` (`STAFF` por defecto | `SWIFTPOS`),
   `integration_id`, `external_sale_id`, `external_operator_id`,
   `external_operator_name` (cajero del POS); `staff_profile_id` nullable con
   `check ((source = 'STAFF') = (staff_profile_id is not null))`;
   `unique (integration_id, external_sale_id)`.
4. **Separar el cálculo sin reescribirlo.** Las ~100 líneas de cálculo de
   `app.confirm_card_purchase` (`0049`) se mueven **literalmente** a
   `app.record_card_purchase_core(tenant, cliente, tarjeta, sucursal,
   empleado|null, ticket, monto, lat, long, origen, …)`, sin `grant`.
   `confirm_card_purchase` conserva su firma y sus validaciones de empleado y
   después llama al núcleo. La PWA no cambia.
5. Geocerca: si la compra de integración trae ubicación, se valida igual que
   hoy; si no la trae, se acepta, porque la sucursal la fija el vínculo.
6. RPCs solo para `service_role`: `app.integration_resolve_card` y
   `app.integration_confirm_purchase`. Validan vínculo y tenant activos,
   sucursal mapeada, tarjeta del mismo tenant y participante en la sucursal.

Impacto de compras sin empleado (revisado): la revisión de ubicación
(`0074`) y la vista de soporte (`0079`) ya usan `left join` con
`staff_profiles`; `stamp_ledger.created_by_staff_id` ya admite nulo; el
trigger de operador PIN no actúa sin sesión. Las exportaciones agregan la
columna `source`.

### PR-2 · Rutas de la API

- Rutas en `src/app/api/integrations/swiftpos/v1/…`.
- API key: búsqueda por prefijo y comparación en tiempo constante del hash.
- El tenant sale de la API key, **nunca** del cuerpo.
- `resolve` reutiliza el descifrado del QR del escáner de empleados.
- Tras confirmar: `dispatchCustomerActivityBestEffort` refresca Apple/Google Wallet.

### PR-3 · Superadmin y etiquetas

- Detalle del tenant → «Integración SwiftPOS»: crear vínculo (muestra la API
  key una vez), mapear sucursales, rotar y revocar.
- Compras y exportaciones muestran el origen «SwiftPOS».

## Lado SwiftPOS (resumen)

- Botón «Tarjeta de lealtad» en caja → `resolve` desde su backend.
- Al completar la venta se guarda el envío en una cola en la misma
  transacción; un proceso lo envía con reintentos. La venta nunca se bloquea.
- La API key vive cifrada en el backend del POS, nunca en el navegador.

## Complejidad

Estimación orientativa para una persona.

| Pieza | Complejidad | Esfuerzo |
|---|---|---|
| PR-1 migración (movimiento literal del cálculo + columnas) | Media | 2–3 días |
| PR-2 API, API key y límites de peticiones (no existen hoy en SwiftCard) | Media | 2–3 días |
| PR-3 Superadmin y etiquetas | Baja | 1–2 días |
| Lado SwiftPOS | Media | 3–4 días |
| Staging punta a punta | Media | 2 días |
| **Total** | **Media** | **~2–2.5 semanas** |

## Riesgos

| # | Riesgo | Impacto | Prob. | Mitigación |
|---|---|---|---|---|
| R1 | API key filtrada → compras falsas | Alto | Media | H1, H3, H4 |
| R2 | Error al mover el cálculo → saldos erróneos en todos los tenants | Alto | Baja | H8 |
| R3 | Cruce de tenants (precedente SEC-002) | Crítico | Baja | H2 |
| R4 | Cajero escanea su tarjeta en ventas ajenas | Medio | Alta | H4, H5 |
| R5 | Venta cancelada en el POS conserva sus puntos | Bajo | Media | Cancelación manual en SwiftCard (D7) |
| R6 | Toma de cuenta Superadmin sin MFA (SEC-003) → emitir API keys | Alto | Baja | H7 |

## Hardening

- **H1 · API key.** 32 bytes aleatorios, mostrada una vez, guardada solo como
  hash, comparación en tiempo constante, solo HTTPS, rotación con
  solapamiento, revocación inmediata, `last_used_at` visible y auditoría de
  creación, rotación y revocación. Los logs nunca registran la cabecera
  `Authorization` ni el QR. Mejora futura si se desea: firma HMAC por petición.
- **H2 · Aislamiento.** Tenant derivado de la API key; RPCs con `revoke` de
  `public`, `anon` y `authenticated`; pruebas negativas entre dos tenants.
- **H3 · Comprobante de escaneo.** `/purchases` exige el `scanTicket` firmado
  por SwiftCard (tarjeta + vínculo + sucursal, 24 h). Con una API key robada no
  se acumula en tarjetas arbitrarias: hace falta el QR real de cada una.
- **H4 · Límites.** Monto máximo por venta, compras por tarjeta por hora y día,
  peticiones por vínculo, `occurredAt` no futuro ni de hace más de 72 h.
- **H5 · Trazabilidad.** Cada compra guarda el cajero del POS que la cobró;
  `/admin/security` y las exportaciones lo muestran como «Cajero SwiftPOS» en
  lugar del empleado de SwiftCard.
- **H6 · Datos mínimos.** `resolve` devuelve nombre de pila, tarjeta, saldo y
  recompensas; nunca teléfono, correo, token ni UUID de cliente.
- **H7 · Prerrequisitos.** MFA para Superadmin (SEC-003) y
  `CARD_SCAN_SECRET_BASE64` dedicada en producción (SEC-012) antes de emitir la
  primera API key.
- **H8 · Proteger el cálculo.** Pruebas que fijen los resultados actuales de
  `confirm_card_purchase` (sellos por compra y por monto, remanente, niveles,
  puntos de por vida) antes del movimiento; deben seguir pasando después.

## Orden de despliegue

1. SwiftCard PR-1 + PR-2; verificar que la PWA registra compras igual que antes.
2. Lado SwiftPOS.
3. SwiftCard PR-3; vincular el primer tenant y probar una venta real.
