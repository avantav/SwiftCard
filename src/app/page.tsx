import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LandingMotion } from "@/components/landing-motion";
import { SwiftWalletBrand } from "@/components/swiftwallet-brand";
import { getStaffSessionContext } from "@/lib/auth/server";
import { getDefaultInternalRoute } from "@/lib/auth/routes";

export const metadata: Metadata = {
  title: "SwiftWallet | Fidelidad digital fácil de entender",
  description:
    "Crea un programa de lealtad digital, entrega tarjetas para Apple Wallet y Google Wallet y opera recompensas desde cualquier sucursal."
};

const benefits = [
  {
    title: "Una tarjeta que el cliente sí lleva",
    description:
      "La tarjeta vive en Apple Wallet, Google Wallet o en la web. No hay otra app que aprender ni una contraseña que recordar."
  },
  {
    title: "Reglas simples para tu negocio",
    description:
      "Define sellos por visita, sellos por monto o puntos acumulativos, con los premios que mejor funcionen para ti."
  },
  {
    title: "Operación clara para el equipo",
    description:
      "Tu personal escanea la tarjeta, registra la compra y confirma. SwiftWallet calcula el avance y entrega los premios."
  },
  {
    title: "Visibilidad en todas tus sucursales",
    description:
      "Consulta clientes, compras, recompensas y resultados por sucursal desde un solo lugar."
  }
];

const questions = [
  {
    question: "¿Mis clientes tienen que descargar una app?",
    answer:
      "No. Pueden guardar su tarjeta en Apple Wallet o Google Wallet y también abrir una versión web desde su teléfono."
  },
  {
    question: "¿Tengo que cambiar mi sistema de cobro?",
    answer:
      "No para comenzar. El equipo registra la compra desde la PWA de SwiftWallet y tu operación de cobro puede continuar como está."
  },
  {
    question: "¿Funciona si tengo varias sucursales?",
    answer:
      "Sí. Puedes asignar programas a sucursales participantes, controlar el acceso del personal y consultar resultados por ubicación."
  },
  {
    question: "¿Puedo contratar y pagar desde el sitio?",
    answer:
      "Todavía no. En esta etapa conocemos tu operación en una demo y definimos contigo la configuración adecuada, sin pedir pagos en línea."
  }
];

export default async function HomePage() {
  const demoRequestHref = process.env.NEXT_PUBLIC_DEMO_REQUEST_URL?.trim() || "#demo-contacto";
  let context = null;
  try {
    context = await getStaffSessionContext();
  } catch {
    context = null;
  }

  if (context?.access.staffStatus === "PASSWORD_RESET_REQUIRED") {
    redirect("/change-password");
  }

  if (context?.access.staffStatus === "ACTIVE") {
    redirect(getDefaultInternalRoute(context.access.role));
  }

  return (
    <main className="landing-page">
      <LandingMotion />
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <SwiftWalletBrand subtitle="Fidelidad digital" />
          <nav className="landing-nav" aria-label="Navegación principal">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#beneficios">Beneficios</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <div className="landing-header-actions">
            <Link className="landing-login-link" href="/login">
              Iniciar sesión
            </Link>
            <a className="landing-button landing-button-primary" href={demoRequestHref}>
              Solicitar una demo
            </a>
          </div>
        </div>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-color-field" aria-hidden="true">
          <span className="is-teal" />
          <span className="is-blue" />
          <span className="is-amber" />
        </div>
        <div className="landing-container landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="landing-kicker">Fidelidad digital, sin complicaciones</p>
            <h1 id="landing-title">Convierte cada compra en una <span>razón para volver.</span></h1>
            <p className="landing-hero-description">
              SwiftWallet ayuda a tu negocio a crear un programa de recompensas fácil para tus
              clientes y sencillo de operar para tu equipo.
            </p>
            <div className="landing-hero-actions">
              <a className="landing-button landing-button-primary" href={demoRequestHref}>
                Solicitar una demo
              </a>
              <a className="landing-button landing-button-secondary" href="#como-funciona">
                Ver cómo funciona
              </a>
            </div>
            <p className="landing-cta-note">
              Sin tarjeta de crédito. Primero entendemos cómo funciona tu negocio.
            </p>
          </div>

          <figure className="landing-product-preview">
            <div className="landing-preview-toolbar">
              <span><i aria-hidden="true" /> Programa activo</span>
              <small>Actualizado ahora</small>
            </div>
            <div className="landing-preview-sequence" aria-label="Flujo: compra, progreso y premio">
              <span><i>1</i> Compra</span>
              <b aria-hidden="true" />
              <span><i>2</i> Progreso</span>
              <b aria-hidden="true" />
              <span><i>3</i> Premio</span>
            </div>
            <div className="landing-preview-body">
              <article className="landing-wallet-card" aria-label="Ejemplo de tarjeta digital">
                <div className="landing-wallet-topline">
                  <span className="landing-wallet-logo" aria-hidden="true">C</span>
                  <strong>Café Central</strong>
                </div>
                <div className="landing-wallet-balance">
                  <span>Tu progreso</span>
                  <strong>6 de 10 visitas</strong>
                </div>
                <div className="landing-stamps" aria-label="6 de 10 visitas completadas">
                  {Array.from({ length: 10 }, (_, index) => (
                    <span className={index < 6 ? "is-earned" : undefined} key={index}>
                      {index < 6 ? "✓" : ""}
                    </span>
                  ))}
                </div>
                <div className="landing-wallet-footer">
                  <span>Próximo premio</span>
                  <strong>Café de cortesía</strong>
                </div>
              </article>

              <div className="landing-activity-card">
                <div>
                  <span className="landing-activity-icon" aria-hidden="true">✓</span>
                  <p><strong>Compra registrada</strong><span>El avance se actualizó automáticamente.</span></p>
                </div>
                <div>
                  <span className="landing-activity-icon is-reward" aria-hidden="true">★</span>
                  <p><strong>Premio disponible</strong><span>Listo para canjear en la próxima visita.</span></p>
                </div>
              </div>
            </div>
            <figcaption>Una experiencia clara para el cliente y para quien lo atiende.</figcaption>
          </figure>
        </div>
      </section>

      <section className="landing-proof" aria-label="Disponibilidad de la tarjeta" data-landing-reveal="fade">
        <div className="landing-container landing-proof-inner">
          <p>Una sola experiencia, disponible donde tus clientes ya están.</p>
          <ul>
            <li>Apple Wallet</li>
            <li>Google Wallet</li>
            <li>Tarjeta web</li>
          </ul>
        </div>
      </section>

      <section className="landing-section" id="como-funciona" aria-labelledby="how-title">
        <div className="landing-container">
          <div className="landing-section-heading" data-landing-reveal="up">
            <p className="landing-kicker">Cómo funciona</p>
            <h2 id="how-title">De tu idea a una tarjeta lista para usar.</h2>
            <p>No necesitas conocer términos técnicos. Configuras el programa y SwiftWallet se encarga del resto.</p>
          </div>
          <ol className="landing-steps">
            <li data-landing-reveal="up" data-reveal-delay="1">
              <span>01</span>
              <div><h3>Define cómo recompensar</h3><p>Elige qué acciones suman, cuántas visitas o puntos necesita el cliente y qué premios recibirá.</p></div>
            </li>
            <li data-landing-reveal="up" data-reveal-delay="2">
              <span>02</span>
              <div><h3>Invita a tus clientes</h3><p>Comparten sus datos desde un QR y guardan su tarjeta digital. No crean una cuenta ni descargan otra app.</p></div>
            </li>
            <li data-landing-reveal="up" data-reveal-delay="3">
              <span>03</span>
              <div><h3>Registra y reconoce cada visita</h3><p>Tu equipo escanea la tarjeta, registra la compra y confirma el canje cuando haya un premio disponible.</p></div>
            </li>
          </ol>
        </div>
      </section>

      <section className="landing-section landing-audience-section" aria-labelledby="audience-title">
        <div className="landing-container">
          <div className="landing-section-heading" data-landing-reveal="up">
            <p className="landing-kicker">Dos experiencias, el mismo objetivo</p>
            <h2 id="audience-title">Fácil para tus clientes. Ordenado para tu negocio.</h2>
          </div>
          <div className="landing-audience-grid">
            <article data-landing-reveal="left">
              <p className="landing-audience-label">Para tus clientes</p>
              <h3>Participar toma menos esfuerzo.</h3>
              <ul>
                <li>Se registran desde un código QR.</li>
                <li>Llevan la tarjeta en su propio teléfono.</li>
                <li>Ven su avance y los premios disponibles.</li>
                <li>No necesitan usuario ni contraseña.</li>
              </ul>
            </article>
            <article data-landing-reveal="right" data-reveal-delay="1">
              <p className="landing-audience-label">Para tu negocio</p>
              <h3>Operar deja de depender del papel.</h3>
              <ul>
                <li>El equipo trabaja desde una PWA en el teléfono.</li>
                <li>Los cálculos se realizan de forma automática.</li>
                <li>Cada operación conserva su historial.</li>
                <li>Las sucursales comparten una vista organizada.</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-section" id="beneficios" aria-labelledby="benefits-title">
        <div className="landing-container">
          <div className="landing-section-heading" data-landing-reveal="up">
            <p className="landing-kicker">Lo que resuelve SwiftWallet</p>
            <h2 id="benefits-title">Todo lo necesario para operar un programa que se entiende.</h2>
          </div>
          <div className="landing-benefit-grid">
            {benefits.map((benefit, index) => (
              <article key={benefit.title} data-landing-reveal="up" data-reveal-delay={`${(index % 2) + 1}`}>
                <span aria-hidden="true">0{index + 1}</span>
                <h3>{benefit.title}</h3>
                <p>{benefit.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-confidence-section" aria-labelledby="confidence-title">
        <div className="landing-container landing-confidence-grid" data-landing-reveal="scale">
          <div>
            <p className="landing-kicker">Control sin complejidad</p>
            <h2 id="confidence-title">Tu equipo atiende. SwiftWallet cuida la lógica.</h2>
            <p>Los sellos, puntos y premios no dependen de cálculos manuales en el teléfono. La plataforma valida cada operación y mantiene un historial para que puedas entender qué pasó.</p>
          </div>
          <dl>
            <div><dt>Hasta 3</dt><dd>programas de tarjeta por negocio</dd></div>
            <div><dt>1 lugar</dt><dd>para sucursales, equipo y resultados</dd></div>
            <div><dt>0 cuentas</dt><dd>o contraseñas para tus clientes</dd></div>
          </dl>
        </div>
      </section>

      <section className="landing-section" id="preguntas" aria-labelledby="questions-title">
        <div className="landing-container landing-faq-layout">
          <div className="landing-section-heading" data-landing-reveal="left">
            <p className="landing-kicker">Preguntas frecuentes</p>
            <h2 id="questions-title">Lo esencial antes de una demo.</h2>
            <p>Te mostramos el flujo completo con ejemplos cercanos a tu operación.</p>
          </div>
          <div className="landing-faq-list" data-landing-reveal="right" data-reveal-delay="1">
            {questions.map((item, index) => (
              <details key={item.question} open={index === 0}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-demo-section" id="solicitar-demo" aria-labelledby="demo-title">
        <div className="landing-container landing-demo-card" data-landing-reveal="scale">
          <div>
            <p className="landing-kicker">Conoce SwiftWallet</p>
            <h2 id="demo-title">Veamos cómo funcionaría en tu negocio.</h2>
            <p>En una demo revisamos tus sucursales, tu forma de recompensar y la experiencia que quieres ofrecer. No necesitas elegir un plan ni realizar un pago.</p>
          </div>
          <div className="landing-demo-action">
            <a className="landing-button landing-button-primary" href={demoRequestHref}>
              Solicitar una demo
            </a>
            <small id="demo-contacto">El canal para agendar se habilitará antes de publicar esta página.</small>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container">
          <SwiftWalletBrand subtitle="Fidelidad digital" />
          <p>Programas de fidelidad claros para negocios y clientes.</p>
          <Link href="/login">Acceso para equipos</Link>
        </div>
      </footer>
    </main>
  );
}
