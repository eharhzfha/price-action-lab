import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Price Action Lab — Professional Trading Application",
  description:
    "NASDAQ futures research desk: market structure, liquidity, FVG/OB confluence, strict replay backtesting, paper execution and risk management.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-base-950 font-sans antialiased">{children}</body>
    </html>
  );
}
