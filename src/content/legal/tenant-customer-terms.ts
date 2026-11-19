import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, tenantContactText, type LegalOperator, type TenantLegalIdentity } from "@/lib/legal/company";

/**
 * Términos y Condiciones del programa de lealtad que cada negocio ofrece a sus
 * clientes (DEC-0072). The business is the program operator; SwiftyCards is only
 * the technology provider. The conditions of each card (written by the
 * business) are appended by the page as plain text, never as Markdown.
 * Pending legal review, like the rest of `src/content/legal/`.
 */
export function tenantCustomerTermsMarkdown(op: LegalOperator, business: TenantLegalIdentity, privacyHref: string, whiteLabel: boolean) {
  const identified = business.legalName && business.legalAddress;
  const operator = identified
    ? `operado por **${business.legalName}**, con domicilio en ${business.legalAddress}`
    : "operado por el negocio que emite tu Tarjeta";
  const platform = whiteLabel ? "una plataforma tecnológica" : `la plataforma **${op.brand}**`;
  return `# Términos y Condiciones del Programa de Lealtad de ${business.tenantName}

Versión ${LEGAL_VERSION} · Vigentes desde el ${LEGAL_EFFECTIVE_DATE}

Estos Términos regulan tu participación en el programa de lealtad (el **«Programa»**) de **${business.tenantName}**, ${operator} (el **«Negocio»**). Al registrarte y marcar la casilla de aceptación, aceptas estos Términos, las condiciones particulares de la tarjeta que elijas, descritas al final, y declaras haber leído el [Aviso de Privacidad](${privacyHref}).

## 1. Participación

- Registrarte es gratuito y no requiere compra.
- El Programa está dirigido a personas físicas mayores de 18 años; si eres menor de edad, regístrate con la autorización de tu madre, padre o tutor.
- Debes registrarte con datos verdaderos y con un teléfono y un correo que te pertenezcan. Cada persona puede tener una sola Tarjeta por programa.

## 2. Tu Tarjeta digital

- Al registrarte recibes una tarjeta digital (la **«Tarjeta»**) que puedes consultar en la web o guardar en Apple Wallet o Google Wallet.
- La Tarjeta es personal e intransferible. Cuida su código QR: quien lo presente puede acumular o canjear con él.
- El personal del Negocio puede pedirte confirmar tu nombre o teléfono antes de registrar una compra o un canje.

## 3. Acumulación de sellos o puntos

- Acumulas sellos o puntos por las compras que el personal del Negocio registra en las sucursales participantes, según las reglas de tu tarjeta.
- Las compras deben registrarse al momento de pagar. No se acumulan compras anteriores a tu registro ni compras que no se hayan registrado, salvo que el Negocio decida hacerlo.
- Si una compra se cancela o se devuelve, el Negocio puede descontar los sellos o puntos que generó.

## 4. Premios

- Obtienes un premio al alcanzar la meta indicada en tu tarjeta. Los premios se canjean en las sucursales participantes presentando tu Tarjeta y dentro de la vigencia que se indique.
- Los premios no son canjeables por dinero en efectivo, no son transferibles y no se combinan con otras promociones, salvo que el Negocio lo indique.
- El Negocio es el único responsable de entregar los premios y de su disponibilidad. Si un premio se agota, el Negocio podrá ofrecerte uno de valor similar.

## 5. Uso indebido

Si detecta fraude, registros duplicados, uso de la Tarjeta de otra persona o manipulación del Programa, el Negocio puede cancelar la Tarjeta y los sellos, puntos o premios obtenidos de forma indebida.

## 6. Cambios y terminación del Programa

- El Negocio puede modificar o terminar el Programa. Las condiciones vigentes de tu tarjeta se publican siempre en tu tarjeta web y aplican desde su publicación; al reclamar tu tarjeta o agregarla a Apple Wallet o Google Wallet se te pedirá aceptar la versión vigente. Si no estás de acuerdo con un cambio, puedes darte de baja.
- Los premios que ya obtuviste se respetan hasta su vencimiento, salvo uso indebido.
- Puedes darte de baja en cualquier momento solicitándolo al Negocio. Al hacerlo se pierden los sellos, puntos y premios no canjeados.

## 7. Comunicaciones

Recibirás avisos en tu Tarjeta sobre compras, premios y saldo y, si diste tu correo, un correo de bienvenida y avisos cuando ganes un premio. Solo recibirás promociones si lo autorizaste expresamente, y puedes retirar esa autorización en cualquier momento desde la opción «Promociones» de tu tarjeta web.

## 8. Privacidad

El Negocio es responsable de tus datos personales. Consulta el [Aviso de Privacidad](${privacyHref}) para conocer qué datos se usan, para qué y cómo ejercer tus derechos.

## 9. Plataforma tecnológica

El Programa funciona sobre ${platform}, que solo provee la tecnología y trata tus datos por cuenta del Negocio. La plataforma no ofrece ni entrega los premios, y no responde por las condiciones del Programa.

## 10. Contacto, ley aplicable y jurisdicción

Para dudas, aclaraciones o para darte de baja, contacta a ${business.tenantName} por ${tenantContactText(business)}. Estos Términos se rigen por las leyes federales de los Estados Unidos Mexicanos. Puedes acudir a la Procuraduría Federal del Consumidor; para cualquier controversia son competentes los tribunales del domicilio del Negocio, sin perjuicio de los derechos que la ley te otorgue como consumidor.
`;
}
