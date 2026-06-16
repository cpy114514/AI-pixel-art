import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const nextStaticSource = path.join(root, ".next", "static");
const nextStaticTarget = path.join(standaloneDir, ".next", "static");
const publicSource = path.join(root, "public");
const publicTarget = path.join(standaloneDir, "public");

async function copyIfExists(source, target) {
  try {
    await fs.access(source);
  } catch {
    return;
  }

  await fs.rm(target, { recursive: true, force: true });
  await fs.cp(source, target, { recursive: true });
}

await copyIfExists(nextStaticSource, nextStaticTarget);
await copyIfExists(publicSource, publicTarget);

console.log("Prepared Next standalone files for Electron.");
