import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Variation Capture — Office",
  description: "Desktop variation register for construction contractors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
