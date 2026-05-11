import { NextRequest, NextResponse } from "next/server";
import { assertAgentAuthorized } from "@/lib/agentAuth";
import { getScale, validateSpriteFrames } from "@/lib/agentFrameUtils";
import { toExactArrayBuffer } from "@/lib/binaryResponse";
import { spriteSheetToPngBuffer } from "@/lib/spriteToPng";

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

  if (!body || typeof body !== "object" || !("frames" in body)) {
    return NextResponse.json({ error: 'JSON must include a "frames" array.' }, { status: 400 });
  }

  const record = body as { frames: unknown; scale?: unknown };
  const validation = validateSpriteFrames(record.frames);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Frame validation failed.", errors: validation.errors, warnings: validation.warnings },
      { status: 422 },
    );
  }

  const scale = getScale(record.scale);
  try {
    const buffer = spriteSheetToPngBuffer(validation.frames, scale);
    const first = validation.frames[0];
    return new NextResponse(toExactArrayBuffer(buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="sprite-sheet-${validation.frames.length}frames-${first.width}x${first.height}-${scale}x.png"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Sprite sheet encoding failed.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
