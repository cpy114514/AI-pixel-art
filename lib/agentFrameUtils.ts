import { validatePixelSprite, type PixelSprite } from "@/lib/pixelUtils";

export function getScale(value: unknown, fallback = 8) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(32, Math.floor(value)))
    : fallback;
}

export function getFrameDelayMs(value: unknown, fallback = 100) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(20, Math.min(2000, Math.round(value)))
    : fallback;
}

export function validateSpriteFrames(input: unknown):
  | { ok: true; frames: PixelSprite[]; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] } {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, errors: ['JSON must include a non-empty "frames" array.'], warnings: [] };
  }

  const frames: PixelSprite[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  input.forEach((frame, index) => {
    const validation = validatePixelSprite(frame);
    if (!validation.ok) {
      errors.push(
        `Frame ${index + 1} failed validation: ${validation.errors.join(" ")}`,
      );
      warnings.push(...validation.warnings.map((warning) => `Frame ${index + 1}: ${warning}`));
      return;
    }

    warnings.push(...validation.warnings.map((warning) => `Frame ${index + 1}: ${warning}`));
    frames.push(validation.sprite);
  });

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const first = frames[0];
  frames.forEach((frame, index) => {
    if (frame.width !== first.width || frame.height !== first.height) {
      errors.push(
        `Frame ${index + 1} size mismatch: expected ${first.width}x${first.height}, received ${frame.width}x${frame.height}.`,
      );
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  return { ok: true, frames, warnings };
}
