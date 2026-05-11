import { normalizePixelColor, TRANSPARENT, type PixelColor } from "@/lib/pixelUtils";

export type VoxelSprite = {
  width: number;
  height: number;
  depth: number;
  voxels: PixelColor[][][];
};

export type VoxelValidationResult =
  | {
      ok: true;
      voxel: VoxelSprite;
      warnings: string[];
    }
  | {
      ok: false;
      errors: string[];
      warnings: string[];
    };

export function createBlankVoxelSprite(width: number, height: number, depth: number): VoxelSprite {
  return {
    width,
    height,
    depth,
    voxels: Array.from({ length: depth }, () =>
      Array.from({ length: height }, () => Array.from({ length: width }, () => TRANSPARENT)),
    ),
  };
}

export function cloneVoxelSprite(voxel: VoxelSprite): VoxelSprite {
  return {
    width: voxel.width,
    height: voxel.height,
    depth: voxel.depth,
    voxels: voxel.voxels.map((layer) => layer.map((row) => [...row])),
  };
}

export function setVoxelColor(
  voxel: VoxelSprite,
  x: number,
  y: number,
  z: number,
  color: PixelColor,
): VoxelSprite {
  if (x < 0 || y < 0 || z < 0 || x >= voxel.width || y >= voxel.height || z >= voxel.depth) {
    return voxel;
  }

  const next = cloneVoxelSprite(voxel);
  next.voxels[z][y][x] = color;
  return next;
}

export function fillVoxelLayer(voxel: VoxelSprite, z: number, color: PixelColor): VoxelSprite {
  if (z < 0 || z >= voxel.depth) {
    return voxel;
  }

  const next = cloneVoxelSprite(voxel);
  next.voxels[z] = Array.from({ length: voxel.height }, () =>
    Array.from({ length: voxel.width }, () => color),
  );
  return next;
}

export function floodFillVoxelLayer(
  voxel: VoxelSprite,
  startX: number,
  startY: number,
  z: number,
  color: PixelColor,
): VoxelSprite {
  if (
    startX < 0 ||
    startY < 0 ||
    z < 0 ||
    startX >= voxel.width ||
    startY >= voxel.height ||
    z >= voxel.depth
  ) {
    return voxel;
  }

  const targetColor = voxel.voxels[z][startY][startX];
  if (targetColor === color) {
    return voxel;
  }

  const next = cloneVoxelSprite(voxel);
  const stack: Array<[number, number]> = [[startX, startY]];

  while (stack.length > 0) {
    const [x, y] = stack.pop() as [number, number];
    if (x < 0 || y < 0 || x >= voxel.width || y >= voxel.height) {
      continue;
    }
    if (next.voxels[z][y][x] !== targetColor) {
      continue;
    }

    next.voxels[z][y][x] = color;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return next;
}

export function repairVoxelSprite(
  input: unknown,
  fallbackColor: PixelColor = TRANSPARENT,
): VoxelValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Voxel data must be a JSON object."], warnings };
  }

  const candidate = input as Partial<VoxelSprite>;
  const { width, height, depth, voxels } = candidate;

  if (!Number.isInteger(width) || Number(width) <= 0 || Number(width) > 32) {
    errors.push("Width must be an integer between 1 and 32.");
  }
  if (!Number.isInteger(height) || Number(height) <= 0 || Number(height) > 32) {
    errors.push("Height must be an integer between 1 and 32.");
  }
  if (!Number.isInteger(depth) || Number(depth) <= 0 || Number(depth) > 32) {
    errors.push("Depth must be an integer between 1 and 32.");
  }
  if (!Array.isArray(voxels)) {
    errors.push("Voxels must be a three-dimensional array: voxels[z][y][x].");
  }

  if (errors.length > 0 || !Array.isArray(voxels)) {
    return { ok: false, errors, warnings };
  }

  const targetWidth = Number(width);
  const targetHeight = Number(height);
  const targetDepth = Number(depth);
  const repaired = createBlankVoxelSprite(targetWidth, targetHeight, targetDepth);
  let repairedCells = 0;
  let invalidColorCount = 0;

  for (let z = 0; z < targetDepth; z += 1) {
    const layer = Array.isArray(voxels[z]) ? voxels[z] : [];
    if (!Array.isArray(voxels[z])) {
      repairedCells += targetWidth * targetHeight;
    }

    for (let y = 0; y < targetHeight; y += 1) {
      const row = Array.isArray(layer[y]) ? layer[y] : [];
      if (!Array.isArray(layer[y])) {
        repairedCells += targetWidth;
      }

      for (let x = 0; x < targetWidth; x += 1) {
        if (x >= row.length) {
          repairedCells += 1;
          continue;
        }

        const normalized = normalizePixelColor(row[x], fallbackColor);
        if (normalized.changed) {
          invalidColorCount += 1;
        }
        repaired.voxels[z][y][x] = normalized.color;
      }

      if (row.length !== targetWidth) {
        repairedCells += Math.abs(row.length - targetWidth);
      }
    }
  }

  if (voxels.length !== targetDepth || repairedCells > 0) {
    warnings.push(
      `AI returned an incomplete ${targetWidth}x${targetHeight}x${targetDepth} voxel grid, so missing cells were filled with transparent.`,
    );
  }
  if (invalidColorCount > 0) {
    warnings.push(
      `${invalidColorCount} invalid color value${
        invalidColorCount === 1 ? " was" : "s were"
      } replaced with ${fallbackColor}.`,
    );
  }

  return { ok: true, voxel: repaired, warnings };
}

function parseJsonishString(value: string): unknown {
  const trimmed = value
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/think>/gi, "")
    .trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("No JSON object found.");
  }
}

export function extractVoxelPayload(value: unknown): unknown {
  if (typeof value === "string") {
    return extractVoxelPayload(parseJsonishString(value));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.width === "number" &&
    typeof record.height === "number" &&
    typeof record.depth === "number" &&
    Array.isArray(record.voxels)
  ) {
    return record;
  }

  const openAiContent = (
    record.choices as Array<{ message?: { content?: unknown } }> | undefined
  )?.[0]?.message?.content;
  if (openAiContent) {
    return extractVoxelPayload(openAiContent);
  }

  const nested =
    record.voxel ??
    record.voxelSprite ??
    record.voxel_sprite ??
    record.sprite ??
    record.data ??
    record.result ??
    record.output;

  return nested ? extractVoxelPayload(nested) : value;
}

export function countVisibleVoxels(voxel: VoxelSprite) {
  return voxel.voxels.flat(2).filter((color) => color !== TRANSPARENT).length;
}
