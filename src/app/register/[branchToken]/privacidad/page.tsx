import { TenantPrivacyPage, tenantLegalMetadata } from "@/components/tenant-legal-pages";
import { getTenantLegalDocuments } from "@/lib/legal/tenant-documents";

export const dynamic = "force-dynamic";
export const metadata = tenantLegalMetadata("Aviso de privacidad");

export default async function Page({ params }: { params: Promise<{ branchToken: string }> }) {
  const { branchToken } = await params;
  return <TenantPrivacyPage context={await getTenantLegalDocuments({ branchToken })} />;
}
