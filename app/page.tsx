
"use client";

import { useEffect, useState } from "react";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

type PhantomProvider = {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signAndSendTransaction: (
    transaction: Transaction,
    options?: {
      preflightCommitment?: "processed" | "confirmed" | "finalized";
    }
  ) => Promise<{ signature: string }>;
};

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
  }
}

const connection = new Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

export default function Home() {
  const [walletAddress, setWalletAddress] = useState("");
  const [coinName, setCoinName] = useState("");
  const [ticker, setTicker] = useState("");
  const [supply, setSupply] = useState("1000000000");
  const [message, setMessage] = useState("");
  const [mintAddress, setMintAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageCid, setImageCid] = useState("");

  useEffect(() => {
    if (!selectedImage) {
      setImagePreview("");
      return;
    }

    const preview = URL.createObjectURL(selectedImage);
    setImagePreview(preview);

    return () => URL.revokeObjectURL(preview);
  }, [selectedImage]);

  function getPhantom() {
    return window.phantom?.solana ?? window.solana;
  }

  async function connectWallet() {
    try {
      const provider = getPhantom();

      if (!provider?.isPhantom) {
        setMessage("Phantom wallet niet gevonden.");
        return;
      }

      const response = await provider.connect();
      setWalletAddress(response.publicKey.toString());
      setMessage("Phantom verbonden.");
    } catch (error) {
      console.error(error);
      setMessage("Walletverbinding mislukt.");
    }
  }

  async function disconnectWallet() {
    try {
      await getPhantom()?.disconnect();
      setWalletAddress("");
      setMessage("Wallet ontkoppeld.");
    } catch (error) {
      console.error(error);
      setMessage("Ontkoppelen mislukt.");
    }
  }

  function chooseImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setMessage("Gebruik PNG, JPG of WEBP.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("De afbeelding mag maximaal 5 MB zijn.");
      event.target.value = "";
      return;
    }

    setSelectedImage(file);
    setImageUrl("");
    setImageCid("");
    setMessage("Afbeelding geselecteerd.");
  }

  async function uploadImage() {
    if (!selectedImage || uploadBusy) return;

    try {
      setUploadBusy(true);
      setMessage("Afbeelding wordt naar Pinata geüpload...");

      const formData = new FormData();
      formData.append("file", selectedImage);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Uploaden mislukt.");
      }

      setImageUrl(result.url);
      setImageCid(result.cid);
      setMessage("Afbeelding succesvol geüpload naar Pinata!");
    } catch (error) {
      console.error("Image upload error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Afbeelding uploaden mislukt."
      );
    } finally {
      setUploadBusy(false);
    }
  }

  async function createCoin() {
    if (busy) return;

    try {
      setMessage("");
      setMintAddress("");

      const provider = getPhantom();

      if (!provider?.isPhantom) {
        setMessage("Phantom wallet niet gevonden.");
        return;
      }

      if (!walletAddress) {
        setMessage("Verbind eerst je Phantom wallet.");
        return;
      }

      if (!coinName.trim()) {
        setMessage("Vul een naam voor je coin in.");
        return;
      }

      if (!/^[A-Za-z0-9]{2,10}$/.test(ticker)) {
        setMessage("Ticker moet 2 tot 10 letters of cijfers bevatten.");
        return;
      }

      const amount = BigInt(supply);

      if (amount <= 0n || amount > 1000000000000n) {
        setMessage("Vul een geldig aantal tokens in.");
        return;
      }

      setBusy(true);
      setMessage("Testtoken wordt voorbereid...");

      const wallet = new PublicKey(walletAddress);
      const mint = Keypair.generate();
      const decimals = 6;
      const tokenAmount = amount * 1000000n;

      const rent =
        await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

      const tokenAccount = getAssociatedTokenAddressSync(
        mint.publicKey,
        wallet,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const transaction = new Transaction();

      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: wallet,
          newAccountPubkey: mint.publicKey,
          space: MINT_SIZE,
          lamports: rent,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mint.publicKey,
          decimals,
          wallet,
          wallet,
          TOKEN_PROGRAM_ID
        ),
        createAssociatedTokenAccountInstruction(
          wallet,
          tokenAccount,
          wallet,
          mint.publicKey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        ),
        createMintToInstruction(
          mint.publicKey,
          tokenAccount,
          wallet,
          tokenAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const latest = await connection.getLatestBlockhash("confirmed");

      transaction.feePayer = wallet;
      transaction.recentBlockhash = latest.blockhash;
      transaction.partialSign(mint);

      setMessage("Controleer de transactie in Phantom...");

      const result = await provider.signAndSendTransaction(
        transaction,
        { preflightCommitment: "confirmed" }
      );

      await connection.confirmTransaction(
        {
          signature: result.signature,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        "confirmed"
      );

      setMintAddress(mint.publicKey.toString());
      setMessage("Je testtoken is aangemaakt op Solana Devnet!");
    } catch (error) {
      console.error("Token creation error:", error);

      const details =
        error instanceof Error ? error.message : String(error);

      setMessage("Tokenaanmaak mislukt: " + details);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header className="header">
        <div className="logo">
          SOLANA<span>.PUMP</span>
        </div>

        <div className="wallet">
          {walletAddress ? (
            <button onClick={disconnectWallet}>
              {walletAddress.slice(0, 4)}...
              {walletAddress.slice(-4)} · Disconnect
            </button>
          ) : (
            <button onClick={connectWallet}>Connect Phantom</button>
          )}
        </div>
      </header>

      <section className="hero">
        <h1>
          LAUNCH YOUR <span>MEMECOIN</span>
        </h1>

        <p>Create, launch and trade tokens on Solana.</p>

        {message && <p>{message}</p>}

        {walletAddress && (
          <p>Connected wallet: {walletAddress}</p>
        )}
      </section>

      <section className="stats">
        <div>
          <h2>0.02 SOL</h2>
          <p>Planned coin launch fee</p>
        </div>

        <div>
          <h2>1%</h2>
          <p>Planned trading fee</p>
        </div>

        <div>
          <h2>Solana</h2>
          <p>Devnet testing</p>
        </div>
      </section>

      <section className="launch">
        <h2>Launch your coin</h2>
        <p>Create your own Solana test token.</p>

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
          onChange={(event) =>
            setTicker(event.target.value.toUpperCase())
          }
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

        <label htmlFor="coinImage">Coin logo (PNG, JPG of WEBP)</label>
        <input
          id="coinImage"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={chooseImage}
        />

        {imagePreview && (
          <div>
            <p>Voorbeeld van je logo:</p>
            <img
              src={imagePreview}
              alt="Voorbeeld coin logo"
              style={{
                width: "140px",
                height: "140px",
                objectFit: "cover",
                borderRadius: "16px",
              }}
            />
          </div>
        )}

        <button
          onClick={uploadImage}
          disabled={!selectedImage || uploadBusy}
        >
          {uploadBusy ? "Uploading..." : "Upload logo to Pinata"}
        </button>

        {imageUrl && (
          <div>
            <p>Logo opgeslagen op IPFS:</p>
            <a href={imageUrl} target="_blank" rel="noreferrer">
              Bekijk geüploade afbeelding
            </a>
            <p>CID: {imageCid}</p>
          </div>
        )}

        <button onClick={createCoin} disabled={busy}>
          {busy ? "Creating..." : "Create Coin"}
        </button>

        {mintAddress && (
          <div>
            <p>Token mint address:</p>
            <p>{mintAddress}</p>
            <a
              href={`https://explorer.solana.com/address/${mintAddress}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
            >
              View token on Solana Explorer
            </a>
          </div>
        )}

        <p>
          Devnet only. Phantom will ask you to approve the transaction.
          The coin name, ticker and logo are not yet stored together
          as on-chain metadata.
        </p>
      </section>

      <footer>
        <p>© 2026 SOLANA.PUMP — Built on Solana</p>
      </footer>
    </main>
  );
}
