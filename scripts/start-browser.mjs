import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";

const preferredPort = Number(process.env.AI_PIXEL_ART_PORT ?? 3000);
let serverProcess;
let openedExistingDevServer = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve({ statusCode: response.statusCode, json: JSON.parse(body) });
        } catch {
          resolve({ statusCode: response.statusCode, json: null });
        }
      });
    });

    request.setTimeout(800, () => {
      request.destroy();
      resolve(null);
    });

    request.on("error", () => resolve(null));
  });
}

function canListenOnPort(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();

    tester.once("error", () => {
      resolve(false);
    });

    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });

    tester.listen(port, "127.0.0.1");
  });
}

async function isPixelArtReady(port) {
  const result = await requestJson(`http://127.0.0.1:${port}/api/health`);
  return (
    result?.statusCode === 200 &&
    result.json?.ok === true &&
    result.json?.name === "ai-pixel-art"
  );
}

async function choosePort() {
  for (let port = preferredPort; port < preferredPort + 20; port += 1) {
    if (await isPixelArtReady(port)) {
      return { port, existing: true };
    }
    if (await canListenOnPort(port)) {
      return { port, existing: false };
    }
    console.log(`Port ${port} is already in use; trying ${port + 1}.`);
  }

  throw new Error(
    `Could not find an available port from ${preferredPort} to ${preferredPort + 19}.`,
  );
}

function openBrowser(url) {
  if (process.platform === "win32") {
    spawn(process.env.ComSpec ?? "cmd.exe", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
    return;
  }

  const command = process.platform === "darwin" ? "open" : "xdg-open";
  spawn(command, [url], { detached: true, stdio: "ignore" }).unref();
}

function startNextDev(port) {
  const isWindows = process.platform === "win32";
  const command = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "npm";
  const args = isWindows
    ? ["/d", "/s", "/c", `npm run dev -- --hostname 127.0.0.1 --port ${port}`]
    : ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)];

  serverProcess = spawn(command, args, {
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  serverProcess.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
  });

  serverProcess.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    process.stderr.write(chunk);

    if (text.includes("Another next dev server is already running.")) {
      const localUrl = text.match(/http:\/\/(?:localhost|127\.0\.0\.1):\d+/)?.[0];
      if (localUrl && !openedExistingDevServer) {
        openedExistingDevServer = true;
        console.log(`Opening existing Next dev server at ${localUrl}`);
        openBrowser(localUrl);
      }
    }
  });

  serverProcess.on("exit", (code) => {
    if (openedExistingDevServer) {
      process.exit(0);
    }
    process.exit(code ?? 0);
  });
}

function stopServer() {
  if (!serverProcess) {
    return;
  }

  if (process.platform === "win32" && serverProcess.pid) {
    spawn("taskkill.exe", ["/pid", String(serverProcess.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    serverProcess.kill();
  }
}

async function main() {
  const { port, existing } = await choosePort();
  const url = `http://127.0.0.1:${port}`;

  if (existing) {
    console.log(`AI Pixel Art is already running at ${url}`);
    openBrowser(url);
    return;
  }

  console.log(`Starting AI Pixel Art at ${url}`);
  startNextDev(port);

  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await isPixelArtReady(port)) {
      console.log(`Opening ${url}`);
      openBrowser(url);
      return;
    }
    await sleep(500);
  }

  throw new Error(`AI Pixel Art did not become ready at ${url}.`);
}

process.on("SIGINT", () => {
  stopServer();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopServer();
  process.exit(0);
});

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  stopServer();
  process.exit(1);
});
