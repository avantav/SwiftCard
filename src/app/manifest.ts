import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "SwiftWallet Operación",
    short_name: "SwiftWallet",
    description: "Opera clientes, compras, sellos y recompensas de SwiftWallet.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f7f8",
    theme_color: "#149c91",
    lang: "es-MX",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ],
    shortcuts: [
      {
        name: "Registrar cliente",
        short_name: "Registro",
        description: "Registrar un cliente en SwiftWallet.",
        url: "/app",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }]
      },
      {
        name: "Identificar cliente",
        short_name: "Clientes",
        description: "Escanear una tarjeta o buscar un cliente de SwiftWallet.",
        url: "/app/scan",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }]
      }
    ]
  };
}
