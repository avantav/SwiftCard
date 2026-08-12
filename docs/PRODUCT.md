# SwiftWallet

## Documento Maestro del MVP

**Tipo:** Product Requirements Document + Plan de implementación    
**Estado:** Alcance funcional confirmado    
**Stack:** Next.js + Supabase/PostgreSQL    
**Idioma:** Español    
**Fechas:** El cronograma original no forma parte de este alcance.

## 1. Resumen ejecutivo

SwiftWallet será una plataforma SaaS multi-tenant para crear y operar programas de fidelidad digitales. Cada negocio podrá administrar sucursales, empleados, clientes, reglas de acumulación, recompensas, tarjetas digitales, estadísticas y exportaciones.

El cliente final no tendrá un portal ni una cuenta con contraseña. Después de registrar sus datos recibirá una tarjeta de recompensas disponible como Web Card, Apple Wallet y Google Wallet. Los empleados utilizarán una PWA instalada en un teléfono del negocio para escanear la tarjeta, registrar compras y canjear recompensas.

El backend será la única fuente de verdad para calcular sellos, remanentes y recompensas.

## 2. Objetivos del MVP

- Crear y administrar tenants manualmente desde un panel Superadmin.  
- Operar múltiples sucursales con una sola tarjeta por cliente y tenant.  
- Registrar clientes por autoservicio o por empleado.  
- Registrar compras con número de ticket y monto.  
- Calcular sellos automáticamente según reglas configurables.  
- Generar y acumular recompensas.  
- Canjear recompensas sin asociarlas a una compra.  
- Mantener auditoría, estadísticas y exportaciones.  
- Integrar Web Card, Apple Wallet y Google Wallet.  
- Asociar ubicaciones de sucursales para recordatorios de proximidad cuando Wallet lo permita.

## 3. Alcance incluido

- Plataforma multi-tenant.  
- Panel Superadmin.  
- Panel administrativo del tenant.  
- PWA para empleados.  
- Acceso operativo configurable por sucursal mediante cuentas individuales o una cuenta compartida con PIN personal.
- Registro público por sucursal.  
- Registro manual por empleado.  
- Web Card, Apple Wallet y Google Wallet.  
- QR seguro por tarjeta.  
- Una tarjeta por cliente y tenant, válida en todas sus sucursales.  
- Una moneda configurable por tenant.  
- Un programa activo con uno o varios niveles de recompensa por tenant.
- Regla por compra o por monto.  
- Remanente configurable.  
- Recompensas acumulables y expiración configurable.  
- Geolocalización flexible o estricta.  
- Ajustes manuales de sellos.  
- Cancelaciones y reversiones auditables.  
- Importación de clientes por Superadmin.  
- Branding estándar o white-label.  
- Pausa del programa y suspensión del tenant.  
- Dashboard, CSV y XLSX.

## 4. Fuera del MVP

- Portal y login del cliente.  
- OTP o validación SMS.  
- Recuperación automática de contraseña.  
- Modo offline.  
- Integración directa con POS.  
- Foto u OCR del ticket.  
- Promociones temporales y reglas por producto.  
- Cobro automático de planes.  
- Registro público de tenants.  
- Acceso de soporte o impersonación.  
- Campañas de marketing y avisos de expiración.  
- Apps móviles nativas.

## 5. Roles

### Superadmin

- Crear, editar, activar y suspender tenants.  
- Configurar branding estándar o white-label.  
- Crear el primer Administrador.  
- Restablecer contraseñas de Administradores.  
- Ver información básica de tenants.  
- Importar clientes y sellos iniciales.  
- Consultar importaciones y auditoría global.

### Administrador

- Gestionar sucursales, empleados y asignaciones.  
- Configurar programa, niveles de recompensa, términos, branding y geolocalización.
- Consultar y editar clientes.  
- Cancelar compras.  
- Ajustar sellos.  
- Cancelar recompensas y revertir canjes.  
- Consultar estadísticas, exportaciones y auditoría.  
- Pausar o reactivar el programa.

### Administrador de sucursal

- Operar y supervisar sucursales asignadas.  
- Iniciar sesión con correo y contraseña en el panel administrativo.
- Administrar empleados individuales y usuarios PIN dentro de sus sucursales, sin modificar cuentas que también pertenezcan a sucursales fuera de su alcance.
- Registrar compras y clientes.  
- Editar o desactivar clientes.  
- Canjear recompensas.  
- Cancelar compras, ajustar sellos y revertir canjes.  
- Consultar estadísticas, exportaciones y auditoría de sus sucursales.

### Empleado

- Escanear tarjetas.  
- Buscar clientes por teléfono o nombre.  
- Registrar clientes y compras.  
- Canjear una recompensa por confirmación.  
- Ver sellos, recompensas y actividad reciente.

### Cliente

No se autentica. Solo registra sus datos, abre su tarjeta, la agrega a Wallet y muestra su QR.

## 6. Multi-tenancy y seguridad

Todas las tablas operativas incluirán tenant_id. Supabase Row Level Security deberá impedir acceso cruzado entre negocios. El tenant se resolverá desde la sesión autenticada y nunca se confiará en un tenant_id enviado libremente por el frontend.

Si un empleado escanea un QR de otro tenant, el sistema no mostrará datos y responderá: **Esta tarjeta no pertenece a este negocio.**

Principios:

- Service role solo en backend.  
- Ningún secreto en el navegador.  
- Tokens públicos aleatorios, rotables y revocables.  
- Montos almacenados en unidades mínimas.  
- Operaciones críticas dentro de transacciones PostgreSQL o RPC seguras.  
- Logs de auditoría inmutables desde la aplicación.

## 7. Tenants y sucursales

Cada tenant tendrá nombre, contacto, estado, moneda, zona horaria, branding mode, logo, banner, colores y programa.

Cada sucursal tendrá nombre, dirección, coordenadas, radio de geofence, estado, token público de registro y configuración de proximidad. El Admin general podrá copiar su enlace público, descargar su QR en PNG y abrir una vista previa desde la administración de sucursales.

El alta de sucursal validará y explicará por campo: nombre obligatorio de 2 a 120 caracteres, dirección opcional de hasta 300, latitud y longitud opcionales pero capturadas en conjunto y dentro de sus rangos, radio entero de 1 a 100000 metros, modo de acceso permitido y, cuando aplique, correo y contraseña compartidos válidos. Un rechazo de base de datos o Auth mostrará una causa segura y un código de diagnóstico; el formulario conservará los valores no sensibles, nunca las contraseñas.

El Admin general podrá editar desde la misma lista el nombre, dirección, coordenadas, radio de geofence, activación y mensaje de proximidad, y estado de una sucursal. La edición aplicará las mismas validaciones detalladas del alta; el mensaje de proximidad será opcional y admitirá hasta 500 caracteres. Desactivar una sucursal requerirá confirmación, impedirá registros públicos y operaciones nuevas, y conservará asignaciones e historial. El modo de acceso y la credencial compartida permanecerán en un control sensible separado.

Las ubicaciones servirán para:

- Recordatorios de tarjeta cerca del negocio.  
- Validación de ubicación del empleado.  
- Identificar origen de clientes.  
- Estadísticas por sucursal.

### Suspensión

Cuando un tenant está suspendido:

- Los usuarios internos no pueden iniciar sesión ni operar.  
- No se registran compras, clientes ni canjes.  
- Las tarjetas siguen visibles en modo informativo.  
- No se elimina información.

## 8. Acceso del personal

El Admin general y los Administradores de sucursal usarán cuentas personales con correo y contraseña. La PWA se instalará en teléfonos del negocio y tendrá botones visibles para cerrar sesión o cambiar empleado.

Cada sucursal configurará un modo exclusivo para usuarios operativos:

- `INDIVIDUAL_CREDENTIALS`: cada empleado usa su propio correo y contraseña, conservando el comportamiento original.
- `SHARED_ACCOUNT_PIN`: la sucursal usa una sola cuenta común de correo y contraseña y cada mesero se identifica después con un PIN personal de seis dígitos.

La cuenta compartida pertenece a una sola sucursal. El PIN queda hasheado, es único dentro de esa sucursal y nunca sustituye la atribución individual: clientes registrados, compras, canjes, ledger y auditoría guardan al operador PIN. Cinco intentos fallidos bloquean el acceso PIN durante cinco minutos. La sesión del operador termina al cambiar usuario, cerrar el navegador o después de ocho horas sin actividad.

Solo el Admin general configura o rota la credencial compartida. El Admin general y los Administradores asignados a la sucursal administran usuarios PIN. Cambiar el modo revoca las sesiones incompatibles sin borrar el historial.

El Administrador podrá asignar una o varias sucursales y una sucursal principal a cada Administrador de sucursal o Empleado.

Las contraseñas se restablecerán manualmente mediante contraseña temporal y cambio obligatorio en el siguiente acceso.

## 9. Clientes

Datos:

- UUID interno.  
- Nombre obligatorio.  
- Teléfono obligatorio y normalizado.  
- Correo opcional.  
- Fecha de nacimiento opcional.  
- Consentimiento de privacidad.  
- Método y sucursal de registro.  
- Empleado creador cuando aplique.  
- Estado activo o inactivo.

Restricción de duplicados:

`UNIQUE (tenant_id, normalized_phone)`

El mismo teléfono puede existir en tenants diferentes.

Si el teléfono ya existe, el registro público mostrará: **Este teléfono ya está registrado. Solicita ayuda a un empleado para recuperar tu tarjeta.** No se mostrará la tarjeta automáticamente.

Los usuarios internos podrán buscar por teléfono exacto o nombre parcial. Administrador y Encargado podrán editar y desactivar clientes. Un cliente inactivo conserva historial, pero no recibe compras, sellos ni canjes.

El Admin general tendrá un directorio exclusivo del tenant en `/admin/customers`, con búsqueda, filtro por estado y paginación. La vista mostrará nombre, contacto, sucursal de alta, estado del cliente y de su tarjeta, unidades acumuladas con la precisión administrativa, recompensas disponibles, estado de generación de Apple Wallet, método y fecha de registro. Los Administradores de sucursal no verán este directorio administrativo y conservarán únicamente la búsqueda operativa dentro de su alcance.

## 10. Registro de clientes

### Autoservicio

Cada sucursal activa tendrá su propio enlace y QR público. El cliente ve el tenant y la sucursal, captura sus datos, el sistema valida formato y duplicados, crea el cliente y genera la tarjeta. Se guarda la sucursal de origen y el método SELF_SERVICE. Al completar el registro se ofrecerá directamente **Agregar a Apple Wallet** cuando el tenant y el servidor estén listos; no se enviará al cliente a una pantalla intermedia de tarjeta actual. Un enlace inválido, de una sucursal inactiva o de un tenant suspendido no mostrará el formulario.

### Por empleado

Desde la PWA, el empleado captura los datos y el sistema genera la tarjeta. Se guarda sucursal, empleado, fecha y método EMPLOYEE.

No habrá OTP, verificación por correo ni contraseña del cliente.

## 11. Tarjeta digital

Cada cliente tendrá una sola tarjeta activa por tenant, válida en todas las sucursales.

Canales:

- Web Card.  
- Apple Wallet.  
- Google Wallet.

Contenido mínimo:

- Branding del tenant.  
- Nombre del programa.  
- Nombre del cliente.  
- QR seguro.  
- Sellos actuales y meta.  
- Premios por número de sellos.
- Recompensas disponibles.  
- Descripción de cada recompensa.
- Términos y condiciones del programa.
- Marca de agua Powered by SwiftWallet cuando el tenant no sea white-label.

El QR solo contendrá un token público seguro. No expondrá nombre, teléfono, UUID ni saldo. Podrá regenerarse e invalidarse.

El mismo identificador seguro se mostrará como QR real en la Web Card y como
barcode QR en Apple Wallet. La PWA operativa podrá leer ambos con la cámara
tras una acción explícita del empleado y conservará captura manual como
respaldo cuando el dispositivo niegue o no soporte la cámara.

El Admin general podrá configurar por tenant la tarjeta Apple Wallet mediante una plantilla `storeCard`: activación, texto de logo, descripción, colores accesibles, logo e imagen principal. El diseño de Wallet es independiente del secreto de firma y no permite alterar libremente la estructura definida por Apple.

El logo y la imagen principal se cargarán desde esta configuración a un bucket público de Supabase Storage dedicado a Wallet. La lectura pública permite que el servidor genere el pase, mientras RLS limita altas, reemplazos y bajas al Admin general dentro de la ruta de su propio tenant. Se aceptarán únicamente PNG, JPEG o WebP de hasta 5 MB.

## 12. Programa de fidelidad

Cada tenant tendrá un programa con uno o varios niveles de recompensa. La configuración ofrecerá tres tipos de programa:

- Sellos por compra: entrega una cantidad configurada por cada compra que alcance el mínimo y cierra ciclos en la meta mayor.
- Sellos por monto: entrega sellos enteros por un monto configurado, con remanente opcional, y cierra ciclos en la meta mayor.
- Puntos acumulativos con hitos: entrega un punto por cada monto entero configurado, conserva el progreso mientras la cuenta permanezca activa, nunca reinicia y entrega cada hito una sola vez por cliente.

El Administrador configurará el nombre singular y plural de la unidad. Todos los programas calcularán con una precisión interna de un decimal y truncarán cada compra sin redondear. Cliente y Empleado verán únicamente la parte entera; Administradores, exportaciones y reportes verán un decimal. En puntos acumulativos, cualquier monto genera puntos y la fracción descartada en una compra no se traslada a otra.

En los programas cíclicos, el nivel con más sellos define la meta y el cierre del ciclo. En puntos acumulativos no existe cierre de ciclo: después del último hito los puntos continúan aumentando y la tarjeta indica que todas las recompensas disponibles fueron desbloqueadas.

Estados:

- ACTIVE.  
- PAUSED.

Cuando el programa está pausado no se generan sellos ni nuevas recompensas, pero las recompensas existentes sí pueden canjearse.

### Regla por compra

Configuración:

- Monto mínimo.  
- Sellos por compra válida.

Las compras debajo del mínimo se registran con cero sellos.

### Regla por monto

Configuración:

- Monto por sello.  
- Acumular remanente: sí o no.

Ejemplo: un sello cada $100; compra de $250; resultado de dos sellos y $50 de remanente si está habilitado.

### Cambios de reglas

El Admin general puede cambiar el tipo de programa con confirmación explícita. Ese cambio conserva recompensas e historial y se guarda primero en pausa. Al pasar de un programa de sellos a puntos acumulativos, cada saldo vigente de sellos se convierte con el multiplicador configurado de puntos por sello, el remanente monetario anterior se descarta y la conversión queda registrada individualmente en el ledger. La nueva regla se aplica únicamente a compras futuras después de reactivar un tipo cíclico. El tipo de puntos acumulativos permanece pausado hasta que su motor esté habilitado. Los cambios de regla o niveles dentro del mismo tipo aplican inmediatamente; si generan recompensas, se crean sin duplicar niveles ya otorgados en el ciclo y se conserva el sobrante. Todo cambio queda auditado.

## 13. Compras

Datos obligatorios:

- Cliente.  
- Sucursal.  
- Empleado.  
- Número de ticket.  
- Monto.  
- Fecha y hora.  
- Geolocalización.  
- Regla aplicada.  
- Sellos otorgados.  
- Remanente antes y después.  
- Recompensas generadas.

El ticket será único por sucursal:

`UNIQUE (branch_id, ticket_number)`

No se solicitará fotografía.

Flujo:

1. Escanear o buscar cliente.  
2. Capturar ticket y monto.  
3. Solicitar previsualización al backend.  
4. Mostrar sellos solo de forma visual.  
5. Confirmar.  
6. El backend recalcula y registra la operación.  
7. Se actualizan tarjeta y Wallet.

El frontend nunca enviará una cantidad de sellos como autoridad.

## 14. Geolocalización

### Modo flexible

Solicita y registra ubicación, pero no bloquea por distancia.

### Modo estricto

Requiere permiso de ubicación, compara contra la sucursal y bloquea operaciones fuera del radio o sin ubicación.

La regla se aplicará a compras y canjes.

## 15. Recompensas

El programa permite configurar uno o más niveles sin un límite funcional de catálogo, ordenados por unidades requeridas. Cada nivel puede representar un premio pequeño o el premio principal.

Comportamiento:

- Al alcanzar un nivel se genera una recompensa AVAILABLE una sola vez dentro de ese ciclo.
- Los premios de niveles menores son acumulables: otorgarlos no descuenta sellos ni reinicia el progreso.
- El nivel con más sellos completa el ciclo y el progreso vuelve a iniciar conservando los sellos sobrantes.
- Una sola operación puede otorgar varios niveles, incluso completar la meta actual y alcanzar un nivel menor del siguiente ciclo.
- Las recompensas obtenidas permanecen disponibles de manera independiente hasta su canje, expiración o cancelación.
- Un programa existente con una sola recompensa funciona como un único nivel y conserva el comportamiento anterior.
- En puntos acumulativos, cada nivel se entrega una sola vez durante toda la vida del cliente, aunque el saldo continúe aumentando.
- Bajar un requisito o agregar un hito ya alcanzado genera la recompensa automáticamente. Subir un requisito o desactivar un nivel no retira recompensas ya otorgadas.
- Una recompensa otorgada se conserva hasta su expiración; sin expiración permanece disponible indefinidamente.
- La recompensa de bienvenida es opcional, configurable y se entrega una sola vez al registro. Una opción fija del programa decide si también se entrega a clientes importados.

Configuración de cada nivel:

- Número de sellos requerido, único dentro del programa.
- Nombre.  
- Descripción.  
- Sin expiración o expiración después de N días.

El programa también requiere términos y condiciones visibles en la tarjeta del cliente junto con el catálogo de premios por número de sellos.

Estados:

- AVAILABLE.  
- REDEEMED.  
- EXPIRED.  
- CANCELLED.

El canje no requiere ticket ni compra. Cada confirmación canjea una sola recompensa y registra cliente, sucursal, empleado, fecha, hora y ubicación.

Administrador puede cancelar una recompensa disponible y revertir un canje. Encargado solo puede revertir canjes. Empleado solo puede canjear.

La cancelación manual de recompensas y la reversión de canjes serán opciones configurables. Cuando la reversión esté habilitada, podrán ejecutarla el Administrador general y el Administrador de sucursal asignado. Cada operación de empleado canjeará una sola recompensa.

Cancelar una recompensa no devuelve sellos.

## 16. Ajustes manuales

Administrador y Encargado podrán agregar o retirar sellos con motivo obligatorio.

- No se permite saldo negativo.  
- Un ajuste positivo puede generar recompensas.  
- Un ajuste negativo no elimina recompensas ya generadas.  
- Toda acción queda en historial y auditoría.

## 17. Corrección y cancelación de compras

Las compras confirmadas no se editan. Para corregir se cancela la compra original y se registra una nueva.

La disponibilidad de cancelaciones será configurable por programa. Cuando estén deshabilitadas, una compra confirmada será definitiva. Los puntos acumulativos de Garmendia iniciarán con cancelaciones de compra y ajustes manuales de puntos deshabilitados.

La cancelación revierte sellos, remanente, progreso y recompensas generadas cuando corresponda.

Si una recompensa generada por la compra ya fue canjeada, la cancelación se bloquea. Primero se debe revertir el canje relacionado.

Toda cancelación requiere motivo y conserva la compra original con estado CANCELLED.

## 18. Importación de clientes

Solo el Superadmin podrá importar CSV o Excel durante el MVP.

Campos:

- Nombre.  
- Teléfono.  
- Correo opcional.  
- Fecha de nacimiento opcional.  
- Sellos iniciales opcionales.

Flujo: subir, mapear columnas, validar, previsualizar, confirmar y mostrar resumen. Se guardará historial con archivo, usuario, fecha, importados, duplicados y errores.

Cuando el programa use puntos acumulativos, la configuración incluirá una equivalencia entera `1 sello importado = N puntos`. La confirmación importará los puntos resultantes y generará automáticamente todos los hitos alcanzados. La misma recompensa de bienvenida podrá incluir o excluir importados mediante una opción fija del programa.

## 19. Dashboard y exportaciones

Filtros:

- Rango de fechas.  
- Sucursal.  
- Agrupación diaria, semanal o mensual.

Métricas:

- Total y nuevos clientes.  
- Compras y monto total.  
- Sellos otorgados.  
- Recompensas generadas y canjeadas.  
- Tasa de canje.  
- Compras y monto por sucursal.  
- Actividad por empleado.  
- Clientes con más compras y mayor monto.  
- Origen de registros.  
- Tendencias.

Administrador ve todo el tenant. Encargado solo sucursales asignadas. Empleado no ve estadísticas.

Exportaciones CSV y XLSX para clientes, compras, canjes, recompensas, ajustes y resumen de estadísticas.

## 20. Auditoría

Registrar, como mínimo:

- Usuario y rol.  
- Tenant y sucursal.  
- Acción.  
- Entidad e ID.  
- Valores anteriores y nuevos.  
- Fecha y hora.  
- Metadatos disponibles.

Acciones auditables: tenants, branding, programa, reglas, usuarios, clientes, compras, cancelaciones, ajustes, recompensas, canjes, reversiones, importaciones, contraseñas y geolocalización.

Superadmin ve auditoría global; Administrador la del tenant; Encargado la de sus sucursales; Empleado no accede.

## 21. PWA

Rutas operativas:

- Inicio.  
- Escanear.  
- Buscar cliente.  
- Nuevo cliente.  
- Registrar compra.  
- Canjear.  
- Historial reciente.  
- Perfil y cambio de empleado.

Requisitos:

- Instalable.  
- Optimizada para teléfono.  
- Cámara y QR.  
- Indicador de conexión.  
- Solo operaciones online.  
- Confirmaciones para compras y canjes.  
- Protección contra doble envío.  
- Manejo claro de permisos de cámara y ubicación.
- Resolución del cliente por escáner o búsqueda manual hacia una sola vista operativa con recompensas disponibles y acción para registrar compra.

## 22. Apple Wallet y Google Wallet

Apple Wallet requiere cuenta Apple Developer, Pass Type ID, Team ID, certificado firmante, llave privada y certificado WWDR. Los secretos solo existirán en el entorno del servidor. El archivo `.pkpass` se generará y firmará al solicitar **Agregar a Apple Wallet** después del registro o desde el respaldo Web Card.

Cada tenant podrá publicar una plantilla `storeCard` con colores, textos y recursos gráficos propios. El pase mostrará programa, cliente, sellos, meta, recompensas disponibles, catálogo, términos, QR seguro y hasta diez ubicaciones activas. Los recursos propios se cargarán al bucket `wallet-assets` del mismo proyecto Supabase; su host se autoriza automáticamente. Cualquier host externo adicional deberá estar autorizado explícitamente por el servidor. Ante un recurso inválido se usará el activo seguro de respaldo.

Google Wallet requerirá proyecto, Issuer ID, service account, clase y objeto de pase.

La Web Card será el respaldo universal.

Las sucursales activas se asociarán a la tarjeta para que el sistema operativo pueda sugerirla cerca del negocio. Esta función depende de permisos, dispositivo, límites y políticas del proveedor; no se garantizará una notificación en todos los teléfonos.

La tarjeta se actualizará al recibir sellos o generar/canjear recompensas mediante el servicio web PassKit, registro revocable de dispositivos, tags monotónicos, entrega firmada del pase y notificaciones APNs vacías. Los push tokens permanecerán cifrados y los identificadores de dispositivo se almacenarán como HMAC. Un fallo de APNs nunca revertirá una operación de fidelidad: quedará en una cola transaccional para reintento. Se incluirá notificación compatible de nueva recompensa. Los avisos de expiración quedan para una fase posterior.

Mientras el hosting no tenga cron, la aplicación intentará el envío inmediatamente después de cada operación y conservará un endpoint interno protegido para conectar un scheduler externo. El cron de reintentos será requisito antes de producción a escala, pero no bloqueará el piloto controlado.

## 23. Arquitectura técnica

Stack:

- Next.js App Router.  
- TypeScript.  
- Supabase Auth.  
- Supabase PostgreSQL.  
- Row Level Security.  
- Supabase Storage.  
- Tailwind CSS y shadcn/ui.  
- Vercel.

Un solo repositorio y aplicación:

- /superadmin  
- /admin  
- /app  
- /register/[branchToken]  
- /card/[cardToken]  
- /api

Tablas principales:

- tenants.  
- branches.  
- staff_profiles.  
- staff_branch_assignments.  
- branch_shared_accounts.
- branch_pin_operators.
- branch_pin_sessions.
- customers.  
- customer_cards.  
- loyalty_programs.  
- loyalty_reward_tiers.
- customer_loyalty_balances.  
- purchases.  
- stamp_ledger.  
- rewards.  
- reward_redemptions.  
- stamp_adjustments.  
- customer_imports.  
- customer_import_rows.  
- wallet_passes.  
- apple_wallet_devices.
- apple_wallet_registrations.
- apple_wallet_update_outbox.
- tenant_wallet_designs.
- Supabase Storage bucket `wallet-assets` con rutas por tenant y políticas RLS de escritura.
- audit_logs.

Operaciones de compra, cancelación, canje, ajuste y cambio de reglas deberán ejecutarse de forma atómica.

## 24. Plan de implementación

### Fase 0 - Preparación

Repositorio, Next.js, Supabase, Vercel, variables, CI, lint, typecheck, pruebas y health check.

### Fase 1 - Multi-tenant y autenticación

Tenants, sucursales, usuarios, roles, asignaciones, RLS, login, contraseña temporal y Superadmin mínimo.

### Fase 2 - Clientes y Web Card

Registro por ambos métodos, normalización, duplicados, búsqueda, QR, edición, desactivación y tarjeta web.

### Fase 3 - Motor de fidelidad

Reglas por compra y monto, remanente, ledger, recompensas, expiración, pausa y cambios de regla.

### Fase 4 - PWA

Instalación, cámara, escáner, compras, previsualización, geolocalización, canjes, conexión y cambio de empleado.

### Fase 5 - Operaciones administrativas

Cancelaciones, reversiones, ajustes, cancelación de recompensas, auditoría e historiales.

### Fase 6 - Dashboard y exportaciones

KPIs, filtros, tendencias, rankings, CSV y XLSX.

### Fase 7 - Superadmin e importaciones

Importación, mapeo, historial, métricas de tenants, suspensión y branding mode.

### Fase 8 - Wallet

Apple Wallet, Google Wallet, actualizaciones, ubicaciones, errores y pruebas en dispositivos reales.

### Fase 9 - Piloto

E2E, seguridad, RLS, monitoreo, backups, privacidad, tenant piloto y checklist de producción.

## 25. Pruebas

Unitarias:

- Normalización de teléfono.  
- Reglas y remanente.  
- Recompensas múltiples y niveles acumulables.
- Expiración.  
- Ajustes.  
- Geofence.

Integración:

- Compra atómica.  
- Cruce de varios niveles y conservación del excedente.
- Cancelación.  
- Reversión.  
- Tickets.  
- Importación.  
- Wallet.  
- RLS.

E2E:

- Crear tenant.  
- Configurar programa.  
- Registrar cliente.  
- Escanear tarjeta.  
- Registrar compra.  
- Generar y canjear recompensa.  
- Cancelar compra.  
- Exportar.  
- Suspender tenant.

## 26. Información necesaria antes del piloto

- Logo de SwiftWallet.  
- Dominio.  
- Tenant piloto.  
- Branding y reglas reales.  
- Cuenta Apple Developer y certificados.  
- Google Wallet Issuer ID.  
- Aviso de privacidad y consentimientos.  
- Correo operativo.  
- Política de soporte.

## 27. Backlog posterior

- Acceso de soporte con impersonación auditada.  
- Alta pública de tenants.  
- Suscripciones.  
- OTP.  
- Recuperación automática.  
- Portal del cliente.  
- Promociones.  
- Reglas por producto.  
- POS y webhooks.  
- Modo offline.  
- Apps nativas.  
- Campañas y avisos de expiración.  
- Referidos, cupones, API pública y CRM.

## 28. Flujo con Codex

Codex trabajará por fases, no con un único prompt para construir toda la plataforma.

Cada tarea incluirá:

1. Contexto.  
2. Objetivo.  
3. Archivos permitidos.  
4. Requisitos funcionales.  
5. Requisitos técnicos.  
6. Migraciones.  
7. Pruebas.  
8. Criterios de aceptación.  
9. Comandos de verificación.  
10. Resumen de cambios.

Reglas:

- No implementar alcance de fases posteriores.  
- No confiar en cálculos del cliente.  
- No desactivar RLS para resolver errores.  
- No usar service role en navegador.  
- No modificar migraciones aplicadas.  
- Mantener transacciones en operaciones críticas.  
- Agregar pruebas a cada corrección.  
- No guardar secretos.

El primer prompt de Codex se limitará a inicializar Next.js, TypeScript, Tailwind, shadcn/ui, Supabase, estructura de rutas, variables, lint, typecheck, pruebas, health check y documentación local. Todavía no implementará reglas de fidelidad ni Wallet.

## 29. Definición de terminado

El MVP estará terminado cuando:

- Superadmin crea y suspende tenants.  
- Admin configura sucursales, usuarios y programa.  
- Cliente se registra por ambos métodos.  
- Se genera tarjeta web y wallet.  
- Empleado registra compras desde teléfono real.  
- Backend calcula sellos y recompensas.  
- Recompensas se acumulan y canjean.  
- Cancelaciones y ajustes conservan consistencia.  
- Geolocalización funciona según modo.  
- Dashboards y exportaciones respetan permisos.  
- Auditoría está disponible.  
- RLS impide acceso cruzado.  
- Un tenant piloto opera en producción controlada.  
