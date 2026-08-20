/* Tenant logos use validated remote HTTPS URLs that cannot be allowlisted by hostname. */
/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";

const MAX_VISIBLE_STAMPS = 24;

export type PublicCard = {
  tenant_name: string;
  branding_mode: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  customer_name: string;
  program_name: string | null;
  program_status: "ACTIVE" | "PAUSED" | null;
  stamp_balance: number;
  reward_goal: number | null;
  terms_and_conditions: string | null;
  reward_tiers: Array<{
    stamps_required: number;
    name: string;
    description: string;
    expiration_days: number | null;
  }>;
  available_rewards: Array<{
    name: string;
    description: string;
    stamps_required: number | null;
    expires_at: string | null;
  }>;
};

export function PublicWalletCard({ card, cardToken, appleWalletAvailable = false, qrDataUrl }: { card: PublicCard; cardToken?: string; appleWalletAvailable?: boolean; qrDataUrl?: string | null }) {
  const rewardGoal = Math.max(0, Math.trunc(card.reward_goal ?? 0));
  const earnedStamps = Math.min(rewardGoal, Math.max(0, Math.trunc(card.stamp_balance)));
  const visibleStampCount = Math.min(rewardGoal, MAX_VISIBLE_STAMPS);
  const filledStampCount = rewardGoal <= MAX_VISIBLE_STAMPS
    ? earnedStamps
    : earnedStamps >= rewardGoal
      ? visibleStampCount
      : Math.floor((earnedStamps / rewardGoal) * visibleStampCount);
  const brandStyle = {
    "--card-primary": card.primary_color,
    "--card-secondary": card.secondary_color,
    "--stamp-columns": Math.min(5, visibleStampCount),
  } as CSSProperties;
  const tenantInitials = card.tenant_name.slice(0, 2).toUpperCase();
  return <main className="wallet-shell" style={brandStyle}>
    <section className="wallet-card" aria-labelledby="card-title">
      <header className="wallet-card-header"><div>{card.logo_url ? <img className="wallet-logo" src={card.logo_url} alt={`Logo de ${card.tenant_name}`} /> : <span className="wallet-tenant-mark" aria-hidden="true">{card.tenant_name.slice(0, 2).toUpperCase()}</span>}</div><span className="wallet-card-label">Tarjeta digital</span></header>
      <div className="wallet-card-body"><p>{card.program_name ?? "Programa de fidelidad"}</p><h1 id="card-title">{card.customer_name}</h1>
        {card.program_status === "PAUSED" ? <p className="wallet-program-status">Programa temporalmente pausado</p> : null}
        {rewardGoal > 0 ? <section className="wallet-progress" aria-labelledby="wallet-progress-title">
          <div className="wallet-progress-heading"><span id="wallet-progress-title">Tu tarjeta</span><strong>{earnedStamps >= rewardGoal ? "Tarjeta completa" : "Sigue acumulando"}</strong></div>
          <div className="wallet-stamp-grid" role="img" aria-label={`${earnedStamps} de ${rewardGoal} sellos acumulados`}>
            {Array.from({ length: visibleStampCount }, (_, index) => {
              const filled = index < filledStampCount;
              return <span className={`wallet-stamp${filled ? " is-filled" : ""}`} aria-hidden="true" key={index}>
                {filled ? card.logo_url
                  ? <img className="wallet-stamp-logo" src={card.logo_url} alt="" />
                  : <span className="wallet-stamp-initials">{tenantInitials}</span>
                  : null}
              </span>;
            })}
          </div>
        </section> : null}
        <div className="wallet-qr" aria-label="QR de la tarjeta">{qrDataUrl ? <div><img alt="Código QR para identificar esta tarjeta" height="172" src={qrDataUrl} width="172" /></div> : <div className="wallet-qr-unavailable" role="status">QR no disponible</div>}<p>{qrDataUrl ? "Presenta este código al personal" : "Solicita al personal que busque tu tarjeta por nombre o teléfono."}</p></div>
      </div>
    </section>
    {appleWalletAvailable && cardToken ? <section className="wallet-apple-action" aria-label="Apple Wallet"><a href={`/card/${encodeURIComponent(cardToken)}?claim=1`}>Agregar a Apple Wallet</a><p>Revisa y acepta los términos vigentes antes de agregar el pase.</p></section> : null}
    <section className="wallet-rewards wallet-tier-catalog" aria-labelledby="reward-tiers-title"><div><p className="public-eyebrow">Cómo ganar</p><h2 id="reward-tiers-title">Premios por número de sellos</h2></div>
      {card.reward_tiers.length ? <ol>{card.reward_tiers.map((tier) => <li key={`${tier.stamps_required}-${tier.name}`}><span>{tier.stamps_required}</span><div><strong>{tier.name}</strong><p>{tier.description}</p><small>{tier.stamps_required} {tier.stamps_required === 1 ? "sello" : "sellos"}{tier.expiration_days ? ` · Vigencia de ${tier.expiration_days} días al obtenerlo` : " · Sin expiración"}</small></div></li>)}</ol> : <p className="wallet-no-rewards">El negocio todavía no ha publicado su catálogo de premios.</p>}
    </section>
    <section className="wallet-rewards" aria-labelledby="rewards-title"><div><p className="public-eyebrow">Beneficios</p><h2 id="rewards-title">Recompensas disponibles</h2></div>
      {card.available_rewards.length ? <ul>{card.available_rewards.map((reward, index) => <li key={`${reward.name}-${reward.expires_at ?? "never"}-${index}`}><span aria-hidden="true">✓</span><div><strong>{reward.name}</strong><p>{reward.description}</p>{reward.expires_at ? <small>Disponible hasta {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(reward.expires_at))}</small> : <small>Sin expiración</small>}</div></li>)}</ul> : <p className="wallet-no-rewards">Sigue acumulando sellos para desbloquear tu próxima recompensa.</p>}
    </section>
    <section className="wallet-terms" aria-labelledby="wallet-terms-title"><p className="public-eyebrow">Información del programa</p><h2 id="wallet-terms-title">Términos y condiciones</h2><p>{card.terms_and_conditions ?? "Consulta los términos y condiciones vigentes con el negocio."}</p></section>
    <p className="wallet-help">Esta tarjeta es válida en las sucursales participantes de {card.tenant_name}.</p>
    {card.branding_mode !== "WHITE_LABEL" ? <p className="wallet-powered">Powered by SwiftWallet</p> : null}
  </main>;
}
