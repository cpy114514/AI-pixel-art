import { NextResponse } from "next/server";

/**
 * Optional: reports whether server-side AI env vars exist (no secret values).
 * Kept so Turbopack/Tailwind incremental caches that still reference this path do not ENOENT.
 */
export async function GET() {
  return NextResponse.json({
    customAiApiKeySet: Boolean(process.env.CUSTOM_AI_API_KEY?.trim()),
    clodLocalApiKeySet: Boolean(process.env.CLOD_LOCAL_API_KEY?.trim()),
  });
}
