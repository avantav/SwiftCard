import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, legalContactText, type LegalOperator } from "@/lib/legal/company";

/** Términos y Condiciones del Servicio (negocios). Pending legal review. */
export function termsMarkdown(op: LegalOperator) {
  const contact = legalContactText(op);
  return `# Términos y Condiciones del Servicio

Versión ${LEGAL_VERSION} · Vigentes desde el ${LEGAL_EFFECTIVE_DATE}

Estos Términos y Condiciones (los **«Términos»**) regulan el uso de la plataforma **${op.brand}** (la **«Plataforma»**), operada por **${op.operatorName}**, con domicilio en ${op.address} (**«${op.brand}»**, «nosotros»). Aplican al negocio, persona física o moral, que crea una cuenta o contrata un plan (el **«Negocio»**) y a las personas usuarias que el Negocio autoriza.

Al crear una cuenta, marcar la casilla de aceptación o usar la Plataforma, el Negocio declara que tiene capacidad legal para obligarse y que acepta estos Términos y el [Aviso de Privacidad](/privacidad). Si una persona acepta en nombre de un Negocio, declara tener facultades para hacerlo.

## 1. Definiciones

- **Cliente final:** persona que se registra en el programa de lealtad del Negocio y recibe una tarjeta digital.
- **Tarjeta:** tarjeta de lealtad digital emitida por el Negocio a través de la Plataforma, disponible como tarjeta web, en Apple Wallet o en Google Wallet.
- **Personas usuarias:** administradores, encargados y empleados del Negocio con acceso a la Plataforma, incluidas las cuentas compartidas de sucursal con PIN.
- **Plan:** el paquete contratado (Inicial, Crecimiento o Empresarial) con sus precios, límites y funciones vigentes al momento de la contratación.
- **Datos del Negocio:** la información que el Negocio o sus Clientes finales capturan en la Plataforma, incluidos datos personales.

## 2. El servicio

${op.brand} es un software como servicio que permite al Negocio crear y operar programas de lealtad: registrar Clientes finales, emitir y actualizar Tarjetas, registrar compras y canjes desde una aplicación web para su personal, configurar sellos, puntos y premios, consultar métricas y enviar avisos y correos relacionados con el programa.

Las funciones disponibles dependen del Plan. Las funciones anunciadas como «Próximamente» no forman parte del servicio contratado hasta su liberación. ${op.brand} puede mejorar, modificar o retirar funciones siempre que no se reduzca de forma sustancial el servicio esencial del Plan vigente; los cambios relevantes se avisarán con anticipación razonable.

El programa de lealtad, sus reglas, premios y promociones son ofrecidos por el Negocio a sus Clientes finales. ${op.brand} solo provee la tecnología: el Negocio es el único responsable de honrar los premios, de las condiciones de su programa y de la atención a sus Clientes finales.

## 3. Cuenta y acceso

- El Negocio debe proporcionar información veraz, completa y actualizada, y mantener vigentes sus datos de contacto y facturación.
- El Negocio es responsable de las credenciales, contraseñas y PIN de sus Personas usuarias, de los permisos que les otorga y de toda actividad realizada con su cuenta.
- El Negocio debe avisar de inmediato a ${op.brand} sobre cualquier uso no autorizado o vulneración de su cuenta.
- El administrador general del Negocio puede crear, restablecer y desactivar las cuentas de su personal. ${op.brand} puede solicitar pruebas de identidad o de representación antes de atender solicitudes sobre una cuenta.

## 4. Planes, precios e impuestos

- Los precios de los Planes se publican en pesos mexicanos y **no incluyen el IVA**, que se agrega al cobro conforme a la tasa vigente.
- El Plan Empresarial y cualquier adaptación a la medida se rigen por la cotización o el contrato específico que acuerden las partes; en lo no previsto aplican estos Términos.
- ${op.brand} puede modificar sus precios con al menos **30 días naturales** de aviso. El nuevo precio aplicará a partir de la siguiente renovación; si el Negocio no está de acuerdo, puede cancelar antes de esa fecha sin penalización.

## 5. Prueba gratuita

- Los Planes Inicial y Crecimiento contratados en línea incluyen una prueba gratuita de **30 días naturales**. Para iniciarla es necesario registrar un método de pago válido.
- **Al terminar la prueba, la suscripción se cobra automáticamente** con el método de pago registrado, salvo que el Negocio la cancele antes desde «Administrar pago y facturas».
- La prueba se ofrece una sola vez por Negocio. ${op.brand} puede negar o terminar una prueba en caso de abuso.

## 6. Facturación, pagos y renovación

- Los pagos se procesan a través de **Stripe**. ${op.brand} no almacena los números completos de tarjeta.
- Las suscripciones son **mensuales o anuales y se renuevan automáticamente** por periodos iguales, con cobro al inicio de cada periodo, hasta que el Negocio las cancele.
- Si un cobro falla, el procesador realizará reintentos automáticos y se notificará al Negocio para actualizar su método de pago. Si el adeudo persiste por más de **15 días naturales**, ${op.brand} podrá limitar o suspender el servicio hasta su regularización.
- El Negocio puede consultar y descargar sus comprobantes de pago desde el portal de pagos. La emisión de **Comprobantes Fiscales Digitales por Internet (CFDI)** se realizará a solicitud del Negocio con sus datos fiscales (RFC, razón social, régimen y código postal), dentro del mes en que se realizó el pago.

## 7. Cancelación y reembolsos

- El Negocio puede cancelar en cualquier momento desde el portal de pagos. La cancelación surte efecto **al final del periodo pagado**; hasta entonces el servicio continúa activo.
- Salvo que la ley aplicable disponga otra cosa o ${op.brand} incumpla estos Términos, **no se realizan reembolsos** por periodos parciales, por cambios a un Plan inferior ni por funciones no utilizadas.
- Los cambios a un Plan superior aplican de inmediato con el ajuste proporcional que calcule el procesador de pagos; los cambios a un Plan inferior aplican al iniciar el siguiente periodo.

## 8. Uso aceptable

El Negocio y sus Personas usuarias no deben:

- Usar la Plataforma para fines ilícitos, fraudulentos o engañosos, ni para ofrecer premios o promociones que no piensen cumplir.
- Registrar a personas o enviarles comunicaciones sin contar con su consentimiento cuando la ley lo exija, ni capturar datos personales sensibles en la Plataforma.
- Suplantar a otro negocio o persona, ni usar marcas, logotipos o contenidos sobre los que no tengan derechos.
- Vulnerar o intentar vulnerar la seguridad de la Plataforma, acceder a datos de otros negocios, hacer ingeniería inversa, extraer datos de forma automatizada o sobrecargar la infraestructura.
- Revender, sublicenciar o poner la Plataforma a disposición de terceros ajenos al Negocio sin autorización escrita.

## 9. Datos personales y encargo del tratamiento

**Roles.** Respecto de los datos personales de sus Clientes finales y de su personal, **el Negocio es el responsable** del tratamiento y **${op.brand} actúa como encargado**, tratándolos únicamente por cuenta del Negocio y para prestar el servicio, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares. Respecto de los datos de contacto, acceso y facturación de las Personas usuarias necesarios para administrar la relación comercial, ${op.brand} actúa como responsable conforme a su [Aviso de Privacidad](/privacidad).

**Obligaciones del Negocio.** El Negocio se obliga a:

- Poner a disposición de sus Clientes finales su aviso de privacidad. La Plataforma muestra un [aviso para clientes de programas de lealtad](/privacidad/clientes) que el Negocio puede adoptar; el Negocio es responsable de que su contenido corresponda a su operación.
- Recabar los consentimientos necesarios, en particular el **consentimiento expreso para enviar promociones**, y respetar su revocación.
- Atender las solicitudes de acceso, rectificación, cancelación y oposición (ARCO) de sus Clientes finales, con el apoyo de ${op.brand} cuando lo requiera.
- No instruir a ${op.brand} tratamientos contrarios a la ley.

**Obligaciones de ${op.brand} como encargado.** ${op.brand} se obliga a:

- Tratar los datos solo conforme a las instrucciones del Negocio expresadas mediante la configuración y el uso de la Plataforma, y no utilizarlos para fines propios ni venderlos.
- Mantener la confidencialidad de los datos, incluso después de terminada la relación, y exigirla a su personal.
- Mantener medidas de seguridad administrativas, técnicas y físicas razonables, incluida la separación de la información de cada Negocio.
- Recurrir solo a los proveedores (subencargados) indicados en el [Aviso de Privacidad](/privacidad) u otros que ofrezcan garantías equivalentes, informando los cambios relevantes.
- Informar al Negocio sin demora indebida sobre cualquier vulneración de seguridad que afecte los Datos del Negocio, y colaborar en su atención.
- Apoyar al Negocio, en la medida de lo razonable, para atender solicitudes ARCO.
- Al terminar el servicio, poner los Datos del Negocio a su disposición para exportación y suprimirlos en los plazos de la sección 14, salvo los que deba conservar por obligación legal.

## 10. Comunicaciones a Clientes finales

- La Plataforma envía comunicaciones **transaccionales** relacionadas con la Tarjeta, como avisos en Apple Wallet o Google Wallet por compras y premios, y correos de bienvenida o de premio cuando el Cliente final proporcionó su correo.
- Las comunicaciones **promocionales** por correo o WhatsApp solo podrán enviarse a Clientes finales que hayan otorgado su consentimiento expreso y conforme a las políticas de los proveedores de mensajería.
- El Negocio es responsable del contenido de sus mensajes y promociones.

## 11. Servicios de terceros

La Plataforma se integra con servicios de terceros como Apple Wallet, Google Wallet, Google Maps, Stripe y proveedores de alojamiento, correo y notificaciones. Su uso está sujeto a los términos de esos terceros. ${op.brand} no es responsable de interrupciones, cambios de políticas, rechazos o decisiones de dichos terceros, aunque procurará mitigar sus efectos.

## 12. Propiedad intelectual

- La Plataforma, su software, diseño, marcas y documentación son propiedad de ${op.brand} o de sus licenciantes. Estos Términos otorgan al Negocio una licencia limitada, no exclusiva, intransferible y revocable para usarla durante la vigencia de su suscripción.
- El Negocio conserva la titularidad de sus marcas, logotipos, imágenes y Datos del Negocio, y otorga a ${op.brand} una licencia limitada para usarlos con el único fin de prestar el servicio, por ejemplo para mostrarlos en las Tarjetas.
- Las sugerencias que el Negocio comparta para mejorar la Plataforma podrán ser utilizadas por ${op.brand} sin obligación de compensación.

## 13. Disponibilidad, soporte y limitación de responsabilidad

- ${op.brand} hará esfuerzos comercialmente razonables para mantener la Plataforma disponible, pero no garantiza un servicio ininterrumpido o libre de errores. Podrán realizarse mantenimientos, procurando avisar con anticipación los programados. Los niveles de servicio específicos solo aplican si se pactan por escrito en el Plan Empresarial.
- En la máxima medida permitida por la ley, ${op.brand} no será responsable por daños indirectos, lucro cesante, pérdida de ventas o de oportunidades de negocio, ni por fallas de terceros, caso fortuito o fuerza mayor.
- La responsabilidad total de ${op.brand} derivada de estos Términos no excederá el monto efectivamente pagado por el Negocio en los **12 meses** anteriores al hecho que la origine.
- Estas limitaciones no aplican en caso de dolo o mala fe ni en los supuestos en que la ley no permita limitar la responsabilidad.

## 14. Suspensión, terminación y destino de los datos

- ${op.brand} podrá suspender o terminar el acceso por falta de pago conforme a la sección 6, por incumplimiento grave de estos Términos, por uso que ponga en riesgo la seguridad de la Plataforma o de otros negocios, o por mandato de autoridad. Salvo urgencia, se avisará previamente al Negocio.
- Al terminar la suscripción, las Tarjetas emitidas dejarán de actualizarse y podrán invalidarse.
- Durante los **30 días naturales** siguientes a la terminación, el Negocio podrá solicitar la exportación de sus Datos del Negocio. Transcurrido ese plazo, ${op.brand} los suprimirá o anonimizará en un plazo razonable, salvo la información que deba conservar por disposición legal, fiscal o para la defensa de sus derechos, la cual se bloqueará y conservará solo por el tiempo necesario.

## 15. Indemnización

El Negocio sacará en paz y a salvo a ${op.brand} frente a reclamaciones de terceros, incluidos Clientes finales y autoridades, derivadas del incumplimiento de estos Términos, del uso de datos personales sin el consentimiento o aviso requeridos, de sus promociones o premios, o de contenidos que infrinjan derechos de terceros.

## 16. Confidencialidad

Cada parte mantendrá confidencial la información no pública de la otra a la que tenga acceso con motivo del servicio y solo la usará para cumplir estos Términos, salvo que deba revelarla por mandato de ley o de autoridad competente.

## 17. Cambios a estos Términos

${op.brand} podrá actualizar estos Términos. Los cambios sustanciales se notificarán al Negocio por correo electrónico o dentro de la Plataforma con al menos **30 días naturales** de anticipación. Si el Negocio continúa usando la Plataforma después de la fecha de entrada en vigor, se entenderá que acepta la nueva versión; si no está de acuerdo, puede cancelar antes de esa fecha.

## 18. Ley aplicable y jurisdicción

Estos Términos se rigen por las leyes federales de los Estados Unidos Mexicanos. Para su interpretación y cumplimiento, las partes se someten a los tribunales competentes de ${op.jurisdiction}, renunciando a cualquier otro fuero que pudiera corresponderles por razón de su domicilio presente o futuro, salvo que la ley aplicable disponga otra cosa.

## 19. Contacto

Para dudas sobre estos Términos, escríbenos por ${contact}.
`;
}
