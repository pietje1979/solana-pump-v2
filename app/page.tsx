
"use client";

import { useState } from "react";

type PhantomProvider = {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
};

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
  }
}

export default function Home() {
  const [walletAddress, setWalletAddress] = useState("");
  const [network, setNetwork] = useState("Nog niet gecontroleerd");
  const [message, setMessage] = useState("");
  const [coinName, setCoinName] = useState("");
  const [ticker, setTicker] = useState("");
  const [supply, setSupply] = useState("1000000000");

  async function connectWallet() {
    try {
      const provider = window.phantom?.solana ?? window.solana;

      if (!provider?.isPhantom) {
        setMessage("Phantom wallet niet gevonden.");
        return;
      }

      const response = await provider.connect();
      setWalletAddress(response.publicKey.toString());

      const rpc = await fetch("https://api.devnet.solana.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getHealth",
        }),
      });

      const data = await rpc.json();

      if (data.result === "ok") {
        setNetwork("Solana Devnet bereikbaar");
        setMessage("Phantom verbonden. Devnet bereikbaar.");
      } else {
        setNetwork("Controle mislukt");
        setMessage("Devnet reageert niet.");
      }
    } catch {
      setMessage("Verbinding of netwerkcontrole mislukt.");
    }
  }

  async function disconnectWallet() {
    try {
      const provider = window.phantom?.solana ?? window.solana;
      if (provider) await provider.disconnect();

      setWalletAddress("");
      setNetwork("Niet verbonden");
      setMessage("Wallet ontkoppeld.");
    } catch {
      setMessage("Ontkoppelen mislukt.");
    }
  }

  function createCoin() {
    if (!walletAddress) {
      setMessage("Verbind eerst je Phantom wallet.");
      return;
    }

    if (!coinName.trim() || !ticker.trim() || !supply.trim()) {
      setMessage("Vul alle velden in.");
      return;
    }

    if (!/^[A-Za-z0-9]{2,10}$/.test(ticker)) {
      setMessage("Ticker moet 2 tot 10 letters of cijfers bevatten.");
      return;
    }

    const amount = Number(supply);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setMessage("Vul een geldig geheel aantal tokens in.");
      return;
    }

    setMessage(
      "Formulier gecontroleerd! De echte tokenaanmaak wordt in de volgende stap aangesloten."
    );
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

        {!walletAddress && (
          <button onClick={connectWallet}>Connect Wallet</button>
        )}

        {message && <p>{message}</p>}

        {walletAddress && (
          <>
            <p>Connected wallet: {walletAddress}</p>
            <p>Website network: {network}</p>
          </>
        )}
      </section>

      <section className="stats">
        <div><h2>0.02 SOL</h2><p>Coin launch fee</p></div>
        <div><h2>1%</h2><p>Trading fee</p></div>
        <div><h2>Solana</h2><p>Blockchain</p></div>
      </section>

      <section className="launch">
        <h2>Launch your coin</h2>
        <p>Create your own Solana token on Devnet.</p>

        <label htmlFor="coinName">Coin name</label>
        <input
          id="coinName"
          value={coinName}
          onChange={(event) => setCoinName(event.target.value)}
          placeholder="My First Coin"
          maxLength={32}
        />

        <label htmlFor="ticker">Ticker</label>
        <input
          id="ticker"
          value={ticker}
          onChange={(event) => setTicker(event.target.value.toUpperCase())}
          placeholder="TEST"
          maxLength={10}
        />

        <label htmlFor="supply">Total supply</label>
        <input
          id="supply"
          type="number"
          min="1"
          step="1"
          value={supply}
          onChange={(event) => setSupply(event.target.value)}
        />

        <button onClick={createCoin}>Create Coin</button>

        <p>
          Devnet testing only. This form does not create a token or send SOL yet.
        </p>
      </section>

      <footer>
        <p>© 2026 SOLANA.PUMP — Built on Solana</p>
      </footer>
    </main>
  );
}
