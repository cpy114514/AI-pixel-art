import { app, BrowserWindow, shell } from "electron";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const port = Number(process.env.AI_PIXEL_ART_PORT ?? 3000);
const appUrl = `http://127.0.0.1:${port}`;

let nextProcess;
let mainWindow;
let splashWindow;
let usedExistingServer = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerReady() {
  try {
    const response = await fetch(appUrl, { signal: AbortSignal.timeout(1000) });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

function startNextServer() {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  nextProcess = spawn(
    npmCommand,
    ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: projectRoot,
      env: { ...process.env, BROWSER: "none" },
      stdio: "pipe",
      windowsHide: true,
    },
  );

  nextProcess.on("exit", () => {
    nextProcess = undefined;
    if (!usedExistingServer && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });
}

async function ensureServer() {
  if (await isServerReady()) {
    usedExistingServer = true;
    return;
  }

  startNextServer();
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await isServerReady()) {
      return;
    }
    await sleep(500);
  }

  throw new Error(`AI Pixel Art could not start at ${appUrl}.`);
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 460,
    height: 320,
    frame: false,
    resizable: false,
    show: true,
    center: true,
    backgroundColor: "#08111f",
    title: "AI Pixel Art",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  splashWindow.loadFile(path.join(__dirname, "splash.html"));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1100,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#f6f8fb",
    title: "AI Pixel Art",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(appUrl)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    mainWindow.show();
  });

  mainWindow.loadURL(appUrl);
}

async function boot() {
  createSplashWindow();
  await ensureServer();
  createMainWindow();
}

app.whenReady().then(() => {
  boot().catch((error) => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.executeJavaScript(
        `document.body.dataset.error = ${JSON.stringify(error.message)}`,
      );
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (nextProcess) {
    nextProcess.kill();
    nextProcess = undefined;
  }
});
