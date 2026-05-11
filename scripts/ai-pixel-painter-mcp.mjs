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

async function getJson(path) {
  const response = await fetch(`${base}${path}`, {
    headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
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

async function exportBinaryAsDataUrl(path, body, expectedContentType) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
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

  if (!contentType.includes(expectedContentType)) {
    const text = await response.text();
    return { ok: false, status: response.status, data: text.slice(0, 500) };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    ok: true,
    byteLength: buffer.length,
    contentType,
    dataUrl: `data:${expectedContentType};base64,${buffer.toString("base64")}`,
  };
}

function jsonText(data) {
  return JSON.stringify(data, null, 2);
}

const server = new McpServer(
  { name: "ai-pixel-painter", version: "1.0.0" },
  {
    instructions:
      "Bridge to the AI Pixel Painter Next.js app. Run `npm run dev` in the project root first. Set AI_PIXEL_PAINTER_BASE_URL if the app is not at http://127.0.0.1:3000. If the server defines AGENT_API_SECRET, set the same env var for this MCP process.",
  },
);

server.registerTool(
  "pixel_painter_get_manifest",
  {
    description: "Get endpoints, auth rules, MCP tools, and schema hints.",
    inputSchema: z.object({}),
  },
  async () => {
    const result = await getJson("/api/agent/manifest");
    if (!result.ok) {
      return { content: [{ type: "text", text: jsonText(result) }], isError: true };
    }
    return { content: [{ type: "text", text: jsonText(result.data) }] };
  },
);

server.registerTool(
  "pixel_painter_validate_sprite",
  {
    description:
      'Validate a sprite JSON object: { width, height, pixels }. Colors are #RGB/#RRGGBB/#RRGGBBAA or "transparent".',
    inputSchema: z.object({
      sprite: z.unknown(),
    }),
  },
  async ({ sprite }) => {
    const result = await postJson("/api/agent/validate", { sprite });
    if (!result.ok) {
      return { content: [{ type: "text", text: jsonText(result.data) }], isError: true };
    }
    return { content: [{ type: "text", text: jsonText(result.data) }] };
  },
);

server.registerTool(
  "pixel_painter_generate_sprite",
  {
    description:
      "Generate one pixel-art sprite from a prompt. Returns { sprite, warnings }. Uses server env CUSTOM_AI_* when API fields are omitted.",
    inputSchema: z.object({
      prompt: z.string(),
      stylePreset: z.string().optional(),
      provider: z.string().optional(),
      width: z.number().int().min(1).max(128).optional(),
      height: z.number().int().min(1).max(128).optional(),
      apiUrl: z.string().optional(),
      apiKey: z.string().optional(),
      model: z.string().optional(),
      referenceImageDataUrl: z.string().optional(),
    }),
  },
  async (args) => {
    const result = await postJson("/api/agent/generate", { ...args, mode: "generate" });
    if (!result.ok) {
      return { content: [{ type: "text", text: jsonText(result.data) }], isError: true };
    }
    return { content: [{ type: "text", text: jsonText(result.data) }] };
  },
);

server.registerTool(
  "pixel_painter_edit_sprite",
  {
    description:
      "Edit an existing sprite with AI. Returns a complete final sprite JSON with the same width and height.",
    inputSchema: z.object({
      editInstruction: z.string(),
      currentSprite: z.unknown(),
      stylePreset: z.string().optional(),
      provider: z.string().optional(),
      width: z.number().int().min(1).max(128).optional(),
      height: z.number().int().min(1).max(128).optional(),
      apiUrl: z.string().optional(),
      apiKey: z.string().optional(),
      model: z.string().optional(),
    }),
  },
  async (args) => {
    const result = await postJson("/api/agent/generate", { ...args, mode: "edit" });
    if (!result.ok) {
      return { content: [{ type: "text", text: jsonText(result.data) }], isError: true };
    }
    return { content: [{ type: "text", text: jsonText(result.data) }] };
  },
);

server.registerTool(
  "pixel_painter_animate_sprite",
  {
    description:
      "Generate animation frames from a current sprite. Returns { frames: [sprite, ...], warnings }.",
    inputSchema: z.object({
      animationInstruction: z.string(),
      currentSprite: z.unknown(),
      frameCount: z.number().int().min(2).max(12).optional(),
      stylePreset: z.string().optional(),
      provider: z.string().optional(),
      width: z.number().int().min(1).max(128).optional(),
      height: z.number().int().min(1).max(128).optional(),
      apiUrl: z.string().optional(),
      apiKey: z.string().optional(),
      model: z.string().optional(),
    }),
  },
  async (args) => {
    const result = await postJson("/api/agent/generate", { ...args, mode: "animate" });
    if (!result.ok) {
      return { content: [{ type: "text", text: jsonText(result.data) }], isError: true };
    }
    return { content: [{ type: "text", text: jsonText(result.data) }] };
  },
);

server.registerTool(
  "pixel_painter_export_sprite_png_base64",
  {
    description:
      "Export one sprite as PNG. Returns { byteLength, contentType, dataUrl }.",
    inputSchema: z.object({
      sprite: z.unknown(),
      scale: z.number().int().min(1).max(32).optional(),
    }),
  },
  async ({ sprite, scale }) => {
    const result = await exportBinaryAsDataUrl(
      "/api/agent/export-png",
      { sprite, scale: scale ?? 8 },
      "image/png",
    );
    if (!result.ok) {
      return { content: [{ type: "text", text: jsonText(result) }], isError: true };
    }
    return { content: [{ type: "text", text: jsonText(result) }] };
  },
);

server.registerTool(
  "pixel_painter_export_sprite_sheet_png_base64",
  {
    description:
      "Export same-sized frames as a horizontal sprite sheet PNG. Returns { byteLength, contentType, dataUrl }.",
    inputSchema: z.object({
      frames: z.array(z.unknown()).min(1),
      scale: z.number().int().min(1).max(32).optional(),
    }),
  },
  async ({ frames, scale }) => {
    const result = await exportBinaryAsDataUrl(
      "/api/agent/export-sprite-sheet",
      { frames, scale: scale ?? 8 },
      "image/png",
    );
    if (!result.ok) {
      return { content: [{ type: "text", text: jsonText(result) }], isError: true };
    }
    return { content: [{ type: "text", text: jsonText(result) }] };
  },
);

server.registerTool(
  "pixel_painter_export_animation_gif_base64",
  {
    description:
      "Export same-sized frames as an animated GIF. Returns { byteLength, contentType, dataUrl }.",
    inputSchema: z.object({
      frames: z.array(z.unknown()).min(1),
      scale: z.number().int().min(1).max(32).optional(),
      frameDelayMs: z.number().int().min(20).max(2000).optional(),
    }),
  },
  async ({ frames, scale, frameDelayMs }) => {
    const result = await exportBinaryAsDataUrl(
      "/api/agent/export-gif",
      { frames, scale: scale ?? 8, frameDelayMs: frameDelayMs ?? 100 },
      "image/gif",
    );
    if (!result.ok) {
      return { content: [{ type: "text", text: jsonText(result) }], isError: true };
    }
    return { content: [{ type: "text", text: jsonText(result) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
