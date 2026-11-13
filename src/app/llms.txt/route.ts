import { llmsTxt, textResponse } from "@/lib/marketing/agent-content";
import { loadPublicPricingPlans } from "@/lib/marketing/pricing-server";

export const dynamic = "force-dynamic";

export async function GET() {
  return textResponse(llmsTxt(await loadPublicPricingPlans()), "text/plain");
}
