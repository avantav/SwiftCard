# Paquetes, Stripe, promociones y afiliados

**Estado:** Fundamento y gestión inicial de paquetes implementados localmente;
Stripe, promociones, afiliados y resumen del tenant siguen pendientes.

**Migración base:** `0059_commercial_billing_foundation.sql`

## Propósito

Este dominio administra la relación comercial entre morrow y cada tenant. No
administra los puntos, compras o recompensas que un tenant entrega a sus
clientes. Facturación y fidelidad comparten el `tenant_id`, pero una falla de
pago nunca debe reescribir el ledger de fidelidad.

## Definiciones

- **Paquete:** oferta comercial versionable con capacidades y límites.
- **Precio:** monto recurrente mensual o anual, por moneda, asociado a un paquete.
- **Membresía facturable:** tarjeta emitida activa cuyo cliente está activo.
- **Uso actual:** membresías facturables existentes al momento de medir.
- **Pico:** mayor uso actual observado dentro del periodo de suscripción.
- **Promoción:** descuento con vigencia, elegibilidad, usos y máximo de membresías cubiertas.
- **Afiliado:** socio que atribuye un tenant y puede generar comisiones cuando el tenant paga.

## Fuente de verdad

PostgreSQL conserva el catálogo, snapshots contractuales, uso, elegibilidad,
atribución y comisiones. Stripe procesa cobros y emite eventos, pero sus IDs son
referencias externas opcionales. La aplicación nunca reconstruye un contrato
histórico leyendo el precio actual del paquete.

| Concepto morrow | Recurso Stripe previsto |
|---|---|
| `billing_packages` | Product |
| `billing_package_prices` | Price recurrente |
| `billing_customers` | Customer |
| `tenant_subscriptions` | Subscription |
| `billing_promotions` | Coupon y Promotion Code |
| `billing_membership_usage` | Meter Event opcional |
| `stripe_webhook_events` | Event idempotente |

Stripe define Products como lo que se vende y Prices como cuánto y con qué
periodicidad se cobra. Las suscripciones relacionan un Customer con uno o más
Prices. Stripe Billing Meters agrega uso de forma asíncrona; morrow conserva su
medición local como autoridad y no usa un resumen eventual para autorizar altas.

Referencias oficiales:

- https://docs.stripe.com/products-prices/how-products-and-prices-work
- https://docs.stripe.com/billing/subscriptions/build-subscriptions
- https://docs.stripe.com/billing/subscriptions/usage-based/how-it-works
- https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage

## Tablas iniciales

- `billing_packages`
- `billing_package_prices`
- `billing_customers`
- `tenant_subscriptions`
- `billing_membership_usage`
- `billing_promotions`
- `billing_promotion_packages`
- `billing_promotion_redemptions`
- `billing_affiliates`
- `billing_affiliate_referrals`
- `billing_affiliate_commissions`
- `stripe_webhook_events`

Todas tienen RLS forzada. Superadmin administra los catálogos. Solo el Admin
general puede leer la suscripción, uso, promoción aplicada, atribución y
comisiones de su propio tenant. Administradores de sucursal y empleados no
acceden al dominio comercial. Los eventos Stripe no tienen permisos para roles
del navegador.

`/admin/billing` presenta ese alcance de solo lectura al Admin general: snapshot
del paquete/precio, estado y periodo, membresías actuales y pico, límites de
sucursales/tarjetas, última promoción y atribución. Advierte al 80%, 90% y 100%
del límite de membresías usando el pico del periodo; no bloquea altas ni cambia
la suscripción.

## Medición de membresías

Los triggers de `customer_cards`, `customers` y `tenant_subscriptions` recalculan:

```text
current_memberships = tarjetas activas con cliente activo
peak_memberships = max(peak_memberships anterior, current_memberships)
```

Revocar una tarjeta o desactivar un cliente reduce el valor actual, pero nunca
reduce el pico. La migración no bloquea altas al alcanzar un límite: primero se
observará uso real y se definirá una política explícita de gracia, upgrade y
fallas de pago.

## Promociones

La base admite porcentaje en puntos base (`10000 = 100%`), monto fijo en
unidades mínimas, vigencia, duración, paquetes elegibles, límites globales y por
tenant, máximo de membresías cubiertas, snapshots y atribución opcional.

`/superadmin/billing/promotions` crea cada promoción y sus paquetes elegibles en
una sola transacción. Una promoción solo puede activarse si no está vencida y
tiene al menos un paquete activo; archivarla no elimina relaciones ni historial.
Los roles autenticados no tienen escritura directa sobre esas tablas: incluso
Superadmin debe usar los RPC transaccionales. La interfaz valida la forma del
descuento y sus topes, pero todavía no consume ni reserva aplicaciones.

La siguiente unidad debe añadir una operación transaccional que valide todos
los límites y reserve la aplicación antes de crear Checkout. No se confiará en
un código o cantidad enviado por el navegador.

## Afiliados

La atribución se conserva una sola vez por tenant. Una comisión referencia al
afiliado, atribución, suscripción e invoice que la originaron. Los primeros
pagos serán conciliados manualmente. Automatizar transferencias requerirá una
decisión separada sobre Stripe Connect, identidad fiscal, KYC, moneda,
contracargos y recuperación de comisiones pagadas.

`/superadmin/billing/affiliates` permite crear, activar y archivar afiliados con
código único, contacto opcional, ventana de atribución y comisión porcentual o
fija en unidades mínimas. La migración `0061` obliga a usar RPC Superadmin para
escribir el catálogo; no existe borrado ni pago automático.

## Flujo Stripe previsto

1. El servidor resuelve al Admin y tenant desde la sesión.
2. Valida paquete, precio y promoción contra PostgreSQL.
3. Crea o reutiliza el Stripe Customer del tenant.
4. Crea Checkout con IDs allowlisted por la base local.
5. El retorno del navegador solo muestra estado pendiente; no activa acceso.
6. El webhook verifica la firma sobre el cuerpo original.
7. Inserta `stripe_webhook_events` por `stripe_event_id` para idempotencia.
8. Actualiza suscripción y snapshots dentro de una transacción.
9. Registra promoción, atribución o comisión cuando corresponde.
10. Reembolsos y disputas corrigen lo comercial sin tocar fidelidad.

## Variables previstas

No deben configurarse ni committearse hasta implementar la unidad Stripe:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY`, solo si una futura UI lo requiere
- `STRIPE_CUSTOMER_PORTAL_RETURN_URL`
- `STRIPE_CHECKOUT_SUCCESS_URL`
- `STRIPE_CHECKOUT_CANCEL_URL`

## Secuencia de entrega

1. Fundamento SQL, medición y RLS — terminado localmente.
2. Creación inicial y ciclo de vida de paquetes/precios en Superadmin — terminado.
3. Promociones y afiliados en Superadmin.
4. Resumen de paquete y uso para el Admin general.
5. Sincronización Stripe Product/Price en test mode.
6. Checkout y Customer Portal.
7. Webhooks idempotentes, reembolsos y disputas.
8. Aplicación transaccional de promociones y comisiones.
9. Política de límites, gracia y upgrades.
10. Pricing público solo con catálogo, impuestos, privacidad y soporte aprobados.

## Despliegue

El propietario confirmó que `main` está actualizado y las migraciones
comerciales hasta `0061` están aplicadas en Supabase. La activación de Stripe
sigue dependiendo de credenciales, precios, impuestos y políticas de pago
aprobadas.
