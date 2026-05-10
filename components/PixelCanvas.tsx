"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import type { PixelSprite } from "@/lib/pixelUtils";
import { TRANSPARENT } from "@/lib/pixelUtils";

type PixelCanvasProps = {
  sprite: PixelSprite;
  showGrid: boolean;
  onPixelAction: (x: number, y: number) => void;
  onStrokeStart: () => void;
  onStrokeEnd: () => void;
};

const MAX_CANVAS_SIZE = 640;

function drawTransparency(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const half = size / 2;
  ctx.fillStyle = "#eef2f7";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#dbe3ee";
  ctx.fillRect(x, y, half, half);
  ctx.fillRect(x + half, y + half, half, half);
}

export default function PixelCanvas({
  sprite,
  showGrid,
  onPixelAction,
  onStrokeStart,
  onStrokeEnd,
}: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPointerDownRef = useRef(false);
  const lastCellRef = useRef<string | null>(null);
  const cellSize = useMemo(
    () => Math.max(6, Math.floor(MAX_CANVAS_SIZE / Math.max(sprite.width, sprite.height))),
    [sprite.height, sprite.width],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.width = sprite.width * cellSize;
    canvas.height = sprite.height * cellSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < sprite.height; y += 1) {
      for (let x = 0; x < sprite.width; x += 1) {
        const color = sprite.pixels[y][x];
        const px = x * cellSize;
        const py = y * cellSize;

        if (color === TRANSPARENT) {
          drawTransparency(ctx, px, py, cellSize);
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(px, py, cellSize, cellSize);
        }
      }
    }

    if (showGrid) {
      ctx.strokeStyle = "rgba(15, 23, 42, 0.18)";
      ctx.lineWidth = 1;

      for (let x = 0; x <= sprite.width; x += 1) {
        const px = x * cellSize + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, canvas.height);
        ctx.stroke();
      }

      for (let y = 0; y <= sprite.height; y += 1) {
        const py = y * cellSize + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(canvas.width, py);
        ctx.stroke();
      }
    }
  }, [cellSize, showGrid, sprite]);

  function getCanvasCell(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((event.clientX - rect.left) * scaleX) / cellSize);
    const y = Math.floor(((event.clientY - rect.top) * scaleY) / cellSize);

    if (x < 0 || y < 0 || x >= sprite.width || y >= sprite.height) {
      return undefined;
    }

    return { x, y, key: `${x}:${y}` };
  }

  function applyPointerCell(event: React.PointerEvent<HTMLCanvasElement>) {
    const cell = getCanvasCell(event);
    if (!cell || lastCellRef.current === cell.key) {
      return;
    }

    lastCellRef.current = cell.key;
    onPixelAction(cell.x, cell.y);
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-5 shadow-inner">
      <canvas
        ref={canvasRef}
        aria-label={`${sprite.width} by ${sprite.height} pixel canvas`}
        className="max-h-full max-w-full cursor-crosshair touch-none rounded-[3px] bg-white shadow-panel"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          isPointerDownRef.current = true;
          lastCellRef.current = null;
          onStrokeStart();
          applyPointerCell(event);
        }}
        onPointerMove={(event) => {
          if (isPointerDownRef.current) {
            applyPointerCell(event);
          }
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          isPointerDownRef.current = false;
          lastCellRef.current = null;
          onStrokeEnd();
        }}
        onPointerCancel={() => {
          isPointerDownRef.current = false;
          lastCellRef.current = null;
          onStrokeEnd();
        }}
      />
    </div>
  );
}
