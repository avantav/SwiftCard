import { stripeCheckoutConfig } from "@/lib/billing/stripe";
import { homeMarkdown, textResponse } from "@/lib/marketing/agent-content";
import { landingFaq } from "@/lib/marketing/faq";
import { loadPublicPricingPlans } from "@/lib/marketing/pricing-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const plans = await loadPublicPricingPlans();
  return textResponse(homeMarkdown(plans, landingFaq(Boolean(stripeCheckoutConfig()))), "text/markdown");
}
