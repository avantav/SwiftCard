# Paquetes, Stripe, promociones y afiliados

**Estado:** Catálogo publicado (Inicial, Crecimiento, Empresarial; DEC-0057) y
alta pública con Stripe Checkout, prueba de 30 días, IVA 16%, webhooks y
Customer Portal implementados (DEC-0058, migración `0071`). Pendiente de
configurar en Stripe test mode y validar de punta a punta. Promociones en
Checkout, comisiones de afiliados y política de límites siguen pendientes.

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

## Alta autoservicio (implementado, DEC-0058)

Solo **Inicial** y **Crecimiento** se contratan en línea. **Empresarial** se
negocia por WhatsApp y su cuenta la crea un Superadmin.

1. La landing envía a `/signup?plan=<código>` cuando Stripe está configurado y
   el precio mensual del plan tiene `stripe_price_id`; si no, a WhatsApp.
2. `/signup` pide plan, periodicidad, negocio, nombre, correo, teléfono
   opcional, contraseña (12–72) y aceptación de términos. Tiene honeypot y un
   máximo de 5 intentos por correo por hora. Rechaza correos con cuenta de staff.
3. El servidor crea o reutiliza el usuario de Auth (sin perfil todavía),
   registra `billing_signup_intents` y crea una Checkout Session de suscripción
   con `trial_period_days: 30`, `payment_method_collection: always`
   (tarjeta obligatoria), `default_tax_rates: [IVA 16%]` y la cancelación de la
   prueba si falta método de pago.
4. El retorno `/signup/success` solo informa el estado; **no activa nada**.
5. `POST /api/stripe/webhook` verifica la firma sobre el cuerpo crudo, registra
   el evento en `stripe_webhook_events` (idempotente) y:
   - `checkout.session.completed` → `app.provision_self_service_tenant`
     (crea tenant, Admin general `ACTIVE` y `billing_customers` en una
     transacción) y sincroniza la suscripción;
   - `customer.subscription.*` e `invoice.paid|payment_failed` → relee la
     suscripción en Stripe y llama a `app.sync_stripe_subscription`
     (snapshots del catálogo al crear; estado, periodos y prueba al actualizar).
   Un fallo responde 500 y Stripe reintenta.
6. `/admin/billing` muestra la prueba y el botón «Administrar pago y facturas»
   (Stripe Customer Portal) solo al Admin general con cliente de Stripe.

Estados: `trialing→TRIALING`, `active→ACTIVE`, `past_due|unpaid→PAST_DUE`,
`paused→PAUSED`, `incomplete→INCOMPLETE`, resto `→CANCELED`. Todavía no se
bloquea la operación por falta de pago (política pendiente).

## Puesta en marcha (test mode)

1. En `.env.local` (y luego en el hosting) define `STRIPE_SECRET_KEY`
   (`sk_test_...`) junto a las variables de Supabase existentes.
2. Aplica la migración `0071_stripe_self_service_signup.sql` (después de `0070`).
3. Ejecuta `npm run stripe:sync-catalog`: crea los productos, los precios MXN
   mensual y anual (`tax_behavior: exclusive`) y la tasa **IVA 16%**; guarda
   `stripe_product_id`/`stripe_price_id` en el catálogo e imprime el
   `STRIPE_IVA_TAX_RATE_ID`. Es seguro repetirlo.
4. Elige cómo cobrar el IVA:
   - **Stripe Tax (recomendado por el plan de Stripe):** en Stripe → Tax
     configura la dirección fiscal (head office) y agrega el registro de
     **México**; luego define `STRIPE_TAX_MODE=automatic`. Checkout activa
     `automatic_tax` y Stripe calcula el IVA; tiene costo por transacción.
   - **Tasa fija:** define `STRIPE_IVA_TAX_RATE_ID` con el valor impreso
     (`STRIPE_TAX_MODE` vacío o `fixed`).
5. En Stripe → Developers → Webhooks, crea el endpoint
   `${SWIFTWALLET_PUBLIC_URL}/api/stripe/webhook` con los eventos
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `customer.subscription.paused`, `customer.subscription.resumed`,
   `invoice.paid` e `invoice.payment_failed`. Copia su signing secret en
   `STRIPE_WEBHOOK_SECRET`. En local: `stripe listen --forward-to
   localhost:3000/api/stripe/webhook`.
6. En Stripe → Settings → Billing → Customer portal, activa el portal
   (cambiar tarjeta, ver facturas, cancelar al final del periodo).
7. Configuración recomendada en el Dashboard (sin código):
   - **Revenue recovery:** activa Smart Retries, los correos de pago fallido y
     la actualización automática de tarjetas; define que la suscripción quede
     `canceled` o `unpaid` tras el último reintento.
   - **Correos de suscripción:** aviso de prueba por terminar y recibos.
   - **Branding** de facturas y Checkout: logo, color y pie con datos fiscales.
8. Redepliega y prueba con la tarjeta `4242 4242 4242 4242`.

Variables (servidor, nunca `NEXT_PUBLIC_`): `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_TAX_MODE`, `STRIPE_IVA_TAX_RATE_ID`; las URLs
de retorno se derivan de `SWIFTWALLET_PUBLIC_URL` (debe ser el dominio público
de producción).

### Revisión contra el plan de Stripe (2026-11-12)

El `stripe_implementation_planner` (cuenta de prueba SwiftyCards) recomendó:
Checkout alojado, precios planos, prueba con tarjeta, Customer Portal, Smart
Retries, Quotes para ventas asistidas, Stripe Tax con cobro, facturas de
suscripción automáticas, CFDI fuera de Stripe y conciliación por webhooks.
Ajustes aplicados al código:

- `subscription_data.billing_mode: flexible` (predeterminado recomendado).
- IVA con `automatic_tax` (`STRIPE_TAX_MODE=automatic`) o tasa fija.
- `tax_id_collection` en Checkout para capturar el **RFC** y poder emitir CFDI.
- Suscripciones que no se pueden vincular (creadas fuera del alta) quedan como
  `IGNORED` con su motivo en `stripe_webhook_events`, sin reintentos infinitos.

### Empresarial con Quotes (venta asistida)

1. Un Superadmin crea el tenant y su Administrador como hoy.
2. En Stripe crea el Customer y una **Quote** con el producto
   «morrow Empresarial» (precio negociado si aplica).
3. Al aceptar la Quote, en la suscripción resultante agrega la metadata
   `morrow_tenant_id=<UUID del tenant>` y, si el precio no es el de catálogo,
   `morrow_package_price_id=<UUID del precio Empresarial del catálogo>`.
4. El webhook vincula el cliente de Stripe al tenant y refleja la suscripción.
   Con precio negociado, `/admin/billing` muestra el snapshot del catálogo como
   referencia; el monto real está en Stripe.

**Fuera de alcance:** facturas CFDI del SAT (Stripe no las emite; se harán
manualmente o con un proveedor como Facturapi), promociones y códigos en
Checkout, comisiones de afiliados, cambio de plan con límites y correo de
verificación del dueño.

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
