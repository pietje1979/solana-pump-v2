
"use client";

import { useState } from "react";

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect: () => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
};

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: {
      solana?: PhantomProvider;
    };
  }
}

export default function Home() {
  const [walletAddress, setWalletAddress] = useState("");
  const [network, setNetwork] = useState("Nog niet gecontroleerd");
  const [message, setMessage] = useState("");

  async function connectWallet() {
    const provider = window.phantom?.solana ?? window.solana;

    if (!provider || !provider.isPhantom) {
      setMessage("Phantom wallet niet gevonden.");
      return;
    }

    try {
      const response = await provider.connect();
      setWalletAddress(response.publicKey.toString());
      setMessage("Phantom wallet succesvol verbonden!");
    } catch {
      setMessage("Phantom verbinding mislukt.");
      return;
    }

    try {
      const response = await fetch("https://api.devnet.solana.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getHealth",
        }),
      });

      const data = await response.json();

      if (data.result === "ok") {
        setNetwork("Solana Devnet RPC bereikbaar");
        setMessage(
          "Wallet verbonden. Devnet-server bereikbaar. Controleer ook het netwerk in Phantom."
        );
      } else {
        setNetwork("Devnet niet bereikbaar");
        setMessage("De Devnet-server reageert niet goed.");
      }
    } catch {
      setNetwork("Controle mislukt");
      setMessage("Wallet verbonden, maar Devnet-controle mislukt.");
    }
  }

  async function disconnectWallet() {
    try {
      const provider = window.phantom?.solana ?? window.solana;

      if (provider) {
        await provider.disconnect();
      }

      setWalletAddress("");
      setNetwork("Niet verbonden");
      setMessage("Wallet ontkoppeld.");
    } catch {
      setMessage("Ontkoppelen is niet gelukt.");
    }
  }

  return (
    <main>
      <header className="header">
        <div className="logo">SOLANA<span>.PUMP</span></div>
        <div className="wallet">
          {walletAddress ? (
            <button onClick={disconnectWallet}>
              {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)} · Disconnect
            </button>
          ) : (
            <button onClick={connectWallet}>Connect Phantom</button>
          )}
        </div>
      </header>

      <section className="hero">
        <h1>LAUNCH YOUR <span>MEMECOIN</span></h1>
        <p>Create, launch and trade tokens on Solana.</p>
        <button onClick={connectWallet}>Connect Wallet</button>

        {message && <p>{message}</p>}

        {walletAddress && (
          <>
            <p>Connected wallet: {walletAddress}</p>
            <p>Website network: {network}</p>
            <p>Controleer dat Phantom zelf ook op Devnet staat.</p>
          </>
        )}
      </section>

      <section className="stats">
        <div>
          <h2>0.02 SOL</h2>
          <p>Coin launch fee</p>
        </div>
        <div>
          <h2>1%</h2>
          <p>Trading fee</p>
        </div>
        <div>
          <h2>Solana</h2>
          <p>Blockchain</p>
        </div>
      </section>

      <section className="launch">
        <h2>Launch your coin</h2>
        <p>Connect your Phantom wallet to get started.</p>
        <button onClick={connectWallet}>Connect Phantom</button>
      </section>

      <footer>
        <p>© 2026 SOLANA.PUMP — Built on Solana</p>
        <p>Devnet testing only. No transactions are made.</p>
      </footer>
    </main>
  );
}
