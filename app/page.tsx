
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
  AuthorityType,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";

import {
  createMetadataAccountV3,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";

import { createNoopSigner } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
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

const umi = createUmi("https://api.devnet.solana.com").use(
  mplTokenMetadata()
);

const DEFAULT_TEST_MINT =
  "429L76ZNArU3ox6LnQ2Rv3xATYTqG4M4iu7QPUpQm6Au";

export default function Home() {
  const [walletAddress, setWalletAddress] = useState("");
  const [coinName, setCoinName] = useState("");
  const [ticker, setTicker] = useState("");
  const [description, setDescription] = useState("");
  const [supply, setSupply] = useState("1000000000");

  const [message, setMessage] = useState("");
  const [mintAddress, setMintAddress] = useState("");
  const [authorityMintAddress, setAuthorityMintAddress] =
    useState(DEFAULT_TEST_MINT);
  const [transactionSignature, setTransactionSignature] = useState("");
  const [securitySignature, setSecuritySignature] = useState("");

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

  async function revokeTokenAuthorities() {
    if (busy) return;

    try {
      setBusy(true);
      setMessage("");

      const provider = getPhantom();

      if (!provider?.isPhantom) {
        setMessage("Phantom wallet niet gevonden.");
        return;
      }

      if (!walletAddress) {
        setMessage("Verbind eerst je Phantom wallet.");
        return;
      }

      let mintPublicKey: PublicKey;

      try {
        mintPublicKey = new PublicKey(authorityMintAddress.trim());
      } catch {
        setMessage(
          "Het tokenadres is ongeldig. Controleer het mintadres."
        );
        return;
      }

      const wallet = new PublicKey(walletAddress);

      const mintInfo = await getMint(
        connection,
        mintPublicKey,
        "confirmed",
        TOKEN_PROGRAM_ID
      );

      const transaction = new Transaction();
      let instructionsAdded = 0;

      if (mintInfo.mintAuthority?.equals(wallet)) {
        transaction.add(
          createSetAuthorityInstruction(
            mintPublicKey,
            wallet,
            AuthorityType.MintTokens,
            null,
            [],
            TOKEN_PROGRAM_ID
          )
        );
        instructionsAdded++;
      } else if (mintInfo.mintAuthority !== null) {
        setMessage(
          "De verbonden wallet is niet de Mint Authority van deze munt. Er is niets gewijzigd."
        );
        return;
      }

      if (mintInfo.freezeAuthority?.equals(wallet)) {
        transaction.add(
          createSetAuthorityInstruction(
            mintPublicKey,
            wallet,
            AuthorityType.FreezeAccount,
            null,
            [],
            TOKEN_PROGRAM_ID
          )
        );
        instructionsAdded++;
      } else if (mintInfo.freezeAuthority !== null) {
        setMessage(
          "De verbonden wallet is niet de Freeze Authority van deze munt. Er is niets gewijzigd."
        );
        return;
      }

      if (instructionsAdded === 0) {
        setMessage(
          "Beide bevoegdheden zijn al ingetrokken. Niemand kan extra tokens bijmaken of tokens bevriezen."
        );
        return;
      }

      const latest = await connection.getLatestBlockhash("confirmed");
      transaction.feePayer = wallet;
      transaction.recentBlockhash = latest.blockhash;

      setMessage(
        "Controleer de beveiligingstransactie in Phantom en bevestig deze."
      );

      const result = await provider.signAndSendTransaction(transaction, {
        preflightCommitment: "confirmed",
      });

      const confirmation = await connection.confirmTransaction(
        {
          signature: result.signature,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error("De beveiligingstransactie is niet geslaagd.");
      }

      setSecuritySignature(result.signature);

      const updatedMint = await getMint(
        connection,
        mintPublicKey,
        "confirmed",
        TOKEN_PROGRAM_ID
      );

      if (
        updatedMint.mintAuthority === null &&
        updatedMint.freezeAuthority === null
      ) {
        setMessage(
          "Veiligheidscontrole geslaagd: Mint Authority en Freeze Authority zijn ingetrokken."
        );
      } else {
        setMessage(
          "Transactie bevestigd. Controleer de resterende bevoegdheid opnieuw."
        );
      }
    } catch (error) {
      console.error("Authority revocation error:", error);
      const details =
        error instanceof Error ? error.message : String(error);
      setMessage("Beveiliging mislukt: " + details);
    } finally {
      setBusy(false);
    }
  }

  async function createCoin() {
    if (busy) return;

    let tokenCreated = false;

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

      if (description.trim().length > 1000) {
        setMessage("De beschrijving mag maximaal 1000 tekens bevatten.");
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

      setMessage("Stap 1/5: logo wordt naar Pinata geüpload...");
      const imageUpload = await uploadToPinata(selectedImage);
      setImageUrl(imageUpload.url);

      setMessage("Stap 2/5: coin-gegevens worden opgeslagen...");

      const coinDescription =
        description.trim() ||
        `${coinName.trim()} token on SOLANA.PUMP.`;

      const metadata = {
        name: coinName.trim(),
        symbol: ticker,
        description: coinDescription,
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

      setMessage("Stap 3/5: Solana-transactie wordt voorbereid...");

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

      // Trek beide bevoegdheden in dezelfde transactie in.
      transaction.add(
        createSetAuthorityInstruction(
          mint.publicKey,
          wallet,
          AuthorityType.MintTokens,
          null,
          [],
          TOKEN_PROGRAM_ID
        ),
        createSetAuthorityInstruction(
          mint.publicKey,
          wallet,
          AuthorityType.FreezeAccount,
          null,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const latest = await connection.getLatestBlockhash("confirmed");
      transaction.feePayer = wallet;
      transaction.recentBlockhash = latest.blockhash;
      transaction.partialSign(mint);

      setMessage(
        "Stap 4/5: controleer de tokenaanmaak en veiligheidsinstellingen in Phantom..."
      );

      const result = await provider.signAndSendTransaction(transaction, {
        preflightCommitment: "confirmed",
      });

      const confirmation = await connection.confirmTransaction(
        {
          signature: result.signature,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error("De tokenaanmaak is niet geslaagd.");
      }

      tokenCreated = true;

      const newMintAddress = mint.publicKey.toString();

      setMintAddress(newMintAddress);
      setAuthorityMintAddress(newMintAddress);
      setTransactionSignature(result.signature);

      const createdMint = await getMint(
        connection,
        mint.publicKey,
        "confirmed",
        TOKEN_PROGRAM_ID
      );

      if (
        createdMint.mintAuthority !== null ||
        createdMint.freezeAuthority !== null
      ) {
        setMessage(
          "De coin is aangemaakt, maar de beveiligingscontrole is niet geslaagd. De coin wordt daarom niet geregistreerd."
        );
        return;
      }

      setMessage(
        "Stap 5/5: beveiligde registratie in Supabase..."
      );

      const registrationResponse = await fetch(
        "/api/register-coin",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mintAddress: newMintAddress,
            name: coinName.trim(),
            ticker: ticker.toUpperCase(),
            description: coinDescription,
            imageUrl: imageUpload.url,
            metadataUrl: metadataUpload.url,
            transactionSignature: result.signature,
            walletAddress,
          }),
        }
      );

      const registrationResult = await registrationResponse.json();

      if (!registrationResponse.ok || !registrationResult.success) {
        console.error(
          "Supabase registration error:",
          registrationResult
        );

        const errorDetails =
          typeof registrationResult.details === "string"
            ? registrationResult.details
            : registrationResult.details
              ? JSON.stringify(registrationResult.details)
              : "Geen aanvullende foutdetails ontvangen.";

        setMessage(
          "Je coin is aangemaakt en beveiligd op Devnet, maar opslaan in het coin-overzicht is mislukt. Bewaar je mintadres: " +
            newMintAddress +
            ". Fout: " +
            (registrationResult.error || "Onbekende fout.") +
            " Details: " +
            errorDetails
        );
        return;
      }

      setMessage(
        "Gelukt! Je coin is aangemaakt, beide bevoegdheden zijn ingetrokken en de coin is opgeslagen in Supabase."
      );
    } catch (error) {
      console.error("Token creation error:", error);
      const details =
        error instanceof Error ? error.message : String(error);

      if (tokenCreated) {
        setMessage(
          "Je coin is al aangemaakt op Devnet, maar een volgende stap is mislukt: " +
            details
        );
      } else {
        setMessage("Tokenaanmaak mislukt: " + details);
      }
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
            <button onClick={disconnectWallet} disabled={busy}>
              {walletAddress.slice(0, 4)}...
              {walletAddress.slice(-4)} · Disconnect
            </button>
          ) : (
            <button onClick={connectWallet} disabled={busy}>
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
        {walletAddress && <p>Connected wallet: {walletAddress}</p>}
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

        <label htmlFor="description">
          Coin description / Your story
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Vertel waar jouw coin voor staat, wat de missie is en welke community je wilt bouwen..."
          maxLength={1000}
          rows={5}
          disabled={busy}
        />
        <p>{description.length}/1000 tekens</p>

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
              href={`/coin/${mintAddress}`}
              style={{
                display: "inline-block",
                margin: "12px 0",
                padding: "12px 20px",
                background: "#a3ff12",
                color: "#090b10",
                borderRadius: "8px",
                fontWeight: "bold",
                textDecoration: "none",
              }}
            >
              Bekijk je coinpagina →
            </a>

            <p>
              <a
                href={`https://explorer.solana.com/address/${mintAddress}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                View token on Solana Explorer
              </a>
            </p>
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
      </section>

      <section className="launch">
        <h2>Token security</h2>
        <p>
          Trek Mint Authority en Freeze Authority in voor een bestaande
          Devnet-token. Dit kan niet ongedaan worden gemaakt.
        </p>

        <label htmlFor="authorityMintAddress">
          Token mint address
        </label>
        <input
          id="authorityMintAddress"
          value={authorityMintAddress}
          onChange={(event) =>
            setAuthorityMintAddress(event.target.value.trim())
          }
          placeholder="Plak hier het token mint address"
          disabled={busy}
        />

        <button
          onClick={revokeTokenAuthorities}
          disabled={busy || !walletAddress}
        >
          {busy ? "Bezig..." : "Revoke Mint & Freeze Authority"}
        </button>

        {securitySignature && (
          <p>
            Security transaction:{" "}
            <a
              href={`https://explorer.solana.com/tx/${securitySignature}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
            >
              Bekijk op Solana Explorer
            </a>
          </p>
        )}

        <p>
          Let op: deze twee instellingen voorkomen niet iedere mogelijke
          rugpull. Liquiditeit en andere risico's moeten apart worden
          gecontroleerd en beveiligd.
        </p>
      </section>

      <footer>
        <p>© 2026 SOLANA.PUMP — Built on Solana</p>
      </footer>
    </main>
  );
}
