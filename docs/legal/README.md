# Documentos legales de SwiftyCards — propuesta para revisión jurídica

Estado: **versión 1.2 publicada provisionalmente** (19 de noviembre de 2026) mientras
la revisa un abogado. No constituye asesoría legal. La marca en los documentos es
**SwiftyCards** (swiftycards.com); el resto de la app aún dice «morrow» (DEC-0077).

| Documento | Ruta pública | Fuente |
|---|---|---|
| Términos y Condiciones del Servicio (negocios) | `/terminos` | `src/content/legal/terms.ts` |
| Aviso de Privacidad Integral (personas usuarias de negocios) | `/privacidad` | `src/content/legal/privacy.ts` |
| Aviso de Privacidad para Clientes de Programas de Lealtad | `/privacidad/clientes` | `src/content/legal/customer-privacy.ts` |
| Aviso simplificado en el registro de clientes | Formulario `/register/...` | `src/components/public-registration-flow.tsx` |
| Términos y Condiciones del programa de cada negocio | `/register/[token]/terminos`, `/card/[token]/terminos` | `src/content/legal/tenant-customer-terms.ts` |
| Aviso de privacidad de cada negocio para sus clientes | `/register/[token]/privacidad`, `/card/[token]/privacidad` | `src/content/legal/customer-privacy.ts` (con identidad del negocio) |

Los textos están en Markdown dentro de esos archivos. Para cambiarlos se edita el
texto y se sube la versión/fecha en `src/lib/legal/company.ts`.

## 1. Marco legal considerado

- **Ley Federal de Protección de Datos Personales en Posesión de los Particulares
  (LFPDPPP)**, nueva ley publicada en el DOF el 20 de marzo de 2025 (vigente desde
  el 21 de marzo de 2025). La autoridad es la **Secretaría Anticorrupción y Buen
  Gobierno** (art. 2, fr. XV), que asumió las funciones del INAI.
  - Art. 15: contenido mínimo del aviso integral (identidad y domicilio, datos,
    finalidades distinguiendo las que requieren consentimiento, opciones para
    limitar uso o divulgación, medios ARCO, forma de comunicar cambios).
  - Art. 16, fr. II: aviso simplificado en medios electrónicos (fracciones I–IV del
    art. 15 y dónde consultar el integral).
  - Arts. 7–8 y 11: consentimiento tácito por regla general; expreso para datos
    financieros/patrimoniales y sensibles; nuevo consentimiento para finalidades
    distintas.
  - Arts. 18–19: medidas de seguridad y aviso inmediato de vulneraciones.
  - Art. 2, fr. XII y art. 35: figura del encargado; arts. 35–36: transferencias y
    excepciones sin consentimiento.
  - Arts. 27–31 y 34: requisitos de la solicitud ARCO; respuesta en 20 días y
    ejecución en 15 días, ampliables una vez; gratuidad.
- Comercio electrónico y consumo (Código de Comercio; Ley Federal de Protección al
  Consumidor y NOM-151 si aplicaran) — **pendiente de valorar por el abogado**, ya
  que los contratantes son negocios.
- Facturación electrónica (CFDI 4.0, SAT): Stripe no emite CFDI.

Fuentes: texto oficial en [ordenjuridico.gob.mx](https://www.ordenjuridico.gob.mx/Documentos/Federal/html/wo125102.html)
y [Cámara de Diputados](https://www.diputados.gob.mx/LeyesBiblio/doc/LFPDPPP.doc);
análisis de [Garrigues](https://www.garrigues.com/es_ES/noticia/mexico-nueva-ley-federal-proteccion-datos-personales-posesion-particulares-introduce),
[Creel](https://www.creel.mx/publicaciones/alertas-clientes/federal-law-for-the-protection-of-personal-data-in-the-possession-of-private-parties/)
y [EY](https://www.ey.com/es_mx/technical/tax/boletines-fiscales/nueva-ley-federal-proteccion-datos-personal-posesion-particulares).

## 2. Investigación de la competencia (12-nov-2026)

| Tema | WonCards ([términos](https://woncards.com/terms_of_service), [uso](https://woncards.com/terms_of_use), [privacidad](https://woncards.com/privacy)) | Clientazo ([privacidad](https://clientazo.app/privacidad)) | Propuesta morrow |
|---|---|---|---|
| Operador | Sin razón social; domicilio en Aguascalientes | Persona física, Hermosillo | Configurable; **falta razón social y domicilio** |
| Ley citada | Ninguna específica | Nueva LFPDPPP (arts. 31 y 36), Secretaría Anticorrupción | Nueva LFPDPPP, artículos concretos |
| Responsable / encargado | No definido | Negocio responsable, plataforma encargada | Igual que Clientazo, con cláusula de encargo completa en los Términos (sección 9) |
| Prueba gratuita | No menciona | 15 días | 30 días con tarjeta y cobro automático explícito |
| Renovación / reembolsos | Renovación automática; sin reembolsos; cambios de precio con 30 días | No publica términos | Renovación automática; cancelación al final del periodo; sin reembolsos parciales; precios con 30 días de aviso |
| Impago | No regulado | No publica | Reintentos y suspensión tras 15 días |
| Datos al terminar | No regulado | No indica | Exportación 30 días y supresión posterior |
| ARCO | Solo correo, sin plazos | Requisitos y plazos 20/15 | Requisitos del art. 28 y plazos del art. 31 |
| Cookies | Publicidad y analítica | No menciona | Solo cookies técnicas (verificado en el código) |
| Mercadotecnia | Consentimiento explícito | No describe flujo | Casilla separada, desmarcada, revocable (DEC-0056) |
| Jurisdicción | Tribunales de Aguascalientes; mediación previa | — | Tribunales de Hermosillo, Sonora (configurable) |

Observaciones: los términos de WonCards contienen una instrucción de redacción sin
completar (sección 12) y no regulan datos tras la terminación ni roles de datos.
Clientazo no publica términos del servicio.

## 3. Decisiones reflejadas en los textos

- El negocio es **responsable** de los datos de sus clientes finales y de su
  personal; morrow es **encargado** y lo formaliza en la sección 9 de los Términos.
- morrow es **responsable** de los datos de contacto, acceso y facturación de las
  personas usuarias de los negocios (aviso `/privacidad`).
- Promociones a clientes finales solo con **consentimiento expreso** (casilla).
- No se recaba la ubicación de los clientes finales; sí la del empleado al operar,
  solo cuando el negocio activa la validación de ubicación.
- Datos de tarjeta solo en Stripe; consentimiento expreso para datos financieros al
  contratar.
- Prueba de 30 días, renovación automática, IVA aparte, cancelación al final del
  periodo y CFDI a solicitud (precios y planes según DEC-0057/DEC-0058).
- Versión 1.2 (DEC-0077), a petición del propietario:
  - Sin garantía de resultados comerciales (§2).
  - Plataforma en desarrollo continuo; fallas reportadas se corrigen en plazo
    razonable; único remedio por indisponibilidad imputable de más de 3 días:
    bonificación proporcional (§2 y §13). No se excluye toda responsabilidad
    para no arriesgar la nulidad de la cláusula.
  - Cada Plan incluye solo lo publicado o lo de su **Orden de Servicio**; todo
    trabajo adicional requiere cotización por escrito aceptada (§4).
  - Orden de Servicio por negocio con precio y alcance propios, aceptada por el
    administrador general con casilla de conformidad (DEC-0076); aclaraciones de
    cargos dentro de 15 días naturales (§4).
  - Acceso de soporte en sesiones temporales y registradas (§9; aviso §3).
  - Estadísticas agregadas y anonimizadas (§9; aviso §7).
  - Clientes importados: el negocio responde por su aviso y base legal (§9).
  - Al terminar, el negocio responde por sellos, puntos y premios pendientes (§14).
  - Notificaciones por correo/plataforma (§17) y cesión a una sociedad (§18).
- Cancelación ARCO de clientes con historial: se eliminan sus datos personales y
  se conserva el historial sin datos identificables (DEC-0075).

## 4. Preguntas abiertas para el abogado

1. **Identidad del operador — PENDIENTE (decisión del propietario, 2026-11-12):**
   la app la opera una persona física. Falta el nombre del titular y un domicilio
   completo (art. 15, fr. I). Opciones en evaluación: oficina virtual o coworking
   para oír y recibir notificaciones, o constituir una S.A.S. antes de activar
   Stripe en live. Mientras tanto se publica «Hermosillo, Sonora». Al decidir,
   configurar `NEXT_PUBLIC_LEGAL_OPERATOR_NAME` y `NEXT_PUBLIC_LEGAL_ADDRESS`.
2. **Medio ARCO:** confirmado por el propietario: `support@avantav.dev` (además de
   WhatsApp +52 662 171 1274). Valorar un buzón dedicado de privacidad.
3. **Domicilio de cada negocio** como responsable frente a sus clientes: la
   plataforma no lo captura todavía; ¿basta con remitir al negocio o debe mostrarse
   en el aviso simplificado del registro?
4. **Transferencias internacionales** a encargados fuera de México (Supabase,
   Stripe, Resend, Apple, Google, hosting): validar redacción y si se requiere
   cláusula adicional.
5. **Plazos**: suspensión por impago (15 días), exportación tras terminación
   (30 días), conservación posterior y límite de responsabilidad (12 meses de pagos).
6. **Jurisdicción** (Hermosillo, Sonora) y conveniencia de mediación o arbitraje.
7. ¿Aplica alguna disposición de la **Ley Federal de Protección al Consumidor** a
   micronegocios contratantes, o a los clientes finales frente al negocio?
8. **Evidencia de aceptación:** hoy se acepta con casilla obligatoria; ¿se requiere
   guardar versión, fecha e IP de aceptación de los Términos (pendiente técnico) o
   NOM-151?
9. **Menores de edad** en programas de lealtad (fecha de nacimiento opcional).
10. **Mercadotecnia por WhatsApp** (futuro): requisitos adicionales de Meta y de la
    ley para mensajes de campañas.

## 5. Pendientes técnicos derivados

- Guardar versión y fecha de aceptación de los Términos en el alta (`/signup`).
  Desde la versión 1.1 (DEC-0072) cada administrador general y cada persona
  usuaria acepta en un modal al entrar; se guardan versión y fecha (sin IP).
- ~~Capturar domicilio/razón social del negocio~~ Hecho (DEC-0072): el
  administrador general los registra antes de usar el panel y aparecen como
  responsable en los términos y el aviso de cada negocio.
- Revisar con el abogado los nuevos **Términos del programa de lealtad** de cada
  negocio (premios no canjeables por efectivo, baja, PROFECO, jurisdicción del
  domicilio del negocio).
- Mostrar el aviso de cambios sustanciales dentro de la plataforma (hoy el modal
  pide aceptar cada versión nueva, pero no resume qué cambió).
- Clientes importados marcados como `SELF_SERVICE` en `registration_method`.
- Órdenes de Servicio sin conexión con Stripe: el monto cobrado se configura aparte.
- Revisar con el abogado: remedio limitado por fallas, plazo de 15 días para
  aclarar cargos, Orden de Servicio como anexo contractual y si los registros de
  auditoría anteriores a una anonimización deben suprimirse o basta bloquearlos.

## 6. Procedimiento de supresión tras la terminación

No hay purga automática. Al terminar la suscripción de un negocio:

1. Registrar la fecha de terminación y avisar al administrador general que tiene
   30 días naturales para solicitar su exportación (Términos §14).
2. Atender la exportación con `/api/admin/exports` o desde Superadmin.
3. Pasados los 30 días, anonimizar a todos los clientes del negocio
   (`app.anonymize_admin_customer` por cliente, o un script equivalente revisado)
   y desactivar al personal. Conservar bloqueados solo los registros fiscales y de
   auditoría necesarios.
4. Coordenadas de compras y canjes: se conservan con la operación; definir con el
   abogado un plazo máximo (propuesta: 12 meses) antes de automatizar su borrado.
