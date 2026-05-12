import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

const preferredPort = Number(process.env.AI_PIXEL_ART_PORT ?? 3000);
const portSearchLimit = preferredPort + 19;
const projectRoot = process.cwd();
const devLogPath = path.join(projectRoot, "ai-pixel-art-dev.log");
let serverProcess;

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

async function isAppReady(port) {
  return (await isPixelArtReady(port)) && (await isHomePageReady(port));
}

async function waitForAppReady(port, maxAttempts = 180) {
  let stableReadyChecks = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (await isAppReady(port)) {
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

async function getProjectNextProcessIds() {
  if (process.platform !== "win32") {
    const result = await runCommand("ps", ["-axo", "pid=,command="]);
    if (result.code !== 0) {
      return [];
    }

    return result.stdout
      .split(/\r?\n/)
      .map((line) => {
        const match = line.match(/^\s*(\d+)\s+(.+)$/);
        return match ? { pid: Number(match[1]), commandLine: match[2] } : null;
      })
      .filter((entry) => entry !== null)
      .filter(
        ({ commandLine, pid }) =>
          Number.isInteger(pid) &&
          pid > 0 &&
          pid !== process.pid &&
          commandLine.includes(projectRoot) &&
          /next(\\|\/)dist(\\|\/)bin|next(\\|\/)dist(\\|\/)server|postcss\.js/.test(
            commandLine,
          ),
      )
      .map(({ pid }) => pid);
  }

  const wmicResult = await runCommand("wmic.exe", [
    "process",
    "get",
    "ProcessId,CommandLine",
    "/FORMAT:CSV",
  ]);

  if (wmicResult.code === 0) {
    return wmicResult.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("Node,"))
      .map((line) => {
        const parts = line.split(",");
        const pid = Number(parts.at(-1)?.trim());
        const commandLine = parts.slice(1, -1).join(",");
        return { commandLine, pid };
      })
      .filter(
        ({ commandLine, pid }) =>
          Number.isInteger(pid) &&
          pid > 0 &&
          pid !== process.pid &&
          commandLine.includes(projectRoot) &&
          /next(\\|\/)dist(\\|\/)bin|next(\\|\/)dist(\\|\/)server|postcss\.js/.test(
            commandLine,
          ),
      )
      .map(({ pid }) => pid);
  }

  const escapedRoot = escapePowerShellSingleQuotedString(projectRoot);
  const command = [
    "$root = '" + escapedRoot + "';",
    "Get-CimInstance Win32_Process",
    "|",
    "Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.Contains($root) -and ($_.CommandLine -match 'next(\\\\|/)dist(\\\\|/)bin|next(\\\\|/)dist(\\\\|/)server|postcss\\.js') }",
    "|",
    "Select-Object -ExpandProperty ProcessId",
  ].join(" ");

  const powershellResult = await runCommand("powershell.exe", [
    "-NoLogo",
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-WindowStyle",
    "Hidden",
    "-Command",
    command,
  ]);

  if (powershellResult.code !== 0) {
    return [];
  }

  return powershellResult.stdout
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

async function cleanupProjectServers() {
  const processIds = await getProjectNextProcessIds();
  if (processIds.length === 0) {
    return;
  }

  console.log("Closing previous AI Pixel Art server processes...");
  await Promise.all(processIds.map((pid) => killProcessTree(pid)));
  await sleep(1000);
}

async function choosePort() {
  for (let port = preferredPort; port <= portSearchLimit; port += 1) {
    if (await isAppReady(port)) {
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

function startNextDev(port) {
  const isWindows = process.platform === "win32";
  const command = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "npm";
  const args = isWindows
    ? ["/d", "/s", "/c", `npm run dev -- --hostname 127.0.0.1 --port ${port}`]
    : ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)];
  fs.appendFileSync(
    devLogPath,
    `\n\n[${new Date().toISOString()}] Starting AI Pixel Art at 127.0.0.1:${port}\n`,
  );
  const stdout = fs.openSync(devLogPath, "a");
  const stderr = fs.openSync(devLogPath, "a");

  serverProcess = spawn(command, args, {
    detached: true,
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", stdout, stderr],
    windowsHide: true,
  });

  fs.closeSync(stdout);
  fs.closeSync(stderr);
  serverProcess.unref();
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
  await cleanupProjectServers();

  const { port, existing } = await choosePort();
  const url = `http://127.0.0.1:${port}`;

  if (existing) {
    throw new Error(
      `Could not restart AI Pixel Art cleanly because ${url} is still in use. Close old Node/Next processes and try again.`,
    );
  }

  console.log(`Starting AI Pixel Art at ${url}`);
  startNextDev(port);

  if (await waitForAppReady(port)) {
    console.log(`Opening ${url}`);
    openBrowser(url);
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
