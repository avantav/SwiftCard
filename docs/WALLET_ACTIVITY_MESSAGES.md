# Wallet: mensajes de actividad (compra, premio alcanzado, premio canjeado)

Estado: **MVP en producción** (PR #21, DEC-0055). Validado por el propietario
en **iPhone** el 2026-11-11 (compra y premios); **Android pendiente**. Este
documento es la fuente del plan, de las decisiones y del trabajo posterior al MVP.

## Objetivo

Avisar al cliente final, a través de su tarjeta en Wallet, cuando:

1. **Registra una compra**: confirmación con las unidades sumadas y el saldo nuevo
   (sellos o puntos) y lo que le falta para el próximo premio.
2. **Alcanza un premio**: aviso de que lo desbloqueó y cómo canjearlo.
3. **Usa un premio**: confirmación del canje y de los premios que le quedan.

Son mensajes **transaccionales** ligados a una operación real. Las campañas o
difusiones libres siguen fuera del MVP (`AGENTS.md` › Scope).

## Capacidades de cada plataforma

| | Apple Wallet | Google Wallet |
|---|---|---|
| Mecanismo | El pase se actualiza por PassKit (push APNs vacío y descarga del `.pkpass`). iOS muestra una notificación cuando **cambia el valor** de un campo con `changeMessage`; `%@` se sustituye por el valor nuevo. | `loyaltyObject.addMessage` con `messageType: TEXT_AND_NOTIFY`: mensaje con título y cuerpo, guardado en el detalle del pase y notificado en Android. |
| Texto libre | Sí, si el valor del campo **es** el mensaje (`changeMessage: "%@"`). | Sí (`header` + `body`). |
| Límites | Sin cuota documentada; un valor idéntico al anterior no notifica. Mantener el texto corto (≈120 caracteres) para que no se corte en la pantalla bloqueada. | **3 mensajes con notificación por pase cada 24 h** (más 3 por cambio de campo). Si se supera: `QuotaExceededException` / HTTP 429. |
| Avisos por cambio de campo | Cada campo con `changeMessage` que cambia puede generar su propio aviso. | `notifyPreference: NOTIFY_ON_UPDATE` solo para el saldo; Google controla el texto. |

Referencias: [Google – Trigger push notifications](https://developers.google.com/wallet/retail/loyalty-cards/use-cases/trigger-push-notifications),
[Google – addmessage](https://developers.google.com/wallet/reference/rest/v1/loyaltyobject/addmessage),
[PassKit – lock screen notifications](https://help.passkit.com/en/articles/4097979-sending-lock-screen-notifications).

## Alcance MVP — plantillas fijas del sistema

### Decisión

Las plantillas son **fijas, en español y gestionadas en código**
(`src/lib/wallet/activity-message.ts`), con variables calculadas por el servidor.
Las plantillas **editables por tarjeta** pasan a fuera del MVP porque requieren
migración, una nueva versión de la RPC de diseño
(`save_loyalty_card_design_v6`, 23 parámetros), interfaz en el editor según
`docs/DESIGN_SYSTEM.md`, validación de variables y vista previa por proveedor.
Ver DEC-0055.

### Plantillas

| Evento | Texto |
|---|---|
| Compra | `¡Gracias por tu compra! Sumaste {sumadas} {unidad}. Ahora tienes {saldo} {unidad}.` + (`Te faltan {faltan} {unidad} para {próximo premio}.` si hay meta) |
| Compra sin unidades | `Registramos tu compra. Tienes {saldo} {unidad}.` + meta si aplica |
| Premio alcanzado | `¡Felicidades! Desbloqueaste {premio}. Muéstralo en caja para canjearlo.` (`… {n} premios: {premio}, …` si son varios) |
| Premio canjeado | `Canjeaste {premio}. ¡Disfrútalo!` + `Te quedan {n} premios disponibles.` / `Sigue sumando {unidad} con cada compra.` |
| Sin actividad | `Aquí verás tu última compra y tus premios.` |

Reglas:

- **No incluye el nombre del cliente** ni datos de contacto: el texto aparece en
  la pantalla bloqueada.
- Si una compra desbloquea un premio, gana el mensaje de **premio alcanzado**:
  un solo aviso por operación.
- El texto se recorta a 150 caracteres (Apple) y el título de Google a 40.
- Unidades en singular o plural según la cantidad; los puntos de por vida se
  muestran enteros (decenas truncadas), igual que el saldo del pase.

### Origen del evento (sin migración)

El último evento se **deriva** de las tablas existentes, filtrando por tenant,
cliente y tarjeta de fidelidad (`loyalty_card_id`):

- Última compra `CONFIRMED` en `purchases`.
- Premios con `source_purchase_id` de esa compra → premio alcanzado.
- Último canje `COMPLETED` en `reward_redemptions` (premio en `rewards`); los
  canjes revertidos (`REVERSED`) se ignoran.
- Gana el evento más reciente (`created_at` / `redeemed_at`).

No hace falta tabla nueva: el mensaje se recalcula siempre desde el estado
confirmado, así que cualquier reintento genera el mismo texto.

### Apple Wallet

- Nuevo campo de reverso `latest-activity` («ÚLTIMA ACTIVIDAD») cuyo valor es el
  mensaje, con `changeMessage: "%@"`.
- Se **quita** `changeMessage` del resto de campos (saldo, progreso, premios en
  frente y reverso) para que cada operación produzca **exactamente un aviso**.
  Antes, una compra en un programa de puntos podía notificar dos veces (saldo y
  progreso) y un premio nuevo, dos (frente y reverso).
- El envío sigue igual: la acción llama a `dispatchAppleWalletUpdatesBestEffort`
  y Wallet descarga el pase nuevo.
- Limitación conocida: en pases instalados antes del despliegue, la primera
  actualización **agrega** el campo; iOS puede no notificar esa primera vez.

### Google Wallet

Hoy el objeto solo se sincroniza al pulsar «Agregar a Google Wallet». En el MVP,
tras cada compra o canje confirmados, la acción ejecuta **por llamada directa**:

1. Busca los pases `GOOGLE` `ACTIVE` del cliente en `wallet_passes`.
2. Recalcula el objeto (saldo, premios, progreso) y hace PATCH **sin**
   `notifyPreference` para no gastar la cuota en un aviso genérico.
3. `addMessage` con `TEXT_AND_NOTIFY`, `id` determinista por evento
   (`activity-<tipo>-<id>`) para que un reintento no duplique el mensaje.
4. Si Google responde con cuota agotada (429 / `QuotaExceeded`), reintenta como
   `TEXT`: el mensaje queda en el pase sin notificación.
5. Si el `id` ya existe (409), se considera entregado.
6. Actualiza `last_synced_at` / `last_error` en `wallet_passes`.

Todo es **best-effort**: un fallo de Google nunca revierte la operación de
fidelidad y solo se registra un diagnóstico sin PII.

### Puntos de disparo

`src/app/app/purchase/actions.ts` (`confirmPurchase`),
`src/app/app/redeem/actions.ts` (`redeemReward`) y
`src/app/app/scan/actions.ts` (canje y `confirmCustomerPurchase`) llaman a
`dispatchCustomerActivityBestEffort({ customerId })` (antes
`dispatchWalletActivityBestEffort`), que agrupa Apple, Google y, desde DEC-0056,
el correo de premio desbloqueado.

### Fuera de alcance del MVP

- Interfaz para ver o editar los mensajes (no hay cambios de UI).
- Mostrar el último mensaje en la Web Card.
- Avisos por cancelaciones, ajustes, reversiones, bono de bienvenida o
  expiración de premios.

## Sin cron ni colas: modo de entrega actual

No existe un scheduler ni un worker. Todo ocurre **en la misma petición** de la
acción del empleado:

- Apple: la cola `apple_wallet_update_outbox` ya existe y la acción la drena con
  `limit: 1`; los trabajos fallidos quedan en la cola hasta la siguiente
  operación del mismo cliente.
- Google: llamada directa sin cola. Si falla (red, cuota, credenciales), **ese**
  mensaje se pierde; el saldo se corrige en la siguiente sincronización.
- Coste: la acción espera las llamadas a Google (OAuth con caché, PATCH y
  addMessage; habitualmente < 1 s; timeout de 10 s por petición).

## Plan para agregar workers (post-MVP)

1. **Cola de Google** `google_wallet_update_outbox` (análoga a la de Apple):
   `customer_card_id`, `event_kind`, `event_id`, `attempts`, `next_attempt_at`,
   `last_error`, con RLS forzada y RPC exclusivas de `service_role`. Encolar por
   trigger en `purchases` / `reward_redemptions` / `rewards`, dentro de la misma
   transacción que la operación.
2. **Worker** `POST /api/internal/wallet/process-updates` protegido con
   `Authorization: Bearer <WALLET_WORKER_SECRET>` (≥32 caracteres, comparación
   en tiempo constante, como `APPLE_WALLET_RETRY_SECRET`). Procesa Apple y Google
   con leases, backoff exponencial y límite por ejecución.
3. **Scheduler**: Vercel Cron (cada minuto) o un cron externo que llame al worker.
   La acción del empleado pasa a solo encolar (respuesta más rápida).
4. **Cuota de Google**: contador por pase y ventana de 24 h; priorizar «premio
   alcanzado» > «premio canjeado» > «compra» y degradar a `TEXT` al agotarse.
5. **Observabilidad**: métricas de entregados, diferidos y fallidos por
   proveedor; alerta si la cola crece (ver `docs/MONITORING_BACKUP.md`).

## Plan post-MVP — plantillas personalizables por tarjeta

1. Migración: columnas en `loyalty_cards`:
   `purchase_message_template`, `reward_unlocked_message_template`,
   `reward_redeemed_message_template` (`text null`, `check` de longitud ≤ 150).
   `null` = plantilla del sistema.
2. RPC `save_loyalty_card_design_v7` (o RPC dedicada
   `save_loyalty_card_messages`), solo ADMIN del tenant, auditada; el trigger
   existente de diseño encola las actualizaciones de Apple.
3. Variables cerradas: `{saldo}`, `{unidad}`, `{sumadas}`, `{faltan}`,
   `{proximo_premio}`, `{premio}`, `{premios_disponibles}`, `{negocio}`. Sin
   HTML, sin enlaces, sin nombre ni teléfono del cliente. Validar en servidor
   que solo se usen variables conocidas.
4. UI en el editor de tarjeta (`/admin/cards`): tres campos con contador de
   caracteres, chips de variables, vista previa con datos de ejemplo y botón
   «Restaurar texto del sistema», siguiendo `docs/DESIGN_SYSTEM.md`.
5. Tests: validación de plantillas, render con cada tipo de programa y límites.

## Verificación

- Unitarias: composición de mensajes (todos los tipos de programa, singular y
  plural, varios premios, sin meta), campo Apple con un único `changeMessage`,
  PATCH de Google sin `notifyPreference` y degradación por cuota.
- Manual tras el despliegue (iPhone y Android reales con el pase instalado):
  1. Compra que suma sin desbloquear → un aviso «¡Gracias por tu compra!…».
  2. Compra que desbloquea → un solo aviso «¡Felicidades!…».
  3. Canje → un aviso «Canjeaste…».
  4. Android: cuarto aviso en 24 h → el mensaje aparece en el pase sin
     notificación.
