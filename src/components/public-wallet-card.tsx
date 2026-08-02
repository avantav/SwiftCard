/* Tenant logos use validated remote HTTPS URLs that cannot be allowlisted by hostname. */
/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";

export type PublicCard = {
  tenant_name: string;
  branding_mode: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  customer_name: string;
  program_name: string | null;
  stamp_balance: number;
  reward_goal: number | null;
  available_rewards: Array<{ name: string; description: string; expires_at: string | null }>;
};

export function PublicWalletCard({ card }: { card: PublicCard }) {
  const progress = card.reward_goal ? Math.min(100, Math.max(0, (card.stamp_balance / card.reward_goal) * 100)) : 0;
  const brandStyle = { "--card-primary": card.primary_color, "--card-secondary": card.secondary_color } as CSSProperties;
  return <main className="wallet-shell" style={brandStyle}>
    <section className="wallet-card" aria-labelledby="card-title">
      <header className="wallet-card-header"><div>{card.logo_url ? <img className="wallet-logo" src={card.logo_url} alt={`Logo de ${card.tenant_name}`} /> : <span className="wallet-tenant-mark" aria-hidden="true">{card.tenant_name.slice(0, 2).toUpperCase()}</span>}</div><span className="wallet-card-label">Tarjeta digital</span></header>
      <div className="wallet-card-body"><p>{card.program_name ?? "Programa de fidelidad"}</p><h1 id="card-title">{card.customer_name}</h1>
        {card.reward_goal ? <section className="wallet-progress" aria-label={`${card.stamp_balance} de ${card.reward_goal} sellos`}><div><span>Progreso</span><strong>{card.stamp_balance} / {card.reward_goal} sellos</strong></div><div className="wallet-progress-track"><span style={{ width: `${progress}%` }} /></div></section> : null}
        <div className="wallet-qr" aria-label="QR de la tarjeta"><div>QR</div><p>Presenta este código al personal</p></div>
      </div>
    </section>
    <section className="wallet-rewards" aria-labelledby="rewards-title"><div><p className="public-eyebrow">Beneficios</p><h2 id="rewards-title">Recompensas disponibles</h2></div>
      {card.available_rewards.length ? <ul>{card.available_rewards.map((reward) => <li key={`${reward.name}-${reward.expires_at ?? "never"}`}><span aria-hidden="true">✓</span><div><strong>{reward.name}</strong><p>{reward.description}</p>{reward.expires_at ? <small>Disponible hasta {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(reward.expires_at))}</small> : <small>Sin expiración</small>}</div></li>)}</ul> : <p className="wallet-no-rewards">Sigue acumulando sellos para desbloquear tu próxima recompensa.</p>}
    </section>
    <p className="wallet-help">Esta tarjeta es válida en las sucursales participantes de {card.tenant_name}.</p>
    {card.branding_mode !== "WHITE_LABEL" ? <p className="wallet-powered">Powered by SwiftWallet</p> : null}
  </main>;
}
