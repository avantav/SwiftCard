export function AppleWalletAddButton({ accepted = false, cardToken }: { accepted?: boolean; cardToken: string }) {
  return (
    <a
      className="public-apple-wallet-button"
      href={accepted ? `/api/wallet/apple/${encodeURIComponent(cardToken)}` : `/card/${encodeURIComponent(cardToken)}?claim=1`}
    >
      <svg
        aria-hidden="true"
        className="public-apple-wallet-icon"
        viewBox="0 0 40 40"
      >
        <rect fill="#ffffff" height="25" rx="4" width="28" x="6" y="8" />
        <path d="M9 11h22v4H9z" fill="#ef4444" />
        <path d="M9 15h22v4H9z" fill="#f59e0b" />
        <path d="M9 19h22v4H9z" fill="#22c55e" />
        <path d="M9 23h22v7H9z" fill="#3b82f6" />
        <rect
          fill="none"
          height="25"
          rx="4"
          stroke="#ffffff"
          strokeWidth="1.5"
          width="28"
          x="6"
          y="8"
        />
      </svg>
      <span>
        <small>Agregar a</small>
        <strong>Apple Wallet</strong>
      </span>
    </a>
  );
}
