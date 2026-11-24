
import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

export const runtime = "nodejs";

const TREASURY_DEVNET =
  "7jbj9JP2G4vMVJSfUQtr3W7pdejRyB2MgcnzuUGbyYJr";

export async function GET() {
  try {
    const address = new PublicKey(TREASURY_DEVNET);

    return NextResponse.json({
      success: true,
      network: "devnet",
      treasuryAddress: address.toBase58(),
      validAddress: true,
      purpose: "SOLANA.PUMP Devnet Treasury",
      transactionsSent: false,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Ongeldig Treasury-adres",
        transactionsSent: false,
      },
      { status: 400 }
    );
  }
}
