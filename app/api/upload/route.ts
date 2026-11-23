
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const jwt = process.env.PINATA_JWT;

    if (!jwt) {
      return NextResponse.json(
        { error: "Pinata is niet ingesteld." },
        { status: 500 }
      );
    }

    const incoming = await request.formData();
    const file = incoming.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Geen afbeelding ontvangen." },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Gebruik PNG, JPG of WEBP." },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "De afbeelding mag maximaal 5 MB zijn." },
        { status: 400 }
      );
    }

    const uploadData = new FormData();
    uploadData.append("file", file);
    uploadData.append("network", "public");
    uploadData.append("name", file.name);

    const response = await fetch(
      "https://uploads.pinata.cloud/v3/files",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        body: uploadData,
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Pinata error:", result);

      return NextResponse.json(
        { error: "Uploaden naar Pinata is mislukt." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      cid: result.data.cid,
      url: `https://gateway.pinata.cloud/ipfs/${result.data.cid}`,
    });
  } catch (error) {
    console.error("Upload error:", error);

    return NextResponse.json(
      { error: "Er is iets misgegaan bij het uploaden." },
      { status: 500 }
    );
  }
}
