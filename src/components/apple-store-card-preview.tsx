/* The preview renders only validated tenant-hosted HTTPS images. */
/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import {
  appleWalletStampLayout,
  appleWalletStampRows,
  appleWalletStampSlots,
} from "@/lib/wallet/apple-stamp-layout";
import { appleWalletProgressText } from "@/lib/wallet/apple-card-content";

export type AppleStoreCardPreviewDesign = {
  logoText: string;
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
  logoImageUrl: string;
  stripImageUrl: string;
};

type AppleStoreCardPreviewProps = {
  design: AppleStoreCardPreviewDesign;
  tenantName: string;
  programName: string;
  programType: "STAMPS_PER_PURCHASE" | "STAMPS_PER_AMOUNT" | "LIFETIME_POINTS";
  rewardGoal: number | null;
  unitNameSingular: string;
  unitNamePlural: string;
};

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "SW";
}

export function AppleStoreCardPreview({
  design,
  tenantName,
  programName,
  programType,
  rewardGoal,
  unitNameSingular,
  unitNamePlural,
}: AppleStoreCardPreviewProps) {
  const exampleBalance = rewardGoal
    ? Math.min(rewardGoal, Math.max(1, Math.floor(rewardGoal * 0.4)))
    : 0;
  const progress = appleWalletStampSlots(exampleBalance, rewardGoal);
  const layout = appleWalletStampLayout(progress.visible);
  const progressText = appleWalletProgressText({
    balance: exampleBalance,
    goal: rewardGoal,
    unitNameSingular,
    unitNamePlural,
  });
  const style = {
    "--apple-pass-background": design.backgroundColor,
    "--apple-pass-foreground": design.foregroundColor,
    "--apple-pass-label": design.labelColor,
    "--apple-pass-stamp-diameter": `${layout.diameter}px`,
    "--apple-pass-stamp-gap": `${layout.gap}px`,
  } as CSSProperties;
  const tenantInitials = initials(tenantName);
  const lifetimePoints = programType === "LIFETIME_POINTS";

  return (
    <div className="apple-pass-preview" style={style}>
      <header>
        <div className="apple-pass-preview-identity">
          {design.logoImageUrl ? (
            <img alt="Logo configurado" src={design.logoImageUrl} />
          ) : (
            <span className="apple-pass-preview-mark" aria-hidden="true">
              {tenantInitials}
            </span>
          )}
          <strong>{design.logoText || tenantName}</strong>
        </div>
        <p className="apple-pass-preview-header-field">
          <span>PREMIOS</span>
          <strong>1</strong>
        </p>
      </header>

      <div
        className={`apple-pass-preview-primary${design.stripImageUrl || progress.visible ? " has-strip" : ""}`}
      >
        {design.stripImageUrl ? (
          <img
            alt="Imagen principal configurada"
            className="apple-pass-preview-strip"
            src={design.stripImageUrl}
          />
        ) : null}
        {lifetimePoints ? (
          <div className="apple-pass-preview-points">
            <span>{unitNamePlural.toLocaleUpperCase("es-MX")}</span>
            <strong>{exampleBalance}</strong>
            <div aria-hidden="true"><i style={{ width: `${Math.round((exampleBalance / Math.max(progress.goal, 1)) * 100)}%` }} /></div>
            <small>Próximo premio al llegar a {progress.goal}</small>
          </div>
        ) : progress.visible ? (
          <div
            aria-label={`${exampleBalance} de ${progress.goal} ${unitNamePlural}`}
            className="apple-pass-preview-stamps"
            role="img"
          >
            {appleWalletStampRows(progress.visible, layout.columns).map((row, rowIndex) => (
              <span
                className="apple-pass-preview-stamp-row"
                key={rowIndex}
                style={{ "--apple-pass-stamp-row-columns": row.length } as CSSProperties}
              >
                {row.map((index) => (
                  <span className={index < progress.filled ? "is-filled" : ""} key={index}>
                    {index < progress.filled ? (
                      design.logoImageUrl ? (
                        <img alt="" src={design.logoImageUrl} />
                      ) : (
                        <small>{tenantInitials}</small>
                      )
                    ) : null}
                  </span>
                ))}
              </span>
            ))}
          </div>
        ) : (
          <p className="apple-pass-preview-program-name">{programName}</p>
        )}
      </div>

      <div className="apple-pass-preview-content">
        <div className="apple-pass-preview-supporting-fields">
          <p>
            <span>CLIENTE</span>
            <strong>Cliente ejemplo</strong>
          </p>
          <p>
            <span>PROGRESO</span>
            <strong>{lifetimePoints ? `${exampleBalance} ${unitNamePlural} acumulados` : progressText}</strong>
          </p>
        </div>
        <figure className="apple-pass-preview-code">
          <img alt="" src="/icons/wallet-preview-qr.svg" />
          <figcaption>Tarjeta de {tenantName}</figcaption>
        </figure>
      </div>
    </div>
  );
}
