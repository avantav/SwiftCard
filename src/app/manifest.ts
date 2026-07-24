import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SwiftWallet",
    short_name: "SwiftWallet",
    description: "Operación de programas de fidelidad digitales.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#149c91",
    lang: "es-MX",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
    ]
  };
}
