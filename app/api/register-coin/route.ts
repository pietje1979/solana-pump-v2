
import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getMint } from "@solana/spl-token";

const connection = new Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;

    if (!url || !secret) {
      return NextResponse.json(
        { error: "Database-instellingen ontbreken." },
        { status: 500 }
      );
    }

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
        { error: "Verplichte gegevens ontbreken." },
        { status: 400 }
      );
    }

    if (
      typeof name !== "string" ||
      name.length > 32 ||
      typeof ticker !== "string" ||
      !/^[A-Za-z0-9]{2,10}$/.test(ticker) ||
      typeof description !== "string" ||
      description.length > 1000
    ) {
      return NextResponse.json(
        { error: "Ongeldige coin-gegevens." },
        { status: 400 }
      );
    }

    const mint = new PublicKey(mintAddress);
    const wallet = new PublicKey(walletAddress);

    const transaction = await connection.getParsedTransaction(
      transactionSignature,
      {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      }
    );

    if (!transaction || transaction.meta?.err) {
      return NextResponse.json(
        { error: "Solana-transactie niet geldig of niet bevestigd." },
        { status: 400 }
      );
    }

    const accountKeys = transaction.transaction.message.accountKeys;
    const feePayer = accountKeys[0]?.pubkey.toString();

    if (feePayer !== wallet.toString()) {
      return NextResponse.json(
        { error: "Wallet komt niet overeen met de transactie." },
        { status: 403 }
      );
    }

    const mintIsInTransaction = accountKeys.some(
      (account) => account.pubkey.toString() === mint.toString()
    );

    if (!mintIsInTransaction) {
      return NextResponse.json(
        { error: "Mintadres staat niet in de transactie." },
        { status: 400 }
      );
    }

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
        { error: "Tokenaanmaak of veiligheidscontroles niet bevestigd." },
        { status: 400 }
      );
    }

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
        { error: "Mint- en Freeze Authority zijn niet beide ingetrokken." },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${url}/rest/v1/coins`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: secret,
          Authorization: `Bearer ${secret}`,
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
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        { error: "Opslaan in database mislukt.", details: errorText },
        { status: response.status }
      );
    }

    const savedCoin = await response.json();

    return NextResponse.json({
      success: true,
      coin: savedCoin[0],
    });
  } catch (error) {
    console.error("Register coin error:", error);

    return NextResponse.json(
      { error: "Coin registreren mislukt." },
      { status: 500 }
    );
  }
}
