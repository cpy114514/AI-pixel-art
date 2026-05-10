import { PNG } from "pngjs";
import { TRANSPARENT, type PixelSprite } from "@/lib/pixelUtils";

function parseHexToRgba(color: string): { r: number; g: number; b: number; a: number } {
  const lower = color.toLowerCase();
  if (lower === TRANSPARENT) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const hex = lower.startsWith("#") ? lower.slice(1) : lower;
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return { r, g, b, a: 255 };
  }
  if (hex.length === 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 255,
    };
  }
  if (hex.length === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: parseInt(hex.slice(6, 8), 16),
    };
  }

  return { r: 0, g: 0, b: 0, a: 0 };
}

export function spriteToPngBuffer(sprite: PixelSprite, scale: number): Buffer {
  const safeScale = Math.max(1, Math.min(32, Math.floor(scale)));
  const w = sprite.width * safeScale;
  const h = sprite.height * safeScale;

  const png = new PNG({ width: w, height: h, colorType: 6 });

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(sprite.width - 1, Math.floor(x / safeScale));
      const sy = Math.min(sprite.height - 1, Math.floor(y / safeScale));
      const rgba = parseHexToRgba(sprite.pixels[sy][sx]);
      const idx = (w * y + x) << 2;
      png.data[idx] = rgba.r;
      png.data[idx + 1] = rgba.g;
      png.data[idx + 2] = rgba.b;
      png.data[idx + 3] = rgba.a;
    }
  }

  return PNG.sync.write(png, { colorType: 6 });
}
