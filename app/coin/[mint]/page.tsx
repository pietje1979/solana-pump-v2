
import { Connection, PublicKey } from "@solana/web3.js";

export const dynamic = "force-dynamic";

const connection = new Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

const METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

function readMetadataString(
  data: Buffer,
  offset: number
): { value: string; nextOffset: number } {
  const length = data.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + length;

  return {
    value: data.subarray(start, end).toString("utf8").replace(/\0/g, "").trim(),
    nextOffset: end,
  };
}

async function getCoinData(mintAddress: string) {
  const mint = new PublicKey(mintAddress);

  const mintAccount = await connection.getParsedAccountInfo(mint);

  if (!mintAccount.value) {
    throw new Error("Deze coin is niet gevonden op Solana Devnet.");
  }

  const parsed = mintAccount.value.data;

  if (!("parsed" in parsed) || parsed.parsed?.type !== "mint") {
    throw new Error("Dit adres is geen geldig token mint-adres.");
  }

  const mintInfo = parsed.parsed.info;

  const [metadataAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );

  const metadataAccount = await connection.getAccountInfo(metadataAddress);

  let metadata: {
    name: string;
    symbol: string;
    uri: string;
    description: string;
    image: string;
  } = {
    name: "",
    symbol: "",
    uri: "",
    description: "",
    image: "",
  };

  if (metadataAccount) {
    const data = metadataAccount.data;

    let offset = 1 + 32 + 32;

    const name = readMetadataString(data, offset);
    offset = name.nextOffset;

    const symbol = readMetadataString(data, offset);
    offset = symbol.nextOffset;

    const uri = readMetadataString(data, offset);

    metadata.name = name.value;
    metadata.symbol = symbol.value;
    metadata.uri = uri.value;

    if (metadata.uri.startsWith("http")) {
      try {
        const response = await fetch(metadata.uri, {
          cache: "no-store",
        });

        if (response.ok) {
          const json = await response.json();

          metadata.description =
            typeof json.description === "string"
              ? json.description
              : "";

          metadata.image =
            typeof json.image === "string" ? json.image : "";
        }
      } catch {
        // De on-chain metadata blijft zichtbaar als de externe metadata niet bereikbaar is.
      }
    }
  }

  return {
    mintAddress: mint.toBase58(),
    supply: mintInfo.supply,
    decimals: mintInfo.decimals,
    mintAuthority: mintInfo.mintAuthority ?? null,
    freezeAuthority: mintInfo.freezeAuthority ?? null,
    metadata,
  };
}

export default async function CoinPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = await params;

  try {
    const coin = await getCoinData(mint);

    const authoritiesRevoked =
      coin.mintAuthority === null && coin.freezeAuthority === null;

    return (
      <main
        style={{
          maxWidth: "850px",
          margin: "0 auto",
          padding: "40px 20px",
          color: "white",
        }}
      >
        <a href="/" style={{ color: "#a3ff12" }}>
          ← Terug naar SOLANA.PUMP
        </a>

        <h1 style={{ marginTop: "35px" }}>
          {coin.metadata.name || "Solana Coin"}
        </h1>

        <p style={{ color: "#a3ff12" }}>
          {coin.metadata.symbol
            ? `$${coin.metadata.symbol}`
            : "Token"}
        </p>

        {coin.metadata.image && (
          <img
            src={coin.metadata.image}
            alt={coin.metadata.name || "Coin logo"}
            style={{
              width: "180px",
              height: "180px",
              objectFit: "cover",
              borderRadius: "20px",
              margin: "20px 0",
            }}
          />
        )}

        <section
          style={{
            background: "#151922",
            padding: "24px",
            borderRadius: "16px",
            marginTop: "20px",
          }}
        >
          <h2>Het verhaal van deze coin</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {coin.metadata.description ||
              "Er is nog geen beschrijving beschikbaar."}
          </p>
        </section>

        <section
          style={{
            background: "#151922",
            padding: "24px",
            borderRadius: "16px",
            marginTop: "20px",
          }}
        >
          <h2>Coin informatie</h2>

          <p>
            <strong>Totale voorraad:</strong>{" "}
            {(Number(coin.supply) / 10 ** coin.decimals).toLocaleString(
              "en-US"
            )}
          </p>

          <p>
            <strong>Decimals:</strong> {coin.decimals}
          </p>

          <p>
            <strong>Mint adres:</strong>
          </p>

          <p style={{ overflowWrap: "anywhere" }}>
            {coin.mintAddress}
          </p>

          <a
            href={`https://explorer.solana.com/address/${coin.mintAddress}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            style={{ color: "#a3ff12" }}
          >
            Bekijk op Solana Explorer
          </a>
        </section>

        <section
          style={{
            background: "#151922",
            padding: "24px",
            borderRadius: "16px",
            marginTop: "20px",
          }}
        >
          <h2>Token beveiliging</h2>

          <p>
            Mint Authority:{" "}
            {coin.mintAuthority === null
              ? "Ingetrokken"
              : "Nog actief"}
          </p>

          <p>
            Freeze Authority:{" "}
            {coin.freezeAuthority === null
              ? "Ingetrokken"
              : "Nog actief"}
          </p>

          <p style={{ color: authoritiesRevoked ? "#a3ff12" : "#ff7777" }}>
            {authoritiesRevoked
              ? "Beide bevoegdheden zijn ingetrokken."
              : "Let op: een of beide bevoegdheden zijn nog actief."}
          </p>
        </section>

        <p style={{ color: "#999", marginTop: "35px" }}>
          SOLANA.PUMP — Devnet testomgeving
        </p>
      </main>
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Onbekende fout.";

    return (
      <main style={{ padding: "40px 20px", color: "white" }}>
        <a href="/" style={{ color: "#a3ff12" }}>
          ← Terug naar SOLANA.PUMP
        </a>
        <h1>Coin niet gevonden</h1>
        <p>{errorMessage}</p>
      </main>
    );
  }
}
