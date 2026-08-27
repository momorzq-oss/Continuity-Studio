import { app, BrowserWindow, dialog, screen } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { StructuredLogger } from "../server/logger.js";
import { startContinuityServer, type StartedContinuityServer } from "../server/runtime.js";
import { boundedWindowState, startBackendWithCollisionFallback, withStartupTimeout } from "./lifecycle.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = app.getAppPath();
const isDevelopment = process.env.CONTINUITY_DESKTOP_DEV === "1" || !app.isPackaged;
const assetRoot = isDevelopment ? path.resolve(currentDir, "..", "assets") : path.join(appRoot, "assets");
const desktopRoot = isDevelopment ? path.resolve(currentDir, "..", "desktop") : path.join(appRoot, "desktop");
const preloadPath = path.join(currentDir, "preload.mjs");
let mainWindow: BrowserWindow | undefined;
let backend: StartedContinuityServer | undefined;
let shuttingDown = false;
const BRAND = "Continuity Studio By BURABEEH";

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId("studio.continuity.desktop");
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

const readWindowState = async (filePath: string) => {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      maximized?: boolean;
    };
  } catch {
    return undefined;
  }
};

const saveWindowState = async (filePath: string, window: BrowserWindow) => {
  const bounds = window.getNormalBounds();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify({ ...bounds, maximized: window.isMaximized() }, null, 2)}\n`, "utf8");
};

const showStartupError = async (window: BrowserWindow, error: unknown) => {
  const message = error instanceof Error ? error.message : `${BRAND} could not start.`;
  const page = `<!doctype html><html><body style="margin:0;background:#090a0b;color:#f2efe9;font:14px system-ui;display:grid;place-items:center;height:100vh"><main style="max-width:620px;padding:34px;border:1px solid #333;border-radius:12px;background:#121416"><p style="color:#e7a93a;letter-spacing:.16em;font-size:11px">CONTINUITY STUDIO · BY BURABEEH</p><h1>Continuity Studio could not start</h1><p style="color:#aaa;line-height:1.6">${message.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p><p style="color:#e7a93a">Close the application and open it again. Details were saved in Documents\\Continuity Studio\\Logs.</p></main></body></html>`;
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
  window.show();
};

const updateLoadingStatus = async (window: BrowserWindow, status: string) => {
  await window.webContents.executeJavaScript(
    `document.getElementById("startup-status").textContent = ${JSON.stringify(status)}`,
    true,
  ).catch(() => undefined);
};

const openAuthWindow = (url: string, parent: BrowserWindow) => {
  const auth = new BrowserWindow({
    parent,
    modal: false,
    width: 620,
    height: 780,
    title: `Connect Codex · ${BRAND}`,
    icon: path.join(assetRoot, "icon.ico"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  void auth.loadURL(url);
};

const createMainWindow = async () => {
  const dataBase = path.join(app.getPath("documents"), "Continuity Studio");
  const projectsRoot = path.join(dataBase, "Projects");
  const logsRoot = path.join(dataBase, "Logs");
  const settingsPath = path.join(dataBase, "settings.json");
  const windowStatePath = path.join(app.getPath("userData"), "window-state.json");
  const logger = new StructuredLogger(logsRoot);
  try {
    loadEnvFile(path.join(dataBase, ".env"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      await logger.warn("desktop", "The optional environment file could not be loaded; startup continued without it.", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const display = screen.getPrimaryDisplay();
  const state = boundedWindowState(await readWindowState(windowStatePath), display.workArea);
  const window = new BrowserWindow({
    ...state,
    title: BRAND,
    backgroundColor: "#090a0b",
    icon: path.join(assetRoot, "icon.ico"),
    minWidth: 1100,
    minHeight: 700,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  });
  mainWindow = window;
  if (state.maximized) window.maximize();
  await window.loadFile(path.join(desktopRoot, "loading.html"));
  window.show();
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/(chatgpt\.com|auth\.openai\.com)\//i.test(url)) openAuthWindow(url, window);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    const allowed = backend?.url && url.startsWith(backend.url);
    if (!allowed && !url.startsWith("file:") && !url.startsWith("data:")) event.preventDefault();
  });
  window.on("close", () => void saveWindowState(windowStatePath, window));
  window.on("closed", () => { mainWindow = undefined; });

  try {
    await logger.info("desktop", `${BRAND} startup began.`, { version: app.getVersion(), packaged: app.isPackaged });
    await updateLoadingStatus(window, "Starting secure local services…");
    const startupWork = startBackendWithCollisionFallback((port) => startContinuityServer({
        workspaceRoot: isDevelopment ? path.resolve(currentDir, "..") : appRoot,
        dataRoot: isDevelopment && process.env.CONTINUITY_USE_WORKSPACE_DATA === "1"
          ? path.resolve(currentDir, "..", "data", "projects")
          : projectsRoot,
        settingsPath,
        logsRoot,
        distRoot: isDevelopment ? path.resolve(currentDir, "..", "dist") : path.join(appRoot, "dist"),
        production: !isDevelopment,
        version: app.getVersion(),
        desktopVersion: app.getVersion(),
        port,
      }));
    const startup = await withStartupTimeout(
      startupWork,
      25_000,
      "The local production service took too long to start. Another application may be blocking it.",
    ).catch((error) => {
      void startupWork.then((lateStartup) => lateStartup.backend.close()).catch(() => undefined);
      throw error;
    });
    backend = startup.backend;
    if (startup.portCollision) {
      await logger.warn("desktop", "Preferred backend port was occupied; an available local port was selected.", { preferredPort: 8787, selectedPort: backend.port });
    }
    await updateLoadingStatus(window, "Opening your production workspace…");
    const startupFlag = startup.portCollision ? "&startup=port_collision" : "";
    await withStartupTimeout(
      window.loadURL(`${backend.url}/?desktop=1${startupFlag}`),
      20_000,
      "The interface did not finish loading. Close Continuity Studio and try again.",
    );
    await logger.info("desktop", `${BRAND} is ready.`, { port: backend.port, portCollision: startup.portCollision });
  } catch (error) {
    if (backend) {
      await backend.close().catch(() => undefined);
      backend = undefined;
    }
    await logger.error("desktop", "Desktop startup failed.", { message: error instanceof Error ? error.message : String(error) });
    await showStartupError(window, error);
  }
};

app.whenReady().then(async () => {
  await createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
  });
}).catch(async (error) => {
  if (mainWindow) {
    await showStartupError(mainWindow, error).catch(() => undefined);
  } else {
    dialog.showErrorBox(BRAND, error instanceof Error ? error.message : "The desktop application could not start.");
    app.quit();
  }
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", (event) => {
  if (shuttingDown || !backend) return;
  event.preventDefault();
  shuttingDown = true;
  void backend.close().finally(() => {
    backend = undefined;
    app.quit();
  });
});
