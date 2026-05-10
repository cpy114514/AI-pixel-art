# AI Pixel Painter

AI Pixel Painter is a Next.js + TypeScript pixel-art sprite editor for AI-assisted game asset creation. It is designed for AI agents and custom AI APIs that return exact JSON pixel color data instead of image files.

## Features

- Pixel canvas editor with grid, brush, eraser, fill, eyedropper, undo, and redo
- Canvas sizes: 8x8, 16x16, 32x32, plus custom dimensions
- AI sprite generation from text prompts
- Photo reference upload for vision-capable models
- AI edit mode for changing an existing sprite, for example "make the ears smaller"
- AI animation mode that uses the current image as frame 1 and generates the remaining frames
- Multi-frame editing with PNG and animated GIF export
- JSON pixel validation and repair for invalid color values
- Generic AI API adapter with provider presets and local saved presets
- Optional agent API and MCP server for tool/agent workflows

## Quick Start

### Windows one-click install

1. Install Node.js from <https://nodejs.org/>.
2. Download this repository as a ZIP from GitHub.
3. Extract the ZIP.
4. Double-click `install.bat`.

The installer:

- installs dependencies
- creates `.env.local` from `.env.example` when needed
- creates a desktop shortcut named `AI Pixel Painter`
- starts the app

After setup, launch the app with the desktop shortcut or by double-clicking `start.bat`.

The app opens at:

```text
http://127.0.0.1:3000
```

If Node.js is not installed, `install.bat` can try to install Node.js LTS with Windows `winget`. If `winget` is not available, it opens the Node.js download page.

### Command line

```bash
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:3000
```

## AI API Setup

You can enter API settings directly in the right-side API connection panel. The settings are saved in your browser localStorage.

For a persistent local default, copy `.env.example` to `.env.local`:

```bash
CUSTOM_AI_API_URL=https://your-api.example.com/v1/chat/completions
CUSTOM_AI_API_KEY=your-api-key
CUSTOM_AI_MODEL=your-model-name
```

Optional local-key preset:

```bash
CLOD_LOCAL_API_KEY=your-clod-token
```

Do not commit `.env.local`. It is ignored by `.gitignore`.

## Provider Presets

Included presets:

- Custom API
- OpenAI
- CLOD
- CLOD OpenAI Best Local Key
- DeepSeek
- OpenRouter
- Kimi / Moonshot
- Alibaba DashScope
- SiliconFlow
- Zhipu GLM

The adapter is generic. OpenAI-compatible chat endpoints receive normal chat completion requests. Photo reference generation uses a multimodal `image_url` message when the endpoint path looks OpenAI-compatible.

## Expected Sprite JSON

AI responses should return a sprite object:

```json
{
  "width": 16,
  "height": 16,
  "pixels": [
    ["#000000", "#ffffff", "transparent"]
  ]
}
```

Colors may be:

- `#RGB`
- `#RRGGBB`
- `#RRGGBBAA`
- `transparent`

Invalid colors are replaced with `transparent`. Width/height mismatches return a readable validation error.

## AI Modes

### Generate

Sends:

```json
{
  "mode": "generate",
  "prompt": "Draw a 16x16 blue slime.",
  "width": 16,
  "height": 16
}
```

When a photo reference is uploaded, the browser compresses it and sends `referenceImageDataUrl`.

### Edit Current Sprite

Sends:

```json
{
  "mode": "edit",
  "editInstruction": "Make the ears smaller and keep the rest unchanged.",
  "currentSprite": {
    "width": 16,
    "height": 16,
    "pixels": []
  }
}
```

The AI must return a complete final sprite JSON with the same width and height.

### Animate Current Frame

Sends:

```json
{
  "mode": "animate",
  "animationInstruction": "Make a 4-frame tail wag loop.",
  "frameCount": 4,
  "currentSprite": {
    "width": 16,
    "height": 16,
    "pixels": []
  }
}
```

The API expects:

```json
{
  "frames": [
    {
      "width": 16,
      "height": 16,
      "pixels": []
    }
  ]
}
```

The current image is kept as frame 1; generated frames are appended after it.

## Agent Integration

Machine-facing HTTP routes:

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/agent/manifest` | Discovery, schema hints, MCP env |
| POST | `/api/agent/validate` | Validate a sprite JSON object |
| POST | `/api/agent/export-png` | Render a PNG from sprite JSON |
| POST | `/api/agent/generate` | Same body as `/api/generate-sprite` |

Optional gate:

```bash
AGENT_API_SECRET=your-local-secret
```

When set, agent routes require:

```text
Authorization: Bearer your-local-secret
```

MCP server:

```bash
npm run mcp:agent
```

Environment:

- `AI_PIXEL_PAINTER_BASE_URL` defaults to `http://127.0.0.1:3000`
- `AGENT_API_SECRET` is optional and must match the Next.js server if configured

## Project Structure

```text
app/api/generate-sprite/route.ts
app/api/agent/manifest/route.ts
app/api/agent/validate/route.ts
app/api/agent/export-png/route.ts
app/api/agent/generate/route.ts
app/page.tsx
components/AIPanel.tsx
components/PixelCanvas.tsx
components/Toolbar.tsx
lib/pixelUtils.ts
lib/generateSpriteFromBody.ts
lib/spriteToPng.ts
lib/exportGif.ts
scripts/ai-pixel-painter-mcp.mjs
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run mcp:agent
```

## License

MIT
