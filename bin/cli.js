#!/usr/bin/env node

import { resolve, dirname } from "path";
import { spawnPromise } from "spawn-rx";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // Get command line arguments
  const [, , command, ...mcpServerArgs] = process.argv;

  const inspectorServerPath = resolve(
    __dirname,
    "..",
    "server",
    "build",
    "index.js",
  );

  // Path to the client entry point
  const inspectorClientPath = resolve(
    __dirname,
    "..",
    "client",
    "bin",
    "cli.js",
  );

  const CLIENT_PORT = process.env.CLIENT_PORT ?? "5173";
  const SERVER_PORT = process.env.SERVER_PORT ?? "3000";

  console.log("Starting MCP inspector...");

  const abort = new AbortController();

  let cancelled = false;
  process.on("SIGINT", () => {
    cancelled = true;
    abort.abort();
  });

  const server = spawnPromise(
    "node",
    [
      inspectorServerPath,
      ...(command ? [`--env`, command] : []),
      ...(mcpServerArgs ? ["--args", mcpServerArgs.join(" ")] : []),
    ],
    { env: { ...process.env, PORT: SERVER_PORT }, signal: abort.signal },
  );

  const client = spawnPromise("node", [inspectorClientPath], {
    env: { ...process.env, PORT: CLIENT_PORT },
    signal: abort.signal,
  });

  // Make sure our server/client didn't immediately fail
  await Promise.any([server, client, delay(2 * 1000)]);
  const portParam = SERVER_PORT === "3000" ? "" : `?port=${SERVER_PORT}`;
  console.log(
    `\n🔍 MCP Inspector is up and running at http://localhost:${CLIENT_PORT}${portParam} 🚀`,
  );

  try {
    await Promise.any([server, client]);
  } catch (e) {
    if (!cancelled || process.env.DEBUG) throw e;
  }

  return 0;
}

main()
  .then((_) => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
