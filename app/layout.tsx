
import type { Metadata } from "next";
import "./globals.css";
import WalletProviders from "./WalletProviders";

export const metadata: Metadata = {
  title: "SOLANA.PUMP",
  description: "Launch and trade Solana tokens."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body>
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
