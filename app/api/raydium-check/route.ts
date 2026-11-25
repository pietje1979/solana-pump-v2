
import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

export const runtime = "nodejs";

const connection = new Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

const TREASURY =
  "9wTe2MV9ZpBM9TdRsSY9vkMVH595YSeDbvoEebnE2E6W";

const PROGRAMS = {
  cpmm: "DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb",
  burnAndEarn: "DRay25Usp3YJAi7beckgpGUC7mGJ2cR1AVPxhYfwVCUX",
  poolFeeReceiver: "3oE58BKVt8KuYkGxx8zBojugnymWmBiyafWgMrnb6eYy",
};

async function checkAccount(address: string) {
  const publicKey = new PublicKey(address);
  const account = await connection.getAccountInfo(publicKey);

  return {
    address: publicKey.toBase58(),
    exists: account !== null,
    executable: account?.executable ?? false,
  };
}

export async function GET() {
  try {
    const [cpmm, burnAndEarn, poolFeeReceiver, treasury] =
      await Promise.all([
        checkAccount(PROGRAMS.cpmm),
        checkAccount(PROGRAMS.burnAndEarn),
        checkAccount(PROGRAMS.poolFeeReceiver),
        checkAccount(TREASURY),
      ]);

    const configResponse = await fetch(
      "https://api-v3-devnet.raydium.io/main/cpmm-config",
      { cache: "no-store" }
    );

    const configs = configResponse.ok
      ? await configResponse.json()
      : null;

    const programsReady =
      cpmm.executable &&
      burnAndEarn.executable &&
      poolFeeReceiver.exists;

    return NextResponse.json({
      success: true,
      network: "Solana Devnet",
      treasuryAddress: treasury.address,
      treasuryExists: treasury.exists,
      programsReady,
      checks: {
        cpmm,
        burnAndEarn,
        poolFeeReceiver,
        treasury,
      },
      cpmmConfigsAvailable: configResponse.ok,
      cpmmConfigs: configs,
      transactionsSent: false,
      liquidityLocked: false,
      message:
        "Raydium-programma's en Treasury gecontroleerd. Er is niets vergrendeld.",
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
