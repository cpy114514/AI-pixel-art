"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PixelSprite } from "@/lib/pixelUtils";
import { TRANSPARENT } from "@/lib/pixelUtils";

type PixelCanvasProps = {
  sprite: PixelSprite;
  showGrid: boolean;
  onPixelAction: (x: number, y: number) => void;
  onStrokeStart: () => void;
  onStrokeEnd: () => void;
  onResize: (width: number, height: number) => void;
};

const FALLBACK_CANVAS_SIZE = 640;
const MIN_CELL_SIZE = 4;
const MAX_CELL_SIZE = 56;
const MAX_GRID_SIZE = 128;

type ResizeMode = "right" | "bottom" | "corner";

type ResizeDrag = {
  mode: ResizeMode;
  left: number;
  top: number;
  cellSize: number;
  startWidth: number;
  startHeight: number;
  lastWidth: number;
  lastHeight: number;
};

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
  onResize,
}: PixelCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPointerDownRef = useRef(false);
  const lastCellRef = useRef<string | null>(null);
  const resizeDragRef = useRef<ResizeDrag | null>(null);
  const [containerSize, setContainerSize] = useState({
    width: FALLBACK_CANVAS_SIZE,
    height: FALLBACK_CANVAS_SIZE,
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      setContainerSize({
        width: Math.max(1, width),
        height: Math.max(1, height),
      });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const cellSize = useMemo(
    () => {
      const usableWidth = Math.max(1, containerSize.width - 72);
      const usableHeight = Math.max(1, containerSize.height - 72);
      const fittedCellSize = Math.floor(
        Math.min(usableWidth / sprite.width, usableHeight / sprite.height),
      );
      return Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, fittedCellSize));
    },
    [containerSize.height, containerSize.width, sprite.height, sprite.width],
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

  function clampGridSize(value: number) {
    return Math.min(MAX_GRID_SIZE, Math.max(1, value));
  }

  function startResize(event: React.PointerEvent<HTMLButtonElement>, mode: ResizeMode) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    resizeDragRef.current = {
      mode,
      left: rect.left,
      top: rect.top,
      cellSize,
      startWidth: sprite.width,
      startHeight: sprite.height,
      lastWidth: sprite.width,
      lastHeight: sprite.height,
    };
  }

  function updateResize(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = resizeDragRef.current;
    if (!drag) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const pointerWidth = clampGridSize(Math.round((event.clientX - drag.left) / drag.cellSize));
    const pointerHeight = clampGridSize(Math.round((event.clientY - drag.top) / drag.cellSize));
    const nextWidth =
      drag.mode === "right" || drag.mode === "corner" ? pointerWidth : drag.startWidth;
    const nextHeight =
      drag.mode === "bottom" || drag.mode === "corner" ? pointerHeight : drag.startHeight;

    if (nextWidth === drag.lastWidth && nextHeight === drag.lastHeight) {
      return;
    }

    drag.lastWidth = nextWidth;
    drag.lastHeight = nextHeight;
    onResize(nextWidth, nextHeight);
  }

  function endResize(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeDragRef.current = null;
  }

  return (
    <div
      className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-5 shadow-inner"
      ref={containerRef}
    >
      <div className="relative inline-flex max-h-full max-w-full items-start justify-start pr-5 pb-5">
        <canvas
          ref={canvasRef}
          aria-label={`${sprite.width} by ${sprite.height} pixel canvas`}
          className="cursor-crosshair touch-none rounded-[3px] bg-white shadow-panel"
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
        <button
          aria-label="Drag to resize grid width"
          className="absolute top-0 bottom-5 right-1 w-4 cursor-ew-resize rounded border border-cyan-200 bg-cyan-100/80 hover:bg-cyan-200"
          onPointerCancel={endResize}
          onPointerDown={(event) => startResize(event, "right")}
          onPointerMove={updateResize}
          onPointerUp={endResize}
          title="Resize width"
          type="button"
        />
        <button
          aria-label="Drag to resize grid height"
          className="absolute right-5 bottom-1 left-0 h-4 cursor-ns-resize rounded border border-cyan-200 bg-cyan-100/80 hover:bg-cyan-200"
          onPointerCancel={endResize}
          onPointerDown={(event) => startResize(event, "bottom")}
          onPointerMove={updateResize}
          onPointerUp={endResize}
          title="Resize height"
          type="button"
        />
        <button
          aria-label="Drag to resize grid width and height"
          className="absolute right-0 bottom-0 h-5 w-5 cursor-nwse-resize rounded border border-cyan-300 bg-cyan-500 shadow-sm hover:bg-cyan-600"
          onPointerCancel={endResize}
          onPointerDown={(event) => startResize(event, "corner")}
          onPointerMove={updateResize}
          onPointerUp={endResize}
          title="Resize width and height"
          type="button"
        />
      </div>
    </div>
  );
}
