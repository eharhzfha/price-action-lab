import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Price Action Lab — Professional Trading Application",
  description:
    "NASDAQ futures research desk: market structure, liquidity, FVG/OB confluence, strict replay backtesting, paper execution and risk management.",
  applicationName: "Price Action Lab",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Price Action Lab" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#080a0c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-[100dvh] overflow-x-hidden bg-base-950 font-sans antialiased">{children}</body>
    </html>
  );
}
