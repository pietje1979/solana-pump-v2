
"use client";

import { useState } from "react";

const coins = [
  { name: "BONK", symbol: "$BONK", price: "$0.000021", change: "+12.4%", color: "#ff9c35" },
  { name: "WIF", symbol: "$WIF", price: "$0.842", change: "+8.2%", color: "#d5a5ff" },
  { name: "POPCAT", symbol: "$POPCAT", price: "$0.326", change: "+5.7%", color: "#ffdf6e" }
];

export default function Home() {
  const [search, setSearch] = useState("");

  const filteredCoins = coins.filter((coin) =>
    `${coin.name} ${coin.symbol}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main>
      <header className="header">
        <a className="logo" href="/">SOLANA<span>.</span>PUMP</a>
        <nav>
          <a href="#explore">Explore</a>
          <a href="#launch">Create coin</a>
        </nav>
        <button className="wallet" onClick={() => alert("Wallet connection will be added in the next development step.")}>
          Connect wallet
        </button>
      </header>

      <section className="hero">
        <div className="eyebrow">THE SOLANA MEMECOIN LAUNCHPAD</div>
        <h1>Discover the next<br /><span>big thing.</span></h1>
        <p>Discover, launch and trade community-powered tokens on Solana.</p>
        <div className="hero-actions">
          <a className="primary" href="#explore">Explore coins ↗</a>
          <a className="secondary" href="#launch">Create a coin</a>
        </div>
        <div className="notice">⚡ Built for Solana · Safety-first platform design</div>
      </section>

      <section className="stats">
        <div><strong>01</strong><span>Built on Solana</span></div>
        <div><strong>1%</strong><span>Planned trading fee</span></div>
        <div><strong>0.02 SOL</strong><span>Planned launch fee</span></div>
      </section>

      <section className="coins" id="explore">
        <div className="section-heading">
          <div><span className="eyebrow">THE MARKET</span><h2>Explore tokens</h2></div>
          <input
            placeholder="Search tokens..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="coin-list">
          {filteredCoins.map((coin) => (
            <div className="coin" key={coin.symbol}>
              <div className="coin-icon" style={{ background: coin.color }}>{coin.name[0]}</div>
              <div className="coin-name"><strong>{coin.name}</strong><span>{coin.symbol}</span></div>
              <div className="coin-price"><strong>{coin.price}</strong><span>Example price</span></div>
              <div className="change">{coin.change}</div>
              <span className="demo">DEMO</span>
            </div>
          ))}
          {filteredCoins.length === 0 && <p className="empty">No matching demo tokens.</p>}
        </div>
        <p className="disclaimer">Demo data only. These are not live prices or connected token listings.</p>
      </section>

      <section className="launch" id="launch">
        <span className="eyebrow">YOUR IDEA. YOUR TOKEN.</span>
        <h2>Ready to launch<br /><span>something big?</span></h2>
        <p>Token creation and wallet transactions are not active yet. We are building and testing the platform first.</p>
        <button onClick={() => alert("Token creation will be enabled after the security and wallet integration is ready.")}>
          Launch a token — coming soon
        </button>
      </section>

      <footer>
        <a className="logo" href="/">SOLANA<span>.</span>PUMP</a>
        <span>Built for the Solana community.</span>
      </footer>
    </main>
  );
}
