import Link from "next/link";

export function SwiftWalletBrand({ href = "/", subtitle }: { href?: string; subtitle?: string }) {
  return <Link className="public-brand" href={href}><span className="enterprise-brand-mark" aria-hidden="true"><span /></span><span><strong>SwiftWallet</strong>{subtitle ? <small>{subtitle}</small> : null}</span></Link>;
}
