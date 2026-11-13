/** Landing FAQ, shared by the page, its JSON-LD and its Markdown version. */

export type FaqItem = { question: string; answer: string };

const ONLINE_SIGNUP_QUESTION = "¿Puedo contratar y pagar desde este sitio?";
const ONLINE_SIGNUP_ANSWER =
  "Sí. Elige el plan Inicial o Crecimiento, crea tu cuenta y registra tu tarjeta: empiezas con 30 días de prueba y no se cobra nada hasta que termine. Para el plan Empresarial escríbenos por WhatsApp.";

const BASE_FAQ: FaqItem[] = [
  {
    question: "¿Mis clientes tienen que descargar una app?",
    answer: "No. Guardan su tarjeta en Apple Wallet o Google Wallet y también pueden abrir una versión web desde su teléfono."
  },
  {
    question: "¿Tengo que cambiar mi sistema de cobro?",
    answer: "No para comenzar. Tu equipo registra la compra desde morrow y tu operación de cobro puede continuar como está."
  },
  {
    question: "¿Funciona si tengo varias sucursales?",
    answer: "Sí. Puedes controlar el acceso de tu equipo, elegir sucursales participantes y consultar resultados por ubicación."
  },
  {
    question: "¿Mis clientes reciben avisos?",
    answer: "Sí. Al registrar una compra o ganar un premio, su tarjeta en Apple Wallet o Google Wallet muestra un aviso con su nuevo saldo. Si dejaron su correo, reciben una bienvenida y un correo cada vez que ganan un premio."
  },
  {
    question: ONLINE_SIGNUP_QUESTION,
    answer: "Por ahora activamos tu cuenta por WhatsApp: eliges tu plan, te acompañamos en la configuración y empiezas con 30 días de prueba, sin pedir pagos en línea. El pago en línea estará disponible pronto."
  }
];

export function landingFaq(onlineSignup: boolean): FaqItem[] {
  return BASE_FAQ.map((item) =>
    onlineSignup && item.question === ONLINE_SIGNUP_QUESTION ? { ...item, answer: ONLINE_SIGNUP_ANSWER } : item
  );
}
