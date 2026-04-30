import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ErrorHandlerInit } from "@/components/ErrorHandlerInit";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "Variation Shield",
  description: "Variation register for construction contractors",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-sans@5.1.0/400.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-sans@5.1.0/500.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-sans-condensed@5.1.0/500.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5.1.0/400.css" />
        <meta name="theme-color" content="#17212B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Variation Shield" />
        <link rel="apple-touch-icon" href="/vs-icon.svg" />
      </head>
      <body className="font-sans antialiased">
        <ErrorHandlerInit />
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
