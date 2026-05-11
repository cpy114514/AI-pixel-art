import { app, BrowserWindow, shell } from "electron";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import http from "node:http";
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
let nextStartError;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerReady() {
  return new Promise((resolve) => {
    const request = http.get(appUrl, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });

    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });

    request.on("error", () => resolve(false));
  });
}

function setSplashStatus(message, isError = false) {
  console.log(message);

  if (!splashWindow || splashWindow.isDestroyed()) {
    return;
  }

  splashWindow.webContents
    .executeJavaScript(
      `window.setStartupStatus(${JSON.stringify(message)}, ${JSON.stringify(isError)})`,
    )
    .catch(() => {});
}

function startNextServer() {
  const isWindows = process.platform === "win32";
  const command = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "npm";
  const args = isWindows
    ? ["/d", "/s", "/c", `npm run dev -- --hostname 127.0.0.1 --port ${port}`]
    : ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)];

  setSplashStatus("Starting local canvas engine...");
  nextProcess = spawn(
    command,
    args,
    {
      cwd: projectRoot,
      env: { ...process.env, BROWSER: "none" },
      stdio: "pipe",
      windowsHide: true,
    },
  );

  nextProcess.stdout?.on("data", (chunk) => {
    const text = chunk.toString().trim();
    if (text) {
      console.log(text);
      if (text.includes("Ready") || text.includes("Local")) {
        setSplashStatus("Local canvas engine is ready...");
      }
    }
  });

  nextProcess.stderr?.on("data", (chunk) => {
    const text = chunk.toString().trim();
    if (text) {
      console.error(text);
      setSplashStatus(text.split("\n").at(-1) ?? text);
    }
  });

  nextProcess.on("error", (error) => {
    nextStartError = error;
    setSplashStatus(`Could not start local engine: ${error.message}`, true);
  });

  nextProcess.on("exit", () => {
    nextProcess = undefined;
    if (!usedExistingServer && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });
}

function stopNextServer() {
  if (!nextProcess) {
    return;
  }

  if (process.platform === "win32" && nextProcess.pid) {
    spawn("taskkill.exe", ["/pid", String(nextProcess.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    nextProcess.kill();
  }

  nextProcess = undefined;
}

async function ensureServer() {
  setSplashStatus(`Checking ${appUrl}...`);
  if (await isServerReady()) {
    usedExistingServer = true;
    setSplashStatus("Using existing local canvas engine...");
    return;
  }

  startNextServer();
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (nextStartError) {
      throw nextStartError;
    }
    if (await isServerReady()) {
      setSplashStatus("Opening AI Pixel Art...");
      return;
    }
    if (attempt > 0 && attempt % 10 === 0) {
      setSplashStatus(`Still starting local canvas engine... ${Math.round(attempt / 2)}s`);
    }
    await sleep(500);
  }

  throw new Error(
    `AI Pixel Art could not start at ${appUrl}. Close anything using port ${port}, then run start.bat again.`,
  );
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

  const showMainWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) {
      return;
    }
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    mainWindow.show();
    mainWindow.focus();
  };

  mainWindow.once("ready-to-show", showMainWindow);
  mainWindow.webContents.once("did-finish-load", showMainWindow);
  mainWindow.webContents.once("did-fail-load", (_event, errorCode, errorDescription) => {
    setSplashStatus(`Could not load app window: ${errorCode} ${errorDescription}`, true);
  });

  mainWindow.loadURL(appUrl).catch((error) => {
    setSplashStatus(`Could not load app window: ${error.message}`, true);
  });
}

async function boot() {
  createSplashWindow();
  await ensureServer();
  createMainWindow();
}

app.whenReady().then(() => {
  boot().catch((error) => {
    setSplashStatus(error instanceof Error ? error.message : String(error), true);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopNextServer();
});
