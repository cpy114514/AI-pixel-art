import { NextRequest, NextResponse } from "next/server";
import {
  countVisibleVoxels,
  extractVoxelPayload,
  repairVoxelSprite,
} from "@/lib/voxelUtils";

type GenerateVoxelRequest = {
  prompt?: string;
  stylePreset?: string;
  provider?: string;
  width?: number;
  height?: number;
  depth?: number;
  apiUrl?: string;
  apiKey?: string;
  model?: string;
  accentColor?: string;
};

function errorResponse(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

function normalizeApiUrl(parsedApiUrl: URL) {
  const normalized = new URL(parsedApiUrl);
  const pathname = normalized.pathname.replace(/\/+$/, "");

  if (pathname === "/v1" || pathname.endsWith("/compatible-mode/v1")) {
    normalized.pathname = `${pathname}/chat/completions`;
  }

  return normalized;
}

function getRawResponsePreview(value: unknown) {
  if (typeof value === "string") {
    return value.slice(0, 4000);
  }
  try {
    return JSON.stringify(value).slice(0, 4000);
  } catch {
    return String(value).slice(0, 4000);
  }
}

function buildVoxelInstruction(
  prompt: string,
  width: number,
  height: number,
  depth: number,
  stylePreset?: string,
  accentColor?: string,
) {
  return [
    "Create one 3D pixel-art voxel game asset as strict JSON.",
    `Exact voxel grid: width=${width}, height=${height}, depth=${depth}.`,
    "Coordinate order: voxels[z][y][x], where z is front-to-back layers, y is top-to-bottom rows, x is left-to-right columns.",
    `Style: ${stylePreset || "Modern game sprite"}.`,
    accentColor ? `Preferred main/accent color: ${accentColor}. Build a small palette around it with highlights, midtones, and shadows.` : "",
    `Request: ${prompt}`,
    "Use transparent for empty space. Use #RRGGBB for solid cube colors only.",
    "Build a recognizable 3D silhouette with volume, not a flat 2D sheet. Use depth layers for front, middle, and back forms.",
    "Lighting: top-left-front light; darker colors on lower, right, and back voxels; highlights on upper/front voxels.",
    "Keep the model centered with empty transparent padding where useful. Avoid random noise, text, labels, oversized solid blocks, and single-color output.",
    `Return exactly ${depth} layers, each layer has exactly ${height} rows, each row has exactly ${width} color strings.`,
    'Output only JSON with exactly this shape: {"width":number,"height":number,"depth":number,"voxels":[[["#RRGGBB","transparent"]]]}',
    "No markdown, no comments, no explanations, no ellipses, no extra keys.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUpstreamBody(
  parsedApiUrl: URL,
  model: string | undefined,
  instruction: string,
  width: number,
  height: number,
  depth: number,
) {
  const isOpenAiCompatibleChat =
    parsedApiUrl.pathname.endsWith("/chat/completions") ||
    parsedApiUrl.pathname.endsWith("/v1/chat/completions");

  if (isOpenAiCompatibleChat) {
    return {
      model: model || "gpt-4.1-mini",
      stream: false,
      response_format: { type: "json_object" },
      temperature: 0.25,
      max_completion_tokens: Math.max(4000, Math.min(32000, width * height * depth * 9 + 1600)),
      messages: [
        {
          role: "system",
          content:
            "You are an expert voxel artist and strict JSON generator. Return valid 3D voxel color arrays only.",
        },
        { role: "user", content: instruction },
      ],
    };
  }

  return {
    model,
    mode: "generate_voxel",
    prompt: instruction,
    width,
    height,
    depth,
    output_format: "json_voxel_sprite",
    schema: {
      type: "object",
      required: ["width", "height", "depth", "voxels"],
      properties: {
        width: { type: "integer" },
        height: { type: "integer" },
        depth: { type: "integer" },
        voxels: {
          type: "array",
          description: "3D array in voxels[z][y][x] order.",
        },
      },
    },
  };
}

export async function POST(request: NextRequest) {
  let body: GenerateVoxelRequest;

  try {
    body = (await request.json()) as GenerateVoxelRequest;
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return errorResponse("Prompt is required.", 400);
  }

  const width = Math.max(2, Math.min(16, Math.round(body.width ?? 8)));
  const height = Math.max(2, Math.min(16, Math.round(body.height ?? 8)));
  const depth = Math.max(2, Math.min(16, Math.round(body.depth ?? 8)));
  const providerApiUrl =
    body.provider === "clod-openai-best-local-key"
      ? "https://api.clod.io/v1"
      : undefined;
  const providerModel = body.provider === "clod-openai-best-local-key" ? "GPT-5.2" : undefined;
  const apiUrl = providerApiUrl || body.apiUrl?.trim() || process.env.CUSTOM_AI_API_URL;
  const apiKey =
    body.provider === "clod-openai-best-local-key"
      ? process.env.CLOD_LOCAL_API_KEY
      : body.apiKey?.trim() || process.env.CUSTOM_AI_API_KEY;
  const model = providerModel || body.model?.trim() || process.env.CUSTOM_AI_MODEL;

  if (!apiUrl) {
    return errorResponse("API URL is not configured.", 500);
  }

  let parsedApiUrl: URL;
  try {
    parsedApiUrl = normalizeApiUrl(new URL(apiUrl));
  } catch {
    return errorResponse("API URL is invalid.", 400, { apiUrl });
  }

  const instruction = buildVoxelInstruction(
    prompt,
    width,
    height,
    depth,
    body.stylePreset,
    body.accentColor,
  );
  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(parsedApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(buildUpstreamBody(parsedApiUrl, model, instruction, width, height, depth)),
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? `Could not reach custom AI API: ${error.message}.`
        : "Could not reach custom AI API.",
      502,
    );
  }

  const responseText = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return errorResponse(
      `Custom AI API returned ${upstreamResponse.status}.`,
      502,
      responseText.slice(0, 1200),
    );
  }

  let responseJson: unknown;
  try {
    responseJson = JSON.parse(responseText);
  } catch {
    return errorResponse(
      "Custom AI API returned invalid JSON. It must return a voxel object with width, height, depth, and voxels.",
      502,
      responseText.slice(0, 1200),
    );
  }

  const payload = extractVoxelPayload(responseJson);
  const validation = repairVoxelSprite(payload);
  if (!validation.ok) {
    return errorResponse("Generated voxel JSON failed validation.", 422, {
      errors: validation.errors,
      warnings: validation.warnings,
      rawResponsePreview: getRawResponsePreview(responseJson),
    });
  }

  if (
    validation.voxel.width !== width ||
    validation.voxel.height !== height ||
    validation.voxel.depth !== depth
  ) {
    return errorResponse("Generated voxel JSON failed validation.", 422, {
      errors: [
        `Voxel size mismatch: expected ${width}x${height}x${depth}, received ${validation.voxel.width}x${validation.voxel.height}x${validation.voxel.depth}.`,
      ],
      warnings: validation.warnings,
      rawResponsePreview: getRawResponsePreview(responseJson),
    });
  }

  return NextResponse.json({
    voxel: validation.voxel,
    warnings: [
      ...validation.warnings,
      `AI output displayed with ${countVisibleVoxels(validation.voxel)} solid cubes.`,
    ],
  });
}
