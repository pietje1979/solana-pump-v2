
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
        { error: "Geen bestand ontvangen." },
        { status: 400 }
      );
    }

    const imageTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    const isImage = imageTypes.includes(file.type);
    const isMetadata = file.type === "application/json";

    if (!isImage && !isMetadata) {
      return NextResponse.json(
        { error: "Alleen PNG, JPG, WEBP of JSON is toegestaan." },
        { status: 400 }
      );
    }

    const maxSize = isImage
      ? 5 * 1024 * 1024
      : 1 * 1024 * 1024;

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Het bestand is te groot." },
        { status: 400 }
      );
    }

    if (isMetadata) {
      try {
        const content = await file.text();
        const parsed = JSON.parse(content);

        if (
          !parsed ||
          typeof parsed.name !== "string" ||
          typeof parsed.symbol !== "string" ||
          typeof parsed.image !== "string"
        ) {
          throw new Error("Ongeldige metadata.");
        }
      } catch {
        return NextResponse.json(
          { error: "Het metadata JSON-bestand is ongeldig." },
          { status: 400 }
        );
      }
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

    const cid = result.data?.cid;

    if (!cid) {
      throw new Error("Pinata heeft geen CID teruggegeven.");
    }

    return NextResponse.json({
      success: true,
      cid,
      url: `https://gateway.pinata.cloud/ipfs/${cid}`,
    });
  } catch (error) {
    console.error("Upload error:", error);

    return NextResponse.json(
      { error: "Er is iets misgegaan bij het uploaden." },
      { status: 500 }
    );
  }
}
