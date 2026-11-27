import { TenantTermsPage, tenantLegalMetadata } from "@/components/tenant-legal-pages";
import { getTenantLegalDocuments } from "@/lib/legal/tenant-documents";

export const dynamic = "force-dynamic";
export const metadata = tenantLegalMetadata("Términos y condiciones del programa");

export default async function Page({ params }: { params: Promise<{ cardToken: string }> }) {
  const { cardToken } = await params;
  return <TenantTermsPage context={await getTenantLegalDocuments({ cardToken })} />;
}
