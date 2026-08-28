import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppSettings } from "../src/types.js";

export type AppSettingsPatch = Omit<Partial<AppSettings>, "local" | "codex" | "hybrid"> & {
  local?: Partial<AppSettings["local"]>;
  codex?: Partial<AppSettings["codex"]>;
  hybrid?: Partial<AppSettings["hybrid"]>;
};

export const SETTINGS_SCHEMA_VERSION = 1;

export const defaultSettings = (): AppSettings => ({
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  firstRunComplete: false,
  defaultBrain: "hybrid",
  local: {
    enabled: false,
    serverUrl: "http://127.0.0.1:11434",
    model: "",
    contextLength: 32_768,
    temperature: 0.65,
    timeoutMs: 120_000,
  },
  codex: {
    model: "",
    autoStart: true,
    approvalPolicy: "unlessTrusted",
  },
  hybrid: {
    localModel: "",
    codexModel: "",
    automaticRouting: true,
    routingPolicy: "balanced",
  },
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",
  trustedProjectWorkspace: true,
  movieDnaPresets: [],
  updatedAt: new Date().toISOString(),
});

const mergeSettings = (stored: AppSettingsPatch): AppSettings => {
  const defaults = defaultSettings();
  return {
    ...defaults,
    ...stored,
    local: { ...defaults.local, ...stored.local },
    codex: { ...defaults.codex, ...stored.codex },
    hybrid: { ...defaults.hybrid, ...stored.hybrid },
    schemaVersion: SETTINGS_SCHEMA_VERSION,
  };
};

export class SettingsStore {
  private cache?: AppSettings;

  constructor(readonly filePath: string) {}

  async get(): Promise<AppSettings> {
    if (this.cache) return structuredClone(this.cache);
    try {
      const stored = JSON.parse(await readFile(this.filePath, "utf8")) as Partial<AppSettings>;
      this.cache = mergeSettings(stored);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.cache = defaultSettings();
      await this.save(this.cache);
    }
    return structuredClone(this.cache);
  }

  async update(patch: AppSettingsPatch): Promise<AppSettings> {
    const current = await this.get();
    const next = mergeSettings({
      ...current,
      ...patch,
      local: { ...current.local, ...patch.local },
      codex: { ...current.codex, ...patch.codex },
      hybrid: { ...current.hybrid, ...patch.hybrid },
      updatedAt: new Date().toISOString(),
    });
    await this.save(next);
    return structuredClone(next);
  }

  private async save(settings: AppSettings) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    try {
      await rename(temporary, this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error;
      await writeFile(this.filePath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    } finally {
      await rm(temporary, { force: true });
    }
    this.cache = settings;
  }
}
