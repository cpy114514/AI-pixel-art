const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

let serverProcess = null;
let mainWindow = null;
let logPath = null;

function log(message) {
  if (!logPath) {
    return;
  }

  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Logging must never prevent the app from starting.
  }
}

function loadingHtml(message) {
  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>AI Pixel Art</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #f8fafc;
            color: #0f172a;
            font-family: Arial, sans-serif;
          }
          main {
            width: min(420px, calc(100vw - 48px));
            border: 1px solid #dbe3ef;
            border-radius: 8px;
            background: white;
            padding: 28px;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
          }
          h1 {
            margin: 0 0 10px;
            font-size: 26px;
          }
          p {
            margin: 0;
            color: #475569;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>AI Pixel Art</h1>
          <p>${message}</p>
        </main>
      </body>
    </html>`;
}

function findFreePort(startPort = 3410) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => {
      findFreePort(startPort + 1).then(resolve, reject);
    });
    server.listen(startPort, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(`${url}/api/health`, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });

      request.setTimeout(1000, () => {
        request.destroy();
        retry();
      });

      request.on("error", retry);
    };

    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error("Timed out waiting for the local app server."));
        return;
      }
      setTimeout(attempt, 300);
    };

    attempt();
  });
}

async function startServer() {
  const port = await findFreePort();
  const appPath = app.getAppPath();
  const serverRoot = path.join(appPath, ".next", "standalone");
  const serverEntry = path.join(serverRoot, "server.js");

  log(`Starting server from ${serverEntry} on port ${port}`);

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: serverRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  serverProcess.stdout.on("data", (chunk) => log(chunk.toString().trim()));
  serverProcess.stderr.on("data", (chunk) => log(chunk.toString().trim()));

  serverProcess.on("exit", (code, signal) => {
    log(`Server exited with code ${code ?? ""} signal ${signal ?? ""}`);
    serverProcess = null;
  });

  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return url;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 980,
    minHeight: 680,
    title: "AI Pixel Art",
    backgroundColor: "#f8fafc",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingHtml("Starting the local canvas engine..."))}`);

  try {
    const url = await startServer();
    log(`Loading ${url}`);
    await mainWindow.loadURL(url);
  } catch (error) {
    log(`Startup failed: ${error.stack ?? error.message}`);
    await mainWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(
        loadingHtml(`Could not start the app. Close any old AI Pixel Art processes and try again. Log file: ${logPath}`),
      )}`,
    );
  }
}

app.whenReady().then(() => {
  logPath = path.join(app.getPath("userData"), "ai-pixel-art.log");
  log("App ready");
  createWindow().catch((error) => {
    log(`Window creation failed: ${error.stack ?? error.message}`);
    app.quit();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
