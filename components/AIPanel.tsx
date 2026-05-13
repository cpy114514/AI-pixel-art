"use client";

import { Bot, Film, History, ImagePlus, Pause, Pencil, Ruler, Sparkles, Trash2, X } from "lucide-react";
import { ALLOWED_SIZES, TRANSPARENT, type PixelSprite } from "@/lib/pixelUtils";
import { useLayoutEffect, useRef, useState } from "react";
import NextImage from "next/image";

export type SpriteHistoryItem = {
  id: string;
  createdAt: string;
  prompt: string;
  stylePreset: string;
  sprite: PixelSprite;
  frames?: PixelSprite[];
};

export type ReferenceImage = {
  name: string;
  dataUrl: string;
  width: number;
  height: number;
};

type AIPanelProps = {
  prompt: string;
  editInstruction: string;
  animationFrameCount: string;
  animationDescription: string;
  stylePreset: string;
  stylePresets: readonly string[];
  spriteHistory: SpriteHistoryItem[];
  referenceImage: ReferenceImage | null;
  canvasWidth: number;
  canvasHeight: number;
  isGenerating: boolean;
  onPauseGeneration: () => void;
  onPromptChange: (prompt: string) => void;
  onEditInstructionChange: (editInstruction: string) => void;
  onAnimationFrameCountChange: (value: string) => void;
  onAnimationDescriptionChange: (value: string) => void;
  onStylePresetChange: (stylePreset: string) => void;
  onGenerate: () => void;
  onEdit: () => void;
  onGenerateAnimation: () => void;
  onReferenceImageFileChange: (file: File | null) => void;
  onClearReferenceImage: () => void;
  onResize: (width: number, height: number) => void;
  onLoadHistoryItem: (item: SpriteHistoryItem) => void;
  onDeleteHistoryItem: (id: string) => void;
  onClearHistory: () => void;
};

type AiToolMode = "generate" | "edit" | "animation";

const aiToolOptions: { id: AiToolMode; label: string }[] = [
  { id: "generate", label: "Generate sprite" },
  { id: "edit", label: "Edit current frame" },
  { id: "animation", label: "Animate current frame" },
];

function SpriteThumbnail({ sprite }: { sprite: PixelSprite }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const maxSize = 56;
    const scale = Math.max(1, Math.floor(maxSize / Math.max(sprite.width, sprite.height)));
    canvas.width = sprite.width * scale;
    canvas.height = sprite.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < sprite.height; y += 1) {
      for (let x = 0; x < sprite.width; x += 1) {
        const color = sprite.pixels[y][x];
        if (color !== TRANSPARENT) {
          ctx.fillStyle = color;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
  }, [sprite]);

  return (
    <canvas
      aria-hidden="true"
      className="h-14 w-14 shrink-0 rounded-md border border-slate-200 bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:10px_10px] bg-[position:0_0,0_5px,5px_-5px,-5px_0px]"
      ref={canvasRef}
    />
  );
}

export default function AIPanel({
  prompt,
  editInstruction,
  animationFrameCount,
  animationDescription,
  stylePreset,
  stylePresets,
  spriteHistory,
  referenceImage,
  canvasWidth,
  canvasHeight,
  isGenerating,
  onPauseGeneration,
  onPromptChange,
  onEditInstructionChange,
  onAnimationFrameCountChange,
  onAnimationDescriptionChange,
  onStylePresetChange,
  onGenerate,
  onEdit,
  onGenerateAnimation,
  onReferenceImageFileChange,
  onClearReferenceImage,
  onResize,
  onLoadHistoryItem,
  onDeleteHistoryItem,
  onClearHistory,
}: AIPanelProps) {
  const [aiToolMode, setAiToolMode] = useState<AiToolMode>("generate");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const widthInputRef = useRef<HTMLInputElement>(null);
  const heightInputRef = useRef<HTMLInputElement>(null);

  function parseCustomSize(value: string) {
    if (!/^\d+$/.test(value.trim())) {
      return null;
    }

    const size = Number(value);
    return Number.isInteger(size) && size > 0 && size <= 128 ? size : null;
  }

  function applyCustomSize(widthValue: string, heightValue: string) {
    const width = parseCustomSize(widthValue);
    const height = parseCustomSize(heightValue);
    if (width !== null && height !== null) {
      onResize(width, height);
    }
  }

  return (
    <aside className="drag-resize flex min-h-0 min-w-60 flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <section className="drag-resize-y min-h-32 space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-cyan-600" />
          <h2 className="text-sm font-bold text-slate-900">AI tools</h2>
        </div>
        <label className="block space-y-1" htmlFor="ai-tool-mode">
          <span className="text-xs font-bold uppercase text-slate-500">Function</span>
          <select
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            id="ai-tool-mode"
            onChange={(event) => setAiToolMode(event.target.value as AiToolMode)}
            value={aiToolMode}
          >
            {aiToolOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1" htmlFor="style-preset">
          <span className="text-xs font-bold uppercase text-slate-500">Style preset</span>
          <select
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
            id="style-preset"
            onChange={(event) => onStylePresetChange(event.target.value)}
            value={stylePreset}
          >
            {stylePresets.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-800">
          AI target canvas: {canvasWidth}x{canvasHeight}
        </div>
        {isGenerating ? (
          <button
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-bold text-amber-800 transition hover:bg-amber-100"
            onClick={onPauseGeneration}
            type="button"
          >
            <Pause className="h-4 w-4" />
            Pause current AI job
          </button>
        ) : null}

        {aiToolMode === "generate" ? (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <textarea
              aria-label="AI sprite prompt"
              className="min-h-24 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-5 text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="Draw a small sword, a coin, a character, or upload a photo and write what to preserve."
            />
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-cyan-600" />
                  <span className="text-xs font-bold uppercase text-slate-500">Photo reference</span>
                </div>
                {referenceImage ? (
                  <button
                    aria-label="Remove photo reference"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-rose-600"
                    onClick={() => {
                      onClearReferenceImage();
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {referenceImage ? (
                <div className="grid grid-cols-[72px_1fr] gap-3">
                  <NextImage
                    alt=""
                    className="h-[72px] w-[72px] rounded-md border border-slate-200 object-cover"
                    height={72}
                    src={referenceImage.dataUrl}
                    unoptimized
                    width={72}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-slate-800">
                      {referenceImage.name}
                    </div>
                    <div className="mt-1 text-xs leading-4 text-slate-500">
                      {referenceImage.width}x{referenceImage.height} reference sent to AI
                    </div>
                  </div>
                </div>
              ) : null}
              <input
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => onReferenceImageFileChange(event.target.files?.[0] ?? null)}
                ref={fileInputRef}
                type="file"
              />
              <button
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-cyan-200 bg-white px-3 text-sm font-bold text-cyan-700 hover:bg-cyan-50"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <ImagePlus className="h-4 w-4" />
                {referenceImage ? "Replace photo" : "Upload photo"}
              </button>
            </div>
            <button
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-cyan-600 px-3 text-sm font-bold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isGenerating || (prompt.trim().length === 0 && !referenceImage)}
              onClick={onGenerate}
              type="button"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? "Generating..." : referenceImage ? "Generate from photo" : "Generate with AI"}
            </button>
          </div>
        ) : null}

        {aiToolMode === "edit" ? (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <textarea
              aria-label="AI sprite edit instruction"
              className="min-h-24 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-5 text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
              onChange={(event) => onEditInstructionChange(event.target.value)}
              placeholder="Make the ears smaller and keep the rest unchanged."
              value={editInstruction}
            />
            <button
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-cyan-200 bg-white px-3 text-sm font-bold text-cyan-700 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
              disabled={isGenerating || editInstruction.trim().length === 0}
              onClick={onEdit}
              type="button"
            >
              <Pencil className="h-4 w-4" />
              {isGenerating ? "Editing..." : "Edit with AI"}
            </button>
          </div>
        ) : null}

        {aiToolMode === "animation" ? (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <label className="block space-y-1" htmlFor="animation-frame-count">
              <span className="text-xs font-bold uppercase text-slate-500">Number of frames</span>
              <input
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                id="animation-frame-count"
                inputMode="numeric"
                max={12}
                min={2}
                onChange={(event) => onAnimationFrameCountChange(event.target.value)}
                type="number"
                value={animationFrameCount}
              />
            </label>
            <label className="block space-y-1" htmlFor="animation-description">
              <span className="text-xs font-bold uppercase text-slate-500">Motion / sequence</span>
              <textarea
                aria-label="Animation motion description"
                className="min-h-20 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-5 text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                id="animation-description"
                onChange={(event) => onAnimationDescriptionChange(event.target.value)}
                placeholder="e.g. 8-frame run cycle facing right, bobbing; arms and legs alternate."
                value={animationDescription}
              />
            </label>
            <button
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isGenerating || animationDescription.trim().length === 0}
              onClick={onGenerateAnimation}
              type="button"
            >
              <Film className="h-4 w-4" />
              {isGenerating ? "Working..." : "Generate animation"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="drag-resize-y min-h-32 space-y-3">
        <div className="flex items-center gap-2">
          <Ruler className="h-4 w-4 text-cyan-600" />
          <h2 className="text-sm font-bold text-slate-900">Canvas settings</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {ALLOWED_SIZES.map((size) => (
            <button
              key={size}
              className={`h-10 rounded-md border text-sm font-bold ${
                canvasWidth === size && canvasHeight === size
                  ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => onResize(size, size)}
              type="button"
            >
              {size}x{size}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <label className="block space-y-1">
            <span className="text-xs font-bold uppercase text-slate-500">Width</span>
            <input
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              defaultValue={canvasWidth}
              key={`width-${canvasWidth}`}
              max={128}
              min={0}
              onBlur={(event) =>
                applyCustomSize(
                  event.target.value,
                  heightInputRef.current?.value ?? canvasHeight.toString(),
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applyCustomSize(
                    event.currentTarget.value,
                    heightInputRef.current?.value ?? canvasHeight.toString(),
                  );
                }
              }}
              ref={widthInputRef}
              type="number"
              onChange={(event) => {
                const nextWidth = event.target.value;
                applyCustomSize(
                  nextWidth,
                  heightInputRef.current?.value ?? canvasHeight.toString(),
                );
              }}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold uppercase text-slate-500">Height</span>
            <input
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              defaultValue={canvasHeight}
              key={`height-${canvasHeight}`}
              max={128}
              min={0}
              onBlur={(event) =>
                applyCustomSize(
                  widthInputRef.current?.value ?? canvasWidth.toString(),
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applyCustomSize(
                    widthInputRef.current?.value ?? canvasWidth.toString(),
                    event.currentTarget.value,
                  );
                }
              }}
              ref={heightInputRef}
              type="number"
              onChange={(event) => {
                const nextHeight = event.target.value;
                applyCustomSize(
                  widthInputRef.current?.value ?? canvasWidth.toString(),
                  nextHeight,
                );
              }}
            />
          </label>
          <div className="flex items-end">
            <button
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              onClick={() =>
                applyCustomSize(
                  widthInputRef.current?.value ?? canvasWidth.toString(),
                  heightInputRef.current?.value ?? canvasHeight.toString(),
                )
              }
              type="button"
            >
              Set
            </button>
          </div>
        </div>
      </section>

      <section className="drag-resize-y min-h-40 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-cyan-600" />
            <h2 className="text-sm font-bold text-slate-900">History</h2>
          </div>
          <button
            className="text-xs font-bold text-slate-500 hover:text-rose-600"
            onClick={onClearHistory}
            type="button"
          >
            Clear
          </button>
        </div>
        {spriteHistory.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            Generated sprites will appear here.
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-auto pr-1">
            {spriteHistory.map((item) => (
              <div
                className="grid grid-cols-[auto_1fr_auto] gap-2 rounded-md border border-slate-200 bg-white p-2"
                key={item.id}
              >
                <button
                  className="text-left"
                  onClick={() => onLoadHistoryItem(item)}
                  title="Load this sprite"
                  type="button"
                >
                  <SpriteThumbnail sprite={item.sprite} />
                </button>
                <button
                  className="min-w-0 text-left"
                  onClick={() => onLoadHistoryItem(item)}
                  type="button"
                >
                  <div className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-800">
                    {item.sprite.width}x{item.sprite.height} · {item.stylePreset}
                  </div>
                  {item.frames && item.frames.length > 1 ? (
                    <div className="mt-1 inline-flex items-center gap-1 rounded border border-cyan-100 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-700">
                      <Film className="h-3 w-3" />
                      {item.frames.length} frames
                    </div>
                  ) : null}
                  <div className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">
                    {item.prompt}
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-slate-400">
                    {new Date(item.createdAt).toLocaleString()}
                  </div>
                </button>
                <button
                  aria-label="Delete history item"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => onDeleteHistoryItem(item.id)}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
