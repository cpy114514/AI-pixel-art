# AI Pixel Art

A simple pixel-art tool for making game sprites with AI.

You can draw by hand, generate sprites from text, edit an existing sprite with AI, turn a photo into pixel art, and export PNG or GIF animations.

## Download

Choose the package for your system:

- Windows: [AI_Pixel_Painter_windows.zip](https://github.com/cpy114514/AI-pixel-art/raw/main/release/AI_Pixel_Painter_windows.zip)
- macOS / Linux: [AI_Pixel_Painter_macos_linux.tar.gz](https://github.com/cpy114514/AI-pixel-art/raw/main/release/AI_Pixel_Painter_macos_linux.tar.gz)

The old Windows link still works:

[AI_Pixel_Painter_one_click.zip](https://github.com/cpy114514/AI-pixel-art/raw/main/release/AI_Pixel_Painter_one_click.zip)

## Quick Start

### Windows

1. Download `AI_Pixel_Painter_windows.zip`.
2. Right-click the ZIP and choose **Extract All**.
3. Open the extracted `AI_Pixel_Painter` folder.
4. Double-click `install.bat`.
5. Wait for dependencies to install. The app will open in your browser.

After installation, you can start it again from the desktop shortcut **AI Pixel Art**. The shortcut opens the browser without keeping a terminal window on screen.

`start.bat` uses the hidden launcher. If you need to see startup logs for debugging, double-click `start-debug.bat`.

### macOS / Linux

1. Download `AI_Pixel_Painter_macos_linux.tar.gz`.
2. Extract it.
3. Open a terminal in the extracted folder.
4. Run:

```bash
chmod +x install.sh start.sh
./install.sh
```

After installation, start it again from the same folder with:

```bash
./start.sh
```

The app runs as a local web app at the first available local port, usually:

```text
http://127.0.0.1:3000
```

If the browser does not open automatically, open that address manually.

## Need Node.js?

This app needs Node.js.

If Node.js is missing on Windows, `install.bat` will try to install it with Windows `winget`. If that does not work, install Node.js LTS from:

<https://nodejs.org/>

Then run `install.bat` or `install.sh` again.

## Using The App

### 1. Connect An AI API

Open the right-side **API connection** panel.

1. Choose a provider preset, or choose `custom`.
2. Fill the API URL if needed.
3. Fill your API key.
4. Choose or type a model name.

Usually you only need:

- API key
- model name, if your provider requires it

Your settings are saved locally in the app, so you do not need to type them again every time.

The download files do not include any API key. API keys stay on your own computer.

### 2. Create A Sprite

1. Choose the canvas size on the left, for example `16x16` or `32x32`.
2. Type a prompt like:

```text
Draw a 16x16 blue slime with a readable face, dark outline, highlight, and shadow.
```

3. Click **Generate with AI**.
4. If it is taking too long, click **Pause current AI job**.

The app tells the AI the current canvas size automatically.

### 3. Edit A Sprite With AI

1. Change **Function** to **Edit current frame**.
2. Type an edit instruction, for example:

```text
Make the ears smaller and keep the rest unchanged.
```

3. Click **Edit with AI**.

If your image has multiple animation frames, the edit is applied to all frames.

### 4. Turn A Photo Into Pixel Art

1. Use **Upload photo** in the AI panel.
2. Type what should be preserved from the photo.
3. Click **Generate from photo**.

### 5. Make Animation

1. Create or load one sprite frame.
2. Change **Function** to **Animate current frame**.
3. Set the number of frames.
4. Describe the motion, for example:

```text
Idle breathing animation with a small bounce and blinking eyes.
```

5. Click **Generate animation**.

### 6. Export

Use the right-side export panel to save:

- current frame PNG
- sprite sheet PNG
- animated GIF

You can choose PNG scale: `1x`, `4x`, `8x`, or `16x`.

## Advanced API Setup

For advanced users, you can also copy `.env.example` to `.env.local` and edit:

```text
CUSTOM_AI_API_URL=
CUSTOM_AI_API_KEY=
CUSTOM_AI_MODEL=
```

Do not upload `.env.local`. It is ignored by Git.

## Developer Commands

```bash
npm install
npm run dev
```

## AI Agent Tool

AI agents can use this app through MCP or local REST APIs.

Start the web app first:

```bash
npm run dev
```

Then start the MCP tool server:

```bash
npm run mcp:agent
```

Example MCP config:

```json
{
  "mcpServers": {
    "ai-pixel-painter": {
      "command": "npm",
      "args": ["run", "mcp:agent"],
      "cwd": "PATH_TO_AI_Pixel_Painter",
      "env": {
        "AI_PIXEL_PAINTER_BASE_URL": "http://127.0.0.1:3000"
      }
    }
  }
}
```

The MCP server gives agents tools to:

- generate a sprite
- edit a sprite
- generate animation frames
- validate sprite JSON
- export PNG
- export sprite sheet PNG
- export animated GIF

REST manifest:

```text
GET http://127.0.0.1:3000/api/agent/manifest
```

Optional local auth:

```text
AGENT_API_SECRET=your-local-secret
```

When set, agent REST routes require:

```text
Authorization: Bearer your-local-secret
```

See `mcp-config.example.json` for a copyable MCP setup.

Build:

```bash
npm run build
```

## License

MIT
