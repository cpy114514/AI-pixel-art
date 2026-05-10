import { NextRequest, NextResponse } from "next/server";
import { assertAgentAuthorized } from "@/lib/agentAuth";
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

  const spriteInput = (body as { sprite: unknown }).sprite;
  const result = validatePixelSprite(spriteInput);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, errors: result.errors, warnings: result.warnings },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ok: true,
    sprite: result.sprite,
    warnings: result.warnings,
  });
}
