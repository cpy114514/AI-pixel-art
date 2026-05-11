import { NextRequest, NextResponse } from "next/server";
import { assertAgentAuthorized } from "@/lib/agentAuth";
import { toExactArrayBuffer } from "@/lib/binaryResponse";
import { encodeSpritesAnimatedGif } from "@/lib/exportGif";
import { getFrameDelayMs, getScale, validateSpriteFrames } from "@/lib/agentFrameUtils";

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

  const record = body as { frames: unknown; scale?: unknown; frameDelayMs?: unknown };
  const validation = validateSpriteFrames(record.frames);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Frame validation failed.", errors: validation.errors, warnings: validation.warnings },
      { status: 422 },
    );
  }

  const scale = getScale(record.scale);
  const frameDelayMs = getFrameDelayMs(record.frameDelayMs);
  try {
    const bytes = encodeSpritesAnimatedGif(validation.frames, scale, frameDelayMs);
    const first = validation.frames[0];
    return new NextResponse(toExactArrayBuffer(bytes), {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Content-Disposition": `attachment; filename="sprite-animation-${validation.frames.length}frames-${first.width}x${first.height}-${scale}x.gif"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "GIF encoding failed.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
