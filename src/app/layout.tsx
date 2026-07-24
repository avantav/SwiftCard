import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SwiftWallet",
  description: "SaaS multi-tenant para programas de fidelidad digitales"
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

