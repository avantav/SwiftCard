import Link from "next/link";

export function MorrowBrand({ href = "/", subtitle }: { href?: string; subtitle?: string }) {
  return <Link className="public-brand" href={href}><span className="enterprise-brand-mark" aria-hidden="true"><span>m</span></span><span><strong>morrow</strong>{subtitle ? <small>{subtitle}</small> : null}</span></Link>;
}
