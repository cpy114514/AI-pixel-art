import { NextRequest, NextResponse } from "next/server";

export function agentAuthFailure(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized.", hint: "Set Authorization: Bearer <AGENT_API_SECRET> when the server defines AGENT_API_SECRET." },
    { status: 401 },
  );
}

/**
 * When `AGENT_API_SECRET` is set in the environment, agent HTTP routes require
 * `Authorization: Bearer <same value>`. When unset, requests are allowed (local dev).
 */
export function assertAgentAuthorized(request: NextRequest): NextResponse | null {
  const secret = process.env.AGENT_API_SECRET?.trim();
  if (!secret) {
    return null;
  }
  const auth = request.headers.get("authorization")?.trim();
  if (auth !== `Bearer ${secret}`) {
    return agentAuthFailure();
  }
  return null;
}
