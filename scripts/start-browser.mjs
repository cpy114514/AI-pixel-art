import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";

const preferredPort = Number(process.env.AI_PIXEL_ART_PORT ?? 3000);
const portSearchLimit = preferredPort + 19;
const projectRoot = process.cwd();
let serverProcess;
let openedExistingDevServer = false;
let existingNextDevServerDetected = false;
let existingNextDevServerUrl = "";
let devServerOutputBuffer = "";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapePowerShellSingleQuotedString(value) {
  return value.replaceAll("'", "''");
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

function requestText(url) {
  return new Promise((resolve) => {
    const request = http.get(
      url,
      {
        headers: {
          "Cache-Control": "no-cache",
        },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({ statusCode: response.statusCode, text: body });
        });
      },
    );

    request.setTimeout(2500, () => {
      request.destroy();
      resolve(null);
    });

    request.on("error", () => resolve(null));
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      windowsHide: true,
      ...options,
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: error.message });
    });
    child.on("exit", (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
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

async function isHomePageReady(port) {
  const result = await requestText(`http://127.0.0.1:${port}/`);
  return (
    result?.statusCode === 200 &&
    typeof result.text === "string" &&
    result.text.includes("AI Pixel Art") &&
    result.text.includes("/_next/")
  );
}

async function waitForAppReady(port, maxAttempts = 180) {
  let stableReadyChecks = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (existingNextDevServerDetected || openedExistingDevServer) {
      return false;
    }

    const healthReady = await isPixelArtReady(port);
    const homeReady = healthReady ? await isHomePageReady(port) : false;

    if (healthReady && homeReady) {
      stableReadyChecks += 1;
      if (stableReadyChecks >= 2) {
        return true;
      }
    } else {
      stableReadyChecks = 0;
    }

    await sleep(500);
  }

  return false;
}

async function findReadyPixelArtPort() {
  for (let port = preferredPort; port <= portSearchLimit; port += 1) {
    if (await isPixelArtReady(port)) {
      return port;
    }
  }

  return null;
}

async function getProjectNextProcessIds() {
  if (process.platform !== "win32") {
    return [];
  }

  const escapedRoot = escapePowerShellSingleQuotedString(projectRoot);
  const command = [
    "$root = '" + escapedRoot + "';",
    "Get-CimInstance Win32_Process",
    "|",
    "Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.Contains($root) -and ($_.CommandLine -match 'next(\\\\|/)dist(\\\\|/)bin|next(\\\\|/)dist(\\\\|/)server|postcss\\.js') } |",
    "Select-Object -ExpandProperty ProcessId",
  ].join(" ");

  const result = await runCommand("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    command,
  ]);

  return result.stdout
    .split(/\r?\n/)
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
}

async function killProcessTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return;
  }

  if (process.platform === "win32") {
    await runCommand("taskkill.exe", ["/pid", String(pid), "/T", "/F"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {}
}

async function cleanupStaleProjectServers() {
  const readyPort = await findReadyPixelArtPort();
  if (readyPort !== null) {
    return readyPort;
  }

  const processIds = await getProjectNextProcessIds();
  if (processIds.length === 0) {
    return null;
  }

  console.log("Cleaning up stale AI Pixel Art server processes...");
  await Promise.all(processIds.map((pid) => killProcessTree(pid)));
  await sleep(1000);
  return null;
}

async function choosePort() {
  for (let port = preferredPort; port <= portSearchLimit; port += 1) {
    if (await isPixelArtReady(port)) {
      return { port, existing: true };
    }
    if (await canListenOnPort(port)) {
      return { port, existing: false };
    }
    console.log(`Port ${port} is already in use; trying ${port + 1}.`);
  }

  throw new Error(
    `Could not find an available port from ${preferredPort} to ${portSearchLimit}.`,
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

function maybeOpenExistingNextDevServer(allowFallback = false) {
  if (!existingNextDevServerDetected || openedExistingDevServer) {
    return;
  }

  if (!existingNextDevServerUrl && !allowFallback) {
    return;
  }

  const url = existingNextDevServerUrl || `http://localhost:${preferredPort}`;
  openedExistingDevServer = true;
  console.log(`Opening existing Next dev server at ${url}`);
  openBrowser(url);
}

function handleNextDevOutput(chunk, stream) {
  const text = chunk.toString();
  stream.write(chunk);
  devServerOutputBuffer = `${devServerOutputBuffer}${text}`.slice(-5000);

  if (devServerOutputBuffer.includes("Another next dev server is already running.")) {
    existingNextDevServerDetected = true;
    const lockMessageStart = devServerOutputBuffer.indexOf(
      "Another next dev server is already running.",
    );
    const lockMessage = devServerOutputBuffer.slice(lockMessageStart);
    const localUrls = [...lockMessage.matchAll(/http:\/\/(?:localhost|127\.0\.0\.1):\d+/g)];
    if (localUrls.length > 0) {
      existingNextDevServerUrl = localUrls[localUrls.length - 1][0];
    }
  }

  maybeOpenExistingNextDevServer();
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
    handleNextDevOutput(chunk, process.stdout);
  });

  serverProcess.stderr.on("data", (chunk) => {
    handleNextDevOutput(chunk, process.stderr);
  });

  serverProcess.on("exit", (code) => {
    maybeOpenExistingNextDevServer(true);
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
  const existingReadyPort = await cleanupStaleProjectServers();
  if (existingReadyPort !== null) {
    const existingUrl = `http://127.0.0.1:${existingReadyPort}`;
    console.log(`AI Pixel Art is already running at ${existingUrl}`);
    await waitForAppReady(existingReadyPort, 30);
    openBrowser(existingUrl);
    return;
  }

  const { port, existing } = await choosePort();
  const url = `http://127.0.0.1:${port}`;

  if (existing) {
    console.log(`AI Pixel Art is already running at ${url}`);
    await waitForAppReady(port, 30);
    openBrowser(url);
    return;
  }

  console.log(`Starting AI Pixel Art at ${url}`);
  startNextDev(port);

  if (await waitForAppReady(port)) {
    console.log(`Opening ${url}`);
    openBrowser(url);
    return;
  }

  if (existingNextDevServerDetected || openedExistingDevServer) {
    return;
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

process.on("SIGHUP", () => {
  stopServer();
  process.exit(0);
});

process.on("SIGBREAK", () => {
  stopServer();
  process.exit(0);
});

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  stopServer();
  process.exit(1);
});
