
import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import * as RaydiumSdk from "@raydium-io/raydium-sdk-v2";

export const runtime = "nodejs";

const TREASURY =
  "7jbj9JP2G4vMVJSfUQtr3W7pdejRyB2MgcnzuUGbyYJr";

const EXPECTED_LOCK_PROGRAM =
  "LockrWmn6K5twhz3y9w1dQERbmgSaRkfnTeTKbpofwE";

export async function GET() {
  try {
    const treasury = new PublicKey(TREASURY);
    const expectedLockProgram = new PublicKey(EXPECTED_LOCK_PROGRAM);

    const sdkLockProgram = RaydiumSdk.LOCK_CPMM_PROGRAM;
    const sdkLockAuth = RaydiumSdk.LOCK_CPMM_AUTH;

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
        Boolean(sdkLockProgram) &&
        new PublicKey(sdkLockProgram).equals(expectedLockProgram),
    };

    return NextResponse.json({
      success: true,
      network: "devnet",
      treasuryAddress: treasury.toBase58(),
      expectedLockProgram: expectedLockProgram.toBase58(),
      sdkLockProgram: sdkLockProgram?.toBase58?.() ?? null,
      sdkLockAuth: sdkLockAuth?.toBase58?.() ?? null,
      checks,
      allChecksPassed: Object.values(checks).every(Boolean),
      transactionsSent: false,
      message:
        "Configuratie gecontroleerd. Er is geen liquiditeit vergrendeld.",
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
