"use client";

/* The preview renders only validated tenant-hosted HTTPS images. */
/* eslint-disable @next/next/no-img-element */
import { useRef, type CSSProperties, type PointerEvent } from "react";
import {
  appleWalletStampLayout,
  appleWalletStampSlots,
} from "@/lib/wallet/apple-stamp-layout";
import {
  appleWalletPointProgressText,
  appleWalletProgressText,
} from "@/lib/wallet/apple-card-content";

export type AppleStoreCardPreviewDesign = {
  logoText: string;
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
  logoImageUrl: string;
  stripImageUrl: string;
  logoScalePercent: number;
  logoMarginXPercent: number;
  logoMarginYPercent: number;
  stripScalePercent: number;
  stripMarginXPercent: number;
  stripMarginYPercent: number;
  stripDimmingEnabled: boolean;
  stripStampsEnabled: boolean;
  stampIconUrl: string;
  stampEmptySlotsEnabled: boolean;
  stampRowCounts: number[];
  stampPositionXPercent: number;
  stampPositionYPercent: number;
};

type AppleStoreCardPreviewProps = {
  design: AppleStoreCardPreviewDesign;
  tenantName: string;
  programName: string;
  programType: "STAMPS_PER_PURCHASE" | "STAMPS_PER_AMOUNT" | "LIFETIME_POINTS";
  rewardGoal: number | null;
  unitNameSingular: string;
  unitNamePlural: string;
  onStampPositionChange?: (xPercent: number, yPercent: number) => void;
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
  onStampPositionChange,
}: AppleStoreCardPreviewProps) {
  const exampleBalance = rewardGoal
    ? Math.min(rewardGoal, Math.max(1, Math.floor(rewardGoal * 0.4)))
    : 0;
  const progress = appleWalletStampSlots(exampleBalance, rewardGoal);
  const layout = appleWalletStampLayout(progress.visible, design.stampRowCounts);
  let stampIndex = 0;
  const stampRows = layout.rows.map((count) => (
    Array.from({ length: count }, () => stampIndex++)
  ));
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
    "--apple-pass-logo-scale": design.logoScalePercent / 100,
    "--apple-pass-logo-margin-x": `${design.logoMarginXPercent}%`,
    "--apple-pass-logo-margin-y": `${design.logoMarginYPercent}%`,
    "--apple-pass-strip-scale": design.stripScalePercent / 100,
    "--apple-pass-strip-margin-x": `${design.stripMarginXPercent}%`,
    "--apple-pass-strip-margin-y": `${design.stripMarginYPercent}%`,
    "--apple-pass-stamp-position-x": `${design.stampPositionXPercent}%`,
    "--apple-pass-stamp-position-y": `${design.stampPositionYPercent}%`,
  } as CSSProperties;
  const tenantInitials = initials(tenantName);
  const lifetimePoints = programType === "LIFETIME_POINTS";
  const primaryRef = useRef<HTMLDivElement>(null);

  function moveStamps(event: PointerEvent<HTMLDivElement>) {
    if (!onStampPositionChange || !primaryRef.current) return;
    const bounds = primaryRef.current.getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100)));
    onStampPositionChange(x, y);
  }

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
          {design.logoText ? <strong>{design.logoText}</strong> : null}
        </div>
      </header>

      <div
        className={`apple-pass-preview-primary${design.stripImageUrl || progress.visible ? " has-strip" : ""}${onStampPositionChange && design.stripStampsEnabled ? " is-stamp-editable" : ""}`}
        ref={primaryRef}
      >
        {design.stripImageUrl ? (
          <img
            alt="Imagen principal configurada"
            className={`apple-pass-preview-strip${design.stripDimmingEnabled ? " is-dimmed" : ""}`}
            src={design.stripImageUrl}
          />
        ) : null}
        {onStampPositionChange && design.stripStampsEnabled ? (
          <span className="apple-pass-preview-placement-grid" aria-hidden="true">
            {Array.from({ length: 15 }, (_, index) => <i key={index} />)}
          </span>
        ) : null}
        {lifetimePoints ? (
          <div className="apple-pass-preview-points">
            <span>{unitNamePlural.toLocaleUpperCase("es-MX")}</span>
            <strong>{exampleBalance}</strong>
            <div aria-hidden="true"><i style={{ width: `${Math.round((exampleBalance / Math.max(progress.goal, 1)) * 100)}%` }} /></div>
            <small>Próximo premio al llegar a {progress.goal}</small>
          </div>
        ) : progress.visible ? (
          design.stripStampsEnabled ? (
            <div
              aria-label={`${exampleBalance} de ${progress.goal} ${unitNamePlural}`}
              className="apple-pass-preview-stamps"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                moveStamps(event);
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) moveStamps(event);
              }}
              role="img"
            >
              {stampRows.map((row, rowIndex) => (
                <span
                  className="apple-pass-preview-stamp-row"
                  key={rowIndex}
                  style={{ "--apple-pass-stamp-row-columns": row.length } as CSSProperties}
                >
                  {row.map((index) => (
                    <span className={`${index < progress.filled ? "is-filled" : ""}${index >= progress.filled && !design.stampEmptySlotsEnabled ? " is-hidden-slot" : ""}`} key={index}>
                      {index < progress.filled ? (
                        design.stampIconUrl || design.logoImageUrl ? (
                          <img alt="" src={design.stampIconUrl || design.logoImageUrl} />
                        ) : (
                          <small>{tenantInitials}</small>
                        )
                      ) : null}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          ) : null
        ) : (
          <p className="apple-pass-preview-program-name">{programName}</p>
        )}
      </div>

      <div className="apple-pass-preview-content">
        <div className={`apple-pass-preview-supporting-fields${lifetimePoints ? " is-lifetime" : ""}`}>
          <p>
            <span>CLIENTE</span>
            <strong>Cliente ejemplo</strong>
          </p>
          <p>
            <span>PREMIOS</span>
            <strong>1</strong>
          </p>
          {lifetimePoints || design.stripStampsEnabled ? (
            <p>
              <span>PROGRESO</span>
              <strong>{lifetimePoints
                ? appleWalletPointProgressText({ balance: exampleBalance, goal: progress.goal })
                : progressText}</strong>
            </p>
          ) : null}
          {lifetimePoints ? <p><span>SIGUIENTE</span><strong>Próximo premio</strong></p> : null}
        </div>
        <figure className="apple-pass-preview-code">
          <img alt="" src="/icons/wallet-preview-qr.svg" />
        </figure>
      </div>
    </div>
  );
}
