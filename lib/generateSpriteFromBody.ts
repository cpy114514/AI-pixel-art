import { NextResponse } from "next/server";
import {
  extractSpritePayload,
  repairPixelSprite,
  validatePixelSprite,
  type PixelSprite,
} from "@/lib/pixelUtils";

export type GenerateSpriteRequest = {
  mode?: "generate" | "edit" | "animate";
  prompt?: string;
  editInstruction?: string;
  animationInstruction?: string;
  frameCount?: number;
  stylePreset?: string;
  provider?: string;
  width?: number;
  height?: number;
  apiUrl?: string;
  apiKey?: string;
  model?: string;
  referenceImageDataUrl?: string;
  currentSprite?: unknown;
};

function errorResponse(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

function getFetchErrorDetails(error: unknown, apiUrl: string) {
  const cause = error instanceof Error ? error.cause : undefined;
  const causeRecord =
    cause && typeof cause === "object" ? (cause as Record<string, unknown>) : undefined;

  return {
    apiUrl,
    message: error instanceof Error ? error.message : String(error),
    cause: cause instanceof Error ? cause.message : undefined,
    code: typeof causeRecord?.code === "string" ? causeRecord.code : undefined,
    address: typeof causeRecord?.address === "string" ? causeRecord.address : undefined,
    port: typeof causeRecord?.port === "number" ? causeRecord.port : undefined,
  };
}

function buildStyleGuidance(stylePreset?: string) {
  switch (stylePreset) {
    case "GBA RPG sprite":
      return "GBA RPG: saturated palette, dark readable outline, top-left light, 3-4 shade ramps per material, compact proportions, readable at 1x.";
    case "NES limited palette":
      return "NES: very few strong colors, high contrast, bold silhouette, simple clusters, strong shape language, no noisy dithering.";
    case "Cute mobile game":
      return "Cute mobile: rounded silhouette, expressive face, soft ramps, glossy highlights, friendly proportions, clean toy-like clusters.";
    case "Dark fantasy item":
      return "Dark fantasy: strong outline, metal/magic accents, dramatic shadows, rim highlights, sharp readable details, restrained glow pixels.";
    case "High contrast icon":
      return "High contrast icon: bold outline, large clean shapes, strong foreground/background separation, minimal noise, instantly recognizable silhouette.";
    default:
      return "Modern game sprite: readable silhouette, crisp outline, clean clusters, tasteful color ramps, controlled highlights, polished indie-game finish.";
  }
}

function getPaletteGuidance(width: number, height: number) {
  const pixels = width * height;
  if (pixels <= 64) {
    return "Palette target: transparent plus 5-8 visible #RRGGBB colors. Use one dark outline, one shadow, one midtone, one highlight, and one accent when possible.";
  }
  if (pixels <= 256) {
    return "Palette target: transparent plus 7-12 visible #RRGGBB colors. Build 2-3 color ramps, reuse colors consistently, and add small accent colors only where they improve readability.";
  }
  return "Palette target: transparent plus 10-18 visible #RRGGBB colors. Build distinct ramps for major materials, reuse colors consistently, and avoid one-color or random-color output.";
}

function getCanvasQualityGuidance(width: number, height: number) {
  const longestSide = Math.max(width, height);

  if (longestSide <= 8) {
    return [
      "8px quality target: iconic silhouette first; every visible pixel must contribute to shape, face, shine, or shadow.",
      "Use chunky readable clusters and avoid tiny noisy details.",
    ].join(" ");
  }

  if (longestSide <= 16) {
    return [
      "16px quality target: strong readable outline, clear face or feature marks, 2-3 shade clusters, and recognizable pose/item shape.",
      "Do not leave the subject as a flat blob; add edge shadow, highlight pixels, and interior detail.",
    ].join(" ");
  }

  if (longestSide <= 32) {
    return [
      "32px quality target: use the full resolution, not a doubled 16px sprite.",
      "Add secondary forms, anti-jagged stair-step clusters, material details, ambient shadow pixels, and highlights while keeping clusters clean.",
    ].join(" ");
  }

  return [
    "Large canvas quality target: use the full resolution with deliberate pixel clusters, readable small details, material texture, and clean contours.",
    "Do not upscale a smaller sprite into repeated 2x2 or 4x4 blocks.",
  ].join(" ");
}

function getStrictJsonGuidance(width: number, height: number) {
  return [
    `Return exactly width=${width}, height=${height}.`,
    `pixels must contain exactly ${height} rows, and every row must contain exactly ${width} strings.`,
    "Every cell is one pixel color. Do not compress rows, omit trailing transparent cells, use ellipses, or return a smaller sprite.",
    "Use only #RRGGBB or transparent. No color names except transparent.",
    'Output only JSON with exactly these keys: {"width":number,"height":number,"pixels":[["#RRGGBB","transparent"]]}',
    "No markdown, no comments, no explanations, no extra keys.",
  ].join("\n");
}

function getPixelArtQualityRules(width: number, height: number, hasReferenceImage = false) {
  return [
    getCanvasQualityGuidance(width, height),
    getPaletteGuidance(width, height),
    "Composition: one centered isolated game asset on transparent background unless the request explicitly asks for a background.",
    "Silhouette: readable at 1x with a clear outer contour; use a 1px dark outline or strong edge contrast where useful.",
    "Lighting: consistent top-left light; place shadows on lower-right areas and highlights on upper-left planes.",
    "Pixel technique: use intentional clusters, clean ramps, selective single-pixel highlights, and small hue shifts between light and shadow.",
    "Avoid: flat single-color fills, simple geometric placeholders, blurry gradients, pillow shading, random noise, banding, text labels, UI elements, watermark-like marks.",
    "Anti-upscale rule: each requested pixel is real detail. Never make a smaller sprite and scale it by repeating blocks.",
    hasReferenceImage
      ? "Reference rule: preserve the main subject, pose, proportions, key colors, and iconic details; simplify into pixel clusters instead of tracing noise."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function getTokenBudget(width: number, height: number) {
  const pixels = width * height;
  return Math.max(3000, Math.min(32000, pixels * 10 + 1400));
}

function buildSpriteInstruction(
  prompt: string,
  stylePreset?: string,
  finalWidth?: number,
  finalHeight?: number,
  width?: number,
  height?: number,
  hasReferenceImage = false,
) {
  const targetWidth = width ?? 16;
  const targetHeight = height ?? 16;
  const displayWidth = finalWidth ?? targetWidth;
  const displayHeight = finalHeight ?? targetHeight;

  return [
    "Create one polished production-ready pixel-art game sprite as strict JSON.",
    `Canvas and JSON size: ${displayWidth}x${displayHeight}.`,
    "Ignore any size written in the user request if it conflicts with this exact size.",
    `Style: ${buildStyleGuidance(stylePreset)}`,
    `Request: ${prompt}`,
    hasReferenceImage
      ? "Reference image attached: preserve the main subject, silhouette, pose, key colors, and recognizable details; remove/transparent the background unless requested."
      : "",
    getPixelArtQualityRules(targetWidth, targetHeight, hasReferenceImage),
    getStrictJsonGuidance(targetWidth, targetHeight),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSpriteEditInstruction(
  editInstruction: string,
  currentSprite: PixelSprite,
  stylePreset?: string,
) {
  return [
    "Edit the existing pixel-art sprite as strict JSON. Return the complete final sprite, not a patch.",
    `Canvas and JSON size: ${currentSprite.width}x${currentSprite.height}.`,
    `Edit request: ${editInstruction}`,
    `Style to preserve: ${buildStyleGuidance(stylePreset)}`,
    getPixelArtQualityRules(currentSprite.width, currentSprite.height),
    "Current sprite JSON:",
    JSON.stringify(currentSprite),
    "Rules: change only the pixels needed for the edit; preserve the subject, pose, palette style, outline, lighting, and all unrelated regions.",
    "For local edits like smaller ears, different eyes, color tweaks, or item changes, modify that region and blend it cleanly with neighboring pixels; do not redraw unrelated areas.",
    "If the existing sprite is too plain, improve only where it supports the requested edit: add cleaner outline, highlight, shadow, and detail without changing identity.",
    getStrictJsonGuidance(currentSprite.width, currentSprite.height),
  ].join("\n");
}

function buildSpriteAnimationInstruction(
  animationInstruction: string,
  currentSprite: PixelSprite,
  stylePreset: string | undefined,
  frameCount: number,
) {
  return [
    "Create a polished pixel-art animation as strict JSON.",
    `Canvas size for every frame: ${currentSprite.width}x${currentSprite.height}.`,
    `Return exactly ${frameCount} frames in {"frames":[...]}.`,
    "Frame 1 starts from the provided current sprite. Keep it as the first pose.",
    `Animation request: ${animationInstruction}`,
    `Style to preserve: ${buildStyleGuidance(stylePreset)}`,
    getPixelArtQualityRules(currentSprite.width, currentSprite.height),
    "Current frame JSON:",
    JSON.stringify(currentSprite),
    "Rules: every frame must use the same size, palette style, outline style, lighting direction, and transparent background behavior.",
    "Animate by changing only the pixels needed for motion. Keep the subject identity stable across frames and avoid flickering outlines or random color shifts.",
    "Motion quality: use small readable pose changes, squash/stretch only when appropriate, and keep the anchor position stable unless movement is requested.",
    'Output only JSON with exactly this shape: {"frames":[{"width":number,"height":number,"pixels":[["#RRGGBB","transparent"]]}]}',
    "Use only #RRGGBB or transparent. No markdown, no comments, no ellipses, no extra keys.",
  ].join("\n");
}

function countVisibleColors(sprite: { pixels: string[][] }) {
  return new Set(sprite.pixels.flat().filter((color) => color !== "transparent")).size;
}

function countVisiblePixels(sprite: { pixels: string[][] }) {
  return sprite.pixels.flat().filter((color) => color !== "transparent").length;
}

function buildUpstreamBody(
  parsedApiUrl: URL,
  model: string | undefined,
  prompt: string,
  stylePreset?: string,
  finalWidth?: number,
  finalHeight?: number,
  width?: number,
  height?: number,
  referenceImageDataUrl?: string,
  currentSprite?: PixelSprite,
  editInstruction?: string,
  animationInstruction?: string,
  frameCount?: number,
) {
  const isOpenAiCompatibleChat =
    parsedApiUrl.pathname.endsWith("/chat/completions") ||
    parsedApiUrl.pathname.endsWith("/v1/chat/completions");
  const targetWidth = width ?? 16;
  const targetHeight = height ?? 16;
  const instruction =
    currentSprite && animationInstruction && frameCount
      ? buildSpriteAnimationInstruction(
          animationInstruction,
          currentSprite,
          stylePreset,
          frameCount,
        )
      : currentSprite && editInstruction
      ? buildSpriteEditInstruction(editInstruction, currentSprite, stylePreset)
      : buildSpriteInstruction(
          prompt,
          stylePreset,
          finalWidth,
          finalHeight,
          targetWidth,
          targetHeight,
          Boolean(referenceImageDataUrl),
        );

  if (isOpenAiCompatibleChat) {
    const maxTokens = getTokenBudget(targetWidth, targetHeight);
    return {
      model: model || "gpt-4.1-mini",
      stream: false,
      response_format: { type: "json_object" },
      temperature: 0.35,
      max_completion_tokens: maxTokens,
      messages: [
        {
          role: "system",
          content:
            "You are an expert pixel artist and strict JSON generator for game sprites. Prioritize readable silhouettes, clean pixel clusters, consistent palettes, exact canvas size, and valid JSON only.",
        },
        {
          role: "user",
          content: referenceImageDataUrl
            ? [
                { type: "text", text: instruction },
                {
                  type: "image_url",
                  image_url: {
                    url: referenceImageDataUrl,
                    detail: "low",
                  },
                },
              ]
            : instruction,
        },
      ],
    };
  }

  return {
    model,
    mode: currentSprite && animationInstruction ? "animate" : currentSprite && editInstruction ? "edit" : "generate",
    prompt: referenceImageDataUrl
      ? `${instruction}\n\nReference image is attached as reference_image.data_url.`
      : instruction,
    width,
    height,
    frame_count: frameCount,
    current_sprite: currentSprite,
    reference_image: referenceImageDataUrl ? { data_url: referenceImageDataUrl } : undefined,
    output_format: "json_pixel_sprite",
    schema: {
      type: "object",
      required: ["width", "height", "pixels"],
      properties: {
        width: { type: "integer" },
        height: { type: "integer" },
        pixels: {
          type: "array",
          items: {
            type: "array",
            items: {
              type: "string",
              description: "A #RGB, #RRGGBB, #RRGGBBAA, or transparent color.",
            },
          },
        },
      },
    },
  };
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

function extractAnimationFramesPayload(value: unknown): unknown[] | undefined {
  const payload = extractSpritePayload(value);
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.frames)) {
    return record.frames;
  }

  const nested =
    record.animation ??
    record.spriteSheet ??
    record.sprite_sheet ??
    record.data ??
    record.result ??
    record.output;

  return nested ? extractAnimationFramesPayload(nested) : undefined;
}

function validateReferenceImageDataUrl(value?: string) {
  if (!value) {
    return { ok: true as const, dataUrl: undefined };
  }

  if (typeof value !== "string") {
    return { ok: false as const, error: "Reference image must be a data URL string." };
  }

  if (value.length > 2_000_000) {
    return { ok: false as const, error: "Reference image is too large after compression." };
  }

  if (!/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(value)) {
    return {
      ok: false as const,
      error: "Reference image must be a PNG, JPG, or WebP data URL.",
    };
  }

  return { ok: true as const, dataUrl: value };
}

function normalizeApiUrl(parsedApiUrl: URL) {
  const normalized = new URL(parsedApiUrl);
  const pathname = normalized.pathname.replace(/\/+$/, "");

  if (pathname === "/v1" || pathname.endsWith("/compatible-mode/v1")) {
    normalized.pathname = `${pathname}/chat/completions`;
  }

  return normalized;
}

export async function generateSpriteFromBody(body: GenerateSpriteRequest): Promise<NextResponse> {
  const mode = body.mode === "edit" ? "edit" : body.mode === "animate" ? "animate" : "generate";
  const editInstruction = body.editInstruction?.trim();
  const animationInstruction = body.animationInstruction?.trim();
  const prompt =
    mode === "edit"
      ? editInstruction
      : mode === "animate"
        ? animationInstruction
        : body.prompt?.trim();
  const stylePreset = body.stylePreset?.trim();
  if (!prompt) {
    return errorResponse(
      mode === "edit"
        ? "Edit instruction is required."
        : mode === "animate"
          ? "Animation instruction is required."
          : "Prompt is required.",
      400,
    );
  }

  const referenceImage = validateReferenceImageDataUrl(body.referenceImageDataUrl);
  if (!referenceImage.ok) {
    return errorResponse(referenceImage.error, 400);
  }

  const providerApiUrl =
    body.provider === "clod-openai-best-local-key"
      ? "https://api.clod.io/v1/chat/completions"
      : undefined;
  const providerModel = body.provider === "clod-openai-best-local-key" ? "gpt-5.1" : undefined;
  const apiUrl = providerApiUrl || body.apiUrl?.trim() || process.env.CUSTOM_AI_API_URL;
  const apiKey =
    body.provider === "clod-openai-best-local-key"
      ? process.env.CLOD_LOCAL_API_KEY
      : body.apiKey?.trim() || process.env.CUSTOM_AI_API_KEY;
  const model = providerModel || body.model?.trim() || process.env.CUSTOM_AI_MODEL;

  if (!apiUrl) {
    return errorResponse(
      "API URL is not configured. Enter it in the API connection panel or set CUSTOM_AI_API_URL in .env.local.",
      500,
    );
  }

  if (body.provider === "clod-openai-best-local-key" && !apiKey) {
    return errorResponse(
      "CLōD OpenAI Best Local Key is selected, but CLOD_LOCAL_API_KEY is missing from .env.local. Restart the dev server after adding it.",
      500,
    );
  }

  let parsedApiUrl: URL;
  try {
    parsedApiUrl = new URL(apiUrl);
  } catch {
    return errorResponse(
      "API URL is invalid. Include the full URL, for example https://example.com/generate-sprite.",
      400,
      { apiUrl },
    );
  }

  if (!["http:", "https:"].includes(parsedApiUrl.protocol)) {
    return errorResponse("API URL must start with http:// or https://.", 400, { apiUrl });
  }

  parsedApiUrl = normalizeApiUrl(parsedApiUrl);

  let upstreamResponse: Response;
  const requestedWidth = body.width ?? 16;
  const requestedHeight = body.height ?? 16;
  const requestedFrameCount = Math.max(2, Math.min(12, Math.round(body.frameCount ?? 4)));
  let currentSprite: PixelSprite | undefined;

  if (mode === "edit" || mode === "animate") {
    const currentValidation = validatePixelSprite(body.currentSprite);
    if (!currentValidation.ok) {
      return errorResponse("Current sprite failed validation.", 400, {
        errors: currentValidation.errors,
        warnings: currentValidation.warnings,
      });
    }

    if (
      currentValidation.sprite.width !== requestedWidth ||
      currentValidation.sprite.height !== requestedHeight
    ) {
      return errorResponse("Current sprite size does not match the canvas.", 400, {
        errors: [
          `Canvas is ${requestedWidth}x${requestedHeight}, but current sprite is ${currentValidation.sprite.width}x${currentValidation.sprite.height}.`,
        ],
        warnings: currentValidation.warnings,
      });
    }

    currentSprite = currentValidation.sprite;
  }

  try {
    upstreamResponse = await fetch(parsedApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(
        buildUpstreamBody(
          parsedApiUrl,
          model,
          prompt,
          stylePreset,
          requestedWidth,
          requestedHeight,
          requestedWidth,
          requestedHeight,
          referenceImage.dataUrl,
          currentSprite,
          mode === "edit" ? editInstruction : undefined,
          mode === "animate" ? animationInstruction : undefined,
          mode === "animate" ? requestedFrameCount : undefined,
        ),
      ),
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? `Could not reach custom AI API: ${error.message}.`
        : "Could not reach custom AI API.",
      502,
      getFetchErrorDetails(error, apiUrl),
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
      "Custom AI API returned invalid JSON. It must return a sprite object with width, height, and pixels.",
      502,
      responseText.slice(0, 1200),
    );
  }

  if (mode === "animate") {
    if (!currentSprite) {
      return errorResponse("Current sprite is required for animation generation.", 400);
    }

    const framesPayload = extractAnimationFramesPayload(responseJson);
    if (!framesPayload || framesPayload.length === 0) {
      return errorResponse("Generated animation JSON failed validation.", 422, {
        errors: ['Animation response must be a JSON object like {"frames":[sprite,...]}.'],
        rawResponsePreview: getRawResponsePreview(responseJson),
      });
    }

    const warnings: string[] = [];
    const validatedFrames: PixelSprite[] = [];
    const candidateFrames =
      framesPayload.length === requestedFrameCount - 1
        ? [currentSprite, ...framesPayload]
        : framesPayload;

    candidateFrames.slice(0, requestedFrameCount).forEach((frame, index) => {
      if (index === 0) {
        validatedFrames.push(currentSprite as PixelSprite);
        return;
      }

      const validation = repairPixelSprite(frame);
      if (!validation.ok) {
        warnings.push(`Frame ${index + 1} failed validation and was skipped.`);
        return;
      }
      if (
        validation.sprite.width !== requestedWidth ||
        validation.sprite.height !== requestedHeight
      ) {
        warnings.push(
          `Frame ${index + 1} size mismatch: expected ${requestedWidth}x${requestedHeight}, received ${validation.sprite.width}x${validation.sprite.height}.`,
        );
        return;
      }

      warnings.push(...validation.warnings.map((warning) => `Frame ${index + 1}: ${warning}`));
      validatedFrames.push(validation.sprite);
    });

    if (validatedFrames.length < 2) {
      return errorResponse("Generated animation JSON failed validation.", 422, {
        errors: ["AI did not return any valid animation frames after the current frame."],
        warnings,
        rawResponsePreview: getRawResponsePreview(responseJson),
      });
    }

    if (validatedFrames.length < requestedFrameCount) {
      warnings.push(
        `Requested ${requestedFrameCount} frames and received ${validatedFrames.length} usable frames.`,
      );
    }

    return NextResponse.json({
      frames: validatedFrames,
      warnings,
    });
  }

  const payload = extractSpritePayload(responseJson);
  const validation = repairPixelSprite(payload);

  if (!validation.ok) {
    return errorResponse("Generated sprite JSON failed validation.", 422, {
      errors: validation.errors,
      warnings: validation.warnings,
      rawResponsePreview: getRawResponsePreview(responseJson),
    });
  }

  if (validation.sprite.width !== requestedWidth || validation.sprite.height !== requestedHeight) {
    return errorResponse("Generated sprite JSON failed validation.", 422, {
      errors: [
        `Sprite size mismatch: expected ${requestedWidth}x${requestedHeight}, received ${validation.sprite.width}x${validation.sprite.height}.`,
        "The AI must return the exact canvas size instead of a smaller upscaled sprite.",
      ],
      warnings: validation.warnings,
      rawResponsePreview: getRawResponsePreview(responseJson),
    });
  }

  const finalSprite = validation.sprite;
  const warnings = [...validation.warnings];
  warnings.push(
    `AI output displayed with ${countVisiblePixels(finalSprite)} visible pixels and ${countVisibleColors(finalSprite)} visible colors.`,
  );

  const minimumVisibleColors = finalSprite.width >= 32 || finalSprite.height >= 32 ? 8 : 5;
  const visibleColorCount = countVisibleColors(finalSprite);

  if (visibleColorCount < minimumVisibleColors) {
    warnings.push(
      `Only ${visibleColorCount} visible colors were generated; expected at least ${minimumVisibleColors}. Showing the partial/simple result anyway.`,
    );
  }

  return NextResponse.json({
    sprite: finalSprite,
    warnings,
  });
}
