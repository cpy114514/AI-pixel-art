import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const authRequired = Boolean(process.env.AGENT_API_SECRET?.trim());

  return NextResponse.json({
    name: "ai-pixel-painter",
    version: "1.0.0",
    origin,
    auth: {
      agentEndpointsRequireBearer: authRequired,
      envVar: "AGENT_API_SECRET",
      header: authRequired ? "Authorization: Bearer <AGENT_API_SECRET>" : null,
    },
    endpoints: {
      manifest: { method: "GET", url: `${origin}/api/agent/manifest` },
      validateSprite: { method: "POST", url: `${origin}/api/agent/validate` },
      exportPng: { method: "POST", url: `${origin}/api/agent/export-png` },
      generateSprite: { method: "POST", url: `${origin}/api/agent/generate` },
      generateSpriteUi: {
        method: "POST",
        url: `${origin}/api/generate-sprite`,
        note: "Same JSON body as generateSprite; used by the browser UI (no AGENT_API_SECRET gate).",
      },
    },
    sprite: {
      description:
        '{ "width": number, "height": number, "pixels": string[][] } — each cell is #RGB, #RRGGBB, #RRGGBBAA, or "transparent".',
      widthHeightRange: [1, 128],
    },
    mcp: {
      command: "npm run mcp:agent",
      env: {
        AI_PIXEL_PAINTER_BASE_URL: "Base URL of the running Next app (default http://127.0.0.1:3000).",
        AGENT_API_SECRET: "Optional; must match the server .env.local value when set.",
      },
    },
    clients: {
      cursor: "Cursor Settings → MCP → add server command `npm run mcp:agent` in this repo (cwd = project root).",
      openClaw: "Register an MCP server pointing at the same command; see https://docs.openclaw.ai/tools",
      codexCli:
        "Call the HTTP endpoints with curl or a script; Codex has no MCP host by default — use REST or wrap this MCP in your runner.",
    },
  });
}
