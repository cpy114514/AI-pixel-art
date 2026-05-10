import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { TRANSPARENT, type PixelSprite } from "@/lib/pixelUtils";

function parseHexRgb(color: string): { r: number; g: number; b: number } {
  const lower = color.toLowerCase();
  const hex = lower.startsWith("#") ? lower.slice(1) : lower;
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  if (hex.length >= 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return { r: 0, g: 0, b: 0 };
}

function spriteToRgba(
  sprite: PixelSprite,
  scale: number,
): { data: Uint8ClampedArray; width: number; height: number } {
  const safeScale = Math.max(1, Math.min(32, Math.floor(scale)));
  const w = sprite.width * safeScale;
  const h = sprite.height * safeScale;
  const data = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(sprite.width - 1, Math.floor(x / safeScale));
      const sy = Math.min(sprite.height - 1, Math.floor(y / safeScale));
      const color = sprite.pixels[sy][sx];
      const i = (y * w + x) * 4;
      if (color === TRANSPARENT) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      } else {
        const rgb = parseHexRgb(color);
        data[i] = rgb.r;
        data[i + 1] = rgb.g;
        data[i + 2] = rgb.b;
        data[i + 3] = 255;
      }
    }
  }

  return { data, width: w, height: h };
}

function findTransparentPaletteIndex(palette: number[][]): number {
  for (let i = 0; i < palette.length; i += 1) {
    const c = palette[i];
    if (c.length >= 4 && c[3] === 0) {
      return i;
    }
  }
  return 0;
}

/**
 * Encodes same-sized sprites as an animated GIF (browser / client).
 * Uses one global palette from all frames for stable colors.
 */
export function encodeSpritesAnimatedGif(
  sprites: PixelSprite[],
  scale: number,
  frameDelayMs: number,
): Uint8Array {
  if (sprites.length === 0) {
    throw new Error("No frames to export.");
  }

  const w0 = sprites[0].width;
  const h0 = sprites[0].height;
  for (const s of sprites) {
    if (s.width !== w0 || s.height !== h0) {
      throw new Error("All frames must share the same width and height for GIF export.");
    }
  }

  const rgbaFrames = sprites.map((s) => spriteToRgba(s, scale));
  const { width: w, height: h } = rgbaFrames[0];
  const frameBytes = w * h * 4;
  const combined = new Uint8ClampedArray(frameBytes * rgbaFrames.length);
  rgbaFrames.forEach((frame, index) => {
    combined.set(frame.data, index * frameBytes);
  });

  const palette = quantize(combined, 256, {
    format: "rgba4444",
    oneBitAlpha: true,
  });

  const transparentIndex = findTransparentPaletteIndex(palette);
  const delay = Math.max(20, Math.min(2000, Math.round(frameDelayMs)));

  const gif = GIFEncoder();
  rgbaFrames.forEach((frame, frameIndex) => {
    const index = applyPalette(frame.data, palette, "rgba4444");
    gif.writeFrame(index, w, h, {
      palette: frameIndex === 0 ? palette : undefined,
      delay,
      ...(frameIndex === 0 ? { repeat: 0 } : {}),
      transparent: true,
      transparentIndex,
    });
  });

  gif.finish();
  return gif.bytes();
}
