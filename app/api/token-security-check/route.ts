
import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

export const runtime = "nodejs";

const connection = new Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mintAddress = searchParams.get("mint");

    if (!mintAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "Geef een token mint-adres mee via ?mint=...",
          transactionsSent: false,
        },
        { status: 400 }
      );
    }

    const mint = new PublicKey(mintAddress);
    const account = await connection.getParsedAccountInfo(mint);

    if (!account.value) {
      return NextResponse.json(
        {
          success: false,
          error: "Token mint niet gevonden op Devnet.",
          mintAddress: mint.toBase58(),
          transactionsSent: false,
        },
        { status: 404 }
      );
    }

    const data = account.value.data;

    if (!("parsed" in data) || data.parsed?.type !== "mint") {
      return NextResponse.json(
        {
          success: false,
          error: "Dit adres is geen herkenbaar token mint-account.",
          transactionsSent: false,
        },
        { status: 400 }
      );
    }

    const mintInfo = data.parsed.info;

    const mintAuthority = mintInfo.mintAuthority ?? null;
    const freezeAuthority = mintInfo.freezeAuthority ?? null;

    return NextResponse.json({
      success: true,
      network: "devnet",
      mintAddress: mint.toBase58(),
      tokenProgram: account.value.owner.toBase58(),

      authorities: {
        mintAuthority,
        freezeAuthority,
      },

      security: {
        mintAuthorityRevoked: mintAuthority === null,
        freezeAuthorityRevoked: freezeAuthority === null,
        bothAuthoritiesRevoked:
          mintAuthority === null && freezeAuthority === null,
      },

      transactionsSent: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        transactionsSent: false,
      },
      { status: 400 }
    );
  }
}
