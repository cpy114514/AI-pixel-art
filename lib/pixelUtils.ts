export type PixelColor = string;

export type PixelSprite = {
  width: number;
  height: number;
  pixels: PixelColor[][];
};

export type SpriteValidationResult =
  | {
      ok: true;
      sprite: PixelSprite;
      warnings: string[];
    }
  | {
      ok: false;
      errors: string[];
      warnings: string[];
    };

export const ALLOWED_SIZES = [8, 16, 32] as const;
export const TRANSPARENT = "transparent";

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isValidPixelColor(color: unknown): color is PixelColor {
  return (
    typeof color === "string" &&
    (color.toLowerCase() === TRANSPARENT || HEX_COLOR_PATTERN.test(color))
  );
}

export function normalizePixelColor(
  color: unknown,
  fallbackColor: PixelColor = TRANSPARENT,
): { color: PixelColor; changed: boolean } {
  if (isValidPixelColor(color)) {
    return { color, changed: false };
  }

  return { color: fallbackColor, changed: true };
}

export function createBlankSprite(width: number, height: number): PixelSprite {
  return {
    width,
    height,
    pixels: Array.from({ length: height }, () =>
      Array.from({ length: width }, () => TRANSPARENT),
    ),
  };
}

export function validatePixelSprite(
  input: unknown,
  fallbackColor: PixelColor = TRANSPARENT,
): SpriteValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input || typeof input !== "object") {
    return {
      ok: false,
      errors: ["Sprite data must be a JSON object."],
      warnings,
    };
  }

  const candidate = input as Partial<PixelSprite>;
  const { width, height, pixels } = candidate;

  if (!Number.isInteger(width) || Number(width) <= 0 || Number(width) > 128) {
    errors.push("Width must be an integer between 1 and 128.");
  }

  if (!Number.isInteger(height) || Number(height) <= 0 || Number(height) > 128) {
    errors.push("Height must be an integer between 1 and 128.");
  }

  if (!Array.isArray(pixels)) {
    errors.push("Pixels must be a two-dimensional array.");
  }

  if (errors.length > 0 || !Array.isArray(pixels)) {
    return { ok: false, errors, warnings };
  }

  if (pixels.length !== height) {
    errors.push(
      `Height mismatch: expected ${height} pixel rows, received ${pixels.length}.`,
    );
  }

  const normalizedPixels: PixelColor[][] = [];
  let invalidColorCount = 0;

  pixels.forEach((row, rowIndex) => {
    if (!Array.isArray(row)) {
      errors.push(`Row ${rowIndex} must be an array.`);
      normalizedPixels[rowIndex] = [];
      return;
    }

    if (row.length !== width) {
      errors.push(
        `Width mismatch on row ${rowIndex}: expected ${width} colors, received ${row.length}.`,
      );
    }

    normalizedPixels[rowIndex] = row.map((color) => {
      const normalized = normalizePixelColor(color, fallbackColor);
      if (normalized.changed) {
        invalidColorCount += 1;
      }
      return normalized.color;
    });
  });

  if (invalidColorCount > 0) {
    warnings.push(
      `${invalidColorCount} invalid color value${
        invalidColorCount === 1 ? " was" : "s were"
      } replaced with ${fallbackColor}.`,
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  return {
    ok: true,
    sprite: {
      width: width as number,
      height: height as number,
      pixels: normalizedPixels,
    },
    warnings,
  };
}

export function repairPixelSprite(
  input: unknown,
  fallbackColor: PixelColor = TRANSPARENT,
): SpriteValidationResult {
  if (!input || typeof input !== "object") {
    return validatePixelSprite(input, fallbackColor);
  }

  const candidate = input as Partial<PixelSprite>;
  const { width, height, pixels } = candidate;

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    Number(width) <= 0 ||
    Number(height) <= 0 ||
    Number(width) > 128 ||
    Number(height) > 128 ||
    !Array.isArray(pixels)
  ) {
    return validatePixelSprite(input, fallbackColor);
  }

  const targetWidth = Number(width);
  const targetHeight = Number(height);
  const repairedPixels: PixelColor[][] = [];
  let repairedRows = 0;
  let repairedCells = 0;
  let invalidColorCount = 0;

  for (let y = 0; y < targetHeight; y += 1) {
    const row = Array.isArray(pixels[y]) ? pixels[y] : [];
    if (!Array.isArray(pixels[y])) {
      repairedRows += 1;
    }

    repairedPixels[y] = [];
    for (let x = 0; x < targetWidth; x += 1) {
      if (x >= row.length) {
        repairedCells += 1;
        repairedPixels[y][x] = fallbackColor;
        continue;
      }

      const normalized = normalizePixelColor(row[x], fallbackColor);
      if (normalized.changed) {
        invalidColorCount += 1;
      }
      repairedPixels[y][x] = normalized.color;
    }

    if (row.length !== targetWidth) {
      repairedCells += Math.abs(row.length - targetWidth);
    }
  }

  const warnings: string[] = [];
  if (repairedRows > 0 || repairedCells > 0 || pixels.length !== targetHeight) {
    warnings.push(
      `AI returned an incomplete ${targetWidth}x${targetHeight} grid, so missing pixels were filled with ${fallbackColor}.`,
    );
  }
  if (invalidColorCount > 0) {
    warnings.push(
      `${invalidColorCount} invalid color value${
        invalidColorCount === 1 ? " was" : "s were"
      } replaced with ${fallbackColor}.`,
    );
  }

  return {
    ok: true,
    sprite: {
      width: targetWidth,
      height: targetHeight,
      pixels: repairedPixels,
    },
    warnings,
  };
}

export function resizeSprite(
  sprite: PixelSprite,
  width: number,
  height: number,
): PixelSprite {
  const next = createBlankSprite(width, height);

  for (let y = 0; y < Math.min(height, sprite.height); y += 1) {
    for (let x = 0; x < Math.min(width, sprite.width); x += 1) {
      next.pixels[y][x] = sprite.pixels[y][x];
    }
  }

  return next;
}

export function scaleSpriteNearest(
  sprite: PixelSprite,
  targetWidth: number,
  targetHeight: number,
): PixelSprite {
  const next = createBlankSprite(targetWidth, targetHeight);

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(sprite.height - 1, Math.floor((y / targetHeight) * sprite.height));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(sprite.width - 1, Math.floor((x / targetWidth) * sprite.width));
      next.pixels[y][x] = sprite.pixels[sourceY][sourceX];
    }
  }

  return next;
}

export function setPixelColor(
  sprite: PixelSprite,
  x: number,
  y: number,
  color: PixelColor,
): PixelSprite {
  if (x < 0 || y < 0 || x >= sprite.width || y >= sprite.height) {
    return sprite;
  }

  return {
    ...sprite,
    pixels: sprite.pixels.map((row, rowIndex) =>
      rowIndex === y
        ? row.map((current, columnIndex) => (columnIndex === x ? color : current))
        : row,
    ),
  };
}

export function spriteToJson(sprite: PixelSprite): string {
  return JSON.stringify(sprite, null, 2);
}

export function parseSpriteJson(json: string): SpriteValidationResult {
  try {
    return validatePixelSprite(JSON.parse(json));
  } catch (error) {
    return {
      ok: false,
      errors: [
        error instanceof Error
          ? `Invalid JSON: ${error.message}`
          : "Invalid JSON.",
      ],
      warnings: [],
    };
  }
}

function parseJsonishString(value: string): unknown {
  const trimmed = value
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/think>/gi, "")
    .trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fencedJson = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedJson?.[1]) {
      try {
        return JSON.parse(fencedJson[1].trim());
      } catch {
        return value;
      }
    }

    const objectStart = trimmed.indexOf("{");
    const objectEnd = trimmed.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      try {
        return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
      } catch {
        return value;
      }
    }

    return value;
  }
}

export function extractSpritePayload(responseBody: unknown): unknown {
  if (typeof responseBody === "string") {
    return parseJsonishString(responseBody);
  }

  if (!responseBody || typeof responseBody !== "object") {
    return responseBody;
  }

  const body = responseBody as Record<string, unknown>;
  const direct = validatePixelSprite(body);
  if (direct.ok) {
    return body;
  }

  const nested =
    body.sprite ??
    body.pixelData ??
    body.pixel_data ??
    body.data ??
    body.result ??
    body.output;

  if (nested) {
    return extractSpritePayload(nested);
  }

  const content = body.content;
  if (typeof content === "string") {
    return extractSpritePayload(content);
  }
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object") {
          const record = part as Record<string, unknown>;
          return record.text ?? record.content ?? "";
        }
        return "";
      })
      .join("\n");
    return extractSpritePayload(text);
  }

  const choices = body.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown>;
    const message = first.message as Record<string, unknown> | undefined;
    return extractSpritePayload(
      message?.content ??
        message?.reasoning_content ??
        message ??
        first.text ??
        first.content ??
        first.delta,
    );
  }

  return body;
}

const t = TRANSPARENT;

export const exampleSprites: Record<string, PixelSprite> = {
  coin: {
    width: 8,
    height: 8,
    pixels: [
      [t, t, "#facc15", "#facc15", "#facc15", "#facc15", t, t],
      [t, "#f59e0b", "#fde047", "#fef08a", "#fde047", "#eab308", "#92400e", t],
      ["#f59e0b", "#fde047", "#fef08a", "#fef3c7", "#fef08a", "#fde047", "#b45309", "#92400e"],
      ["#f59e0b", "#fde047", "#fef08a", "#facc15", "#facc15", "#fde047", "#b45309", "#92400e"],
      ["#f59e0b", "#eab308", "#facc15", "#facc15", "#facc15", "#eab308", "#b45309", "#92400e"],
      ["#92400e", "#d97706", "#eab308", "#facc15", "#eab308", "#d97706", "#92400e", "#78350f"],
      [t, "#92400e", "#b45309", "#d97706", "#d97706", "#92400e", "#78350f", t],
      [t, t, "#78350f", "#92400e", "#92400e", "#78350f", t, t],
    ],
  },
  slime: {
    width: 16,
    height: 16,
    pixels: [
      [t, t, t, t, t, "#38bdf8", "#38bdf8", "#38bdf8", "#38bdf8", "#38bdf8", "#38bdf8", t, t, t, t, t],
      [t, t, t, "#38bdf8", "#38bdf8", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#38bdf8", "#38bdf8", "#38bdf8", t, t, t, t],
      [t, t, "#38bdf8", "#7dd3fc", "#bae6fd", "#bae6fd", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#38bdf8", "#0284c7", "#0284c7", t, t, t],
      [t, "#38bdf8", "#7dd3fc", "#bae6fd", "#bae6fd", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#38bdf8", "#0284c7", "#0284c7", "#0284c7", t, t],
      [t, "#38bdf8", "#7dd3fc", "#bae6fd", "#7dd3fc", "#0f172a", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#0f172a", "#38bdf8", "#0284c7", "#0284c7", "#0284c7", t, t],
      ["#38bdf8", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#0f172a", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#0f172a", "#38bdf8", "#38bdf8", "#0284c7", "#0284c7", "#0284c7", t],
      ["#38bdf8", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#38bdf8", "#38bdf8", "#0284c7", "#0284c7", "#0284c7", t],
      ["#38bdf8", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#0f172a", "#0f172a", "#0f172a", "#0f172a", "#0f172a", "#0f172a", "#38bdf8", "#38bdf8", "#0284c7", "#0284c7", "#0284c7", t],
      ["#38bdf8", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#0f172a", "#0f172a", "#0f172a", "#0f172a", "#38bdf8", "#38bdf8", "#38bdf8", "#0284c7", "#0284c7", "#0284c7", t],
      ["#38bdf8", "#38bdf8", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#38bdf8", "#38bdf8", "#38bdf8", "#0284c7", "#0284c7", "#0284c7", "#0284c7", t],
      [t, "#38bdf8", "#38bdf8", "#7dd3fc", "#7dd3fc", "#7dd3fc", "#38bdf8", "#38bdf8", "#38bdf8", "#38bdf8", "#0284c7", "#0284c7", "#0284c7", "#0284c7", t, t],
      [t, "#0284c7", "#38bdf8", "#38bdf8", "#38bdf8", "#38bdf8", "#38bdf8", "#38bdf8", "#0284c7", "#0284c7", "#0284c7", "#0284c7", "#0284c7", "#0369a1", t, t],
      [t, t, "#0284c7", "#38bdf8", "#38bdf8", "#38bdf8", "#38bdf8", "#0284c7", "#0284c7", "#0284c7", "#0284c7", "#0284c7", "#0369a1", t, t, t],
      [t, t, t, "#0284c7", "#0284c7", "#38bdf8", "#38bdf8", "#0284c7", "#0284c7", "#0284c7", "#0369a1", "#0369a1", t, t, t, t],
      [t, t, t, t, "#0369a1", "#0284c7", "#0284c7", "#0284c7", "#0284c7", "#0369a1", "#0369a1", t, t, t, t, t],
      [t, t, t, t, t, "#0369a1", "#0369a1", "#0369a1", "#0369a1", "#0369a1", t, t, t, t, t, t],
    ],
  },
  sword: {
    width: 16,
    height: 16,
    pixels: [
      [t, t, t, t, t, t, t, t, t, t, "#e5e7eb", "#94a3b8", t, t, t, t],
      [t, t, t, t, t, t, t, t, t, "#e5e7eb", "#f8fafc", "#94a3b8", t, t, t, t],
      [t, t, t, t, t, t, t, t, "#e5e7eb", "#f8fafc", "#cbd5e1", t, t, t, t, t],
      [t, t, t, t, t, t, t, "#e5e7eb", "#f8fafc", "#cbd5e1", t, t, t, t, t, t],
      [t, t, t, t, t, t, "#e5e7eb", "#f8fafc", "#cbd5e1", t, t, t, t, t, t, t],
      [t, t, t, t, t, "#e5e7eb", "#f8fafc", "#cbd5e1", t, t, t, t, t, t, t, t],
      [t, t, t, t, "#e5e7eb", "#f8fafc", "#cbd5e1", t, t, t, t, t, t, t, t, t],
      [t, t, t, "#e5e7eb", "#f8fafc", "#cbd5e1", t, "#f59e0b", "#92400e", t, t, t, t, t, t, t],
      [t, t, "#e5e7eb", "#f8fafc", "#cbd5e1", t, "#f59e0b", "#fbbf24", "#92400e", "#92400e", t, t, t, t, t, t],
      [t, "#1f2937", "#1f2937", "#1f2937", t, t, t, "#92400e", "#451a03", t, t, t, t, t, t, t],
      [t, t, "#1f2937", "#f59e0b", "#1f2937", t, t, "#92400e", t, t, t, t, t, t, t, t],
      [t, t, t, "#92400e", t, t, "#92400e", "#451a03", t, t, t, t, t, t, t, t],
      [t, t, t, t, t, "#92400e", "#451a03", t, t, t, t, t, t, t, t, t],
      [t, t, t, t, "#92400e", "#451a03", t, t, t, t, t, t, t, t, t, t],
      [t, t, t, "#92400e", "#451a03", t, t, t, t, t, t, t, t, t, t, t],
      [t, t, t, "#451a03", t, t, t, t, t, t, t, t, t, t, t, t],
    ],
  },
  heart: {
    width: 16,
    height: 16,
    pixels: [
      [t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t],
      [t, t, t, "#991b1b", "#dc2626", "#dc2626", t, t, t, "#991b1b", "#dc2626", "#dc2626", t, t, t, t],
      [t, t, "#991b1b", "#ef4444", "#f87171", "#ef4444", "#dc2626", t, "#991b1b", "#ef4444", "#f87171", "#ef4444", "#dc2626", t, t, t],
      [t, "#991b1b", "#ef4444", "#fca5a5", "#f87171", "#ef4444", "#ef4444", "#dc2626", "#ef4444", "#f87171", "#fca5a5", "#f87171", "#ef4444", "#dc2626", t, t],
      [t, "#991b1b", "#ef4444", "#f87171", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#f87171", "#ef4444", "#ef4444", "#dc2626", t, t],
      [t, "#991b1b", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#dc2626", t, t],
      [t, t, "#991b1b", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#dc2626", t, t, t],
      [t, t, t, "#991b1b", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#dc2626", t, t, t, t],
      [t, t, t, t, "#991b1b", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#ef4444", "#dc2626", t, t, t, t, t],
      [t, t, t, t, t, "#991b1b", "#ef4444", "#ef4444", "#ef4444", "#dc2626", t, t, t, t, t, t],
      [t, t, t, t, t, t, "#991b1b", "#ef4444", "#dc2626", t, t, t, t, t, t, t],
      [t, t, t, t, t, t, t, "#991b1b", t, t, t, t, t, t, t, t],
      [t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t],
      [t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t],
      [t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t],
      [t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t],
    ],
  },
};
