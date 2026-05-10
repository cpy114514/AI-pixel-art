"use client";

import type { ReactNode } from "react";
import {
  Eraser,
  Grid2X2,
  PaintBucket,
  Paintbrush,
  Pipette,
  Redo2,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { TRANSPARENT } from "@/lib/pixelUtils";

export type DrawTool = "brush" | "eraser" | "fill" | "eyedropper";

type ToolbarProps = {
  activeTool: DrawTool;
  selectedColor: string;
  showGrid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: DrawTool) => void;
  onColorChange: (color: string) => void;
  onToggleGrid: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
};

const swatches = [
  "#0f172a",
  "#ffffff",
  "#38bdf8",
  "#22c55e",
  "#facc15",
  "#ef4444",
  "#a855f7",
  "#92400e",
];

export default function Toolbar({
  activeTool,
  selectedColor,
  showGrid,
  canUndo,
  canRedo,
  onToolChange,
  onColorChange,
  onToggleGrid,
  onUndo,
  onRedo,
  onClear,
}: ToolbarProps) {
  const tools: Array<{ id: DrawTool; label: string; icon: ReactNode }> = [
    { id: "brush", label: "Brush", icon: <Paintbrush className="h-4 w-4" /> },
    { id: "eraser", label: "Eraser", icon: <Eraser className="h-4 w-4" /> },
    { id: "fill", label: "Fill", icon: <PaintBucket className="h-4 w-4" /> },
    { id: "eyedropper", label: "Pick", icon: <Pipette className="h-4 w-4" /> },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 pr-2 text-sm font-semibold text-slate-700">
        <Paintbrush className="h-4 w-4 text-cyan-600" />
        Tools
      </div>

      <div className="flex items-center gap-1">
        {tools.map((tool) => (
          <button
            aria-label={tool.label}
            className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium ${
              activeTool === tool.id
                ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            title={tool.label}
            type="button"
          >
            {tool.icon}
            <span className="hidden xl:inline">{tool.label}</span>
          </button>
        ))}
      </div>

      <input
        aria-label="Selected paint color"
        type="color"
        value={selectedColor === TRANSPARENT ? "#000000" : selectedColor.slice(0, 7)}
        onChange={(event) => onColorChange(event.target.value)}
        className="h-9 w-10 cursor-pointer rounded-md border border-slate-200 bg-white p-1"
      />

      <div className="flex items-center gap-1">
        {swatches.map((color) => (
          <button
            aria-label={`Use ${color}`}
            key={color}
            onClick={() => onColorChange(color)}
            className={`h-8 w-8 rounded-md border ${
              selectedColor === color ? "border-cyan-600 ring-2 ring-cyan-100" : "border-slate-200"
            }`}
            style={{ backgroundColor: color }}
            type="button"
          />
        ))}
        <button
          aria-label="Use transparent color"
          onClick={() => onColorChange(TRANSPARENT)}
          className={`flex h-8 w-8 items-center justify-center rounded-md border bg-slate-50 text-slate-500 ${
            selectedColor === TRANSPARENT ? "border-cyan-600 ring-2 ring-cyan-100" : "border-slate-200"
          }`}
          type="button"
        >
          <Eraser className="h-4 w-4" />
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          aria-label="Undo"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canUndo}
          onClick={onUndo}
          type="button"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          aria-label="Redo"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canRedo}
          onClick={onRedo}
          type="button"
        >
          <Redo2 className="h-4 w-4" />
        </button>
        <button
          aria-label={showGrid ? "Hide grid" : "Show grid"}
          onClick={onToggleGrid}
          className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium ${
            showGrid
              ? "border-cyan-200 bg-cyan-50 text-cyan-700"
              : "border-slate-200 bg-white text-slate-600"
          }`}
          type="button"
        >
          <Grid2X2 className="h-4 w-4" />
          Grid
        </button>
        <button
          aria-label="Clear sprite"
          onClick={onClear}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          type="button"
        >
          <RotateCcw className="h-4 w-4" />
          Clear
        </button>
      </div>
    </div>
  );
}
