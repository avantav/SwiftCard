import Image from "next/image";

export function GoogleWalletBadge() {
  return (
    <Image
      alt="Agregar a la Billetera de Google"
      height={55}
      priority
      src="/icons/add-to-google-wallet-es-419.svg"
      width={239}
    />
  );
}

export function GoogleWalletAddButton({
  accepted = false,
  cardToken,
}: {
  accepted?: boolean;
  cardToken: string;
}) {
  return (
    <a
      aria-label="Agregar a la Billetera de Google"
      className="public-google-wallet-button"
      href={
        accepted
          ? `/api/wallet/google/${encodeURIComponent(cardToken)}`
          : `/card/${encodeURIComponent(cardToken)}?claim=1`
      }
    >
      <GoogleWalletBadge />
    </a>
  );
}
