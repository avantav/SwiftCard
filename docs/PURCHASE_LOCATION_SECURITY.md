# Seguridad de ubicación de compras

Estado: implementado (DEC-0066, migración `0074`). Ruta: `/admin/security`.

## Qué resuelve

Permite al negocio revisar dónde se registró cada compra frente al punto y
radio configurados de su sucursal, para detectar operaciones fuera del local,
dispositivos que no envían ubicación o sucursales sin punto configurado.

Es una vista de **observación**: no cambia compras, no cancela nada y no
modifica la validación de ubicación ni las coordenadas guardadas por la compra.

## Permisos

| Rol | Acceso |
|---|---|
| Admin general | Todas las sucursales del negocio |
| Administrador de sucursal | Solo sus sucursales asignadas |
| Empleado, cuenta compartida/PIN | Sin acceso |
| Superadmin (incluido modo soporte) | Sin acceso; la vista muestra el aviso de restricción |

La autoridad es la función `app.get_purchase_location_review` (security
definer): valida rol, estado del perfil y del negocio, aplica el alcance por
sucursal y nunca confía en filtros del cliente. La página no lee `purchases`
directamente (su política RLS también deja ver compras a empleados asignados).

## Datos mostrados

Fecha y hora (zona horaria del negocio), sucursal, operador (usuario o PIN),
ticket, importe, estado de la compra, coordenadas registradas, punto y radio de
la sucursal, distancia y resultado: dentro, fuera, sin coordenadas o sucursal
sin punto. **No se devuelve ningún dato del cliente.**

Límites: periodo de hasta 93 días calendario y 1,000 compras más recientes por
consulta.

## Señales de revisión

Se marcan para revisión humana, sin acciones automáticas:

- Un operador con 3 o más compras fuera del radio en el periodo.
- Una sucursal con 3 o más compras sin coordenadas que representan al menos el
  25 % de sus compras del periodo.
- Sucursales sin punto configurado.

## Auditoría, privacidad y retención

- Cada consulta escribe `PURCHASE_LOCATION_REVIEW_VIEWED` en `audit_logs` con
  los filtros, la zona horaria y el número de filas.
- Las coordenadas forman parte del registro inmutable de la compra y se
  conservan mientras se conserve la compra (obligaciones contables y de
  auditoría). La vista no crea copias ni exporta datos.
- El aviso de privacidad para usuarios del negocio menciona la ubicación del
  dispositivo al registrar operaciones; cualquier cambio de finalidad requiere
  actualizar `src/content/legal/`.

## Mapa

Usa Google Maps con `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (la misma clave del
selector de sucursales). Sin clave, la vista muestra un aviso y la tabla, que
siempre contiene las mismas compras y es la alternativa accesible.

## Pendiente

- Exportación CSV de la vista (no incluida para no multiplicar copias de
  ubicaciones; evaluar con el negocio piloto).
- Validación con un negocio piloto antes de anunciarla.
