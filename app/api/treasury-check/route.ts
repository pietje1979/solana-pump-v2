
import { NextResponse } from "next/server";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

export const runtime = "nodejs";

const TREASURY_DEVNET =
  "7jbj9JP2G4vMVJSfUQtr3W7pdejRyB2MgcnzuUGbyYJr";

const connection = new Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

export async function GET() {
  try {
    const address = new PublicKey(TREASURY_DEVNET);

    const [balance, accountInfo] = await Promise.all([
      connection.getBalance(address),
      connection.getAccountInfo(address),
    ]);

    return NextResponse.json({
      success: true,
      network: "devnet",
      treasuryAddress: address.toBase58(),
      validAddress: true,
      accountExists: accountInfo !== null,
      balanceLamports: balance,
      balanceSOL: balance / LAMPORTS_PER_SOL,
      purpose: "SOLANA.PUMP Devnet Treasury",
      transactionsSent: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        transactionsSent: false,
      },
      { status: 500 }
    );
  }
}
