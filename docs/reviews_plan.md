# Sistema de Reviews y Reputación

**Estado:** Expansión post-MVP autorizada; revisada el 2026-09-17 y pendiente
de implementación como Fase 11.

**Fuente ejecutable:** Este documento define el producto. La secuencia de
entrega, dependencias y criterios de terminado viven en
`docs/IMPLEMENTATION_PLAN.md`. Ante una contradicción prevalecen
`docs/PRODUCT.md`, `docs/DECISIONS.md` y las reglas de seguridad del repositorio.

## 1. Objetivo

Agregar un nuevo producto independiente enfocado en:

* Captación de reseñas en Google.
* Medición de interacciones con QR y NFC.
* Seguimiento del funnel de conversión hacia Google Reviews.
* Captura opcional de información del cliente.
* Generación y seguimiento de promociones o beneficios.
* Métricas por negocio y sucursal.
* Integración opcional con el sistema de lealtad existente.

El sistema de Reviews y el sistema de Lealtad deben funcionar como productos independientes.

Un cliente podrá contratar:

* Solo Loyalty.
* Solo Reviews.
* Loyalty + Reviews.

Ambos productos utilizarán la misma infraestructura y base de datos para evitar duplicar negocios, sucursales y clientes.

---

# 2. Productos

## Loyalty

Sistema existente de tarjetas de lealtad.

Principales funciones:

* Tarjetas digitales.
* Apple Wallet / Google Wallet.
* Sellos o puntos.
* Registro de ventas.
* Recompensas.
* Clientes.
* Sucursales.
* Dashboard.
* Reglas de lealtad.

---

## Reviews

Nuevo sistema para captar y medir reseñas.

Principales funciones:

* QR para reviews.
* NFC para reviews.
* Landing page por negocio/sucursal.
* Redirección hacia Google Reviews.
* Analytics.
* Registro opcional del cliente.
* Cupones o promociones.
* Integración con Google Business Profile.
* Seguimiento de nuevas reseñas.
* Dashboard de reputación.

---

# 3. Arquitectura de Productos

Los productos deben compartir información base.

```text
Account / Tenant
│
├── Business
│   │
│   ├── Branches
│   │
│   ├── Customers
│   │
│   └── Users
│
├── Products
│   │
│   ├── Loyalty
│   │
│   └── Reviews
│
├── Loyalty Module
│
└── Reviews Module
```

La contratación de un producto no debe requerir contratar el otro.

---

# 4. Activación de Productos

Cada cuenta deberá tener definidos los productos habilitados.

Ejemplo:

```text
Cliente A

Loyalty: ACTIVE
Reviews: INACTIVE
```

```text
Cliente B

Loyalty: INACTIVE
Reviews: ACTIVE
```

```text
Cliente C

Loyalty: ACTIVE
Reviews: ACTIVE
```

Esto debe controlar:

* Acceso al dashboard.
* Navegación.
* Funciones disponibles.
* APIs disponibles.
* Métricas.
* Configuración.

---

# 5. Entidades Compartidas

Los siguientes datos deben poder utilizarse por ambos productos.

## Business

Información general del negocio.

Campos principales:

* ID
* Nombre
* Logo
* Teléfono
* Email
* Branding
* Estado

---

## Branch

Sucursales del negocio.

Campos:

* ID
* Business ID
* Nombre
* Dirección
* Teléfono
* Ubicación
* Estado

Cada sucursal podrá tener su propio:

* QR.
* NFC.
* Google Business Profile.
* Link de Google Reviews.
* Analytics.

---

## Customer

Cliente final del negocio.

Campos sugeridos:

* ID
* Business ID
* Nombre
* Teléfono
* Email
* Fecha de registro
* Última actividad

El cliente puede existir aunque el negocio no tenga Loyalty activo.

Esto permite que Reviews capture clientes sin depender del módulo de lealtad.

---

# 6. Sistema de Reviews

## 6.1 Landing de Reviews

Cada negocio o sucursal tendrá una landing pública.

Ejemplo:

```text
reviews.app.com/cafe-central
```

o:

```text
reviews.app.com/cafe-central/centro
```

La landing debe ser:

* Mobile-first.
* Rápida.
* Personalizada con branding.
* Accesible mediante QR.
* Accesible mediante NFC.

---

# 7. Flujo Principal

```text
Cliente
   ↓
QR / NFC
   ↓
Landing de Reviews
   ↓
Evento: page_view
   ↓
Invitación a compartir experiencia
   ↓
Click "Dejar reseña en Google"
   ↓
Evento: google_review_click
   ↓
Google Reviews
```

---

# 8. Registro Opcional del Cliente

El negocio podrá activar o desactivar captura de información.

Campos posibles:

* Nombre.
* Teléfono.
* Email.

Ejemplo:

```text
Gracias por visitarnos.

Registra tu visita y recibe un beneficio
para tu próxima compra.

Nombre
Teléfono

[Continuar]
```

El registro no deberá estar condicionado a dejar una reseña.

---

# 9. Promociones

Reviews podrá tener su propio sistema básico de promociones.

Ejemplos:

* 10% de descuento en próxima visita.
* $50 de descuento.
* Producto gratis en próxima compra.
* Promoción especial.
* Cupón personalizado.

La promoción se obtiene por registrarse o participar en el programa y no por publicar una reseña.

---

# 10. Cupones

Cada cupón deberá tener:

* ID.
* Código.
* Customer ID.
* Business ID.
* Branch ID.
* Promotion ID.
* Fecha de creación.
* Fecha de expiración.
* Estado.

Estados:

```text
ACTIVE
REDEEMED
EXPIRED
CANCELLED
```

---

# 11. Canje de Cupón

Desde el dashboard:

```text
Código:

A7K92F

[Validar]
```

Resultado:

```text
Cupón válido

Cliente:
Carlos M.

Beneficio:
10% de descuento

[Canjear]
```

---

# 12. QR

Cada sucursal podrá generar diferentes QR.

Ejemplos:

```text
QR mostrador
QR ticket
QR mesa
QR recepción
QR empleado
QR campaña
```

Cada QR deberá poder identificarse individualmente para analytics.

---

# 13. NFC

Se podrán registrar dispositivos o tarjetas NFC.

Información:

* ID.
* Nombre.
* Business.
* Branch.
* Ubicación.
* Estado.
* URL asociada.

Ejemplo:

```text
NFC-01

Sucursal Centro

Ubicación:
Caja principal
```

---

# 14. Tracking de Eventos

El sistema deberá tener un sistema centralizado de eventos.

Eventos iniciales:

```text
page_view

qr_scan

nfc_visit

customer_registered

google_review_click

coupon_created

coupon_viewed

coupon_redeemed
```

Cada evento deberá almacenar cuando sea posible:

* Business ID.
* Branch ID.
* Customer ID.
* QR ID.
* NFC ID.
* Timestamp.
* Source.
* Session ID.

---

# 15. Sources

El sistema deberá identificar cómo llegó el cliente.

Ejemplos:

```text
NFC
QR
Wallet
Direct Link
Loyalty
Campaign
```

Esto permitirá comparar canales.

---

# 16. Dashboard de Reviews

## Resumen

Mostrar:

* Visitas.
* Personas únicas.
* Clicks hacia Google.
* CTR hacia Google.
* Clientes registrados.
* Cupones creados.
* Cupones utilizados.
* Nuevas reseñas.
* Rating de Google.

Ejemplo:

```text
Visitas

1,284

+14.2%
```

```text
Clicks Google

742

57.8% CTR
```

```text
Reviews nuevas

+83
```

```text
Google Rating

4.7 ★
```

---

# 17. Funnel

Mostrar:

```text
Landing Views
1,284
   ↓
Customer Registrations
643
   ↓
Google Clicks
512
   ↓
New Google Reviews
183
```

No deberá afirmarse que cada nueva reseña corresponde directamente a un click específico salvo que exista información suficiente para establecer esa relación.

---

# 18. Analytics por Sucursal

El administrador podrá comparar:

| Sucursal | Views | Google Clicks | CTR | Reviews | Cupones |
| -------- | ----: | ------------: | --: | ------: | ------: |
| Centro   |   430 |           280 | 65% |     +42 |      31 |
| Norte    |   350 |           190 | 54% |     +28 |      19 |
| Sur      |   220 |           105 | 48% |     +17 |      11 |

---

# 19. Analytics por Fuente

Ejemplo:

| Fuente | Visitas | Conversión |
| ------ | ------: | ---------: |
| NFC    |     420 |        63% |
| QR     |     310 |        52% |
| Wallet |     180 |        71% |
| Direct |      80 |        31% |

---

# 20. Analytics por Periodo

Filtros:

* Hoy.
* Últimos 7 días.
* Últimos 30 días.
* Mes actual.
* Mes anterior.
* Rango personalizado.

---

# 21. Google Business Profile

Cada sucursal podrá conectar su ubicación de Google Business Profile.

Información a sincronizar:

* Nombre.
* Rating.
* Número total de reviews.
* Reviews recientes.
* Fecha de reviews.

Esto permitirá mostrar:

```text
Rating

4.7 ★

Reviews

482

Este mes

+37
```

---

# 22. Reviews Recientes

Dashboard:

```text
★★★★★

Carlos M.

"Excelente servicio."

Hace 2 horas
```

El objetivo es centralizar información de reputación dentro de la plataforma.

---

# 23. Integración con Loyalty

Si el negocio tiene ambos productos activos, se habilitarán funciones adicionales.

```text
Reviews
     ↕
Shared Customer
     ↕
Loyalty
```

---

# 24. Cliente Compartido

Un mismo Customer ID deberá utilizarse en ambos sistemas.

Ejemplo:

```text
Customer #3918

Carlos Martínez

Reviews
- 3 interacciones
- 1 click hacia Google

Loyalty
- 7 visitas
- 7 sellos
- $2,850 en compras
```

No se deben crear dos registros del mismo cliente solamente por utilizar productos diferentes.

---

# 25. Reviews desde Loyalty

Después de registrar una visita o venta:

```text
Compra
   ↓
Registro de venta
   ↓
Asignar puntos/sello
   ↓
Evaluar reglas de Reviews
   ↓
Mostrar invitación
```

Ejemplo:

```text
¡Gracias por tu visita!

Ya tienes 7 de 10 sellos.

¿Quieres compartir tu experiencia?

[Dejar reseña]
```

---

# 26. Reglas para Solicitar Review

Cuando ambos productos estén activos se podrán definir reglas.

Ejemplos:

```text
Solicitar después de:

2 visitas
```

```text
Solicitar máximo:

1 vez cada 180 días
```

```text
No volver a mostrar después de:

google_review_click
```

También podría configurarse:

* Después de determinada compra.
* Después de cierta cantidad de visitas.
* Después de completar una recompensa.
* Después de una venta mayor a determinado monto.

---

# 27. Wallet + Reviews

Los negocios que tengan Loyalty podrán agregar acciones relacionadas con Reviews dentro de la experiencia de Wallet.

Ejemplo:

```text
CAFÉ CENTRAL

7 / 10 sellos

Próxima recompensa:
Café gratis

[Dejar una reseña]
```

---

# 28. Analytics Combinados

Cuando ambos productos estén activos, se podrá mostrar información cruzada.

Ejemplo:

```text
Clientes loyalty

1,420

Interactuaron con Reviews

684

Clicks Google

410

Clientes recurrentes

492
```

---

# 29. Customer Timeline

Cuando ambos productos estén activos se podrá generar una línea de actividad.

Ejemplo:

```text
Carlos Martínez

12 Sep
Compra $450

12 Sep
+1 sello

12 Sep
Review landing view

12 Sep
Google review click

16 Sep
Cupón utilizado

16 Sep
Compra $320

16 Sep
+1 sello
```

Esto deberá utilizar eventos compartidos y no dependencias directas entre módulos.

---

# 30. Dashboard Global

Cuando el negocio tenga ambos productos:

```text
Dashboard
│
├── Overview
├── Customers
├── Branches
│
├── Loyalty
│   ├── Cards
│   ├── Sales
│   ├── Rewards
│   └── Analytics
│
├── Reviews
│   ├── Overview
│   ├── Reviews
│   ├── QR / NFC
│   ├── Promotions
│   └── Analytics
│
└── Settings
```

Si solamente tiene Reviews:

```text
Dashboard
│
├── Overview
├── Customers
├── Branches
├── Reviews
│   ├── Overview
│   ├── Reviews
│   ├── QR / NFC
│   ├── Promotions
│   └── Analytics
└── Settings
```

Si solamente tiene Loyalty:

```text
Dashboard
│
├── Overview
├── Customers
├── Branches
├── Loyalty
│   ├── Cards
│   ├── Sales
│   ├── Rewards
│   └── Analytics
└── Settings
```

---

# 31. Separación Técnica de Módulos

Aunque compartan base de datos, los módulos deben permanecer desacoplados.

Reviews no deberá depender de:

* Tarjetas.
* Sellos.
* Puntos.
* Rewards de Loyalty.
* Wallet.

Loyalty no deberá depender de:

* Google Business.
* Google Reviews.
* NFC de reviews.
* QR de reviews.
* Review analytics.

La integración solamente deberá ocurrir cuando ambos productos estén activos.

---

# 32. Modelo Conceptual de Base de Datos

```text
businesses
branches
users
customers

business_products
subscriptions

loyalty_cards
loyalty_transactions
loyalty_rewards
loyalty_rules

review_locations
review_sources
review_links
review_events
review_promotions
review_coupons
google_business_connections
google_reviews
```

---

# 33. Business Products

Tabla encargada de determinar productos habilitados.

Ejemplo:

```text
business_products

id
business_id
product
status
activated_at
expires_at
```

Valores:

```text
LOYALTY

REVIEWS
```

Estados:

```text
ACTIVE
TRIAL
SUSPENDED
CANCELLED
```

---

# 34. Principio de Diseño

Los módulos deberán seguir este principio:

> Compartir identidad y datos base, pero no lógica de negocio.

Compartido:

```text
Business
Branch
Customer
User
Authentication
Billing
```

Independiente:

```text
Loyalty Domain
Reviews Domain
```

Integración:

```text
Shared Events
Customer ID
Business ID
Branch ID
```

Esto permitirá agregar nuevos productos posteriormente sin rediseñar la plataforma.

Ejemplo:

```text
Platform
│
├── Loyalty
├── Reviews
├── Marketing
├── Reservations
└── CRM
```

---

# 35. MVP Reviews

Para una primera versión se consideran indispensables:

## Configuración

* Activar Reviews por negocio.
* Crear sucursales.
* Configurar link de Google Reviews.
* Personalizar landing.

## Captación

* QR.
* NFC.
* Landing pública.
* Botón hacia Google.

## Tracking

* Page views.
* Visitantes únicos.
* Google review clicks.
* Source tracking.
* Analytics por sucursal.

## Clientes

* Registro opcional.
* Nombre.
* Teléfono.
* Asociación con Business.
* Asociación con Branch.

## Promociones

* Crear promoción.
* Crear cupón.
* Validar cupón.
* Canjear cupón.

## Dashboard

* Visits.
* Unique visitors.
* Google clicks.
* CTR.
* Customer registrations.
* Coupons.
* Conversion funnel.

## Integración Loyalty

Si Loyalty se encuentra activo:

* Utilizar los mismos clientes.
* Acceso desde la experiencia de Loyalty.
* Disparar invitaciones después de una visita.
* Mostrar actividad combinada.

---

# 36. Features Posteriores al MVP

* Integración completa con Google Business Profile API.
* Sincronización automática de reviews.
* Dashboard de rating histórico.
* Respuestas a reviews.
* Campañas.
* WhatsApp.
* Segmentación de clientes.
* Automatizaciones.
* Notificaciones.
* Customer lifecycle.
* Comparativas entre sucursales.
* Reportes automáticos.
* White-label.
* Roles avanzados.
* API pública.
* Webhooks.

---

# 37. Objetivo Comercial

El sistema debe permitir vender tres configuraciones diferentes:

### Loyalty

```text
Tarjetas
+
Sellos / puntos
+
Recompensas
+
Clientes
```

### Reviews

```text
Google Reviews
+
QR / NFC
+
Analytics
+
Clientes
+
Promociones
```

### Loyalty + Reviews

```text
Loyalty
+
Reputation
+
Customer Analytics
+
Retención
+
Reviews
+
Promociones
```

El objetivo es que ambos productos puedan venderse independientemente pero que contratar ambos genere funciones adicionales y una experiencia más completa.

---

# 38. Revisión técnica vinculante

La revisión del 2026-09-17 conserva el objetivo comercial y agrega estas
restricciones para que el plan sea compatible con la plataforma existente.

## 38.1 Reutilización del modelo actual

* `tenants` es la entidad canónica de negocio; no se creará una tabla
  `businesses` paralela.
* `branches`, `staff_profiles`, `staff_branch_assignments` y Auth siguen siendo
  las fuentes compartidas de sucursales, usuarios y permisos.
* Los productos habilitados se modelarán como capacidades o entitlements del
  dominio comercial existente. No se creará una segunda fuente de verdad de
  suscripciones.
* Las promociones comerciales de paquetes y los beneficios entregados a
  consumidores son dominios distintos. El módulo Reviews usará nombres como
  `review_offers` y `review_coupons` para evitar confundirlos con promociones
  de facturación.

## 38.2 Visitantes, contactos y clientes

* Una visita anónima no creará automáticamente un registro en `customers`.
* Cada apertura usará una sesión pública opaca y de vida limitada. Los
  identificadores de dispositivo o red no se expondrán ni se usarán como una
  identidad de cliente confiable.
* Solo cuando exista consentimiento y un identificador suficiente se creará o
  vinculará un cliente del tenant mediante reglas de normalización y
  deduplicación. No se crearán duplicados por producto.
* Antes de persistir nombre, teléfono o correo se deben aprobar aviso de
  privacidad, finalidad, retención, eliminación y consentimiento.

## 38.3 Cumplimiento de Google Reviews

* La invitación se mostrará de forma neutral a clientes con experiencias
  genuinas; no se preguntará primero por satisfacción para enviar solo a los
  clientes positivos a Google.
* Ningún descuento, producto, cupón, punto o recompensa se ofrecerá a cambio
  de publicar, editar o eliminar una reseña, ni dependerá de una calificación.
* Un beneficio puede depender de registro o participación independiente, y
  debe entregarse igual aunque la persona no abra Google ni publique contenido.
* `google_review_click` prueba únicamente que se abrió el destino. No se
  presentará como una reseña publicada ni se atribuirá una reseña concreta a
  una sesión sin evidencia suficiente.
* Rating, total de reseñas, reseñas recientes y respuestas requieren conexión
  OAuth y acceso aprobado a Google Business Profile; permanecen fuera del
  primer MVP de captación.

Referencias oficiales revisadas:

* https://support.google.com/business/answer/3474122
* https://support.google.com/contributionpolicy/answer/7400114
* https://developers.google.com/my-business/content/review-data

## 38.4 Medición y abuso

* `qr_scan` y `nfc_visit` significan una apertura con un token de fuente QR o
  NFC; el navegador no puede demostrar por sí solo el acto físico de escanear
  o acercar el dispositivo.
* QR y NFC usarán tokens opacos, rotables y revocables. No aceptarán
  `tenant_id`, `branch_id` ni tipo de fuente enviados libremente por el cliente.
* Los eventos tendrán esquema versionado, idempotencia, límites de frecuencia,
  clasificación de bots, retención definida y agregaciones que no mezclen
  sesiones, personas y clientes identificados.
* Los códigos de cupón serán aleatorios y no enumerables. Validación y canje
  serán tenant/sucursal-scoped, atómicos, idempotentes y auditados.

## 38.5 Alcance del primer MVP

El primer corte implementable incluye entitlements, configuración por
sucursal, enlaces de Google aportados por el Admin, fuentes QR/NFC, landing
pública neutral, eventos, analytics básicos, captura opcional consentida y
ofertas/cupones independientes de la reseña. La sincronización con Google
Business Profile, atribución de reseñas, respuestas, automatizaciones, Wallet y
reglas cruzadas avanzadas con Loyalty se entregarán en unidades posteriores.
