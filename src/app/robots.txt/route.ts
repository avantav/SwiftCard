import { robotsTxt, textResponse } from "@/lib/marketing/agent-content";

/** Served as a route (not robots.ts) because Content-Signal is not a Next.js robots field. */
export function GET() {
  return textResponse(robotsTxt(), "text/plain");
}
