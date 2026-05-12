# AI Pixel Art

A simple pixel-art tool for making game sprites with AI.

You can draw by hand, generate sprites from text, edit an existing sprite with AI, turn a photo into pixel art, and export PNG or GIF animations.

## Download

Choose the package for your system:

- Windows: [AI_Pixel_Painter_windows.zip](https://github.com/cpy114514/AI-pixel-art/raw/main/release/AI_Pixel_Painter_windows.zip)
- macOS / Linux: [AI_Pixel_Painter_macos_linux.tar.gz](https://github.com/cpy114514/AI-pixel-art/raw/main/release/AI_Pixel_Painter_macos_linux.tar.gz)

The old Windows link still works:

[AI_Pixel_Painter_one_click.zip](https://github.com/cpy114514/AI-pixel-art/raw/main/release/AI_Pixel_Painter_one_click.zip)

## How To Use

### Windows

1. Download the ZIP.
2. Extract it.
3. Double-click `install.bat`.
4. The app will open in your browser.

After installation, you can start it again from the desktop shortcut **AI Pixel Art**. The shortcut opens the browser without keeping a terminal window on screen.

If you need to see startup logs for debugging, double-click `start.bat`.

### macOS / Linux

1. Download the `.tar.gz`.
2. Extract it.
3. Open a terminal in the extracted folder.
4. Run:

```bash
chmod +x install.sh start.sh
./install.sh
```

After installation, start it again with:

```bash
./start.sh
```

The app runs as a local web app at the first available local port, usually:

```text
http://127.0.0.1:3000
```

## Need Node.js?

This app needs Node.js.

If Node.js is missing on Windows, `install.bat` will try to install it with Windows `winget`. If that does not work, install Node.js LTS from:

<https://nodejs.org/>

Then run `install.bat` or `install.sh` again.

## AI API Setup

Open the app and choose an API provider preset.

Usually you only need to fill:

- API key
- model name, if your provider requires it

Your settings are saved locally in the app, so you do not need to type them again every time.

The download ZIP does not include any API key. API keys stay on your own computer.

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
