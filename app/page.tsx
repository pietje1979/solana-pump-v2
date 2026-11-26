"use client";

import { useEffect, useState, type ChangeEvent } from "react";
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
  getAccount,
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

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const umi = createUmi("https://api.devnet.solana.com").use(
  mplTokenMetadata()
);

const DEFAULT_TEST_MINT =
  "429L76ZNArU3ox6LnQ2Rv3xATYTqG4M4iu7QPUpQm6Au";

function formatTokenAmount(amount: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = amount % base;

  const wholeText = whole.toLocaleString("nl-NL");

  if (decimals === 0 || fraction === 0n) {
    return wholeText;
  }

  const fractionText = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return `${wholeText},${fractionText}`;
}

export default function Home() {
  const { connection } = useConnection();

  const { publicKey, connected, sendTransaction } = useWallet();

  const walletAddress = publicKey?.toString() ?? "";

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

  const [securityStatus, setSecurityStatus] = useState("");
  const [securityChecking, setSecurityChecking] = useState(false);

  const [busy, setBusy] = useState(false);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [metadataUrl, setMetadataUrl] = useState("");

  // Nieuwe gegevens voor de totale voorraad en het wallet-saldo.
  const [totalSupply, setTotalSupply] = useState("");
  const [walletTokenBalance, setWalletTokenBalance] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [mintAuthorityStatus, setMintAuthorityStatus] = useState("");
  const [freezeAuthorityStatus, setFreezeAuthorityStatus] = useState("");
  const [tokenInfoStatus, setTokenInfoStatus] = useState("");

  async function loadTokenInformation(address: string) {
    const mintPublicKey = new PublicKey(address);

    const mintInfo = await getMint(
      connection,
      mintPublicKey,
      "confirmed",
      TOKEN_PROGRAM_ID
    );

    setTotalSupply(
      formatTokenAmount(mintInfo.supply, mintInfo.decimals)
    );
    setTokenDecimals(mintInfo.decimals);

    setMintAuthorityStatus(
      mintInfo.mintAuthority === null
        ? "Ingetrokken"
        : "Nog actief"
    );

    setFreezeAuthorityStatus(
      mintInfo.freezeAuthority === null
        ? "Ingetrokken"
        : "Nog actief"
    );

    if (!publicKey) {
      setWalletTokenBalance("");
      return;
    }

    const tokenAccounts = await connection.getTokenAccountsByOwner(
      publicKey,
      { mint: mintPublicKey },
      "confirmed"
    );

    let totalBalance = 0n;

    for (const tokenAccount of tokenAccounts.value) {
      const accountInfo = await getAccount(
        connection,
        tokenAccount.pubkey,
        "confirmed",
        TOKEN_PROGRAM_ID
      );

      totalBalance += accountInfo.amount;
    }

    setWalletTokenBalance(
      formatTokenAmount(totalBalance, mintInfo.decimals)
    );
  }

  // Controleer automatisch beveiliging, voorraad en wallet-saldo.
  useEffect(() => {
    let cancelled = false;

    async function check() {
      const address = authorityMintAddress.trim();

      if (!address) {
        setSecurityStatus("");
        setTokenInfoStatus("");
        setTotalSupply("");
        setWalletTokenBalance("");
        setMintAuthorityStatus("");
        setFreezeAuthorityStatus("");
        setTokenDecimals(null);
        return;
      }

      let mintPublicKey: PublicKey;

      try {
        mintPublicKey = new PublicKey(address);
      } catch {
        setSecurityStatus("Vul een geldig tokenadres in.");
        setTokenInfoStatus("Vul een geldig mintadres in.");
        setTotalSupply("");
        setWalletTokenBalance("");
        return;
      }

      setSecurityChecking(true);
      setTokenInfoStatus("Tokeninformatie wordt opgehaald...");
      setSecurityStatus("Beveiliging wordt gecontroleerd op Solana Devnet...");

      try {
        const mintInfo = await getMint(
          connection,
          mintPublicKey,
          "confirmed",
          TOKEN_PROGRAM_ID
        );

        if (cancelled) return;

        const mintRevoked = mintInfo.mintAuthority === null;
        const freezeRevoked = mintInfo.freezeAuthority === null;

        setTotalSupply(
          formatTokenAmount(mintInfo.supply, mintInfo.decimals)
        );
        setTokenDecimals(mintInfo.decimals);

        setMintAuthorityStatus(
          mintRevoked ? "Ingetrokken" : "Nog actief"
        );

        setFreezeAuthorityStatus(
          freezeRevoked ? "Ingetrokken" : "Nog actief"
        );

        if (mintRevoked && freezeRevoked) {
          setSecurityStatus(
            "BEVEILIGING GESLAAGD: Mint Authority en Freeze Authority zijn allebei ingetrokken."
          );
        } else {
          const mintText = mintRevoked
            ? "Mint Authority: ingetrokken."
            : "Mint Authority: nog actief.";

          const freezeText = freezeRevoked
            ? "Freeze Authority: ingetrokken."
            : "Freeze Authority: nog actief.";

          setSecurityStatus(`${mintText} ${freezeText}`);
        }

        if (publicKey) {
          const tokenAccounts = await connection.getTokenAccountsByOwner(
            publicKey,
            { mint: mintPublicKey },
            "confirmed"
          );

          let totalBalance = 0n;

          for (const tokenAccount of tokenAccounts.value) {
            const accountInfo = await getAccount(
              connection,
              tokenAccount.pubkey,
              "confirmed",
              TOKEN_PROGRAM_ID
            );

            totalBalance += accountInfo.amount;
          }

          if (cancelled) return;

          setWalletTokenBalance(
            formatTokenAmount(totalBalance, mintInfo.decimals)
          );
        } else {
          setWalletTokenBalance("");
        }

        setTokenInfoStatus("Tokeninformatie succesvol opgehaald.");
      } catch (error) {
        if (cancelled) return;

        console.error("Token information check error:", error);

        setSecurityStatus(
          "Controle mislukt. Controleer het mintadres en of je met Devnet verbonden bent."
        );

        setTokenInfoStatus(
          "Tokeninformatie kon niet worden opgehaald. Controleer het mintadres en Devnet."
        );

        setTotalSupply("");
        setWalletTokenBalance("");
        setMintAuthorityStatus("");
        setFreezeAuthorityStatus("");
      } finally {
        if (!cancelled) {
          setSecurityChecking(false);
        }
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, [authorityMintAddress, connection, publicKey]);

  useEffect(() => {
    if (!selectedImage) {
      setImagePreview("");
      return;
    }

    const preview = URL.createObjectURL(selectedImage);
    setImagePreview(preview);

    return () => URL.revokeObjectURL(preview);
  }, [selectedImage]);

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
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

  async function checkSecurityNow() {
    const address = authorityMintAddress.trim();

    try {
      const mintPublicKey = new PublicKey(address);

      setSecurityChecking(true);
      setSecurityStatus("Beveiliging wordt gecontroleerd...");
      setTokenInfoStatus("Tokeninformatie wordt opgehaald...");

      await loadTokenInformation(address);

      const mintInfo = await getMint(
        connection,
        mintPublicKey,
        "confirmed",
        TOKEN_PROGRAM_ID
      );

      const mintRevoked = mintInfo.mintAuthority === null;
      const freezeRevoked = mintInfo.freezeAuthority === null;

      if (mintRevoked && freezeRevoked) {
        setSecurityStatus(
          "BEVEILIGING GESLAAGD: Mint Authority en Freeze Authority zijn allebei ingetrokken."
        );
      } else {
        setSecurityStatus(
          `${mintRevoked ? "Mint Authority: ingetrokken." : "Mint Authority: nog actief."} ${freezeRevoked ? "Freeze Authority: ingetrokken." : "Freeze Authority: nog actief."}`
        );
      }

      setTokenInfoStatus("Tokeninformatie succesvol opgehaald.");
    } catch (error) {
      console.error("Security check error:", error);
      setSecurityStatus(
        "Controle mislukt. Controleer het tokenadres en Devnet."
      );
      setTokenInfoStatus("Tokeninformatie kon niet worden opgehaald.");
    } finally {
      setSecurityChecking(false);
    }
  }

  async function revokeTokenAuthorities() {
    if (busy) return;

    try {
      if (!connected || !publicKey) {
        setMessage("Verbind eerst je wallet.");
        return;
      }

      setBusy(true);
      setMessage("");

      let mintPublicKey: PublicKey;

      try {
        mintPublicKey = new PublicKey(authorityMintAddress.trim());
      } catch {
        setMessage("Het tokenadres is ongeldig. Controleer het mintadres.");
        return;
      }

      const mintInfo = await getMint(
        connection,
        mintPublicKey,
        "confirmed",
        TOKEN_PROGRAM_ID
      );

      const transaction = new Transaction();
      let instructionsAdded = 0;

      if (mintInfo.mintAuthority?.equals(publicKey)) {
        transaction.add(
          createSetAuthorityInstruction(
            mintPublicKey,
            publicKey,
            AuthorityType.MintTokens,
            null,
            [],
            TOKEN_PROGRAM_ID
          )
        );
        instructionsAdded++;
      } else if (mintInfo.mintAuthority !== null) {
        setMessage(
          "Deze wallet is niet de Mint Authority van deze munt."
        );
        return;
      }

      if (mintInfo.freezeAuthority?.equals(publicKey)) {
        transaction.add(
          createSetAuthorityInstruction(
            mintPublicKey,
            publicKey,
            AuthorityType.FreezeAccount,
            null,
            [],
            TOKEN_PROGRAM_ID
          )
        );
        instructionsAdded++;
      } else if (mintInfo.freezeAuthority !== null) {
        setMessage(
          "Deze wallet is niet de Freeze Authority van deze munt."
        );
        return;
      }

      if (instructionsAdded === 0) {
        setMessage("Beide bevoegdheden zijn al ingetrokken.");
        await checkSecurityNow();
        return;
      }

      const latest = await connection.getLatestBlockhash("confirmed");
      transaction.feePayer = publicKey;
      transaction.recentBlockhash = latest.blockhash;

      setMessage(
        "Controleer de beveiligingstransactie in je wallet en bevestig deze."
      );

      const signature = await sendTransaction(
        transaction,
        connection,
        { preflightCommitment: "confirmed" }
      );

      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error("De beveiligingstransactie is niet geslaagd.");
      }

      setSecuritySignature(signature);

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
        setSecurityStatus(
          "BEVEILIGING GESLAAGD: Mint Authority en Freeze Authority zijn allebei ingetrokken."
        );
      } else {
        setMessage(
          "Transactie bevestigd. Controleer de resterende bevoegdheid opnieuw."
        );
      }

      await loadTokenInformation(authorityMintAddress.trim());
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

    try {
      setMessage("");
      setMintAddress("");
      setTransactionSignature("");
      setImageUrl("");
      setMetadataUrl("");

      if (!connected || !publicKey) {
        setMessage("Verbind eerst je wallet.");
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

      if (!description.trim()) {
        setMessage("Schrijf eerst het verhaal achter je coin.");
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

      const wallet = publicKey;

      setMessage("Stap 1/4: logo wordt naar Pinata geüpload...");
      const imageUpload = await uploadToPinata(selectedImage);
      setImageUrl(imageUpload.url);

      setMessage("Stap 2/4: coin-gegevens worden opgeslagen...");

      const metadata = {
        name: coinName.trim(),
        symbol: ticker,
        description: description.trim(),
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
        "Stap 4/4: controleer de tokenaanmaak in je wallet en bevestig deze..."
      );

      const signature = await sendTransaction(
        transaction,
        connection,
        { preflightCommitment: "confirmed" }
      );

      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error("De tokenaanmaak is niet geslaagd.");
      }

      const createdMintAddress = mint.publicKey.toString();

      setMintAddress(createdMintAddress);
      setAuthorityMintAddress(createdMintAddress);
      setTransactionSignature(signature);

      const createdMint = await getMint(
        connection,
        mint.publicKey,
        "confirmed",
        TOKEN_PROGRAM_ID
      );

      if (
        createdMint.mintAuthority === null &&
        createdMint.freezeAuthority === null
      ) {
        setMessage(
          "Je testcoin is aangemaakt. Mint Authority en Freeze Authority zijn direct ingetrokken."
        );
        setSecurityStatus(
          "BEVEILIGING GESLAAGD: Mint Authority en Freeze Authority zijn allebei ingetrokken."
        );
      } else {
        setMessage(
          "Je testcoin is aangemaakt. Let op: controle van de bevoegdheden is nog niet afgerond."
        );
      }

      await loadTokenInformation(createdMintAddress);
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
          <WalletMultiButton />
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
        <p role="status">
          Coin-lancering is tijdelijk uitgeschakeld. SOLANA.PUMP activeert dit pas
          wanneer de verplichte 90/10-verdeling, de 12-maands makerlock en de
          permanente liquiditeitsvergrendeling on-chain zijn ingebouwd en getest.
        </p>

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

        <label htmlFor="description">The story behind your coin</label>
        <textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Vertel waar je coin voor staat, wat je idee is en wat je community samenbrengt..."
          rows={5}
          maxLength={1000}
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

        <button onClick={createCoin} disabled={true}>
          Launch tijdelijk uitgeschakeld
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
      </section>

      <section className="launch">
        <h2>Tokeninformatie</h2>
        <p>
          Deze gegevens worden rechtstreeks gecontroleerd op Solana Devnet.
        </p>

        <label htmlFor="authorityMintAddress">
          Token mint address
        </label>

        <input
          id="authorityMintAddress"
          value={authorityMintAddress}
          onChange={(event) =>
            setAuthorityMintAddress(event.target.value)
          }
          placeholder="Plak hier het token mint address"
          disabled={busy}
        />

        <p aria-live="polite">{tokenInfoStatus}</p>

        <div>
          <h3>Totale tokenvoorraad</h3>
          <p>
            {totalSupply !== ""
              ? `${totalSupply} tokens`
              : "Nog niet beschikbaar"}
          </p>
        </div>

        <div>
          <h3>Saldo in jouw verbonden wallet</h3>
          <p>
            {!connected
              ? "Verbind je wallet om je saldo te bekijken."
              : walletTokenBalance !== ""
                ? `${walletTokenBalance} tokens`
                : "Saldo wordt opgehaald..."}
          </p>
        </div>

        <div>
          <h3>Mint Authority</h3>
          <p>{mintAuthorityStatus || "Nog niet gecontroleerd"}</p>
        </div>

        <div>
          <h3>Freeze Authority</h3>
          <p>{freezeAuthorityStatus || "Nog niet gecontroleerd"}</p>
        </div>

        <div>
          <h3>Aantal decimalen</h3>
          <p>
            {tokenDecimals !== null
              ? tokenDecimals
              : "Nog niet beschikbaar"}
          </p>
        </div>

        <div>
          <h3>Mintadres</h3>
          <p>{authorityMintAddress || "Nog geen mintadres ingevuld"}</p>
          {authorityMintAddress && (
            <a
              href={`https://explorer.solana.com/address/${authorityMintAddress}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
            >
              Bekijk token op Solana Explorer
            </a>
          )}
        </div>
      </section>

      <section className="launch">
        <h2>Token security</h2>
        <p>
          Controleer Mint Authority en Freeze Authority van een bestaande
          Devnet-token. Als ze al zijn ingetrokken, laat SOLANA.PUMP dat zien.
        </p>

        <p aria-live="polite">
          {securityChecking ? "Bezig met controleren..." : securityStatus}
        </p>

        <button
          onClick={checkSecurityNow}
          disabled={securityChecking || busy}
        >
          {securityChecking ? "Controleren..." : "Controleer beveiliging"}
        </button>

        <button
          onClick={revokeTokenAuthorities}
          disabled={busy || !connected}
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
