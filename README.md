# AI Pixel Painter

A simple pixel-art tool for making game sprites with AI.

You can draw by hand, generate sprites from text, edit an existing sprite with AI, turn a photo into pixel art, and export PNG or GIF animations.

## Download

Windows one-click package:

[Download AI_Pixel_Painter_one_click.zip](https://github.com/cpy114514/AI-pixel-art/raw/main/release/AI_Pixel_Painter_one_click.zip)

Or use GitHub's green **Code** button and choose **Download ZIP**.

## How To Use

1. Download the ZIP.
2. Extract it.
3. Double-click `install.bat`.
4. The app will open in your browser.

After installation, you can start it again from the desktop shortcut **AI Pixel Painter**, or by double-clicking `start.bat`.

The app runs locally at:

```text
http://127.0.0.1:3000
```

## Need Node.js?

This app needs Node.js.

If Node.js is missing, `install.bat` will try to install it with Windows `winget`. If that does not work, install Node.js LTS from:

<https://nodejs.org/>

Then run `install.bat` again.

## AI API Setup

Open the app and choose an API provider preset.

Usually you only need to fill:

- API key
- model name, if your provider requires it

Your settings are saved in your browser, so you do not need to type them again every time.

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

Build:

```bash
npm run build
```

## License

MIT
