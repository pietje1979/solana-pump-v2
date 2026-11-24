
import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

export const runtime = "nodejs";

const connection = new Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

// Officiële Raydium Devnet-programma's
const PROGRAMS = {
  cpmm: "DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb",
  burnAndEarn: "DRay25Usp3YJAi7beckgpGUC7mGJ2cR1AVPxhYfwVCUX",
  poolFeeReceiver: "3oE58BKVt8KuYkGxx8zBojugnymWmBiyafWgMrnb6eYy",
};

async function checkAccount(address: string) {
  const publicKey = new PublicKey(address);
  const account = await connection.getAccountInfo(publicKey);

  return {
    address,
    exists: account !== null,
    executable: account?.executable ?? false,
  };
}

export async function GET() {
  try {
    const [cpmm, burnAndEarn, poolFeeReceiver] =
      await Promise.all([
        checkAccount(PROGRAMS.cpmm),
        checkAccount(PROGRAMS.burnAndEarn),
        checkAccount(PROGRAMS.poolFeeReceiver),
      ]);

    const configResponse = await fetch(
      "https://api-v3-devnet.raydium.io/main/cpmm-config",
      { cache: "no-store" }
    );

    let configs = null;

    if (configResponse.ok) {
      configs = await configResponse.json();
    }

    const allProgramsReady =
      cpmm.executable &&
      burnAndEarn.executable &&
      poolFeeReceiver.exists;

    return NextResponse.json({
      network: "Solana Devnet",
      success: true,
      programsReady: allProgramsReady,
      checks: {
        cpmm,
        burnAndEarn,
        poolFeeReceiver,
      },
      cpmmConfigsAvailable: configResponse.ok,
      cpmmConfigs: configs,
      transactionsSent: false,
      message: allProgramsReady
        ? "De Devnet-programma's zijn gevonden."
        : "Een of meer Devnet-programma's zijn niet correct beschikbaar.",
    });
  } catch (error) {
    console.error("Raydium check error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "De Raydium Devnet-controle is mislukt.",
      },
      { status: 500 }
    );
  }
}
