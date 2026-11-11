# PWA: detección de actualizaciones y bloqueo hasta actualizar

Estado: **Planeado** (sin implementar). Ámbito: PWA de empleados (`/app/*`).

## Objetivo

Al abrir la PWA, y cada vez que vuelve del segundo plano, buscar en segundo
plano si existe una versión nueva desplegada. Si la hay, avisar al empleado y
**bloquear las operaciones hasta que se actualice**, para que nadie registre
compras o canjes con código viejo.

## Estado actual (2026-11-10)

`src/components/pwa-controller.tsx` ya tiene un *gate* bloqueante:

- Al cargar registra `/sw.js` (`updateViaCache: "none"`), llama a
  `registration.update()` y, si hay un worker `waiting` o `installing`, envía
  `SKIP_WAITING` y recarga con `controllerchange`.
- Mientras tanto marca como `inert` el contenido de `.operations-main` y muestra
  «Buscando actualizaciones» / «Actualizando la aplicación», con «Reintentar» si
  falla.

Huecos que impiden que funcione como se espera:

1. **`public/sw.js` es estático** (`swiftwallet-offline-v1`) y no cambia entre
   despliegues. El navegador solo considera que hay un worker nuevo cuando cambian
   sus bytes, así que después de un despliegue normal nunca detecta nada.
2. **La comprobación solo ocurre en la carga completa.** Una PWA instalada que
   vuelve del segundo plano no recarga: conserva el JavaScript del build anterior.
   Tras un despliegue, las Server Actions del build viejo pueden fallar
   («Failed to find Server Action») o enviar formularios con contratos obsoletos.
3. No existe una noción explícita de «versión desplegada» que el cliente pueda
   comparar.

## Diseño propuesto

### 1. Identificador de build

- En `next.config.mjs`, calcular un `buildId` una sola vez por build:
  `VERCEL_GIT_COMMIT_SHA` → `git rev-parse --short HEAD` → marca de tiempo, para
  funcionar también en Hostinger.
- Exponerlo al cliente como `NEXT_PUBLIC_APP_BUILD_ID` (`env` de Next) y usarlo
  también en `generateBuildId`, para que servidor y cliente compartan el mismo
  valor.

### 2. Endpoint de versión

- `GET /api/version` → `{ buildId }` con `Cache-Control: no-store`,
  `force-dynamic`, sin autenticación ni datos sensibles (solo el identificador
  del build).

### 3. Service worker versionado

- Registrar `/sw.js?v=<buildId>`. Al cambiar la URL del script, el navegador
  instala un worker nuevo en cada despliegue y el flujo `waiting` /
  `SKIP_WAITING` ya existente se activa. El nombre de la caché offline puede
  incluir el build para limpiar la anterior en `activate`.
- Mantener DEC-0010: el worker sigue sin cachear HTML autenticado ni datos.

### 4. Comprobación en segundo plano

En `PwaController`:

- **Al abrir:** igual que hoy, más una comparación de `NEXT_PUBLIC_APP_BUILD_ID`
  con `/api/version`.
- **Al volver del segundo plano:** `visibilitychange` → `visible` y evento
  `pageshow` (bfcache) disparan `registration.update()` y `/api/version`, con un
  intervalo mínimo de 60 s entre comprobaciones.
- **Mientras está abierta:** comprobación cada 5 minutos (solo si es visible y
  hay conexión).
- **Defensa extra:** si una Server Action responde con error de acción
  desconocida o de despliegue nuevo, tratarlo como «actualización disponible».

### 5. Aviso y bloqueo

- Si `buildId` remoto ≠ local, o hay un worker `waiting`, mostrar el *gate*
  existente con el estado **«Hay una nueva versión»**, el texto «Actualiza para
  seguir operando» y la acción primaria **«Actualizar ahora»**.
- «Actualizar ahora» envía `SKIP_WAITING` (si hay worker esperando) y recarga.
  Si el worker nuevo no llega en unos segundos, recarga igualmente.
- Mientras el *gate* esté visible: contenido `inert`, `aria-busy`, foco atrapado
  en el diálogo (`role="alertdialog"`, como hoy) y sin opción de cerrarlo.
- **Nunca interrumpir un envío en curso.** Si se detecta la versión nueva
  mientras hay un formulario enviándose o el modal de operación está en el paso
  de confirmación, el bloqueo se aplica justo al terminar esa operación. No se
  pierde ni se duplica ninguna compra.
- Sin conexión: se mantiene el aviso offline actual; la verificación se repite al
  volver la red.

### 6. Diseño e interfaz

- Reutilizar `.pwa-update-gate` / `.pwa-update-card` y el icono `download`.
- Antes de implementar, leer `docs/DESIGN_SYSTEM.md` y verificar su checklist
  (una sola acción primaria, foco visible, `prefers-reduced-motion`, 375 px a
  1440 px y textos en español).

## Fuera de alcance

- Actualizaciones parciales sin recargar o en caliente.
- Modo offline o caché del *shell* autenticado (DEC-0010 sigue vigente).
- Forzar actualización en `/admin` o `/superadmin`: opcional, se puede reutilizar
  el mismo componente más adelante.

## Archivos previstos

`next.config.mjs`, `src/app/api/version/route.ts` (nuevo),
`src/components/pwa-controller.tsx`, `public/sw.js`, `src/app/globals.css` (solo
si el nuevo estado lo requiere), tests en `src/lib/pwa/runtime.test.ts` y del
endpoint.

## Verificación

- Unitarias: comparación de build, intervalo mínimo entre comprobaciones,
  aplazamiento durante un envío, respuesta `no-store` del endpoint.
- Manual: instalar la PWA en un teléfono, desplegar un build nuevo, volver a la
  app desde segundo plano → aparece «Hay una nueva versión» y bloquea →
  «Actualizar ahora» recarga en el build nuevo. Repetir con el modal de compra
  en el paso de confirmación: la compra se completa y después bloquea.

## Decisiones abiertas

- Confirmar si `/admin` y `/superadmin` también deben bloquear o solo avisar.
- Confirmar el intervalo de comprobación (propuesta: al volver a primer plano y
  cada 5 minutos).
