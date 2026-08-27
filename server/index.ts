import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { startContinuityServer } from "./runtime.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, "..");
try {
  loadEnvFile(path.join(workspaceRoot, ".env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const dataRoot = process.env.CONTINUITY_DATA_DIR?.trim()
  ? path.resolve(process.env.CONTINUITY_DATA_DIR)
  : path.join(workspaceRoot, "data", "projects");
const dataBase = path.dirname(dataRoot);
const production = process.argv.includes("--prod") || process.env.NODE_ENV === "production";
const runtime = await startContinuityServer({
  workspaceRoot,
  dataRoot,
  settingsPath: path.join(dataBase, "settings.json"),
  logsRoot: path.join(dataBase, "logs"),
  distRoot: path.join(workspaceRoot, "dist"),
  production,
  version: process.env.npm_package_version || "1.0.0",
  port: Number(process.env.PORT) || 8787,
});

console.log(`Continuity Studio running at ${runtime.url}`);
console.log(`Provider: ${runtime.router.providerInfo.label}`);
console.log(`Project data: ${dataRoot}`);

const shutdown = async () => {
  await runtime.close();
  process.exit(0);
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
