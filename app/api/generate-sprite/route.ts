import { NextRequest, NextResponse } from "next/server";
import { generateSpriteFromBody, type GenerateSpriteRequest } from "@/lib/generateSpriteFromBody";

function errorResponse(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function POST(request: NextRequest) {
  let body: GenerateSpriteRequest;

  try {
    body = (await request.json()) as GenerateSpriteRequest;
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  return generateSpriteFromBody(body);
}
