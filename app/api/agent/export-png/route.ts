import { NextRequest, NextResponse } from "next/server";
import { assertAgentAuthorized } from "@/lib/agentAuth";
import { spriteToPngBuffer } from "@/lib/spriteToPng";
import { validatePixelSprite } from "@/lib/pixelUtils";

export async function POST(request: NextRequest) {
  const unauthorized = assertAgentAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("sprite" in body)) {
    return NextResponse.json({ error: 'JSON must include a "sprite" object.' }, { status: 400 });
  }

  const record = body as { sprite: unknown; scale?: unknown };
  const scale =
    typeof record.scale === "number" && Number.isFinite(record.scale)
      ? Math.floor(record.scale)
      : 8;

  const validation = validatePixelSprite(record.sprite);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Sprite validation failed.", errors: validation.errors, warnings: validation.warnings },
      { status: 422 },
    );
  }

  try {
    const buffer = spriteToPngBuffer(validation.sprite, scale);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="sprite-${validation.sprite.width}x${validation.sprite.height}-${scale}x.png"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "PNG encoding failed.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
