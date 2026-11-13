import { legalMarkdown, textResponse } from "@/lib/marketing/agent-content";

export const dynamic = "force-dynamic";

export function GET() {
  return textResponse(legalMarkdown("/privacidad"), "text/markdown");
}
