
import { NextResponse } from "next/server";
import * as RaydiumSdk from "@raydium-io/raydium-sdk-v2";

export const runtime = "nodejs";

export async function GET() {
  try {
    const devnet = RaydiumSdk.DEVNET_PROGRAM_ID;

    const checks = {
      devnetConfigExported: Boolean(devnet),
      devnetLockProgramExported: Boolean(devnet?.LOCK_CPMM_PROGRAM),
      devnetLockAuthorityExported: Boolean(devnet?.LCOK_CPMM_AUTH),
      lockInstructionExported:
        typeof RaydiumSdk.makeCpmmLockInstruction === "function",
      lockPositionInstructionExported:
        typeof RaydiumSdk.cpmmLockPositionInstruction === "function",
      lockPdaHelperExported:
        typeof RaydiumSdk.getCpLockPda === "function",
    };

    return NextResponse.json({
      success: true,
      network: "devnet",
      sdk: "@raydium-io/raydium-sdk-v2",
      devnetAddresses: {
        lockProgram:
          devnet?.LOCK_CPMM_PROGRAM?.toBase58?.() ?? null,
        lockAuthority:
          devnet?.LCOK_CPMM_AUTH?.toBase58?.() ?? null,
        cpmmProgram:
          devnet?.CREATE_CPMM_POOL_PROGRAM?.toBase58?.() ?? null,
      },
      checks,
      allChecksPassed: Object.values(checks).every(Boolean),
      transactionsSent: false,
      message:
        "Devnet-lockadressen gecontroleerd. Er is niets vergrendeld.",
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
