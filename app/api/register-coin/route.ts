
import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getMint } from "@solana/spl-token";

export const runtime = "nodejs";

const connection = new Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secret) {
    return NextResponse.json(
      {
        success: false,
        error: "Supabase-instellingen ontbreken.",
        hasUrl: Boolean(url),
        hasSecret: Boolean(secret),
      },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `${url}/rest/v1/coins?select=id&limit=1`,
      {
        headers: { apikey: secret },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const details = await response.text();

      console.error("Supabase controle mislukt:", details);

      return NextResponse.json(
        {
          success: false,
          database: "Niet verbonden",
          status: response.status,
          details,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      database: "Verbonden",
      table: "public.coins",
      message: "Supabase werkt correct.",
    });
  } catch (error) {
    console.error("Supabase verbindingsfout:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Verbinding met Supabase mislukt.",
        details: String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let stage = "Start registratie";

  try {
    stage = "Supabase-instellingen controleren";

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;

    if (!url || !secret) {
      return NextResponse.json(
        { error: "Database-instellingen ontbreken.", stage },
        { status: 500 }
      );
    }

    stage = "Gegevens ontvangen";

    const body = await request.json();

    const {
      mintAddress,
      name,
      ticker,
      description,
      imageUrl,
      metadataUrl,
      transactionSignature,
      walletAddress,
    } = body;

    if (
      !mintAddress ||
      !name ||
      !ticker ||
      !transactionSignature ||
      !walletAddress
    ) {
      return NextResponse.json(
        { error: "Verplichte gegevens ontbreken.", stage },
        { status: 400 }
      );
    }

    if (
      typeof name !== "string" ||
      name.trim().length === 0 ||
      name.length > 32 ||
      typeof ticker !== "string" ||
      !/^[A-Za-z0-9]{2,10}$/.test(ticker) ||
      typeof description !== "string" ||
      description.length > 1000
    ) {
      return NextResponse.json(
        { error: "Ongeldige coin-gegevens.", stage },
        { status: 400 }
      );
    }

    stage = "Wallet- en mintadres controleren";

    const mint = new PublicKey(mintAddress);
    const wallet = new PublicKey(walletAddress);

    stage = "Solana-transactie controleren";

    const transaction = await connection.getParsedTransaction(
      transactionSignature,
      {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      }
    );

    if (!transaction || transaction.meta?.err) {
      return NextResponse.json(
        {
          error: "Solana-transactie niet geldig of niet bevestigd.",
          stage,
        },
        { status: 400 }
      );
    }

    const accountKeys = transaction.transaction.message.accountKeys;
    const feePayer = accountKeys[0]?.pubkey.toString();

    if (feePayer !== wallet.toString()) {
      return NextResponse.json(
        {
          error: "Wallet komt niet overeen met de transactie.",
          stage,
        },
        { status: 403 }
      );
    }

    const mintIsInTransaction = accountKeys.some(
      (account) => account.pubkey.toString() === mint.toString()
    );

    if (!mintIsInTransaction) {
      return NextResponse.json(
        {
          error: "Mintadres staat niet in de transactie.",
          stage,
        },
        { status: 400 }
      );
    }

    stage = "Token- en veiligheidsinstructies controleren";

    const instructions = transaction.transaction.message.instructions;

    const initializeInstruction = instructions.find((instruction) => {
      if (!("parsed" in instruction)) return false;

      return (
        instruction.program === "spl-token" &&
        instruction.parsed.type === "initializeMint" &&
        instruction.parsed.info.mint === mint.toString()
      );
    });

    const revokedMint = instructions.some((instruction) => {
      if (!("parsed" in instruction)) return false;

      return (
        instruction.program === "spl-token" &&
        instruction.parsed.type === "setAuthority" &&
        instruction.parsed.info.mint === mint.toString() &&
        instruction.parsed.info.authorityType === "mintTokens" &&
        instruction.parsed.info.newAuthority === null
      );
    });

    const revokedFreeze = instructions.some((instruction) => {
      if (!("parsed" in instruction)) return false;

      return (
        instruction.program === "spl-token" &&
        instruction.parsed.type === "setAuthority" &&
        instruction.parsed.info.mint === mint.toString() &&
        instruction.parsed.info.authorityType === "freezeAccount" &&
        instruction.parsed.info.newAuthority === null
      );
    });

    if (!initializeInstruction || !revokedMint || !revokedFreeze) {
      return NextResponse.json(
        {
          error: "Tokenaanmaak of veiligheidscontroles niet bevestigd.",
          stage,
          checks: {
            initializeMint: Boolean(initializeInstruction),
            mintAuthorityRevoked: revokedMint,
            freezeAuthorityRevoked: revokedFreeze,
          },
        },
        { status: 400 }
      );
    }

    stage = "Mint-authoriteiten op de blockchain controleren";

    const mintInfo = await getMint(
      connection,
      mint,
      "confirmed",
      TOKEN_PROGRAM_ID
    );

    if (
      mintInfo.mintAuthority !== null ||
      mintInfo.freezeAuthority !== null
    ) {
      return NextResponse.json(
        {
          error: "Mint- en Freeze Authority zijn niet beide ingetrokken.",
          stage,
        },
        { status: 400 }
      );
    }

    stage = "Coin opslaan in Supabase";

    const response = await fetch(`${url}/rest/v1/coins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: secret,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        mint_address: mint.toString(),
        name: name.trim(),
        ticker: ticker.toUpperCase(),
        description: description.trim(),
        image_url: imageUrl || null,
        metadata_url: metadataUrl || null,
        network: "devnet",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "Supabase opslag mislukt:",
        response.status,
        errorText
      );

      return NextResponse.json(
        {
          error: "Opslaan in database mislukt.",
          stage,
          status: response.status,
          details: errorText,
        },
        { status: response.status }
      );
    }

    const savedCoin = await response.json();

    if (!Array.isArray(savedCoin) || savedCoin.length === 0) {
      return NextResponse.json(
        {
          error: "Supabase heeft geen opgeslagen coin teruggegeven.",
          stage,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      coin: savedCoin[0],
    });
  } catch (error) {
    const details =
      error instanceof Error
        ? error.message
        : String(error);

    console.error("Register coin error:", {
      stage,
      details,
    });

    return NextResponse.json(
      {
        error: "Coin registreren mislukt.",
        stage,
        details,
      },
      { status: 500 }
    );
  }
}
