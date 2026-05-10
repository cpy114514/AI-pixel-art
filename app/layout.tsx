import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Pixel Painter",
  description: "Generate and edit pixel-art sprites from exact JSON color data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
