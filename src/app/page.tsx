import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LandingMotion } from "@/components/landing-motion";
import { MorrowBrand } from "@/components/morrow-brand";
import { getStaffSessionContext } from "@/lib/auth/server";
import { getDefaultInternalRoute } from "@/lib/auth/routes";
import "./landing.css";

export const metadata: Metadata = {
  title: "morrow | Lealtad digital que hace volver a tus clientes",
  description:
    "Crea un programa de lealtad fácil de usar, entrega tarjetas para Apple Wallet y Google Wallet y entiende qué hace volver a tus clientes."
};

type MarketingIconName =
  | "arrow"
  | "chart"
  | "check"
  | "gift"
  | "scan"
  | "shield"
  | "store"
  | "users"
  | "wallet";

function MarketingIcon({ name, size = 18 }: { name: MarketingIconName; size?: number }) {
  const paths: Record<MarketingIconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    chart: <><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-7" /><path d="M22 19H2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    gift: <><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M7.5 8C5 8 4 6.8 4 5.5S5.1 3 6.5 3C9 3 12 8 12 8m4.5 0C19 8 20 6.8 20 5.5S18.9 3 17.5 3C15 3 12 8 12 8" /></>,
    scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M7 12h10" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    store: <><path d="M3 9h18l-2-5H5L3 9Z" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    wallet: <><path d="M4 5h15a2 2 0 0 1 2 2v12H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><path d="M16 11h5v5h-5a2.5 2.5 0 0 1 0-5Z" /></>
  };

  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name]}
      </g>
    </svg>
  );
}

const benefits = [
  {
    icon: "users" as const,
    title: "Más visitas que sí puedes medir",
    description: "Da a cada cliente una razón clara para volver y observa el avance de tu programa en un solo lugar."
  },
  {
    icon: "gift" as const,
    title: "Premios que se entienden al instante",
    description: "Tus clientes saben cuánto han avanzado, qué pueden ganar y cuándo pueden usar su recompensa."
  },
  {
    icon: "wallet" as const,
    title: "Una tarjeta que siempre llevan",
    description: "La tarjeta vive en Apple Wallet, Google Wallet o en la web. No hay otra app que aprender."
  }
];

const questions = [
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
    question: "¿Puedo contratar y pagar desde este sitio?",
    answer: "Todavía no. Primero conocemos tu operación en una demo y definimos contigo la configuración adecuada, sin pedir pagos en línea."
  }
];

function WalletCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`mkt-wallet-card${compact ? " is-compact" : ""}`}>
      <div className="mkt-wallet-brand">
        <span className="mkt-pass-mark">S</span>
        <span><strong>CAFÉ NORTE</strong><small>CLUB DE VISITAS</small></span>
        <span className="mkt-qr" aria-hidden="true" />
      </div>
      <div className="mkt-wallet-progress">
        <small>PROGRESO DE ANA</small>
        <strong>7 de 10 visitas</strong>
        <div className="mkt-stamp-row" aria-label="7 de 10 visitas completadas">
          {Array.from({ length: 10 }, (_, index) => (
            <span className={index < 7 ? "is-earned" : undefined} key={index}>
              {index < 7 ? <MarketingIcon name="check" size={9} /> : null}
            </span>
          ))}
        </div>
      </div>
      <div className="mkt-wallet-reward">
        <span><small>PRÓXIMO PREMIO</small><strong>Bebida de cortesía</strong></span>
        <MarketingIcon name="gift" size={19} />
      </div>
    </div>
  );
}

function DashboardPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`mkt-dashboard${compact ? " is-compact" : ""}`} role="img" aria-label="Vista del panel de morrow con clientes, visitas y recompensas">
      <aside>
        <div className="mkt-dashboard-brand"><span>m</span> morrow</div>
        <p>ESPACIO DE TRABAJO</p>
        <ul>
          <li className="is-active"><MarketingIcon name="chart" size={13} /> Resumen</li>
          <li><MarketingIcon name="users" size={13} /> Clientes</li>
          <li><MarketingIcon name="gift" size={13} /> Recompensas</li>
          <li><MarketingIcon name="store" size={13} /> Sucursales</li>
        </ul>
        <div className="mkt-dashboard-user"><span>AM</span><small>Andrea M.<br />Administradora</small></div>
      </aside>
      <div className="mkt-dashboard-main">
        <header><div><small>HOY</small><strong>Tu programa, de un vistazo</strong></div><span>+</span></header>
        <div className="mkt-metrics">
          <article><small>Clientes activos</small><strong>2,847</strong><em>+12.8%</em></article>
          <article><small>Visitas este mes</small><strong>8,429</strong><em>+8.4%</em></article>
          <article><small>Premios usados</small><strong>684</strong><em>+21.2%</em></article>
        </div>
        <div className="mkt-dashboard-panels">
          <article className="mkt-chart-panel">
            <div><strong>Actividad de clientes</strong><small>Últimos 30 días</small></div>
            <div className="mkt-chart" aria-hidden="true"><i /><i /><i /><span /></div>
            <footer><span>10 ago</span><span>20 ago</span><span>1 sep</span><span>9 sep</span></footer>
          </article>
          <article className="mkt-activity-panel">
            <strong>Actividad reciente</strong>
            <div><span><MarketingIcon name="gift" size={11} /></span><p><b>Premio canjeado</b><small>Hace un momento</small></p></div>
            <div><span><MarketingIcon name="users" size={11} /></span><p><b>Nuevo registro</b><small>Hace 4 minutos</small></p></div>
            <div><span><MarketingIcon name="check" size={11} /></span><p><b>Visita registrada</b><small>Hace 12 minutos</small></p></div>
          </article>
        </div>
      </div>
    </div>
  );
}

function PhonePreview() {
  return (
    <div className="mkt-phone-stage" role="img" aria-label="Tarjeta de lealtad de morrow dentro de la wallet de un teléfono">
      <div className="mkt-phone-orbit" aria-hidden="true" />
      <div className="mkt-phone">
        <div className="mkt-phone-screen">
          <span className="mkt-dynamic-island" />
          <div className="mkt-phone-status"><b>9:41</b><span>● ◒ ▰</span></div>
          <div className="mkt-phone-header"><span>‹</span><strong>Wallet</strong><span>•••</span></div>
          <WalletCard />
          <div className="mkt-phone-action"><MarketingIcon name="wallet" size={15} /> Detalles de la tarjeta</div>
          <span className="mkt-home-indicator" />
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const demoRequestHref = process.env.NEXT_PUBLIC_DEMO_REQUEST_URL?.trim() || "#demo-contacto";
  let context = null;
  try {
    context = await getStaffSessionContext();
  } catch {
    context = null;
  }

  if (context?.access.staffStatus === "PASSWORD_RESET_REQUIRED") redirect("/change-password");
  if (context?.access.staffStatus === "ACTIVE") redirect(getDefaultInternalRoute(context.access.role));

  return (
    <main className="landing-page mkt-page">
      <LandingMotion />
      <header className="mkt-header">
        <div className="mkt-container mkt-header-inner">
          <MorrowBrand />
          <nav className="mkt-nav" aria-label="Navegación principal">
            <a href="#producto">Producto</a>
            <a href="#beneficios">Beneficios</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <div className="mkt-header-actions">
            <Link href="/login">Iniciar sesión</Link>
            <a className="mkt-button mkt-button-dark" href={demoRequestHref}>Solicitar una demo <MarketingIcon name="arrow" size={15} /></a>
          </div>
        </div>
      </header>

      <section className="mkt-hero" aria-labelledby="landing-title">
        <div className="mkt-container mkt-hero-grid">
          <div className="mkt-hero-copy">
            <p className="mkt-pill"><span /> Fidelidad digital para negocios locales</p>
            <h1 id="landing-title">Haz que cada visita se convierta en <em>crecimiento.</em></h1>
            <p>morrow reúne clientes, recompensas y tarjetas digitales en una plataforma clara, para que tu negocio pueda construir relaciones que duran.</p>
            <div className="mkt-hero-actions">
              <a className="mkt-button mkt-button-dark" href={demoRequestHref}>Solicitar una demo <MarketingIcon name="arrow" size={15} /></a>
              <a className="mkt-text-link" href="#como-funciona">Ver cómo funciona <MarketingIcon name="arrow" size={15} /></a>
            </div>
            <small className="mkt-trust-note"><MarketingIcon name="shield" size={15} /> Sin tarjeta de crédito. Primero entendemos cómo funciona tu negocio.</small>
          </div>
          <div className="mkt-hero-visual" aria-hidden="true">
            <div className="mkt-grid-field" />
            <div className="mkt-orbit is-one" />
            <div className="mkt-orbit is-two" />
            <DashboardPreview />
            <div className="mkt-floating-wallet"><WalletCard compact /></div>
            <div className="mkt-floating-note"><span><MarketingIcon name="gift" size={13} /></span><p><strong>Premio desbloqueado</strong><small>Bebida de cortesía · Ana M.</small></p></div>
          </div>
        </div>
      </section>

      <section className="mkt-business-strip" aria-label="Negocios que pueden usar morrow">
        <div className="mkt-container"><p>HECHO PARA NEGOCIOS A LOS QUE LA GENTE QUIERE VOLVER</p><ul><li><MarketingIcon name="store" size={16} /> CAFÉS</li><li>RESTAURANTES</li><li>RETAIL</li><li>ESTÉTICAS</li><li>SERVICIOS</li></ul></div>
      </section>

      <section className="mkt-section" id="beneficios" aria-labelledby="benefits-title">
        <div className="mkt-container">
          <div className="mkt-section-heading" data-landing-reveal="up"><p className="mkt-eyebrow">UNA MEJOR FORMA DE CREAR LEALTAD</p><h2 id="benefits-title">Simple para tu equipo.<br /><em>Valioso</em> para tus clientes.</h2></div>
          <div className="mkt-benefit-grid">
            {benefits.map((benefit, index) => <article key={benefit.title} data-landing-reveal="up" data-reveal-delay={`${index + 1}`}><span><MarketingIcon name={benefit.icon} size={21} /></span><h3>{benefit.title}</h3><p>{benefit.description}</p><a href="#producto">Conocer más <MarketingIcon name="arrow" size={14} /></a></article>)}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-product-section" id="producto" aria-labelledby="product-title">
        <div className="mkt-container mkt-product-grid">
          <div className="mkt-product-copy" data-landing-reveal="left">
            <p className="mkt-eyebrow">TODO EN UN SOLO LUGAR</p>
            <h2 id="product-title">Conoce a tus clientes. <em>Crece</em> con intención.</h2>
            <p>Desde la primera visita hasta el premio número diez, morrow te muestra qué está pasando sin convertirte en especialista en datos.</p>
            <ul>
              <li><MarketingIcon name="users" /><span><strong>Clientes organizados</strong><small>Consulta el historial y el avance de cada persona.</small></span></li>
              <li><MarketingIcon name="chart" /><span><strong>Resultados comprensibles</strong><small>Ve visitas, compras y recompensas sin hojas de cálculo.</small></span></li>
              <li><MarketingIcon name="wallet" /><span><strong>Tarjetas digitales</strong><small>Permanece cerca del cliente en la wallet que ya usa.</small></span></li>
            </ul>
          </div>
          <div className="mkt-dashboard-wrap" data-landing-reveal="right"><DashboardPreview compact /></div>
        </div>
      </section>

      <section className="mkt-phone-section" aria-labelledby="phone-title">
        <div className="mkt-container mkt-phone-grid">
          <div className="mkt-phone-copy" data-landing-reveal="left">
            <p className="mkt-eyebrow">UNA EXPERIENCIA MÁS CERCANA</p>
            <h2 id="phone-title">Lealtad que se siente <em>personal.</em></h2>
            <p>Tu cliente abre su tarjeta, ve cuánto ha avanzado y descubre su próximo premio. Sin buscar una tarjeta de papel ni recordar otra contraseña.</p>
            <ul><li><MarketingIcon name="check" size={14} /> Siempre en su teléfono</li><li><MarketingIcon name="check" size={14} /> Lista para visitas rápidas</li><li><MarketingIcon name="check" size={14} /> Con la identidad de tu negocio</li></ul>
          </div>
          <div data-landing-reveal="right" data-reveal-delay="1"><PhonePreview /></div>
        </div>
      </section>

      <section className="mkt-section mkt-process" id="como-funciona" aria-labelledby="how-title">
        <div className="mkt-container">
          <div className="mkt-section-heading is-centered" data-landing-reveal="up"><p className="mkt-eyebrow">CÓMO FUNCIONA</p><h2 id="how-title">Menos configuración. <em>Más movimiento.</em></h2><p>Tres pasos fáciles de entender para tu negocio y para tus clientes.</p></div>
          <ol>
            <li data-landing-reveal="up"><span>01</span><div><h3>Define tu programa</h3><p>Elige si quieres premiar visitas, compras o puntos, y establece recompensas claras.</p></div><MarketingIcon name="arrow" size={17} /></li>
            <li data-landing-reveal="up" data-reveal-delay="1"><span>02</span><div><h3>Invita a tus clientes</h3><p>Se registran con un QR y guardan su tarjeta. No crean una cuenta ni descargan una app.</p></div><MarketingIcon name="arrow" size={17} /></li>
            <li data-landing-reveal="up" data-reveal-delay="2"><span>03</span><div><h3>Reconoce cada visita</h3><p>Tu equipo escanea, registra y confirma. morrow calcula el avance automáticamente.</p></div></li>
          </ol>
        </div>
      </section>

      <section className="mkt-wallet-section" aria-labelledby="wallet-title">
        <div className="mkt-container mkt-wallet-grid">
          <div data-landing-reveal="left"><p className="mkt-eyebrow">SIEMPRE A LA MANO</p><h2 id="wallet-title">Tu programa de lealtad,<br /><em>en su wallet.</em></h2><p>Dales una tarjeta que realmente van a usar. morrow permite emitir, actualizar y personalizar pases sin complicar la experiencia.</p><ul><li><MarketingIcon name="check" size={14} /> Apple Wallet</li><li><MarketingIcon name="check" size={14} /> Google Wallet</li><li><MarketingIcon name="check" size={14} /> Tarjeta web</li></ul><a className="mkt-button mkt-button-light" href={demoRequestHref}>Verlo en una demo <MarketingIcon name="arrow" size={15} /></a></div>
          <div className="mkt-wallet-stage" data-landing-reveal="right"><span aria-hidden="true" /><WalletCard /></div>
        </div>
      </section>

      <section className="mkt-section mkt-faq" id="preguntas" aria-labelledby="questions-title">
        <div className="mkt-container mkt-faq-grid">
          <div data-landing-reveal="left"><p className="mkt-eyebrow">PREGUNTAS FRECUENTES</p><h2 id="questions-title">Las buenas preguntas merecen <em>respuestas claras.</em></h2><p>En la demo también podemos revisar cualquier caso particular de tu operación.</p></div>
          <div className="mkt-faq-list" data-landing-reveal="right">
            {questions.map((item, index) => <details key={item.question} open={index === 0}><summary>{item.question}<span aria-hidden="true">⌄</span></summary><p>{item.answer}</p></details>)}
          </div>
        </div>
      </section>

      <section className="mkt-demo" id="solicitar-demo" aria-labelledby="demo-title">
        <div className="mkt-container" data-landing-reveal="up"><p className="mkt-eyebrow">CUANDO ESTÉS LISTO</p><h2 id="demo-title">Crea una experiencia de lealtad<br />que tus clientes <em>sí quieran usar.</em></h2><p>Te mostramos el flujo completo con ejemplos cercanos a tu negocio. No necesitas elegir un plan ni realizar un pago.</p><a className="mkt-button mkt-button-dark" href={demoRequestHref}>Solicitar una demo <MarketingIcon name="arrow" size={15} /></a><small id="demo-contacto">El canal para agendar se habilitará antes de publicar esta página.</small></div>
      </section>

      <footer className="mkt-footer">
        <div className="mkt-container"><div><MorrowBrand /><p>Lealtad digital para negocios locales.</p></div><nav aria-label="Navegación del pie"><a href="#producto">Producto</a><a href="#beneficios">Beneficios</a><a href="#como-funciona">Cómo funciona</a><a href="#preguntas">Preguntas</a></nav><p>© 2026 morrow</p></div>
      </footer>
    </main>
  );
}
