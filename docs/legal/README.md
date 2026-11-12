# Documentos legales de morrow — propuesta para revisión jurídica

Estado: **versión 1.0 publicada provisionalmente** (12 de noviembre de 2026) mientras
la revisa un abogado. No constituye asesoría legal.

| Documento | Ruta pública | Fuente |
|---|---|---|
| Términos y Condiciones del Servicio (negocios) | `/terminos` | `src/content/legal/terms.ts` |
| Aviso de Privacidad Integral (personas usuarias de negocios) | `/privacidad` | `src/content/legal/privacy.ts` |
| Aviso de Privacidad para Clientes de Programas de Lealtad | `/privacidad/clientes` | `src/content/legal/customer-privacy.ts` |
| Aviso simplificado en el registro de clientes | Formulario `/register/...` | `src/components/public-registration-flow.tsx` |

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
- Capturar domicilio/razón social del negocio si el abogado lo requiere.
- Mostrar el aviso de cambios sustanciales dentro de la plataforma.
