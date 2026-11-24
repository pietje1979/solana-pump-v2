import { NextResponse } from "next/server";
import * as RaydiumSdk from "@raydium-io/raydium-sdk-v2";

export const runtime = "nodejs";

export async function GET() {
  try {
    const exports = Object.keys(RaydiumSdk).sort();

    const relevantExports = exports.filter((name) =>
      /cpmm|lock|burn|pool|raydium/i.test(name)
    );

    return NextResponse.json({
      success: true,
      sdk: "@raydium-io/raydium-sdk-v2",
      relevantExports,
      totalExports: exports.length,
      transactionsSent: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
