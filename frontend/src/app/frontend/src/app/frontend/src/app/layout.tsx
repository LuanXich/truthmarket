import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TruthMarket — Decentralized Prediction Market",
  description: "Bet on real-world events. Resolved autonomously by AI on GenLayer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-dark-900 text-white antialiased">{children}</body>
    </html>
  );
}
