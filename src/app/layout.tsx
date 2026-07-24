import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SwiftWallet",
  description: "SaaS multi-tenant para programas de fidelidad digitales",
  applicationName: "SwiftWallet",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#149c91",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
