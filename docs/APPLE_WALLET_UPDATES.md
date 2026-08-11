# Apple Wallet: actualizaciones automáticas

## Estado implementado

SwiftWallet incluye el servicio web PassKit completo para que una tarjeta instalada consulte y descargue cambios de sellos, recompensas, cliente, programa, diseño y ubicaciones.

El flujo actual es:

1. PostgreSQL confirma la operación de fidelidad.
2. Un trigger incrementa el `update_tag` del pase y agrega o combina un trabajo en `apple_wallet_update_outbox` dentro de la misma transacción.
3. La acción de Next.js intenta enviar inmediatamente una notificación vacía a APNs.
4. La operación de fidelidad no se revierte si APNs o la red fallan.
5. Apple Wallet consulta los seriales modificados y descarga un `.pkpass` nuevo con el mismo serial y token de autenticación.
6. Los dispositivos inválidos se eliminan y los fallos recuperables permanecen en la cola.

La notificación APNs no contiene saldo, cliente ni recompensas. Solo solicita a Wallet que consulte nuevamente el pase.

## Migración pendiente de aplicación manual

Aplicar, después de respaldar y revisar el proyecto correcto:

```text
supabase/migrations/0038_apple_wallet_updates.sql
```

La migración crea:

- Dispositivos con identificador almacenado únicamente como HMAC.
- Push tokens cifrados con AES-256-GCM.
- Registros muchos-a-muchos entre dispositivos y pases.
- Tags monotónicos de actualización.
- Una cola transaccional con leases, reintentos y deduplicación.
- Triggers para cambios que afectan el contenido de un pase.
- RPC exclusivas de `service_role`; `anon` y `authenticated` no pueden leer las tablas ni ejecutar el worker.

La migración `0038` fue validada junto con todas las migraciones y pruebas RLS en PostgreSQL desechable. No fue aplicada al Supabase remoto.

## Variables de entorno

Se conservan las credenciales Apple existentes:

```env
APPLE_PASS_TYPE_ID=
APPLE_TEAM_ID=
APPLE_SIGNER_CERTIFICATE_BASE64=
APPLE_SIGNER_KEY_BASE64=
APPLE_WWDR_CERTIFICATE_BASE64=
APPLE_CERTIFICATE_PASSWORD=
SWIFTWALLET_PUBLIC_URL=https://tu-dominio.example
```

Agregar un secreto estable de exactamente 32 bytes codificado como Base64:

```env
APPLE_WALLET_UPDATE_SECRET_BASE64=
```

Puede generarse localmente con:

```bash
openssl rand -base64 32
```

Este secreto deriva, con separación criptográfica de propósito:

- El `authenticationToken` estable de cada pase.
- Los HMAC de identificadores y push tokens.
- La llave de cifrado de push tokens.

No debe rotarse directamente. Cambiarlo hace que los pases ya instalados no puedan autenticarse y que los push tokens existentes no puedan descifrarse. Una rotación futura requiere aceptar temporalmente la llave anterior y volver a cifrar los registros.

Para conectar un cron externo en el futuro, configurar además:

```env
APPLE_WALLET_RETRY_SECRET=
```

Debe ser un valor aleatorio de al menos 32 caracteres.

## Endpoints publicados

El pase usa esta base:

```text
https://tu-dominio.example/api/wallet/apple
```

Apple Wallet agrega las rutas oficiales:

```text
POST   /v1/devices/{deviceId}/registrations/{passTypeId}/{serial}
DELETE /v1/devices/{deviceId}/registrations/{passTypeId}/{serial}
GET    /v1/devices/{deviceId}/registrations/{passTypeId}
GET    /v1/passes/{passTypeId}/{serial}
POST   /v1/log
```

La descarga actualizada admite `If-Modified-Since`, responde `304` cuando corresponde y devuelve el pase con el mismo `serialNumber`, `passTypeIdentifier` y `authenticationToken`.

## Envío APNs

El servidor usa HTTP/2, TLS 1.2 o posterior y el endpoint de producción `api.push.apple.com:443`. Se reutilizan el certificado firmante, la llave privada y la cadena WWDR del pase. El payload es `{}` y el topic es `APPLE_PASS_TYPE_ID`.

El envío se intenta inmediatamente después de:

- Confirmar una compra.
- Canjear una recompensa.
- Editar o desactivar un cliente.
- Cambiar el programa o sus niveles.
- Cambiar el diseño Wallet.
- Cambiar branding, estado del tenant o ubicaciones relevantes.

Las cancelaciones, ajustes y reversiones ya generan trabajo mediante triggers. Cuando sus pantallas administrativas pendientes se implementen, deberán llamar también al despachador inmediato después de confirmar su RPC.

## Pendiente: cron externo

Hostinger compartido no tiene un cron confirmado. Por ahora, cada operación normal intenta su propio envío y los siguientes envíos también pueden procesar trabajo vencido dentro de su alcance.

Queda pendiente conectar un scheduler externo que haga, por ejemplo cada minuto:

```http
POST /api/internal/wallet/apple/process-updates
Authorization: Bearer <APPLE_WALLET_RETRY_SECRET>
```

Ese endpoint procesa hasta 25 trabajos por llamada y nunca expone push tokens. Hasta conectar el cron, un fallo APNs que no sea seguido por otra operación puede permanecer pendiente en la cola.

## Activación y prueba en iPhone

1. Aplicar la migración `0038`.
2. Configurar las variables de entorno en Hostinger y volver a desplegar/reiniciar la app Node.js.
3. Eliminar del iPhone cualquier pase emitido antes de esta implementación y volver a agregarlo. Los pases anteriores no contienen `webServiceURL` ni `authenticationToken`.
4. Confirmar que Apple registra el dispositivo en el nuevo endpoint.
5. Registrar una compra que otorgue un sello.
6. Confirmar que la operación finaliza aunque APNs falle.
7. Confirmar que Wallet solicita la lista de seriales, descarga el pase y muestra el nuevo saldo.
8. Repetir con recompensa generada y canjeada.
9. Revisar que no existan identificadores, tokens, secretos o datos de cliente en logs.

Las notificaciones de actualización de pases funcionan únicamente contra APNs de producción y su entrega es best effort. La validación final requiere HTTPS público y un iPhone real.

Documentación oficial: [Adding a Web Service to Update Passes](https://developer.apple.com/documentation/WalletPasses/adding-a-web-service-to-update-passes) y [Sending notification requests to APNs](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns).
