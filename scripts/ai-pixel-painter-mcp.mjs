import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const base = (process.env.AI_PIXEL_PAINTER_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
const secret = process.env.AGENT_API_SECRET?.trim();

function jsonHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }
  return headers;
}

async function postJson(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { _raw: text.slice(0, 4000) };
  }
  return { ok: response.ok, status: response.status, data };
}

async function exportPngAsDataUrl(sprite, scale) {
  const response = await fetch(`${base}/api/agent/export-png`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ sprite, scale: scale ?? 8 }),
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { _raw: text.slice(0, 2000) };
    }
    return { ok: false, status: response.status, data };
  }

  if (!contentType.includes("image/png")) {
    const text = await response.text();
    return { ok: false, status: response.status, data: text.slice(0, 500) };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;
  return { ok: true, dataUrl, byteLength: buffer.length };
}

const server = new McpServer(
  { name: "ai-pixel-painter", version: "1.0.0" },
  {
    instructions:
      "Bridge to the AI Pixel Painter Next.js app. Run `npm run dev` in the project root first. Set AI_PIXEL_PAINTER_BASE_URL if the app is not at http://127.0.0.1:3000. If the server defines AGENT_API_SECRET, set the same env var for this process.",
  },
);

server.registerTool(
  "pixel_painter_get_manifest",
  {
    description: "GET /api/agent/manifest — endpoints, auth rules, and schema hints.",
    inputSchema: z.object({}),
  },
  async () => {
    const response = await fetch(`${base}/api/agent/manifest`);
    if (!response.ok) {
      const text = await response.text();
      return {
        content: [{ type: "text", text: `HTTP ${response.status}: ${text.slice(0, 2000)}` }],
        isError: true,
      };
    }
    const data = await response.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

server.registerTool(
  "pixel_painter_validate_sprite",
  {
    description:
      'POST /api/agent/validate. Body: { sprite: { width, height, pixels } } — colors are #RGB/#RRGGBB/#RRGGBBAA or "transparent".',
    inputSchema: z.object({
      sprite: z.unknown(),
    }),
  },
  async ({ sprite }) => {
    const result = await postJson("/api/agent/validate", { sprite });
    const text = JSON.stringify(result.data, null, 2);
    if (!result.ok) {
      return { content: [{ type: "text", text }], isError: true };
    }
    return { content: [{ type: "text", text }] };
  },
);

server.registerTool(
  "pixel_painter_export_sprite_png_base64",
  {
    description:
      "POST /api/agent/export-png. Returns a data:image/png;base64,... URL plus byte length for saving or vision tools.",
    inputSchema: z.object({
      sprite: z.unknown(),
      scale: z.number().int().min(1).max(32).optional(),
    }),
  },
  async ({ sprite, scale }) => {
    const result = await exportPngAsDataUrl(sprite, scale);
    if (!result.ok) {
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { byteLength: result.byteLength, dataUrl: result.dataUrl },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerTool(
  "pixel_painter_generate_sprite",
  {
    description:
      "POST /api/agent/generate — same JSON body as the browser UI /api/generate-sprite (mode generate|edit, prompt, apiUrl, apiKey, model, width, height, stylePreset, referenceImageDataUrl, currentSprite for edit). Uses server env CUSTOM_AI_* when fields omitted.",
    inputSchema: z.object({
      mode: z.enum(["generate", "edit"]).optional(),
      prompt: z.string().optional(),
      editInstruction: z.string().optional(),
      stylePreset: z.string().optional(),
      provider: z.string().optional(),
      width: z.number().int().optional(),
      height: z.number().int().optional(),
      apiUrl: z.string().optional(),
      apiKey: z.string().optional(),
      model: z.string().optional(),
      referenceImageDataUrl: z.string().optional(),
      currentSprite: z.unknown().optional(),
    }),
  },
  async (args) => {
    const result = await postJson("/api/agent/generate", args);
    const text = JSON.stringify(result.data, null, 2);
    if (!result.ok) {
      return { content: [{ type: "text", text }], isError: true };
    }
    return { content: [{ type: "text", text }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
