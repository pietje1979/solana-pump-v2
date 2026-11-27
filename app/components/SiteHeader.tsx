"use client";

import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-logo">
          SOLANA<span>.PUMP</span>
        </Link>

        <nav className="site-nav">
          <Link href="/" className="site-nav-link">Launch</Link>
          <Link href="/coins" className="site-nav-link">Markt</Link>
        </nav>

        <div className="site-wallet">
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
