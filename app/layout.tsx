import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quantumvest Matrix",
  description: "Live trading signals across Quantum, Schwab, and Algo portfolios",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
