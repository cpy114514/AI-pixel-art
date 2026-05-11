"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { TRANSPARENT } from "@/lib/pixelUtils";
import type { VoxelSprite } from "@/lib/voxelUtils";

type VoxelLayerEditorProps = {
  voxel: VoxelSprite;
  layerIndex: number;
  onVoxelAction: (x: number, y: number) => void;
};

const FALLBACK_CANVAS_SIZE = 280;
const MIN_CELL_SIZE = 6;
const MAX_CELL_SIZE = 32;

function drawTransparency(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const half = size / 2;
  ctx.fillStyle = "#eef2f7";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#dbe3ee";
  ctx.fillRect(x, y, half, half);
  ctx.fillRect(x + half, y + half, half, half);
}

export default function VoxelLayerEditor({
  voxel,
  layerIndex,
  onVoxelAction,
}: VoxelLayerEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPointerDownRef = useRef(false);
  const lastCellRef = useRef<string | null>(null);
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
      setContainerSize({
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const cellSize = useMemo(() => {
    const usableWidth = Math.max(1, containerSize.width - 24);
    const usableHeight = Math.max(1, containerSize.height - 24);
    const fittedCellSize = Math.floor(
      Math.min(usableWidth / voxel.width, usableHeight / voxel.height),
    );
    return Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, fittedCellSize));
  }, [containerSize.height, containerSize.width, voxel.height, voxel.width]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const layer = voxel.voxels[layerIndex];
    if (!canvas || !layer) {
      return;
    }

    canvas.width = voxel.width * cellSize;
    canvas.height = voxel.height * cellSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < voxel.height; y += 1) {
      for (let x = 0; x < voxel.width; x += 1) {
        const color = layer[y][x];
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

    ctx.strokeStyle = "rgba(15, 23, 42, 0.22)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= voxel.width; x += 1) {
      const px = x * cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= voxel.height; y += 1) {
      const py = y * cellSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(canvas.width, py);
      ctx.stroke();
    }
  }, [cellSize, layerIndex, voxel]);

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

    if (x < 0 || y < 0 || x >= voxel.width || y >= voxel.height) {
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
    onVoxelAction(cell.x, cell.y);
  }

  return (
    <div
      className="flex min-h-60 items-center justify-center overflow-auto rounded-md border border-slate-200 bg-slate-100 p-3 shadow-inner"
      ref={containerRef}
    >
      <canvas
        aria-label={`Voxel layer ${layerIndex + 1} editor`}
        className="cursor-crosshair touch-none rounded-[3px] bg-white shadow-panel"
        onPointerCancel={() => {
          isPointerDownRef.current = false;
          lastCellRef.current = null;
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          isPointerDownRef.current = true;
          lastCellRef.current = null;
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
        }}
        ref={canvasRef}
      />
    </div>
  );
}
