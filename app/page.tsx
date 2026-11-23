
"use client";

import { useState } from "react";

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect: () => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  request: (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;
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
    try {
      const provider = window.phantom?.solana ?? window.solana;

      if (!provider || !provider.isPhantom) {
        setMessage("Phantom wallet niet gevonden.");
        return;
      }

      const response = await provider.connect();
      setWalletAddress(response.publicKey.toString());

      const endpoint = await provider.request({
        method: "getCluster",
      });

      if (endpoint === "devnet") {
        setNetwork("Solana Devnet");
        setMessage("Verbonden met Solana Devnet!");
      } else {
        setNetwork(String(endpoint));
        setMessage("Wallet verbonden. Controleer het netwerk in Phantom.");
      }
    } catch {
      setMessage("Verbinding of netwerkcontrole mislukt.");
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
            <p>Network: {network}</p>
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
