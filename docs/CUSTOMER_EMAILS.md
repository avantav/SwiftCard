# Correos a clientes

Estado: **MVP implementado** (rama `worktree-email-notifications`, DEC-0056).
Pendiente: verificar el dominio en Resend, configurar las variables en el
hosting, aplicar la migración `0070` y probar con un correo real.

## Alcance MVP (transaccional)

| Correo | Cuándo | Contenido |
|---|---|---|
| **Bienvenida** | Se emite una tarjeta nueva (`CREATED`) por registro público o por empleado, y el cliente dejó correo. | Saludo con el nombre de pila, programa, cómo se acumula, **premio de bienvenida si la tarjeta lo da**, próximo premio y botón «Abrir mi tarjeta» (desde ahí agrega a Apple o Google Wallet). |
| **Premio desbloqueado** | Una compra confirmada genera uno o más premios (`rewards.source_purchase_id`). | «¡Ganaste {premio}!», cómo canjearlo y botón «Ver mi tarjeta». |

No se envían correos para clientes importados por CSV/Excel, recuperaciones
de importados (`IMPORTED_RECOVERY`), ajustes manuales ni canjes.

Son correos **transaccionales** del programa al que el cliente se registró:
no requieren el consentimiento de marketing y no incluyen promociones.

## Proveedor y remitente

- **Resend**, por API REST (`src/lib/email/resend.ts`, sin dependencia nueva).
- Remitente: `"{nombre del negocio}" <EMAIL_FROM_ADDRESS>`. Recomendado: un
  subdominio dedicado del dominio de morrow, p. ej. `tarjetas@correo.<dominio>`,
  para aislar la reputación de envío del dominio principal.
- Si el negocio es white-label, el pie no menciona a morrow.

### Configuración (manual)

1. Crear la cuenta en Resend y agregar el dominio de envío; publicar los
   registros DNS que indique (SPF, DKIM y, recomendado, DMARC) y esperar la
   verificación.
2. Crear una API key con permiso solo de envío.
3. Variables de entorno del servidor (nunca con prefijo `NEXT_PUBLIC_`):
   - `RESEND_API_KEY`
   - `EMAIL_FROM_ADDRESS` (dirección del dominio verificado)
   - `EMAIL_REPLY_TO` (opcional)
   - `SWIFTWALLET_PUBLIC_URL` (ya existente; se usa para el enlace de la tarjeta)
4. Aplicar la migración `0070_customer_emails_and_marketing_consent.sql`.

Sin `RESEND_API_KEY` o `EMAIL_FROM_ADDRESS` los correos se omiten y el registro
y las compras funcionan igual.

## Funcionamiento

- Plantillas fijas en español (`src/lib/email/templates.ts`), HTML basado en
  tablas con estilos inline, versión de texto plano, todo valor dinámico
  escapado y enlaces o imágenes solo HTTPS. El color del botón usa el fondo de la
  tarjeta con texto negro o blanco calculado para contraste AA.
- Orquestación en `src/lib/email/customer-emails.ts` con la clave de servicio:
  1. Carga cliente, negocio, diseño, programa y saldo.
  2. Reserva el evento en `customer_email_deliveries` (`welcome:<tarjeta>` o
     `reward:<compra>`, únicos por tenant). Si ya existe, no reenvía.
  3. Envía con `Idempotency-Key` igual al evento.
  4. Registra `SENT` + id del proveedor o `FAILED` + error corto.
- La tabla no guarda la dirección de correo (minimización de datos).
- **Sin cola ni cron**: el envío ocurre dentro de la acción, en paralelo con las
  actualizaciones de Wallet (`dispatchCustomerActivityBestEffort`). Un fallo no
  afecta la operación; el evento queda `FAILED` y hoy no se reintenta.
- El correo de premio solo describe compras de los últimos 15 minutos, para no
  enviar eventos viejos si la acción se reintenta mucho después.

## Consentimiento de marketing (para campañas futuras)

- Nueva casilla **opcional y desmarcada** en el registro público («Quiero recibir
  promociones y novedades de {negocio} por correo o WhatsApp») y en el registro
  por empleado («El cliente acepta recibir promociones…»).
- Se guarda en `customers.marketing_consent`, con fecha y origen
  (`SELF_SERVICE` o `EMPLOYEE`), mediante la RPC
  `app.set_card_marketing_consent(token, consent)`. El token de la tarjeta es la
  autoridad; un empleado además debe tener acceso al tenant. El cambio queda en
  `audit_logs` por el trigger existente de clientes.
- Es independiente del aviso de privacidad (LFPDPPP / GDPR exigen consentimiento
  expreso para fines secundarios como mercadotecnia).

## Post-MVP: campañas de email y WhatsApp

Requiere autorización explícita (las campañas están fuera del MVP según
`AGENTS.md`). Diseño previsto:

1. **Audiencia:** solo clientes con `marketing_consent = true` **y** en el
   **tier más alto** del programa. Pendiente definir «tier más alto»: propuesta,
   haber alcanzado el nivel de premio más alto en programas de puntos
   acumulados, o un número de ciclos completados en programas de sellos.
2. **Baja con un clic** en cada correo de campaña (enlace firmado que pone
   `marketing_consent = false`) y encabezado `List-Unsubscribe`.
3. **WhatsApp:** WhatsApp Business Platform (Cloud API) con plantillas aprobadas
   por Meta y opt-in explícito; mismo consentimiento y misma audiencia.
4. **Envío por lotes con cola y worker** (Resend Batch / colas), límites por
   tenant, registro por destinatario y métricas de entrega.
5. **Plantillas editables** por el negocio, con vista previa y variables cerradas.

## Otros pendientes

- Reintento de correos `FAILED` (worker; ver `docs/WALLET_ACTIVITY_MESSAGES.md`).
- Correo de premio por ajuste manual o premio de bienvenida posterior.
- Mostrar el consentimiento de marketing en `/admin/customers` y permitir
  retirarlo desde el panel.
- Verificación del correo del cliente: no existe (PRODUCT: sin verificación por
  correo). Una dirección mal escrita recibe la bienvenida; el pie indica
  «Si no fuiste tú, ignora este mensaje».

## Verificación

- Unitarias: plantillas (escape, white-label, contraste, asuntos), envío
  idempotente, proveedor no configurado, fallo del proveedor, consentimiento solo
  con opt-in y bienvenida solo con tarjeta nueva.
- Manual tras configurar: registrar un cliente con correo propio (con y sin
  premio de bienvenida), registrar una compra que desbloquee un premio y revisar
  ambos correos en Gmail y en Outlook (móvil y escritorio).
