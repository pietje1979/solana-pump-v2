
import { NextResponse } from "next/server";
import * as RaydiumSdk from "@raydium-io/raydium-sdk-v2";

export const runtime = "nodejs";

function address(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "toBase58" in value &&
    typeof value.toBase58 === "function"
  ) {
    return value.toBase58();
  }

  return null;
}

export async function GET() {
  try {
    const devnet = RaydiumSdk.DEVNET_PROGRAM_ID as unknown as
      Record<string, unknown>;

    const checks = {
      devnetProgramConfigExported: Boolean(RaydiumSdk.DEVNET_PROGRAM_ID),
      devnetLockProgramExported: Boolean(RaydiumSdk.DEV_LOCK_CPMM_PROGRAM),
      devnetLockAuthorityExported: Boolean(RaydiumSdk.DEV_LOCK_CPMM_AUTH),
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
        lockProgram: address(devnet.LOCK_CPMM_PROGRAM),
        lockAuthorityTypoKey: address(devnet.LCOK_CPMM_AUTH),
        exportedLockProgram: address(RaydiumSdk.DEV_LOCK_CPMM_PROGRAM),
        exportedLockAuthority: address(RaydiumSdk.DEV_LOCK_CPMM_AUTH),
        cpmmProgram: address(devnet.CREATE_CPMM_POOL_PROGRAM),
      },
      devnetConfigKeys: Object.keys(devnet).sort(),
      checks,
      allChecksPassed: Object.values(checks).every(Boolean),
      transactionsSent: false,
      message:
        "Devnet-lockadressen en SDK-functies gecontroleerd. Er is niets vergrendeld.",
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
