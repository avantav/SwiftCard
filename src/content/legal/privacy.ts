import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, legalContactText, type LegalOperator } from "@/lib/legal/company";

/**
 * Aviso de privacidad integral de morrow (LFPDPPP 2025, art. 15). Covers the
 * people who use the platform on behalf of a business. Pending legal review.
 */
export function privacyMarkdown(op: LegalOperator) {
  const contact = legalContactText(op);
  return `# Aviso de Privacidad Integral

Versión ${LEGAL_VERSION} · Última actualización: ${LEGAL_EFFECTIVE_DATE}

## 1. Identidad y domicilio del responsable

**${op.operatorName}** (**«${op.brand}»**), con domicilio en ${op.address}, es responsable del tratamiento de los datos personales que se describen en este aviso, de conformidad con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (la **«Ley»**).

Este aviso aplica a las personas que visitan nuestro sitio y a quienes usan la plataforma ${op.brand} en nombre de un negocio: dueños, administradores, encargados y empleados (las **«Personas usuarias»**), así como a los prospectos que nos contactan.

**Clientes de los programas de lealtad.** Los datos de las personas que se registran en el programa de lealtad de un negocio son responsabilidad de ese negocio; ${op.brand} los trata únicamente **como encargado, por cuenta del negocio**. Consulta el [aviso para clientes de programas de lealtad](/privacidad/clientes).

## 2. Datos personales que tratamos

- **Identificación y contacto:** nombre, correo electrónico, teléfono y, en su caso, nombre del negocio y puesto o rol.
- **Acceso y seguridad:** credenciales de acceso (la contraseña se almacena cifrada y nunca en texto legible), PIN de operador (almacenado como resumen criptográfico), sucursales asignadas, registros de actividad y auditoría, dirección IP y datos técnicos del dispositivo y del navegador.
- **Ubicación al operar:** cuando el negocio activa la validación de ubicación, las coordenadas del dispositivo del empleado al confirmar una compra o un canje, para verificar que la operación ocurre en la sucursal. No rastreamos la ubicación de forma continua.
- **Facturación y pago:** nombre o razón social, RFC, régimen fiscal, domicilio fiscal y correo de facturación. **Los datos de tarjeta los recaba y resguarda directamente Stripe**; ${op.brand} no almacena números completos de tarjeta. Al contratar, consientes expresamente el tratamiento de tus datos financieros por parte de ${op.brand} y de su procesador de pagos para efectuar los cobros.
- **Comunicaciones:** mensajes que nos envías por correo o WhatsApp para soporte o ventas.

No tratamos datos personales sensibles de las Personas usuarias.

## 3. Finalidades

**Finalidades necesarias** para la relación con el negocio, que no requieren tu consentimiento:

- Crear, administrar y proteger cuentas y accesos, incluidas las cuentas compartidas con PIN.
- Prestar el servicio contratado y operar la plataforma.
- Cobrar suscripciones, emitir comprobantes y cumplir obligaciones fiscales.
- Prevenir fraudes y abusos, mantener registros de auditoría y atender incidentes de seguridad.
- Brindar soporte y enviarte comunicaciones sobre el servicio, tu cuenta, tu prueba gratuita y tus pagos.
- Cumplir obligaciones legales y requerimientos de autoridad.

**Finalidades secundarias**, que no son necesarias para el servicio:

- Enviarte novedades, contenidos y promociones de ${op.brand}.
- Invitarte a encuestas y elaborar estadísticas para mejorar la plataforma.

Si no deseas que tus datos se traten para las finalidades secundarias, puedes indicarlo en cualquier momento por ${contact}. Tu negativa no afectará el servicio.

## 4. Proveedores y transferencias

Para prestar el servicio nos apoyamos en proveedores que tratan datos **por cuenta de ${op.brand} como encargados**, con obligaciones de confidencialidad y seguridad, algunos ubicados fuera de México:

- **Supabase:** base de datos, autenticación y almacenamiento de archivos.
- **Proveedor de alojamiento de la aplicación web.**
- **Stripe:** procesamiento de pagos y suscripciones.
- **Resend:** envío de correos transaccionales.
- **Apple y Google:** emisión y actualización de tarjetas en Apple Wallet y Google Wallet, y mapas para ubicar sucursales.

${op.brand} **no vende ni renta** datos personales. Solo transferiremos datos a terceros sin tu consentimiento en los supuestos del artículo 36 de la Ley, por ejemplo cuando lo exija una ley o una autoridad competente, o cuando sea necesario para el reconocimiento, ejercicio o defensa de un derecho en un proceso judicial.

## 5. Derechos ARCO y revocación del consentimiento

Tienes derecho a **acceder** a tus datos, **rectificarlos**, **cancelarlos** y **oponerte** a su tratamiento (derechos ARCO), así como a revocar tu consentimiento y a limitar el uso o divulgación de tus datos. El ejercicio de estos derechos es gratuito, salvo los gastos justificados de envío o reproducción.

Para ejercerlos, envía tu solicitud por ${contact}, con:

- Tu nombre y un medio para comunicarte la respuesta.
- Un documento que acredite tu identidad o, en su caso, la representación legal.
- La descripción clara de los datos y del derecho que deseas ejercer.
- Cualquier otro elemento que facilite la localización de tus datos; en solicitudes de rectificación, las modificaciones y la documentación que las sustente.

Responderemos en un plazo máximo de **20 días** contados desde la recepción de la solicitud y, si resulta procedente, la haremos efectiva dentro de los **15 días** siguientes. Estos plazos podrán ampliarse una vez por un periodo igual cuando lo justifiquen las circunstancias.

Para limitar la publicidad, también puedes inscribirte en el Registro Público para Evitar Publicidad de la Procuraduría Federal del Consumidor.

## 6. Cookies y tecnologías similares

Usamos únicamente **cookies técnicas** necesarias para mantener tu sesión iniciada, la sesión de operador con PIN y, en su caso, las sesiones de soporte, así como almacenamiento local del navegador para preferencias de la aplicación. No usamos cookies de publicidad ni herramientas de analítica de terceros. Puedes eliminar las cookies desde tu navegador, pero la plataforma no funcionará sin las técnicas.

## 7. Conservación y seguridad

Conservamos los datos mientras exista la relación con el negocio y, después, durante los plazos necesarios para cumplir obligaciones legales, fiscales y para la defensa de nuestros derechos; al concluir, se suprimen o anonimizan. Aplicamos medidas de seguridad administrativas, técnicas y físicas, como cifrado en tránsito, aislamiento de la información de cada negocio, control de accesos por rol y registros de auditoría. Si ocurre una vulneración que afecte de forma significativa tus derechos, te informaremos de inmediato.

## 8. Menores de edad

La plataforma está dirigida a negocios y a personas mayores de 18 años.

## 9. Cambios a este aviso

Este aviso puede actualizarse por cambios legales o en nuestros servicios. Publicaremos la versión vigente en esta página con su fecha de actualización y, cuando los cambios sean relevantes, te avisaremos por correo o dentro de la plataforma.

## 10. Autoridad

Si consideras que tu derecho a la protección de datos personales ha sido vulnerado, puedes acudir ante la **Secretaría Anticorrupción y Buen Gobierno**, autoridad competente conforme a la Ley.
`;
}
