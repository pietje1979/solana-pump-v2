
import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import * as RaydiumSdk from "@raydium-io/raydium-sdk-v2";

export const runtime = "nodejs";

const TREASURY =
  "9wTe2MV9ZpBM9TdRsSY9vkMVH595YSeDbvoEebnE2E6W";

// Officieel Raydium Burn & Earn lock-programma op Devnet
const EXPECTED_LOCK_PROGRAM =
  "DRay25Usp3YJAi7beckgpGUC7mGJ2cR1AVPxhYfwVCUX";

export async function GET() {
  try {
    const treasury = new PublicKey(TREASURY);
    const expectedLockProgram = new PublicKey(EXPECTED_LOCK_PROGRAM);

    const devnet = RaydiumSdk.DEVNET_PROGRAM_ID;

    const sdkLockProgram = devnet.LOCK_CPMM_PROGRAM;
    const sdkLockAuth = devnet.LOCK_CPMM_AUTH;

    const checks = {
      treasuryValid: treasury.toBase58() === TREASURY,

      lockProgramExported: Boolean(sdkLockProgram),
      lockAuthExported: Boolean(sdkLockAuth),

      lockInstructionExported:
        typeof RaydiumSdk.makeCpmmLockInstruction === "function",

      lockPositionInstructionExported:
        typeof RaydiumSdk.cpmmLockPositionInstruction === "function",

      lockPdaHelperExported:
        typeof RaydiumSdk.getCpLockPda === "function",

      expectedProgramMatchesSdk:
        sdkLockProgram.equals(expectedLockProgram),

      raydiumClassExported: Boolean(RaydiumSdk.Raydium),
    };

    return NextResponse.json({
      success: true,
      network: "devnet",

      treasuryAddress: treasury.toBase58(),

      expectedLockProgram: expectedLockProgram.toBase58(),

      sdkLockProgram: sdkLockProgram.toBase58(),
      sdkLockAuth: sdkLockAuth.toBase58(),

      checks,

      allChecksPassed: Object.values(checks).every(Boolean),

      transactionsSent: false,
      liquidityLocked: false,

      message:
        "Raydium Devnet-lockadressen en SDK-functies gecontroleerd. Er is niets vergrendeld.",
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
