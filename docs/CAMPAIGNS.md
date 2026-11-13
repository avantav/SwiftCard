# Campañas (plan Empresarial)

Estado: implementado (DEC-0068, migración `0076`). Ruta: `/admin/campaigns`.

## Quién puede usarlas

- Solo el **Admin general** del negocio, fuera del modo soporte.
- El negocio necesita una suscripción `empresarial` activa o en prueba, **o**
  que el Superadmin active «Campañas (Empresarial)» en el menú del tenant
  (`/superadmin`). Ningún negocio tiene hoy suscripción registrada, así que
  la activación manual es el camino actual.

## Cómo funciona

1. **Audiencia:** segmentos de las estadísticas (DEC-0067) y sucursal
   opcional. La vista previa muestra cuántos recibirán correo, cuántos aviso
   en Wallet y cuántos quedan fuera (sin consentimiento o por el límite).
2. **Mensaje:** nombre interno; correo (asunto ≤120, mensaje ≤1,500) y/o
   aviso de Wallet (≤120, sin enlaces). Confirmación obligatoria.
3. **Envío:** al crear la campaña se fijan los destinatarios y el envío corre
   en segundo plano. El detalle muestra enviados, pendientes, fallidos y
   omitidos por canal, con «Reintentar pendientes».

## Reglas contra el abuso

- Solo clientes con **consentimiento de marketing** (casilla del registro).
- **Una campaña por cliente cada 7 días**, sumando correo y Wallet.
- Audiencia máxima de 5,000 clientes por campaña y una campaña por minuto.
- Google Wallet permite 3 avisos con notificación por pase al día; si se
  agotan, el mensaje queda guardado en el pase sin notificar.
- Cada correo incluye **«Dejar de recibir promociones»**
  (`/card/[token]/promociones`, confirma con un botón). Retirar el permiso
  detiene correos y avisos de campañas; los avisos de compras y premios
  siguen.

## Canales

| Canal | Entrega |
|---|---|
| Correo | Resend con la marca de la tarjeta, saludo, botón a la tarjeta y enlace de baja. Clave de idempotencia por destinatario. |
| Apple Wallet | El pase muestra la campaña como «última actividad» y el iPhone notifica. Se encola al crear la campaña; vuelve a mostrar la actividad normal tras la siguiente compra o canje. Solo pases con dispositivo registrado. |
| Google Wallet | `addMessage` con id `campaign-<campaña>` (un reintento no duplica). |

## Fuera de alcance

Cupones o descuentos, WhatsApp, programación de envíos, plantillas guardadas,
métricas de aperturas y clics.
