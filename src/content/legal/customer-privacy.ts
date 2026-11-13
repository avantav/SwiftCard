import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, legalContactText, type LegalOperator } from "@/lib/legal/company";

/**
 * Aviso de privacidad para clientes de programas de lealtad. Each business is
 * the data controller; morrow processes data on its behalf. Pending review.
 */
export function customerPrivacyMarkdown(op: LegalOperator) {
  const contact = legalContactText(op);
  return `# Aviso de Privacidad para Clientes de Programas de Lealtad

Versión ${LEGAL_VERSION} · Última actualización: ${LEGAL_EFFECTIVE_DATE}

Este aviso aplica a las personas que se registran en el programa de lealtad de un negocio que usa la plataforma ${op.brand} y reciben una tarjeta digital (la **«Tarjeta»**).

## 1. ¿Quién es responsable de tus datos?

**El negocio que emite tu Tarjeta** (su nombre y logotipo aparecen en la Tarjeta y en el formulario de registro) es el **responsable** del tratamiento de tus datos personales y de su protección, en términos de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (la **«Ley»**). Puedes pedirle directamente su domicilio y su aviso de privacidad.

**${op.operatorName}** (**«${op.brand}»**), con domicilio en ${op.address}, opera la plataforma y trata tus datos **únicamente como encargado, por cuenta del negocio**, para operar su programa de lealtad. ${op.brand} no usa tus datos para fines propios, no los vende y mantiene separada la información de cada negocio.

## 2. Datos que se tratan

- **Identificación y contacto:** nombre, teléfono y correo electrónico (obligatorios al registrarte); fecha de nacimiento (opcional). Los clientes importados por el negocio pueden no tener correo.
- **Programa de lealtad:** sucursal de registro, compras registradas, sellos o puntos, premios obtenidos y canjeados, y la versión de los términos del programa que aceptaste.
- **Tarjeta digital:** identificadores técnicos necesarios para entregar y actualizar tu Tarjeta en Apple Wallet o Google Wallet. Los identificadores del dispositivo se guardan cifrados o como resúmenes criptográficos.
- **Consentimientos:** tu aceptación del aviso y de los términos del programa y, si la otorgas, tu autorización para recibir promociones.

**No se recaba tu ubicación.** La Tarjeta puede incluir la ubicación de las sucursales para que tu teléfono te la sugiera al estar cerca; esa función ocurre en tu dispositivo y no comparte tu ubicación con el negocio ni con ${op.brand}. No se tratan datos personales sensibles ni datos financieros.

## 3. ¿Para qué se usan?

**Finalidades necesarias** para participar en el programa:

- Registrarte y emitir, entregar y actualizar tu Tarjeta.
- Registrar tus compras y visitas, calcular sellos o puntos, y otorgar y canjear premios.
- Enviarte avisos en tu Tarjeta sobre compras, premios y saldo, y, si diste tu correo, un correo de bienvenida y avisos cuando ganes un premio.
- Identificarte al presentar tu Tarjeta, atender tus solicitudes y prevenir fraudes o abusos del programa.

**Finalidad secundaria**, que solo ocurre si la autorizas marcando la casilla correspondiente:

- Enviarte promociones, novedades y beneficios del negocio por correo electrónico o WhatsApp.

Puedes negarte o retirar esta autorización en cualquier momento sin afectar tu participación en el programa.

## 4. Proveedores y transferencias

Para operar la plataforma, ${op.brand} se apoya en proveedores que actúan como encargados con obligaciones de confidencialidad, algunos fuera de México: Supabase (base de datos), el proveedor de alojamiento de la aplicación, Resend (correo), y Apple y Google (Apple Wallet y Google Wallet).

Tus datos **no se venden** ni se comparten con otros negocios. Solo se transferirán sin tu consentimiento en los casos previstos en el artículo 36 de la Ley, como requerimientos de autoridad competente.

## 5. Tus derechos

Puedes **acceder**, **rectificar** y **cancelar** tus datos, **oponerte** a su tratamiento, revocar tu consentimiento y limitar su uso o divulgación. Dirige tu solicitud al negocio que emitió tu Tarjeta o, si lo prefieres, a ${op.brand} por ${contact}; la turnaremos al negocio y le daremos apoyo para atenderla.

Tu solicitud debe incluir tu nombre, un medio para responderte, un documento que acredite tu identidad o representación, el derecho que deseas ejercer y la descripción de los datos (por ejemplo, el teléfono con el que te registraste). La respuesta se dará en un máximo de **20 días** y, si procede, se hará efectiva dentro de los **15 días** siguientes; ambos plazos pueden ampliarse una vez por un periodo igual. El trámite es gratuito.

## 6. Conservación y seguridad

Tus datos se conservan mientras tu Tarjeta esté activa y, después, durante el tiempo necesario para atender aclaraciones y obligaciones legales; luego se suprimen o anonimizan. Si el negocio deja de usar ${op.brand}, tus datos se le entregan o se suprimen conforme a su contrato. Se aplican medidas como cifrado en tránsito, aislamiento de los datos de cada negocio y control de accesos. Si ocurre una vulneración que afecte de forma significativa tus derechos, se te informará de inmediato.

## 7. Menores de edad

Los programas de lealtad están dirigidos a personas mayores de 18 años. Si eres menor de edad, regístrate con la autorización de tu madre, padre o tutor.

## 8. Cambios y autoridad

Este aviso puede actualizarse; la versión vigente estará siempre en esta página con su fecha. Si consideras que tus derechos han sido vulnerados, puedes acudir ante la **Secretaría Anticorrupción y Buen Gobierno**.
`;
}
