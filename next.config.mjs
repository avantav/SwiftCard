import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

/**
 * Public pages and their Markdown alternates. Keep in sync with PUBLIC_PAGES
 * in src/lib/marketing/agent-content.ts (covered by agent-content.test.ts).
 */
export const MARKDOWN_ALTERNATES = [
  { source: "/", destination: "/index.md" },
  { source: "/terminos", destination: "/terminos.md" },
  { source: "/privacidad", destination: "/privacidad.md" },
  { source: "/privacidad/clientes", destination: "/privacidad/clientes.md" }
];

/** Browsers never send text/markdown; agents that do want the Markdown version. */
const ACCEPTS_MARKDOWN = ".*text/markdown.*";

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return {
      // Agents that explicitly ask for Markdown get the page's Markdown version.
      beforeFiles: MARKDOWN_ALTERNATES.map(({ source, destination }) => ({
        source,
        destination,
        has: [{ type: "header", key: "accept", value: ACCEPTS_MARKDOWN }]
      }))
    };
  },
  async headers() {
    return [
      ...MARKDOWN_ALTERNATES.map(({ source, destination }) => ({
        source,
        headers: [
          {
            key: "Link",
            value: `<${destination}>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"; type="text/plain"`
          },
          { key: "Vary", value: "Accept" }
        ]
      })),
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
          { key: "Service-Worker-Allowed", value: "/" }
        ]
      }
    ];
  },
  turbopack: {
    root: projectRoot
  }
};

export default nextConfig;
