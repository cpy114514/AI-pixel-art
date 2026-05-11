"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Download,
  Film,
  ImageDown,
  KeyRound,
  Link2,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import AIPanel, { type ReferenceImage, type SpriteHistoryItem } from "@/components/AIPanel";
import { encodeSpritesAnimatedGif } from "@/lib/exportGif";
import PixelCanvas from "@/components/PixelCanvas";
import Toolbar, { type DrawTool } from "@/components/Toolbar";
import {
  createBlankSprite,
  exampleSprites,
  resizeSprite,
  setPixelColor,
  spriteToJson,
  TRANSPARENT,
  validatePixelSprite,
  type PixelSprite,
} from "@/lib/pixelUtils";

type FetchSpriteAiResult =
  | { ok: true; sprite: PixelSprite; frames?: PixelSprite[]; warnings: string[] }
  | { ok: false; message: string; details?: unknown };

function formatSpriteAiFailureDetails(result: {
  error?: string;
  details?: unknown;
}): string {
  let details = "";
  if (typeof result.details === "object" && result.details) {
    if ("errors" in result.details) {
      const validationDetails = result.details as {
        errors?: string[];
        rawResponsePreview?: string;
      };
      details = ` ${validationDetails.errors?.join(" ") ?? ""}`;
      if (validationDetails.rawResponsePreview) {
        details += ` Raw response: ${validationDetails.rawResponsePreview}`;
      }
    } else if ("code" in result.details || "cause" in result.details) {
      const fetchDetails = result.details as {
        code?: string;
        cause?: string;
        address?: string;
        port?: number;
      };
      details = [
        fetchDetails.code ? `Code: ${fetchDetails.code}.` : "",
        fetchDetails.cause ? `Cause: ${fetchDetails.cause}.` : "",
        fetchDetails.address
          ? `Address: ${fetchDetails.address}${fetchDetails.port ? `:${fetchDetails.port}` : ""}.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");
      details = details ? ` ${details}` : "";
    }
  } else if (typeof result.details === "string") {
    details = ` ${result.details}`;
  }
  return details;
}

async function fetchSpriteAiFromApi(
  payload: Record<string, unknown>,
): Promise<FetchSpriteAiResult> {
  let response: Response;
  try {
    response = await fetch("/api/generate-sprite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Network request failed.",
    };
  }

  const result = (await response.json()) as {
    sprite?: unknown;
    frames?: unknown;
    warnings?: string[];
    error?: string;
    details?: unknown;
  };

  if (!response.ok) {
    const detailText = formatSpriteAiFailureDetails(result);
    return {
      ok: false,
      message: `${result.error ?? `Request failed (${response.status}).`}${detailText}`,
      details: result.details,
    };
  }

  if (Array.isArray(result.frames)) {
    const validatedFrames: PixelSprite[] = [];
    const warnings = [...(result.warnings ?? [])];

    for (let index = 0; index < result.frames.length; index += 1) {
      const validation = validatePixelSprite(result.frames[index]);
      if (!validation.ok) {
        return {
          ok: false,
          message: `Frame ${index + 1}: ${validation.errors.join(" ")}`,
          details: validation.errors,
        };
      }
      validatedFrames.push(validation.sprite);
      warnings.push(...validation.warnings.map((warning) => `Frame ${index + 1}: ${warning}`));
    }

    if (validatedFrames.length === 0) {
      return {
        ok: false,
        message: "Animation response did not contain any frames.",
      };
    }

    return {
      ok: true,
      sprite: validatedFrames[0],
      frames: validatedFrames,
      warnings,
    };
  }

  const validation = validatePixelSprite(result.sprite);
  if (!validation.ok) {
    return {
      ok: false,
      message: validation.errors.join(" "),
      details: validation.errors,
    };
  }

  return {
    ok: true,
    sprite: validation.sprite,
    warnings: [...validation.warnings, ...(result.warnings ?? [])],
  };
}

const scaleOptions = [1, 4, 8, 16] as const;
const API_SETTINGS_STORAGE_KEY = "ai-pixel-painter-api-settings";
const API_PRESETS_STORAGE_KEY = "ai-pixel-painter-api-presets";
const SPRITE_HISTORY_STORAGE_KEY = "ai-pixel-painter-sprite-history";
const CLOD_MODELS_STORAGE_KEY = "ai-pixel-painter-clod-models";

const stylePresets = [
  "Modern game sprite",
  "GBA RPG sprite",
  "NES limited palette",
  "Cute mobile game",
  "Dark fantasy item",
  "High contrast icon",
] as const;

const providerPresets = [
  {
    id: "custom",
    name: "Custom API",
    apiUrl: "",
    model: "",
  },
  {
    id: "openai",
    name: "OpenAI",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4.1-mini",
  },
  {
    id: "clod",
    name: "CLÅD",
    apiUrl: "https://api.clod.io/v1/chat/completions",
    model: "DeepSeek V3",
  },
  {
    id: "clod-openai-best-local-key",
    name: "CLÅD OpenAI Best Local Key",
    apiUrl: "https://api.clod.io/v1/chat/completions",
    model: "gpt-5.1",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    apiUrl: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    model: "openai/gpt-4.1-mini",
  },
  {
    id: "kimi",
    name: "Kimi / Moonshot",
    apiUrl: "https://api.moonshot.ai/v1/chat/completions",
    model: "kimi-k2.5",
  },
  {
    id: "dashscope",
    name: "Alibaba DashScope",
    apiUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    model: "qwen-plus",
  },
  {
    id: "siliconflow",
    name: "SiliconFlow",
    apiUrl: "https://api.siliconflow.cn/v1/chat/completions",
    model: "Qwen/Qwen2.5-7B-Instruct",
  },
  {
    id: "zhipu",
    name: "Zhipu GLM",
    apiUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    model: "glm-4.6",
  },
] as const;

type ProviderPresetId = (typeof providerPresets)[number]["id"];

type StoredApiSettings = {
  provider?: ProviderPresetId;
  apiUrl?: string;
  apiKey?: string;
  apiModel?: string;
};

type LocalApiPreset = StoredApiSettings & {
  id: string;
  name: string;
};

const defaultClodModels = ["gpt-5.1", "DeepSeek V3", "Llama 3.1 8B"] as const;

type LocalState = {
  selectedProvider: ProviderPresetId;
  apiUrl: string;
  apiKey: string;
  apiModel: string;
  localPresets: LocalApiPreset[];
  spriteHistory: SpriteHistoryItem[];
  clodModels: string[];
  hasLoaded: boolean;
};

type SpriteFrame = {
  id: string;
  name: string;
  sprite: PixelSprite;
};

function getStoredApiSettings(): StoredApiSettings {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(API_SETTINGS_STORAGE_KEY);
    if (!stored) {
      return {};
    }

    const settings = JSON.parse(stored) as StoredApiSettings;
    if (
      settings.provider &&
      !providerPresets.some((provider) => provider.id === settings.provider)
    ) {
      window.localStorage.removeItem(API_SETTINGS_STORAGE_KEY);
      return {};
    }
    return settings;
  } catch {
    window.localStorage.removeItem(API_SETTINGS_STORAGE_KEY);
    return {};
  }
}

function getLocalApiPresets(): LocalApiPreset[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(API_PRESETS_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const presets = JSON.parse(stored);
    return Array.isArray(presets)
      ? presets.filter(
          (preset): preset is LocalApiPreset =>
            preset &&
            typeof preset === "object" &&
            typeof preset.id === "string" &&
            typeof preset.name === "string" &&
            (!preset.provider ||
              providerPresets.some((provider) => provider.id === preset.provider)),
        )
      : [];
  } catch {
    window.localStorage.removeItem(API_PRESETS_STORAGE_KEY);
    return [];
  }
}

function getSpriteHistory(): SpriteHistoryItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(SPRITE_HISTORY_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const history = JSON.parse(stored);
    return Array.isArray(history)
      ? history.filter((item): item is SpriteHistoryItem => {
          if (!item || typeof item !== "object") {
            return false;
          }
          const candidate = item as Partial<SpriteHistoryItem>;
          return (
            typeof candidate.id === "string" &&
            typeof candidate.createdAt === "string" &&
            typeof candidate.prompt === "string" &&
            validatePixelSprite(candidate.sprite).ok
          );
        })
      : [];
  } catch {
    window.localStorage.removeItem(SPRITE_HISTORY_STORAGE_KEY);
    return [];
  }
}

function getClodModels(): string[] {
  if (typeof window === "undefined") {
    return [...defaultClodModels];
  }

  try {
    const stored = window.localStorage.getItem(CLOD_MODELS_STORAGE_KEY);
    if (!stored) {
      return [...defaultClodModels];
    }
    const models = JSON.parse(stored);
    return Array.isArray(models) && models.every((model) => typeof model === "string")
      ? models
      : [...defaultClodModels];
  } catch {
    window.localStorage.removeItem(CLOD_MODELS_STORAGE_KEY);
    return [...defaultClodModels];
  }
}

type Status = {
  type: "idle" | "success" | "warning" | "error";
  message: string;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function drawSpriteToCanvas(
  ctx: CanvasRenderingContext2D,
  sprite: PixelSprite,
  scale: number,
  offsetX = 0,
  offsetY = 0,
) {
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < sprite.height; y += 1) {
    for (let x = 0; x < sprite.width; x += 1) {
      const color = sprite.pixels[y][x];
      if (color !== TRANSPARENT) {
        ctx.fillStyle = color;
        ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
      }
    }
  }
}

function canvasToDownload(canvas: HTMLCanvasElement, filename: string) {
  return new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("PNG export failed."));
        return;
      }
      downloadBlob(blob, filename);
      resolve();
    }, "image/png");
  });
}

function exportSpritePng(sprite: PixelSprite, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = sprite.width * scale;
  canvas.height = sprite.height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create PNG canvas.");
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSpriteToCanvas(ctx, sprite, scale);

  return canvasToDownload(
    canvas,
    `ai-pixel-painter-${sprite.width}x${sprite.height}-${scale}x.png`,
  );
}

function exportSpriteSheetPng(frames: SpriteFrame[], scale: number) {
  if (frames.length === 0) {
    throw new Error("No frames to export.");
  }

  const first = frames[0].sprite;
  const canvas = document.createElement("canvas");
  canvas.width = first.width * frames.length * scale;
  canvas.height = first.height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create sprite sheet canvas.");
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  frames.forEach((frame, index) => {
    drawSpriteToCanvas(ctx, frame.sprite, scale, index * first.width * scale, 0);
  });

  return canvasToDownload(
    canvas,
    `ai-pixel-painter-sheet-${frames.length}frames-${first.width}x${first.height}-${scale}x.png`,
  );
}

function cloneSprite(sprite: PixelSprite): PixelSprite {
  return {
    ...sprite,
    pixels: sprite.pixels.map((row) => [...row]),
  };
}

function floodFillSprite(sprite: PixelSprite, startX: number, startY: number, color: string) {
  if (startX < 0 || startY < 0 || startX >= sprite.width || startY >= sprite.height) {
    return sprite;
  }

  const targetColor = sprite.pixels[startY][startX];
  if (targetColor === color) {
    return sprite;
  }

  const next = cloneSprite(sprite);
  const stack: Array<[number, number]> = [[startX, startY]];

  while (stack.length > 0) {
    const [x, y] = stack.pop() as [number, number];
    if (x < 0 || y < 0 || x >= sprite.width || y >= sprite.height) {
      continue;
    }
    if (next.pixels[y][x] !== targetColor) {
      continue;
    }

    next.pixels[y][x] = color;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return next;
}

function createSpriteFrame(sprite: PixelSprite, index: number, name?: string): SpriteFrame {
  return {
    id: typeof crypto !== "undefined" ? crypto.randomUUID() : `frame-${Date.now()}-${index}`,
    name: name ?? `Frame ${index}`,
    sprite: cloneSprite(sprite),
  };
}

function imageFileToReferenceImage(file: File) {
  return new Promise<ReferenceImage>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choose a PNG, JPG, or WebP image."));
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      reject(new Error("Reference image is too large. Use an image under 16 MB."));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const sourceWidth = image.naturalWidth;
      const sourceHeight = image.naturalHeight;
      if (sourceWidth <= 0 || sourceHeight <= 0) {
        reject(new Error("Could not read the reference image dimensions."));
        return;
      }

      const maxSide = 768;
      const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not prepare the reference image."));
        return;
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      resolve({
        name: file.name,
        dataUrl: canvas.toDataURL("image/jpeg", 0.86),
        width,
        height,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load the reference image."));
    };
    image.src = objectUrl;
  });
}

function FrameThumbnail({
  frame,
  isActive,
  onSelect,
  onDuplicate,
  onDelete,
  canDelete,
}: {
  frame: SpriteFrame;
  isActive: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const scale = Math.max(1, Math.floor(48 / Math.max(frame.sprite.width, frame.sprite.height)));
    canvas.width = frame.sprite.width * scale;
    canvas.height = frame.sprite.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSpriteToCanvas(ctx, frame.sprite, scale);
  }, [frame.sprite]);

  return (
    <div
      className={`flex items-center gap-2 rounded-md border p-2 ${
        isActive ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-white"
      }`}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={onSelect}
        type="button"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-100">
          <canvas ref={canvasRef} className="max-h-10 max-w-10" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-slate-800">{frame.name}</span>
          <span className="block text-xs text-slate-500">
            {frame.sprite.width}x{frame.sprite.height}
          </span>
        </span>
      </button>
      <button
        aria-label={`Duplicate ${frame.name}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        onClick={onDuplicate}
        type="button"
      >
        <Copy className="h-4 w-4" />
      </button>
      <button
        aria-label={`Delete ${frame.name}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canDelete}
        onClick={onDelete}
        type="button"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Home() {
  const [sprite, setSprite] = useState<PixelSprite>(exampleSprites.slime);
  const [frames, setFrames] = useState<SpriteFrame[]>([
    { id: "frame-1", name: "Frame 1", sprite: cloneSprite(exampleSprites.slime) },
  ]);
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [prompt, setPrompt] = useState(
    "Draw a polished blue slime game sprite with a clear silhouette, dark outline, glossy top-left highlight, soft lower-right shadow, expressive face, and several blue color ramps.",
  );
  const [stylePreset, setStylePreset] = useState<(typeof stylePresets)[number]>(
    "Modern game sprite",
  );
  const [activeTool, setActiveTool] = useState<DrawTool>("brush");
  const [selectedColor, setSelectedColor] = useState("#38bdf8");
  const [showGrid, setShowGrid] = useState(true);
  const [pngScale, setPngScale] = useState<(typeof scaleOptions)[number]>(8);
  const [gifFrameDelayMs, setGifFrameDelayMs] = useState(100);
  const [undoStack, setUndoStack] = useState<PixelSprite[]>([]);
  const [redoStack, setRedoStack] = useState<PixelSprite[]>([]);
  const strokeSnapshotRef = useRef<PixelSprite | null>(null);
  const [localState, setLocalState] = useState<LocalState>({
    selectedProvider: "custom",
    apiUrl: providerPresets[0].apiUrl,
    apiKey: "",
    apiModel: providerPresets[0].model,
    localPresets: [],
    spriteHistory: [],
    clodModels: [...defaultClodModels],
    hasLoaded: false,
  });
  const [presetName, setPresetName] = useState("");
  const [selectedLocalPresetId, setSelectedLocalPresetId] = useState("");
  const [newClodModel, setNewClodModel] = useState("");
  const [editInstruction, setEditInstruction] = useState("");
  const [animationFrameCount, setAnimationFrameCount] = useState("4");
  const [animationDescription, setAnimationDescription] = useState("");
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<Status>({
    type: "idle",
    message: "Ready for JSON import, manual painting, or AI generation.",
  });

  const filledPixels = useMemo(
    () => sprite.pixels.flat().filter((color) => color !== TRANSPARENT).length,
    [sprite.pixels],
  );
  const activeFrame = frames[activeFrameIndex] ?? frames[0];
  const {
    selectedProvider,
    apiUrl,
    apiKey,
    apiModel,
    localPresets,
    spriteHistory,
    clodModels,
    hasLoaded,
  } = localState;

  useEffect(() => {
    const loadLocalState = window.setTimeout(() => {
      const storedApiSettings = getStoredApiSettings();
      setLocalState({
        selectedProvider: storedApiSettings.provider ?? "custom",
        apiUrl: storedApiSettings.apiUrl ?? providerPresets[0].apiUrl,
        apiKey: storedApiSettings.apiKey ?? "",
        apiModel: storedApiSettings.apiModel ?? providerPresets[0].model,
        localPresets: getLocalApiPresets(),
        spriteHistory: getSpriteHistory(),
        clodModels: getClodModels(),
        hasLoaded: true,
      });
    }, 0);

    return () => window.clearTimeout(loadLocalState);
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }
    const settings: StoredApiSettings = {
      provider: selectedProvider,
      apiUrl,
      apiKey,
      apiModel,
    };
    window.localStorage.setItem(API_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [apiKey, apiModel, apiUrl, hasLoaded, selectedProvider]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }
    window.localStorage.setItem(API_PRESETS_STORAGE_KEY, JSON.stringify(localPresets));
  }, [hasLoaded, localPresets]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }
    window.localStorage.setItem(SPRITE_HISTORY_STORAGE_KEY, JSON.stringify(spriteHistory));
  }, [hasLoaded, spriteHistory]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }
    window.localStorage.setItem(CLOD_MODELS_STORAGE_KEY, JSON.stringify(clodModels));
  }, [clodModels, hasLoaded]);

  function setActiveFrameSprite(nextSprite: PixelSprite) {
    setSprite(nextSprite);
    setFrames((current) =>
      current.map((frame, index) =>
        index === activeFrameIndex ? { ...frame, sprite: cloneSprite(nextSprite) } : frame,
      ),
    );
  }

  function applySprite(nextSprite: PixelSprite, nextStatus?: Status) {
    setActiveFrameSprite(nextSprite);
    if (nextStatus) {
      setStatus(nextStatus);
    }
  }

  function commitSprite(nextSprite: PixelSprite, nextStatus?: Status) {
    setUndoStack((current) => [cloneSprite(sprite), ...current].slice(0, 80));
    setRedoStack([]);
    applySprite(nextSprite, nextStatus);
  }

  function handleStrokeStart() {
    if (activeTool !== "brush" && activeTool !== "eraser") {
      return;
    }
    strokeSnapshotRef.current = cloneSprite(sprite);
  }

  function handleStrokeEnd() {
    if (activeTool !== "brush" && activeTool !== "eraser") {
      strokeSnapshotRef.current = null;
      return;
    }
    const snapshot = strokeSnapshotRef.current;
    if (!snapshot) {
      return;
    }
    strokeSnapshotRef.current = null;

    if (spriteToJson(snapshot) !== spriteToJson(sprite)) {
      setUndoStack((current) => [snapshot, ...current].slice(0, 80));
      setRedoStack([]);
    }
  }

  function handlePixelAction(x: number, y: number) {
    if (activeTool === "eyedropper") {
      setSelectedColor(sprite.pixels[y][x]);
      setActiveTool("brush");
      setStatus({ type: "success", message: `Picked ${sprite.pixels[y][x]} from (${x}, ${y}).` });
      return;
    }

    if (activeTool === "fill") {
      const next = floodFillSprite(sprite, x, y, selectedColor);
      if (spriteToJson(next) !== spriteToJson(sprite)) {
        commitSprite(next, {
          type: "success",
          message: `Filled area from (${x}, ${y}) with ${selectedColor}.`,
        });
      }
      return;
    }

    const color = activeTool === "eraser" ? TRANSPARENT : selectedColor;
    setSprite((current) => {
      const next = setPixelColor(current, x, y, color);
      setFrames((currentFrames) =>
        currentFrames.map((frame, index) =>
          index === activeFrameIndex ? { ...frame, sprite: cloneSprite(next) } : frame,
        ),
      );
      return next;
    });
    setStatus({
      type: "success",
      message:
        activeTool === "eraser"
          ? `Erased pixel (${x}, ${y}).`
          : `Painted pixel (${x}, ${y}) with ${color}.`,
    });
  }

  function handleUndo() {
    const previous = undoStack[0];
    if (!previous) {
      return;
    }

    setUndoStack((current) => current.slice(1));
    setRedoStack((current) => [cloneSprite(sprite), ...current].slice(0, 80));
    applySprite(previous, { type: "success", message: "Undo applied." });
  }

  function handleRedo() {
    const next = redoStack[0];
    if (!next) {
      return;
    }

    setRedoStack((current) => current.slice(1));
    setUndoStack((current) => [cloneSprite(sprite), ...current].slice(0, 80));
    applySprite(next, { type: "success", message: "Redo applied." });
  }

  function handleSelectFrame(index: number) {
    const frame = frames[index];
    if (!frame) {
      return;
    }

    setActiveFrameIndex(index);
    setSprite(cloneSprite(frame.sprite));
    setUndoStack([]);
    setRedoStack([]);
    strokeSnapshotRef.current = null;
    setStatus({ type: "success", message: `Selected ${frame.name}.` });
  }

  function handleAddBlankFrame() {
    const nextFrame = createSpriteFrame(
      createBlankSprite(sprite.width, sprite.height),
      frames.length + 1,
    );
    setFrames((current) => [...current, nextFrame]);
    setActiveFrameIndex(frames.length);
    setSprite(cloneSprite(nextFrame.sprite));
    setUndoStack([]);
    setRedoStack([]);
    setStatus({ type: "success", message: `Added ${nextFrame.name}.` });
  }

  function handleNewImage() {
    const blank = createBlankSprite(sprite.width, sprite.height);
    const nextFrame = createSpriteFrame(blank, 1, "Frame 1");
    setFrames([nextFrame]);
    setActiveFrameIndex(0);
    setSprite(cloneSprite(nextFrame.sprite));
    setUndoStack([]);
    setRedoStack([]);
    strokeSnapshotRef.current = null;
    setStatus({
      type: "success",
      message: `Created a new blank ${sprite.width}x${sprite.height} image.`,
    });
  }

  function handleDuplicateFrame(index: number) {
    const source = frames[index];
    if (!source) {
      return;
    }

    const nextFrame = createSpriteFrame(
      source.sprite,
      frames.length + 1,
      `Frame ${frames.length + 1}`,
    );
    const nextFrames = [
      ...frames.slice(0, index + 1),
      nextFrame,
      ...frames.slice(index + 1),
    ];
    setFrames(nextFrames);
    setActiveFrameIndex(index + 1);
    setSprite(cloneSprite(nextFrame.sprite));
    setUndoStack([]);
    setRedoStack([]);
    setStatus({ type: "success", message: `Duplicated ${source.name}.` });
  }

  function handleDeleteFrame(index: number) {
    if (frames.length <= 1) {
      return;
    }

    const nextFrames = frames.filter((_, frameIndex) => frameIndex !== index);
    const nextIndex = Math.min(index, nextFrames.length - 1);
    setFrames(
      nextFrames.map((frame, frameIndex) => ({ ...frame, name: `Frame ${frameIndex + 1}` })),
    );
    setActiveFrameIndex(nextIndex);
    setSprite(cloneSprite(nextFrames[nextIndex].sprite));
    setUndoStack([]);
    setRedoStack([]);
    setStatus({ type: "success", message: "Deleted frame." });
  }

  function handleResize(width: number, height: number) {
    const resizedFrames = frames.map((frame) => ({
      ...frame,
      sprite: resizeSprite(frame.sprite, width, height),
    }));
    const next = resizedFrames[activeFrameIndex]?.sprite ?? resizeSprite(sprite, width, height);
    setPrompt((currentPrompt) =>
      currentPrompt.replace(/\b\d{1,3}\s*x\s*\d{1,3}\b/gi, `${width}x${height}`),
    );
    setUndoStack([]);
    setRedoStack([]);
    setFrames(resizedFrames);
    setSprite(next);
    setStatus({
      type: "success",
      message: `All frames resized to ${width}x${height}. Existing pixels were preserved where possible.`,
    });
  }

  function handleProviderChange(providerId: ProviderPresetId) {
    const preset = providerPresets.find((provider) => provider.id === providerId);
    if (!preset) {
      return;
    }

    setLocalState((current) => ({
      ...current,
      selectedProvider: providerId,
      apiUrl: preset.apiUrl,
      apiModel: preset.model,
    }));
    setStatus({
      type: "success",
      message:
        providerId === "custom"
          ? "Custom API selected. Enter the API URL, model, and API key."
          : `${preset.name} preset selected. Paste your API key and generate.`,
    });
  }

  function applyStoredSettings(settings: StoredApiSettings) {
    setLocalState((current) => ({
      ...current,
      selectedProvider:
        settings.provider && providerPresets.some((provider) => provider.id === settings.provider)
          ? settings.provider
          : current.selectedProvider,
      apiUrl: settings.apiUrl ?? "",
      apiKey: settings.apiKey ?? "",
      apiModel: settings.apiModel ?? "",
    }));
  }

  function handleSaveLocalPreset() {
    const name = presetName.trim();
    if (!name) {
      setStatus({ type: "error", message: "Enter a preset name before saving." });
      return;
    }

    const preset: LocalApiPreset = {
      id: crypto.randomUUID(),
      name,
      provider: selectedProvider,
      apiUrl,
      apiKey,
      apiModel,
    };

    setLocalState((current) => ({
      ...current,
      localPresets: [
        ...current.localPresets.filter((item) => item.name.toLowerCase() !== name.toLowerCase()),
        preset,
      ],
    }));
    setSelectedLocalPresetId(preset.id);
    setPresetName("");
    setStatus({ type: "success", message: `Saved local API preset "${name}".` });
  }

  function handleLoadLocalPreset(id: string) {
    setSelectedLocalPresetId(id);
    const preset = localPresets.find((item) => item.id === id);
    if (!preset) {
      return;
    }
    applyStoredSettings(preset);
    setStatus({ type: "success", message: `Loaded local API preset "${preset.name}".` });
  }

  function handleDeleteLocalPreset() {
    if (!selectedLocalPresetId) {
      setStatus({ type: "error", message: "Choose a local preset to delete." });
      return;
    }

    const preset = localPresets.find((item) => item.id === selectedLocalPresetId);
    setLocalState((current) => ({
      ...current,
      localPresets: current.localPresets.filter((item) => item.id !== selectedLocalPresetId),
    }));
    setSelectedLocalPresetId("");
    setStatus({
      type: "success",
      message: preset ? `Deleted local API preset "${preset.name}".` : "Deleted local preset.",
    });
  }

  function saveGeneratedSpriteToHistory(nextSprite: PixelSprite, historyPrompt = prompt) {
    const item: SpriteHistoryItem = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      prompt: historyPrompt,
      stylePreset,
      sprite: nextSprite,
    };

    setLocalState((current) => ({
      ...current,
      spriteHistory: [item, ...current.spriteHistory].slice(0, 30),
    }));
  }

  function handleLoadHistoryItem(item: SpriteHistoryItem) {
    setPrompt(item.prompt);
    if (stylePresets.includes(item.stylePreset as (typeof stylePresets)[number])) {
      setStylePreset(item.stylePreset as (typeof stylePresets)[number]);
    }
    commitSprite(item.sprite, {
      type: "success",
      message: `Loaded history item from ${new Date(item.createdAt).toLocaleString()}.`,
    });
  }

  function handleDeleteHistoryItem(id: string) {
    setLocalState((current) => ({
      ...current,
      spriteHistory: current.spriteHistory.filter((item) => item.id !== id),
    }));
    setStatus({ type: "success", message: "Deleted history item." });
  }

  function handleAddClodModel() {
    const model = newClodModel.trim();
    if (!model) {
      setStatus({ type: "error", message: "Enter a CLÅD model name first." });
      return;
    }

    setLocalState((current) => ({
      ...current,
      clodModels: current.clodModels.some((item) => item.toLowerCase() === model.toLowerCase())
        ? current.clodModels
        : [...current.clodModels, model],
      apiModel: model,
    }));
    setNewClodModel("");
    setStatus({ type: "success", message: `Added CLÅD model "${model}".` });
  }

  async function handleReferenceImageFileChange(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const nextReferenceImage = await imageFileToReferenceImage(file);
      setReferenceImage(nextReferenceImage);
      setStatus({
        type: "success",
        message: `Loaded photo reference ${nextReferenceImage.width}x${nextReferenceImage.height}.`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Could not load the reference image.",
      });
    }
  }

  async function submitSpriteAiRequest({
    payload,
    idleMessage,
    successMessage,
    historyPrompt,
    errorPrefix,
    commitResult = false,
  }: {
    payload: Record<string, unknown>;
    idleMessage: string;
    successMessage: string;
    historyPrompt: string;
    errorPrefix: string;
    commitResult?: boolean;
  }) {
    setIsGenerating(true);
    setStatus({ type: "idle", message: idleMessage });

    try {
      const outcome = await fetchSpriteAiFromApi(payload);
      if (!outcome.ok) {
        setStatus({ type: "error", message: `${errorPrefix}: ${outcome.message}` });
        return;
      }

      const nextStatus: Status = {
        type: outcome.warnings.length > 0 ? "warning" : "success",
        message: outcome.warnings.join(" ") || successMessage,
      };
      if (commitResult) {
        commitSprite(outcome.sprite, nextStatus);
      } else {
        applySprite(outcome.sprite, nextStatus);
      }
      saveGeneratedSpriteToHistory(outcome.sprite, historyPrompt);
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? `${errorPrefix}: ${error.message}`
            : errorPrefix,
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerate() {
    const requestPrompt =
      prompt.trim() || "Convert the reference photo into a polished pixel-art game sprite.";

    await submitSpriteAiRequest({
      payload: {
        mode: "generate",
        prompt: requestPrompt,
        stylePreset,
        width: sprite.width,
        height: sprite.height,
        provider: selectedProvider,
        apiUrl,
        apiKey,
        model: apiModel,
        referenceImageDataUrl: referenceImage?.dataUrl,
      },
      idleMessage: referenceImage
        ? "Calling /api/generate-sprite with photo reference..."
        : "Calling /api/generate-sprite...",
      successMessage: `Generated ${sprite.width}x${sprite.height} sprite.`,
      historyPrompt: requestPrompt,
      errorPrefix: "AI generation failed",
    });
  }

  async function handleEditCurrentSprite() {
    const requestEditInstruction = editInstruction.trim();
    if (!requestEditInstruction) {
      setStatus({ type: "error", message: "Enter an edit instruction first." });
      return;
    }

    await submitSpriteAiRequest({
      payload: {
        mode: "edit",
        editInstruction: requestEditInstruction,
        stylePreset,
        width: sprite.width,
        height: sprite.height,
        provider: selectedProvider,
        apiUrl,
        apiKey,
        model: apiModel,
        currentSprite: sprite,
      },
      idleMessage: "Calling /api/generate-sprite to edit current sprite...",
      successMessage: `Edited ${sprite.width}x${sprite.height} sprite.`,
      historyPrompt: `Edit: ${requestEditInstruction}`,
      errorPrefix: "AI edit failed",
      commitResult: true,
    });
  }

  async function handleGenerateAnimation() {
    const raw = animationFrameCount.trim().replaceAll(",", "");
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 2 || n > 12) {
      setStatus({ type: "error", message: "Enter a whole number of frames from 2 to 12." });
      return;
    }

    const desc = animationDescription.trim();
    if (!desc) {
      setStatus({
        type: "error",
        message: "Describe the motion or story for the animation (e.g. walk cycle, idle breathing, slash).",
      });
      return;
    }

    const w = sprite.width;
    const h = sprite.height;

    setIsGenerating(true);
    setStatus({
      type: "idle",
      message: `Animation: generating ${n} frames from current frame...`,
    });

    try {
      const outcome = await fetchSpriteAiFromApi({
        mode: "animate",
        animationInstruction: desc,
        frameCount: n,
        stylePreset,
        width: w,
        height: h,
        provider: selectedProvider,
        apiUrl,
        apiKey,
        model: apiModel,
        currentSprite: sprite,
      });

      if (!outcome.ok) {
        setStatus({
          type: "error",
          message: `Animation failed: ${outcome.message}`,
        });
        return;
      }

      if (!outcome.frames) {
        setStatus({
          type: "error",
          message: "Animation failed: API response did not contain frames.",
        });
        return;
      }

      const nextFrames = outcome.frames.map((frameSprite, index) =>
        createSpriteFrame(frameSprite, index + 1, `Frame ${index + 1}`),
      );
      setFrames(nextFrames);
      setActiveFrameIndex(0);
      setSprite(cloneSprite(nextFrames[0].sprite));
      setUndoStack([]);
      setRedoStack([]);
      strokeSnapshotRef.current = null;
      saveGeneratedSpriteToHistory(nextFrames[0].sprite, `Animation ${n} frames: ${desc}`);
      setStatus({
        type: outcome.warnings.length > 0 ? "warning" : "success",
        message: outcome.warnings.join(" ") || `Generated ${nextFrames.length}-frame animation.`,
      });
    } finally {
      setIsGenerating(false);
    }
  }
  async function handleExportPng() {
    try {
      await exportSpritePng(sprite, pngScale);
      setStatus({ type: "success", message: `Exported PNG at ${pngScale}x scale.` });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "PNG export failed.",
      });
    }
  }

  async function handleExportSpriteSheet() {
    try {
      await exportSpriteSheetPng(frames, pngScale);
      setStatus({
        type: "success",
        message: `Exported ${frames.length}-frame sprite sheet at ${pngScale}x scale.`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Sprite sheet export failed.",
      });
    }
  }

  function handleExportGif() {
    try {
      const sprites = frames.map((f) => f.sprite);
      const bytes = encodeSpritesAnimatedGif(sprites, pngScale, gifFrameDelayMs);
      const blob = new Blob([new Uint8Array(bytes)], { type: "image/gif" });
      const first = frames[0].sprite;
      downloadBlob(
        blob,
        `ai-pixel-painter-${frames.length}frames-${first.width}x${first.height}-${pngScale}x.gif`,
      );
      setStatus({
        type: "success",
        message: `Exported ${frames.length}-frame GIF (${gifFrameDelayMs} ms per frame).`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "GIF export failed.",
      });
    }
  }

  const statusClasses = {
    idle: "border-slate-200 bg-slate-50 text-slate-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-rose-200 bg-rose-50 text-rose-800",
  }[status.type];

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-4 px-4 py-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div>
            <h1 className="text-xl font-black text-slate-950">AI Pixel Painter</h1>
            <p className="text-sm text-slate-500">
              Build multi-frame game sprites from exact JSON pixel color data.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
              {sprite.width}x{sprite.height}
            </span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
              {frames.length} frames
            </span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
              {activeFrame?.name ?? "Frame 1"}
            </span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
              {filledPixels} filled pixels
            </span>
          </div>
        </header>

        <div className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-[360px_minmax(0,1fr)_320px]">
          <AIPanel
            prompt={prompt}
            editInstruction={editInstruction}
            animationFrameCount={animationFrameCount}
            animationDescription={animationDescription}
            stylePreset={stylePreset}
            stylePresets={stylePresets}
            spriteHistory={spriteHistory}
            referenceImage={referenceImage}
            canvasWidth={sprite.width}
            canvasHeight={sprite.height}
            isGenerating={isGenerating}
            onPromptChange={setPrompt}
            onEditInstructionChange={setEditInstruction}
            onAnimationFrameCountChange={setAnimationFrameCount}
            onAnimationDescriptionChange={setAnimationDescription}
            onStylePresetChange={(nextStylePreset) =>
              setStylePreset(nextStylePreset as (typeof stylePresets)[number])
            }
            onGenerate={handleGenerate}
            onEdit={handleEditCurrentSprite}
            onGenerateAnimation={handleGenerateAnimation}
            onReferenceImageFileChange={handleReferenceImageFileChange}
            onClearReferenceImage={() => {
              setReferenceImage(null);
              setStatus({ type: "success", message: "Removed photo reference." });
            }}
            onResize={handleResize}
            onLoadHistoryItem={handleLoadHistoryItem}
            onDeleteHistoryItem={handleDeleteHistoryItem}
            onClearHistory={() => {
              setLocalState((current) => ({ ...current, spriteHistory: [] }));
              setStatus({ type: "success", message: "Cleared generation history." });
            }}
          />

          <section className="flex min-h-[620px] flex-col gap-3 lg:min-h-0">
            <Toolbar
              selectedColor={selectedColor}
              activeTool={activeTool}
              showGrid={showGrid}
              canUndo={undoStack.length > 0}
              canRedo={redoStack.length > 0}
              onToolChange={setActiveTool}
              onColorChange={setSelectedColor}
              onToggleGrid={() => setShowGrid((current) => !current)}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onClear={() =>
                commitSprite(createBlankSprite(sprite.width, sprite.height), {
                  type: "success",
                  message: "Cleared the canvas.",
                })
              }
            />
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Film className="h-4 w-4 text-cyan-600" />
                  <h2 className="text-sm font-bold text-slate-900">Animation frames</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    onClick={handleNewImage}
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    New image
                  </button>
                  <button
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-bold text-cyan-700 hover:bg-cyan-100"
                    onClick={handleAddBlankFrame}
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    Add frame
                  </button>
                </div>
              </div>
              <div className="grid max-h-44 gap-2 overflow-auto sm:grid-cols-2 xl:grid-cols-4">
                {frames.map((frame, index) => (
                  <FrameThumbnail
                    canDelete={frames.length > 1}
                    frame={frame}
                    isActive={index === activeFrameIndex}
                    key={frame.id}
                    onDelete={() => handleDeleteFrame(index)}
                    onDuplicate={() => handleDuplicateFrame(index)}
                    onSelect={() => handleSelectFrame(index)}
                  />
                ))}
              </div>
            </div>
            <PixelCanvas
              sprite={sprite}
              showGrid={showGrid}
              onPixelAction={handlePixelAction}
              onStrokeStart={handleStrokeStart}
              onStrokeEnd={handleStrokeEnd}
            />
          </section>

          <aside className="flex min-h-0 flex-col gap-4 overflow-auto rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-cyan-600" />
                <h2 className="text-sm font-bold text-slate-900">API connection</h2>
              </div>
              <label className="block space-y-1" htmlFor="provider-preset">
                <span className="text-xs font-bold uppercase text-slate-500">Provider</span>
                <select
                  id="provider-preset"
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  onChange={(event) => handleProviderChange(event.target.value as ProviderPresetId)}
                  value={selectedProvider}
                >
                  {providerPresets.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">API URL</span>
                <input
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  onChange={(event) =>
                    setLocalState((current) => ({ ...current, apiUrl: event.target.value }))
                  }
                  placeholder="https://your-api.example.com/generate"
                  type="url"
                  value={apiUrl}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">API Key</span>
                <input
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 font-mono text-xs text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  onChange={(event) =>
                    setLocalState((current) => ({ ...current, apiKey: event.target.value }))
                  }
                  placeholder="Paste API key here"
                  type="text"
                  value={apiKey}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Model</span>
                {selectedProvider === "clod" ? (
                  <select
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    onChange={(event) =>
                      setLocalState((current) => ({ ...current, apiModel: event.target.value }))
                    }
                    value={apiModel}
                  >
                    {clodModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    onChange={(event) =>
                      setLocalState((current) => ({ ...current, apiModel: event.target.value }))
                    }
                    placeholder="custom-model-name"
                    type="text"
                    value={apiModel}
                  />
                )}
              </label>
              {selectedProvider === "clod" ? (
                <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-bold uppercase text-slate-500">CLÅD models</div>
                  <input
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                    onChange={(event) => setNewClodModel(event.target.value)}
                    placeholder="Paste model name from app.clod.io/user/models"
                    type="text"
                    value={newClodModel}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="h-9 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-bold text-cyan-700 hover:bg-cyan-100"
                      onClick={handleAddClodModel}
                      type="button"
                    >
                      Add model
                    </button>
                    <button
                      className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                      onClick={() => {
                        setLocalState((current) => ({
                          ...current,
                          clodModels: [...defaultClodModels],
                          apiModel: defaultClodModels[0],
                        }));
                      }}
                      type="button"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs leading-4 text-slate-500">
                <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-600" />
                Settings are saved locally in this browser. Fields remain editable.
              </div>
              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-bold uppercase text-slate-500">Local presets</div>
                <select
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  onChange={(event) => handleLoadLocalPreset(event.target.value)}
                  value={selectedLocalPresetId}
                >
                  <option value="">Choose saved preset</option>
                  {localPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <input
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  onChange={(event) => setPresetName(event.target.value)}
                  placeholder="Preset name"
                  type="text"
                  value={presetName}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="h-9 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-bold text-cyan-700 hover:bg-cyan-100"
                    onClick={handleSaveLocalPreset}
                    type="button"
                  >
                    Save preset
                  </button>
                  <button
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                    onClick={handleDeleteLocalPreset}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <button
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                onClick={() => {
                  window.localStorage.removeItem(API_SETTINGS_STORAGE_KEY);
                  handleProviderChange("custom");
                  setLocalState((current) => ({ ...current, apiKey: "" }));
                  setStatus({
                    type: "success",
                    message: "Saved API settings cleared from this browser.",
                  });
                }}
                type="button"
              >
                Clear saved API settings
              </button>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <ImageDown className="h-4 w-4 text-cyan-600" />
                <h2 className="text-sm font-bold text-slate-900">Export PNG / GIF</h2>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs leading-4 text-slate-500">
                Sprite sheet: {frames.length} frames, horizontal strip,{" "}
                {sprite.width * frames.length}x{sprite.height} base pixels.
              </div>
              <div className="grid grid-cols-4 gap-2">
                {scaleOptions.map((scale) => (
                  <button
                    key={scale}
                    className={`h-9 rounded-md border text-sm font-bold ${
                      pngScale === scale
                        ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => setPngScale(scale)}
                    type="button"
                  >
                    {scale}x
                  </button>
                ))}
              </div>
              <button
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-bold text-white hover:bg-slate-800"
                onClick={handleExportPng}
                type="button"
              >
                <Download className="h-4 w-4" />
                Export current frame
              </button>
              <button
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-bold text-cyan-700 hover:bg-cyan-100"
                onClick={handleExportSpriteSheet}
                type="button"
              >
                <Film className="h-4 w-4" />
                Export sprite sheet
              </button>
              <label className="block space-y-1" htmlFor="gif-frame-delay">
                <span className="text-xs font-bold uppercase text-slate-500">GIF frame delay (ms)</span>
                <input
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  id="gif-frame-delay"
                  max={2000}
                  min={20}
                  onChange={(event) => setGifFrameDelayMs(Number(event.target.value) || 100)}
                  step={10}
                  type="number"
                  value={gifFrameDelayMs}
                />
              </label>
              <button
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 text-sm font-bold text-violet-800 hover:bg-violet-100"
                onClick={handleExportGif}
                type="button"
              >
                <Film className="h-4 w-4" />
                Export animated GIF
              </button>
            </section>

            <section className="mt-auto space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-cyan-600" />
                <h2 className="text-sm font-bold text-slate-900">Validation</h2>
              </div>
              <div className={`rounded-md border p-3 text-sm leading-5 ${statusClasses}`}>
                {status.message}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
