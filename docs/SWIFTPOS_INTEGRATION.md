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
   `external_tenant_id`, `key_id`, secreto HMAC de 32 bytes **cifrado** con
   AES-256-GCM y una llave maestra propia (la firma exige poder leerlo; se
   muestra una sola vez), `status` (`ACTIVE`/`REVOKED`), `created_by`,
   `last_used_at`, `last_used_ip`, `revoked_at`. Admite dos secretos activos
   durante una rotación (ver Hardening).
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
- Autenticación por firma HMAC-SHA256 de cada petición (ver Hardening H1);
  sin bearer reutilizable. Límite de peticiones por vínculo.
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

## Complejidad

Estimación orientativa para una persona; no incluye esperas de despliegue.

| Pieza | Complejidad | Esfuerzo | Por qué |
|---|---|---|---|
| PR-1 migración y núcleo de cálculo | **Alta** | 4–6 días | Extraer el núcleo de `confirm_card_purchase` toca los tres tipos de programa, remanente, niveles y puntos de por vida; `staff_profile_id` nullable afecta auditoría, atribución PIN, exportaciones, estadísticas y revisión de ubicación. Sin Docker local las migraciones no se prueban localmente. |
| PR-2 API + firma + límites | Media | 3–4 días | No existe infraestructura de rate limiting en SwiftCard; hay que crearla. |
| PR-3 Superadmin y etiquetas | Baja–media | 2 días | UI con el sistema de diseño existente. |
| Lado SwiftPOS (outbox, caja, apagar lealtad nativa) | Media | 4–6 días | Outbox transaccional, worker con reintentos, cambio en la caja. |
| Staging punta a punta y hardening operativo | Media | 2–3 días | Prueba real de venta, cancelación, rotación y revocación. |
| **Total** | **Media–alta** | **~3–4 semanas** | |

## Riesgos

| # | Riesgo | Impacto | Prob. | Mitigación principal |
|---|---|---|---|---|
| R1 | Secreto del vínculo filtrado → compras falsas y recompensas gratis en cualquier tarjeta del tenant | Alto | Media | H1, H3, H4, H7 |
| R2 | Regresión del motor de cálculo al refactorizar → saldos erróneos en **todos** los tenants | Alto | Media | H10 |
| R3 | Cruce de tenants (vínculo A acumula en tarjeta de B); precedente SEC-002 | Crítico | Baja | H2 |
| R4 | Fraude interno del cajero (escanea su propia tarjeta en ventas ajenas) | Medio | Alta | H4, H5 |
| R5 | Cancelación después de canjear → pérdida o saldo inconsistente | Medio | Media | H6 |
| R6 | Toma de cuenta Superadmin (sin MFA, SEC-003) → emitir secretos para cualquier tenant | Alto | Baja | H9 |
| R7 | Fuga de datos personales por la respuesta de `resolve` o por logs con QR/firma | Medio | Baja | H8 |
| R8 | SwiftCard caído o lento → puntos retrasados, ventas duplicadas por reintentos | Bajo | Media | H11 |

## Hardening

**H1 · Autenticación de la petición.** Cabeceras `X-Swift-Key-Id`,
`X-Swift-Timestamp`, `X-Swift-Signature` = HMAC-SHA256 de
`método \n ruta \n timestamp \n sha256(cuerpo)`. Ventana de ±5 min, comparación
en tiempo constante, rechazo de nonces repetidos (`Idempotency-Key`, TTL 10
min). Solo HTTPS. Un secreto robado de un log no sirve sin el cuerpo firmado y
la firma caduca en minutos. La lista de IPs permitidas es opcional, no control
primario (Hostinger puede compartir IP de salida).

**H2 · Aislamiento.** El tenant sale siempre del vínculo, nunca del cuerpo.
Cada RPC verifica: vínculo `ACTIVE`, tenant `ACTIVE`, tarjeta del mismo tenant,
sucursal mapeada y participante en la tarjeta. RPCs `revoke` de `public`,
`anon` y `authenticated`; `grant` solo a `service_role` (higiene SEC-017). El
cliente `service_role` se crea únicamente dentro del módulo de integración.
Pruebas negativas obligatorias entre dos tenants.

**H3 · Prueba de presencia de la tarjeta.** `resolve` devuelve un
`scanTicket` firmado por SwiftCard (tarjeta + vínculo + sucursal + caducidad
de 24 h). `purchases` exige ese ticket y `occurred_at` dentro de su vigencia.
Con un secreto robado no se puede acumular en tarjetas arbitrarias: hace falta
el QR físico de cada una.

**H4 · Límites de negocio.** Monto máximo por venta (configurable por tenant),
velocidad por tarjeta (p. ej. 5 compras/hora, 20/día), velocidad por vínculo,
`occurred_at` no futuro (>5 min) ni anterior a 72 h, montos en cero se ignoran.
Al exceder: `LIMIT_EXCEEDED`, sin acumular, y alerta.

**H5 · Trazabilidad del operador.** Guardar el empleado del POS
(`external_operator_id` y nombre) en la compra. Extender `/admin/security` con
señales: misma tarjeta acumulando con el mismo cajero, ráfagas, montos
repetidos justo bajo un umbral.

**H6 · Cancelaciones.** Reversión normal si no hay actividad posterior; si la
hay, asiento compensatorio (sin bajar de cero) marcado para revisión, y
bloqueo de canjes de esa tarjeta mientras la revisión siga abierta. Toda
cancelación del POS queda auditada con motivo.

**H7 · Ciclo de vida del secreto.** 32 bytes aleatorios mostrados una vez;
cifrado en reposo con `INTEGRATION_SECRETS_MASTER_KEY` independiente (no
derivada de la llave `service_role`, lección SEC-012). Rotación con dos
secretos válidos y expiración del anterior; revocación inmediata
(interruptor por vínculo para Superadmin y Admin general); `last_used_at` e IP
visibles; eventos de creación, rotación y revocación en `audit_logs`. En
SwiftPOS el secreto vive cifrado en su base con su propia llave maestra, nunca
en variables `VITE_*` ni en el navegador; `resolve` se hace desde el backend del
POS con sesión y permiso del empleado.

**H8 · Datos mínimos y logs.** `resolve` devuelve nombre de pila, nombre de
tarjeta, saldo y recompensas; nunca teléfono, correo, `public_token` ni
UUID de cliente. Respuestas `no-store`. Los logs redactan QR, firma y
cabeceras de autenticación. Actualizar el aviso de privacidad para reflejar
que el POS consulta la tarjeta.

**H9 · Prerrequisitos de la auditoría.** Antes de emitir el primer secreto:
MFA para Superadmin (SEC-003), `CARD_SCAN_SECRET_BASE64` dedicada configurada
en producción (SEC-012), URLs de integración sin depender de `Host` (SEC-013) y
CI con SCA/secret scanning (SEC-010) recomendado.

**H10 · No romper el motor.** Antes de refactorizar, pruebas "golden" con los
resultados actuales de `confirm_card_purchase` para los tres tipos de programa
(remanente, niveles, puntos de por vida, recompensas de bienvenida); el núcleo
extraído debe reproducirlos exactamente. Desplegar con el vínculo desactivado
y verificar compras de PWA en producción antes de activar el primero.

**H11 · Robustez.** Outbox en la misma transacción; carga construida desde la
fila de venta, nunca desde la petición del navegador; idempotencia por
`external_sale_id`; backoff exponencial con jitter, cola de errores visible
para el administrador del POS después de N intentos; timeouts de 5 s, sin
seguir redirecciones; URL de SwiftCard fija por entorno (sin SSRF).

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
