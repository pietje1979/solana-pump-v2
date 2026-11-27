import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getMint } from "@solana/spl-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const connection = new Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

export async function GET(request: NextRequest) {
  const mintAddress = request.nextUrl.searchParams.get("mint");

  if (!mintAddress) {
    return NextResponse.json(
      { error: "Mintadres ontbreekt." },
      { status: 400 }
    );
  }

  try {
    const mint = new PublicKey(mintAddress);
    const mintInfo = await getMint(
      connection,
      mint,
      "confirmed",
      TOKEN_PROGRAM_ID
    );

    return NextResponse.json({
      mint: mint.toBase58(),
      supply: mintInfo.supply.toString(),
      decimals: mintInfo.decimals,
      network: "devnet",
    });
  } catch (error) {
    console.error("Tokenvoorraad ophalen mislukt:", error);

    return NextResponse.json(
      { error: "Tokenvoorraad kon niet worden opgehaald." },
      { status: 502 }
    );
  }
}
