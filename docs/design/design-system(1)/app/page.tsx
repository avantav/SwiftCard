'use client'

import { useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CreditCard,
  ChevronLeft,
  Gift,
  Info,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  QrCode,
  Send,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  WalletCards,
  X,
} from 'lucide-react'

const navItems = ['Product', 'Solutions', 'Resources', 'Pricing', 'Componentes']
const benefits = [
  ['Increase repeat visits', 'Give customers a reason to choose you again and again.', '↗'],
  ['Reward loyal customers', 'Turn everyday transactions into lasting relationships.', '✦'],
  ['Launch offers easily', 'Create thoughtful campaigns without the busywork.', '⌁'],
]
const steps = [
  ['Create your program', 'Set the rules, rewards and look of your loyalty experience.'],
  ['Invite your customers', 'Issue a digital card in seconds, straight to their wallet.'],
  ['Grow with every visit', 'Track what works and turn insights into action.'],
]

function Logo() {
  return <div className="flex items-center gap-2 font-semibold tracking-[-0.03em]"><span className="logo-mark">m</span><span className="text-[19px]">morrow</span></div>
}

function DashboardPreview() {
  const [active, setActive] = useState('Overview')
  const tabs = ['Overview', 'Customers', 'Rewards', 'Campaigns']
  return (
    <div className="dashboard-shell animate-float">
      <aside className="dashboard-sidebar">
        <div className="mb-8 flex items-center gap-2 text-[13px] font-semibold"><span className="logo-mark small">m</span> morrow</div>
        <p className="eyebrow mb-3">Workspace</p>
        <nav className="flex flex-col gap-1">
          {tabs.map((tab, index) => <button key={tab} onClick={() => setActive(tab)} className={`dash-nav ${active === tab ? 'active' : ''}`}><span>{[LayoutDashboard, Users, Gift, Send][index] && (() => { const I = [LayoutDashboard, Users, Gift, Send][index]; return <I size={14} /> })()}</span>{tab}</button>)}
        </nav>
        <div className="mt-auto flex flex-col gap-1"><button className="dash-nav"><Settings2 size={14} />Settings</button><div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-[11px]"><span className="avatar">GN</span><span>Gonzalo N.</span><MoreHorizontal size={14} className="ml-auto opacity-60" /></div></div>
      </aside>
      <section className="dashboard-main">
        <div className="flex items-center justify-between"><div><p className="eyebrow">Tuesday, September 9, 2026</p><h3 className="mt-1 text-[17px] font-semibold tracking-[-0.03em]">Good morning, Gonzalo</h3></div><button className="icon-button"><Plus size={15} /></button></div>
        <div className="mt-6 grid grid-cols-3 gap-2"><div className="metric-card"><span>Active members</span><strong>2,847</strong><em>+12.8%</em></div><div className="metric-card"><span>Visits this month</span><strong>8,429</strong><em>+8.4%</em></div><div className="metric-card"><span>Rewards claimed</span><strong>684</strong><em>+21.2%</em></div></div>
        <div className="mt-3 grid grid-cols-[1.35fr_1fr] gap-3"><div className="panel"><div className="flex items-center justify-between"><div><p className="eyebrow">Member activity</p><p className="mt-1 text-xs text-muted-foreground">Visits over the last 30 days</p></div><span className="select-pill">30 days <ChevronDown size={12} /></span></div><div className="chart mt-7"><div className="chart-line one" /><div className="chart-line two" /><div className="chart-line three" /><div className="chart-area" /></div><div className="mt-2 flex justify-between text-[9px] text-muted-foreground"><span>Aug 10</span><span>Aug 20</span><span>Sep 1</span><span>Sep 9</span></div></div><div className="panel"><div className="flex items-center justify-between"><p className="eyebrow">Recent activity</p><ArrowRight size={13} /></div><div className="mt-4 flex flex-col gap-4">{[['Gonzalo N.', 'Redeemed Free Drink', 'Just now', 'bg-teal'], ['Maya R.', 'Joined the Coffee Club', '4 min ago', 'bg-blue'], ['Sam T.', 'Earned a new stamp', '12 min ago', 'bg-sand']].map(([name, event, time, color]) => <div className="flex items-center gap-2.5" key={name}><span className={`activity-dot ${color}`}><Users size={11} /></span><div className="min-w-0"><p className="truncate text-[10px] font-medium">{name}</p><p className="truncate text-[9px] text-muted-foreground">{event}</p></div><span className="ml-auto whitespace-nowrap text-[9px] text-muted-foreground">{time}</span></div>)}</div></div></div>
      </section>
    </div>
  )
}

function IphoneMockup() {
  return <div className="iphone-stage" aria-label="Apple Wallet loyalty pass preview on iPhone">
    <div className="iphone-frame"><div className="iphone-screen wallet-screen"><div className="dynamic-island" /><div className="iphone-status"><span>9:41</span><span>● ◒ ▰</span></div><div className="wallet-screen-header"><ChevronLeft size={18} /><strong>Wallet</strong><MoreHorizontal size={18} /></div><div className="apple-pass"><div className="pass-brand"><span className="pass-logo">N</span><span><strong>NORTE COFFEE</strong><small>LOYALTY CARD</small></span><QrCode size={30} /></div><div className="pass-content"><span className="pass-label">CARDHOLDER</span><strong>GONZALO N.</strong><div className="pass-stamps"><div className="stamp-row">{Array.from({ length: 10 }).map((_, i) => <span className={`wallet-stamp ${i < 7 ? 'filled' : ''}`} key={i}>{i < 7 ? <Check size={9} /> : ''}</span>)}</div><small>7 of 10 visits</small></div></div><div className="pass-reward"><span>Next reward</span><strong>Free drink</strong><Gift size={18} /></div><div className="pass-barcode"><div className="barcode-lines" /><span>HOLD NEAR READER</span></div><div className="pass-footer"><span>norte.coffee</span><span>Expires Sep 2027</span></div></div><div className="wallet-actions"><span><Info size={15} />Pass Details</span><Share2 size={15} /></div><div className="wallet-home-indicator" /></div></div></div>
}

function CoffeeIcon() { return <span className="coffee-glyph">✦</span> }

function WalletCard() { return <div className="wallet-card animate-wallet"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[0.18em]">MORROW</p><p className="mt-1 text-[9px] opacity-65">NORTE COFFEE CLUB</p></div><QrCode size={26} strokeWidth={1.2} /></div><div className="mt-14"><p className="text-[10px] opacity-65">GONZALO</p><p className="mt-1 text-[14px] font-medium">7 / 10 visits</p><div className="mt-3 flex gap-1">{Array.from({ length: 10 }).map((_, i) => <span className={`stamp ${i < 7 ? 'filled' : ''}`} key={i} />)}</div><p className="mt-4 text-[9px] opacity-65">NEXT REWARD: <span className="font-semibold opacity-100">FREE DRINK</span></p></div></div> }

export default function Page() {
  const [menuOpen, setMenuOpen] = useState(false)
  return <main>
    <header className="site-header"><div className="container flex items-center justify-between"><Logo /><nav className="hidden items-center gap-8 md:flex">{navItems.map((item, i) => <a href={item === 'Pricing' ? '/pricing' : item === 'Componentes' ? '/components' : `#${item.toLowerCase()}`} key={item} className="nav-link">{item}{i < 3 && <ChevronDown size={13} />}</a>)}</nav><div className="hidden items-center gap-5 md:flex"><a className="nav-link" href="#login">Log in</a><a className="button button-dark" href="#demo">Book a demo <ArrowRight size={15} /></a></div><button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button></div>{menuOpen && <div className="mobile-nav">{navItems.map(item => <a href={item === 'Pricing' ? '/pricing' : item === 'Componentes' ? '/components' : `#${item.toLowerCase()}`} key={item} onClick={() => setMenuOpen(false)}>{item}</a>)}<a href="#demo" className="button button-dark" onClick={() => setMenuOpen(false)}>Book a demo</a></div>}</header>
    <section className="hero"><div className="container hero-grid"><div className="hero-copy"><div className="pill"><span className="pill-dot" /> The loyalty platform for local business</div><h1>Turn repeat visits into <span className="serif-accent">measurable growth.</span></h1><p>Morrow helps businesses manage customers, rewards, loyalty cards and wallet passes in one clean platform.</p><div className="hero-actions"><a className="button button-dark" href="#demo">Book a demo <ArrowRight size={15} /></a><a className="text-link" href="#how-it-works">See how it works <ArrowRight size={15} /></a></div><div className="hero-note"><ShieldCheck size={15} /> Built for businesses that care about every customer</div></div><div className="hero-visual"><div className="visual-grid" /><div className="hero-orbit orbit-a" /><div className="hero-orbit orbit-b" /><DashboardPreview /><div className="floating-wallet"><WalletCard /></div><div className="floating-note"><span className="note-icon"><Sparkles size={13} /></span><span><strong>Reward unlocked</strong><small>Free drink · Gonzalo N.</small></span></div></div></div></section>
    <section className="trust-strip"><div className="container flex flex-col items-start justify-between gap-5 md:flex-row md:items-center"><p className="eyebrow">Built for the businesses people come back to</p><div className="trust-types"><span><Store size={16} /> CAFÉS</span><span>RESTAURANTS</span><span>RETAIL</span><span>SALONS</span><span>SERVICES</span></div></div></section>
    <section className="section" id="solutions"><div className="container"><div className="section-heading"><p className="eyebrow">A better way to build loyalty</p><h2>Simple for your team.<br /><span className="serif-accent">Meaningful</span> for your customers.</h2></div><div className="benefit-grid">{benefits.map(([title, text, icon]) => <article className="benefit" key={title}><div className="benefit-icon">{icon}</div><h3>{title}</h3><p>{text}</p><a href="#features">Learn more <ArrowRight size={14} /></a></article>)}</div></div></section>
    <section className="section feature-section" id="product"><div className="container feature-grid"><div className="feature-copy"><p className="eyebrow">Everything in one place</p><h2>Know your customers.<br /><span className="serif-accent">Grow</span> with intention.</h2><p className="body-copy">From the first visit to the tenth reward, Morrow gives you the tools and clarity to build relationships that last.</p><div className="feature-list"><div><Users size={18} /><span><strong>Customer management</strong><small>Understand every member, at a glance.</small></span></div><div><BarChart3 size={18} /><span><strong>Actionable analytics</strong><small>See what is driving retention and revenue.</small></span></div><div><CreditCard size={18} /><span><strong>Digital wallet passes</strong><small>Stay close to customers, wherever they are.</small></span></div></div></div><div className="app-card-wrap"><DashboardPreview /></div></div></section>
    <section className="iphone-section"><div className="container iphone-grid"><div className="iphone-copy"><p className="eyebrow">A better customer experience</p><h2>Loyalty that feels <span className="serif-accent">personal.</span></h2><p className="body-copy">Give every customer a simple, beautiful way to see their progress, discover rewards and keep coming back.</p><div className="iphone-points"><span><Check size={14} /> Always in their pocket</span><span><Check size={14} /> Designed for quick visits</span><span><Check size={14} /> Branded to your business</span></div><a href="#demo" className="text-link">See the customer experience <ArrowRight size={15} /></a></div><IphoneMockup /></div></section>
    <section className="section process-section" id="how-it-works"><div className="container"><div className="section-heading center"><p className="eyebrow">How it works</p><h2>Less setup. <span className="serif-accent">More momentum.</span></h2></div><div className="steps">{steps.map(([title, text], i) => <div className="step" key={title}><span className="step-number">0{i + 1}</span><div><h3>{title}</h3><p>{text}</p></div>{i < 2 && <ArrowRight className="step-arrow" size={17} />}</div>)}</div></div></section>
    <section className="wallet-section"><div className="container wallet-grid"><div><p className="eyebrow light">Always within reach</p><h2>Your loyalty program,<br /><span>in their wallet.</span></h2><p className="body-copy light-copy">Give customers a card they will actually use. Morrow makes Apple Wallet and Google Wallet passes effortless to issue, update and brand.</p><div className="wallet-checks"><span><Check size={14} /> Apple Wallet ready</span><span><Check size={14} /> Google Wallet ready</span></div><a href="#demo" className="button button-light">Explore wallet passes <ArrowRight size={15} /></a></div><div className="wallet-stage"><div className="wallet-shadow" /><WalletCard /></div></div></section>
    <section className="cta-section" id="demo"><div className="container cta-inner"><p className="eyebrow">Ready when you are</p><h2>Build a loyalty experience<br />your customers <span className="serif-accent">actually use.</span></h2><div className="hero-actions justify-center"><a className="button button-dark" href="mailto:hello@morrow.example">Book a demo <ArrowRight size={15} /></a><a className="text-link" href="mailto:sales@morrow.example">Talk to sales <ArrowRight size={15} /></a></div></div></section>
    <footer className="site-footer"><div className="container flex flex-col gap-8 md:flex-row md:items-center md:justify-between"><div><Logo /><p className="mt-3 text-xs text-muted-foreground">Modern loyalty for local business.</p></div><div className="footer-links"><a href="#product">Product</a><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="mailto:hello@morrow.example">Contact</a><a href="#privacy">Privacy</a><a href="#terms">Terms</a></div><p className="text-xs text-muted-foreground">© 2026 Morrow</p></div></footer>
  </main>
}
