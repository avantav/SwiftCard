'use client'

import { useState } from 'react'
import { ArrowRight, Check, ChevronDown, HelpCircle } from 'lucide-react'

const plans = [
  {
    name: 'Starter',
    description: 'The essentials to start building loyalty.',
    monthly: 49,
    annual: 39,
    featured: false,
    features: ['Up to 500 members', 'Digital loyalty cards', 'Basic rewards', 'Email support'],
  },
  {
    name: 'Growth',
    description: 'Everything you need to turn visits into habits.',
    monthly: 129,
    annual: 99,
    featured: true,
    features: ['Up to 2,500 members', 'Apple & Google Wallet passes', 'Advanced rewards and campaigns', 'Customer insights and analytics', 'Priority support'],
  },
  {
    name: 'Scale',
    description: 'A more thoughtful loyalty engine for growing teams.',
    monthly: 299,
    annual: 249,
    featured: false,
    features: ['Unlimited members', 'Multiple locations', 'Custom branded experiences', 'API access and integrations', 'Dedicated success manager'],
  },
]

const faqs = [
  ['Can I change plans later?', 'Yes. You can upgrade or downgrade your plan whenever your business changes.'],
  ['Is there a setup fee?', 'No. Every plan includes onboarding guidance with no setup fee.'],
  ['Do wallet passes cost extra?', 'Apple Wallet and Google Wallet passes are included in the Growth and Scale plans.'],
  ['Can I try Morrow before committing?', 'Absolutely. Book a demo and we will help you find the right plan for your business.'],
]

function Logo() {
  return <a href="/" className="flex items-center gap-2 font-semibold tracking-[-0.03em]"><span className="logo-mark">m</span><span className="text-[19px]">morrow</span></a>
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(true)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return <main className="pricing-page">
    <header className="site-header"><div className="container flex items-center justify-between"><Logo /><nav className="hidden items-center gap-8 md:flex"><a className="nav-link" href="/#product">Product</a><a className="nav-link" href="/#solutions">Solutions</a><a className="nav-link" href="/#how-it-works">Resources</a><a className="nav-link" href="/pricing">Pricing</a><a className="nav-link" href="/components">Componentes</a></nav><div className="hidden items-center gap-5 md:flex"><a className="nav-link" href="/#login">Log in</a><a className="button button-dark" href="/#demo">Book a demo <ArrowRight size={15} /></a></div><a className="button button-dark md:hidden" href="/#demo">Demo <ArrowRight size={14} /></a></div></header>

    <section className="pricing-hero"><div className="container"><p className="eyebrow">Simple, transparent pricing</p><h1>Choose the plan that keeps<br /><span className="serif-accent">customers coming back.</span></h1><p className="pricing-intro">Start with the essentials, then grow into a loyalty program that feels like your own.</p><div className="billing-toggle" role="group" aria-label="Billing frequency"><button className={!annual ? 'selected' : ''} onClick={() => setAnnual(false)}>Monthly</button><button className={annual ? 'selected' : ''} onClick={() => setAnnual(true)}>Yearly <span>Save 20%</span></button></div></div></section>

    <section className="pricing-cards"><div className="container pricing-grid">{plans.map(plan => <article className={`price-card ${plan.featured ? 'featured' : ''}`} key={plan.name}>{plan.featured && <div className="popular-label">Most popular</div>}<div className="price-card-top"><p className="eyebrow">{plan.name}</p><h2>{plan.description}</h2><div className="price"><span>$</span><strong>{annual ? plan.annual : plan.monthly}</strong><small>/ month</small></div><p className="price-note">Billed {annual ? 'annually' : 'monthly'}</p><a className={`button ${plan.featured ? 'button-dark' : 'button-outline'}`} href="/#demo">{plan.featured ? 'Get started' : 'Choose plan'} <ArrowRight size={15} /></a></div><div className="price-divider" /><div className="feature-stack"><p className="feature-label">Includes</p>{plan.features.map(feature => <div className="price-feature" key={feature}><Check size={15} /><span>{feature}</span></div>)}</div></article>)}</div></section>

    <section className="pricing-note"><div className="container pricing-note-inner"><div><p className="eyebrow">For larger teams</p><h2>Need something more tailored?</h2></div><a className="text-link" href="mailto:sales@morrow.example">Talk to our team <ArrowRight size={15} /></a></div></section>

    <section className="faq-section"><div className="container faq-grid"><div><p className="eyebrow">Frequently asked</p><h2>Good questions<br /><span className="serif-accent">deserve clear answers.</span></h2><p className="body-copy">Still deciding? We are happy to help you find a plan that fits the way you work.</p></div><div className="faq-list">{faqs.map(([question, answer], index) => <div className="faq-item" key={question}><button onClick={() => setOpenFaq(openFaq === index ? null : index)} aria-expanded={openFaq === index}><span>{question}</span><ChevronDown size={17} className={openFaq === index ? 'rotate-180' : ''} /></button>{openFaq === index && <p>{answer}</p>}</div>)}</div></div></section>

    <section className="cta-section"><div className="container cta-inner"><p className="eyebrow">Start with Morrow</p><h2>Make every visit<br /><span className="serif-accent">mean more.</span></h2><div className="hero-actions justify-center"><a className="button button-dark" href="mailto:hello@morrow.example">Book a demo <ArrowRight size={15} /></a><a className="text-link" href="/#product">Explore the product <ArrowRight size={15} /></a></div></div></section>

    <footer className="site-footer"><div className="container flex flex-col gap-8 md:flex-row md:items-center md:justify-between"><div><Logo /><p className="mt-3 text-xs text-muted-foreground">Modern loyalty for local business.</p></div><div className="footer-links"><a href="/#product">Product</a><a href="/#solutions">Features</a><a href="/pricing">Pricing</a><a href="mailto:hello@morrow.example">Contact</a><a href="#privacy">Privacy</a><a href="#terms">Terms</a></div><p className="text-xs text-muted-foreground">© 2026 Morrow</p></div></footer>
  </main>
}
