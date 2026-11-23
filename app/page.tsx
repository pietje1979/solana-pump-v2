
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

import {
  createMetadataAccountV3,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";

import {
  createNoopSigner,
} from "@metaplex-foundation/umi";

import {
  createUmi,
} from "@metaplex-foundation/umi-bundle-defaults";

import {
  fromWeb3JsPublicKey,
  toWeb3JsInstruction,
} from "@metaplex-foundation/umi-web3js-adapters";

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

const umi = createUmi(
  "https://api.devnet.solana.com"
).use(mplTokenMetadata());

export default function Home() {
  const [walletAddress, setWalletAddress] = useState("");
  const [coinName, setCoinName] = useState("");
  const [ticker, setTicker] = useState("");
  const [supply, setSupply] = useState("1000000000");

  const [message, setMessage] = useState("");
  const [mintAddress, setMintAddress] = useState("");
  const [transactionSignature, setTransactionSignature] = useState("");

  const [busy, setBusy] = useState(false);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [metadataUrl, setMetadataUrl] = useState("");

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

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

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
    setMetadataUrl("");
    setMintAddress("");
    setTransactionSignature("");
    setMessage("Afbeelding geselecteerd.");
  }

  async function uploadToPinata(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || !result.url || !result.cid) {
      throw new Error(
        result.error || "Uploaden naar Pinata is mislukt."
      );
    }

    return {
      url: result.url as string,
      cid: result.cid as string,
    };
  }

  async function createCoin() {
    if (busy) return;

    try {
      setMessage("");
      setMintAddress("");
      setTransactionSignature("");
      setImageUrl("");
      setMetadataUrl("");

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

      if (coinName.trim().length > 32) {
        setMessage("De naam mag maximaal 32 tekens bevatten.");
        return;
      }

      if (!/^[A-Za-z0-9]{2,10}$/.test(ticker)) {
        setMessage(
          "Ticker moet 2 tot 10 letters of cijfers bevatten."
        );
        return;
      }

      if (!selectedImage) {
        setMessage("Selecteer eerst een logo.");
        return;
      }

      const amount = BigInt(supply);

      if (amount <= 0n || amount > 1000000000000n) {
        setMessage("Vul een geldig aantal tokens in.");
        return;
      }

      setBusy(true);

      const wallet = new PublicKey(walletAddress);

      // Stap 1: afbeelding uploaden naar Pinata.
      setMessage("Stap 1/4: logo wordt naar Pinata geüpload...");

      const imageUpload = await uploadToPinata(selectedImage);

      setImageUrl(imageUpload.url);

      // Stap 2: metadata JSON maken en uploaden.
      setMessage("Stap 2/4: coin-gegevens worden opgeslagen...");

      const metadata = {
        name: coinName.trim(),
        symbol: ticker,
        description: `${coinName.trim()} token on SOLANA.PUMP.`,
        image: imageUpload.url,
        external_url: "https://solana-pump-v2-pi.vercel.app/",
        attributes: [],
        properties: {
          category: "image",
          files: [
            {
              uri: imageUpload.url,
              type: selectedImage.type,
            },
          ],
        },
      };

      const metadataFile = new File(
        [JSON.stringify(metadata, null, 2)],
        `${ticker}-metadata.json`,
        { type: "application/json" }
      );

      const metadataUpload = await uploadToPinata(metadataFile);

      setMetadataUrl(metadataUpload.url);

      // Stap 3: token en metadata voorbereiden.
      setMessage("Stap 3/4: Solana-transactie wordt voorbereid...");

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
        )
      );

      // Metaplex metadata-instructie.
      const umiWallet = fromWeb3JsPublicKey(wallet);

      const metadataBuilder = createMetadataAccountV3(umi, {
        mint: fromWeb3JsPublicKey(mint.publicKey),

        mintAuthority: createNoopSigner(umiWallet),

        payer: createNoopSigner(umiWallet),

        updateAuthority: umiWallet,

        data: {
          name: coinName.trim(),
          symbol: ticker,
          uri: metadataUpload.url,
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        },

        isMutable: true,
        collectionDetails: null,
      });

      const metadataInstructions =
        metadataBuilder.getInstructions().map(toWeb3JsInstruction);

      transaction.add(...metadataInstructions);

      // Tokenaccount aanmaken en de voorraad minten.
      transaction.add(
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

      const latest =
        await connection.getLatestBlockhash("confirmed");

      transaction.feePayer = wallet;
      transaction.recentBlockhash = latest.blockhash;

      // De nieuwe mint-keypair tekent alvast.
      transaction.partialSign(mint);

      // Stap 4: Phantom ondertekent de volledige transactie.
      setMessage(
        "Stap 4/4: controleer en bevestig de transactie in Phantom..."
      );

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
      setTransactionSignature(result.signature);

      setMessage(
        "Je testcoin met naam, ticker en logo is aangemaakt op Solana Devnet!"
      );
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
            <button onClick={connectWallet}>
              Connect Phantom
            </button>
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
          disabled={busy}
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
          disabled={busy}
        />

        <label htmlFor="supply">Total supply</label>
        <input
          id="supply"
          type="number"
          min="1"
          step="1"
          value={supply}
          onChange={(event) => setSupply(event.target.value)}
          disabled={busy}
        />

        <label htmlFor="coinImage">
          Coin logo (PNG, JPG of WEBP)
        </label>

        <input
          id="coinImage"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={chooseImage}
          disabled={busy}
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

        {transactionSignature && (
          <div>
            <p>Transaction:</p>
            <a
              href={`https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
            >
              View transaction on Solana Explorer
            </a>
          </div>
        )}

        {imageUrl && (
          <p>
            <a href={imageUrl} target="_blank" rel="noreferrer">
              Bekijk logo op Pinata
            </a>
          </p>
        )}

        {metadataUrl && (
          <p>
            <a href={metadataUrl} target="_blank" rel="noreferrer">
              Bekijk coin metadata
            </a>
          </p>
        )}

        <p>
          Devnet only. Phantom will ask you to approve the transaction.
          Token metadata is created using Metaplex.
        </p>
      </section>

      <footer>
        <p>© 2026 SOLANA.PUMP — Built on Solana</p>
      </footer>
    </main>
  );
}
