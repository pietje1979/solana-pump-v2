
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

  const metadata = {
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
        // On-chain metadata blijft beschikbaar.
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

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "15px 0",
        borderBottom: "1px solid #292e38",
      }}
    >
      <p style={{ color: "#9299a6", margin: "0 0 7px", fontSize: "13px" }}>
        {label}
      </p>
      <p
        style={{
          color: "white",
          margin: 0,
          overflowWrap: "anywhere",
          fontSize: "15px",
        }}
      >
        {value}
      </p>
    </div>
  );
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

    const totalSupply = (
      Number(coin.supply) / 10 ** coin.decimals
    ).toLocaleString("en-US");

    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#090b10",
          color: "white",
          padding: "30px 18px 60px",
        }}
      >
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <a
            href="/"
            style={{
              color: "#a3ff12",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            ← Terug naar SOLANA.PUMP
          </a>

          <section
            style={{
              textAlign: "center",
              padding: "45px 15px 30px",
            }}
          >
            {coin.metadata.image ? (
              <img
                src={coin.metadata.image}
                alt={coin.metadata.name || "Coin logo"}
                style={{
                  width: "170px",
                  height: "170px",
                  objectFit: "cover",
                  borderRadius: "28px",
                  border: "2px solid #a3ff12",
                  boxShadow: "0 0 35px #a3ff1230",
                }}
              />
            ) : (
              <div
                style={{
                  width: "170px",
                  height: "170px",
                  margin: "0 auto",
                  borderRadius: "28px",
                  background: "#151922",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "50px",
                }}
              >
                🪙
              </div>
            )}

            <h1 style={{ fontSize: "34px", margin: "22px 0 8px" }}>
              {coin.metadata.name || "Solana Coin"}
            </h1>

            <p
              style={{
                color: "#a3ff12",
                fontSize: "19px",
                fontWeight: "bold",
                margin: 0,
              }}
            >
              {coin.metadata.symbol
                ? `$${coin.metadata.symbol}`
                : "TOKEN"}
            </p>

            <p style={{ color: "#9299a6", fontSize: "13px" }}>
              Built on Solana
            </p>
          </section>

          <section
            style={{
              background: "#151922",
              border: "1px solid #292e38",
              borderRadius: "18px",
              padding: "22px",
              marginBottom: "18px",
            }}
          >
            <h2 style={{ fontSize: "20px", marginTop: 0 }}>
              The story behind this coin
            </h2>

            <p
              style={{
                color: "#c4c9d2",
                lineHeight: 1.8,
                whiteSpace: "pre-wrap",
                marginBottom: 0,
              }}
            >
              {coin.metadata.description ||
                "Er is nog geen beschrijving beschikbaar."}
            </p>
          </section>

          <section
            style={{
              background: "#151922",
              border: "1px solid #292e38",
              borderRadius: "18px",
              padding: "22px",
              marginBottom: "18px",
            }}
          >
            <h2 style={{ fontSize: "20px", marginTop: 0 }}>
              Coin information
            </h2>

            <InfoRow label="Total supply" value={totalSupply} />
            <InfoRow label="Decimals" value={String(coin.decimals)} />
            <InfoRow label="Network" value="Solana Devnet" />

            <div style={{ paddingTop: "18px" }}>
              <p style={{ color: "#9299a6", fontSize: "13px" }}>
                Token mint address
              </p>

              <p
                style={{
                  color: "white",
                  fontSize: "13px",
                  overflowWrap: "anywhere",
                  lineHeight: 1.7,
                }}
              >
                {coin.mintAddress}
              </p>

              <a
                href={`https://explorer.solana.com/address/${coin.mintAddress}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#a3ff12", fontSize: "14px" }}
              >
                View on Solana Explorer ↗
              </a>
            </div>
          </section>

          <section
            style={{
              background: "#151922",
              border: "1px solid #292e38",
              borderRadius: "18px",
              padding: "22px",
              marginBottom: "25px",
            }}
          >
            <h2 style={{ fontSize: "20px", marginTop: 0 }}>
              Security status
            </h2>

            <div style={{ marginBottom: "15px" }}>
              <p style={{ margin: "0 0 6px" }}>Mint Authority</p>
              <strong
                style={{
                  color: coin.mintAuthority === null ? "#a3ff12" : "#ff7777",
                }}
              >
                {coin.mintAuthority === null
                  ? "✓ Revoked"
                  : "⚠ Still active"}
              </strong>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <p style={{ margin: "0 0 6px" }}>Freeze Authority</p>
              <strong
                style={{
                  color: coin.freezeAuthority === null ? "#a3ff12" : "#ff7777",
                }}
              >
                {coin.freezeAuthority === null
                  ? "✓ Revoked"
                  : "⚠ Still active"}
              </strong>
            </div>

            <p
              style={{
                color: authoritiesRevoked ? "#a3ff12" : "#ff7777",
                lineHeight: 1.6,
                fontSize: "14px",
              }}
            >
              {authoritiesRevoked
                ? "Both token authorities have been revoked."
                : "One or more token authorities are still active."}
            </p>

            <p
              style={{
                color: "#9299a6",
                fontSize: "12px",
                lineHeight: 1.6,
                marginBottom: 0,
              }}
            >
              Dit is geen volledige rugpullgarantie. Liquiditeit en andere
              risico's moeten apart worden gecontroleerd.
            </p>
          </section>

          <footer
            style={{
              textAlign: "center",
              color: "#777f8d",
              fontSize: "13px",
            }}
          >
            SOLANA.PUMP — Security first. Community always.
          </footer>
        </div>
      </main>
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Onbekende fout.";

    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#090b10",
          color: "white",
          padding: "40px 20px",
        }}
      >
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <a href="/" style={{ color: "#a3ff12" }}>
            ← Terug naar SOLANA.PUMP
          </a>
          <h1>Coin niet gevonden</h1>
          <p>{errorMessage}</p>
        </div>
      </main>
    );
  }
}
