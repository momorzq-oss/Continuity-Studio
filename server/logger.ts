import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type LogCategory =
  | "desktop"
  | "backend"
  | "brain-router"
  | "codex"
  | "local-model"
  | "production";

interface LogEntry {
  createdAt: string;
  level: "info" | "warn" | "error";
  category: LogCategory;
  message: string;
  data?: Record<string, unknown>;
}

const sensitiveKey = /key|token|password|secret|credential|authorization/i;
const sensitiveValue = /(sk-[A-Za-z0-9_-]{12,}|(?:bearer|authorization:)\s+[A-Za-z0-9._~+\/-]{12,}|(?:api[_-]?key|access[_-]?token|refresh[_-]?token)["'=:\s]+[A-Za-z0-9._~+\/-]{8,})/gi;

const sanitizeString = (value: string) => value.replace(sensitiveValue, "[REDACTED]");

const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "string") return sanitizeString(value);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : redact(item),
    ]),
  );
};

export class StructuredLogger {
  constructor(readonly rootDir: string) {}

  info(category: LogCategory, message: string, data?: Record<string, unknown>) {
    return this.write({ category, message, data, level: "info", createdAt: new Date().toISOString() });
  }

  warn(category: LogCategory, message: string, data?: Record<string, unknown>) {
    return this.write({ category, message, data, level: "warn", createdAt: new Date().toISOString() });
  }

  error(category: LogCategory, message: string, data?: Record<string, unknown>) {
    return this.write({ category, message, data, level: "error", createdAt: new Date().toISOString() });
  }

  async recentErrors(limit = 20) {
    const categories: LogCategory[] = ["desktop", "backend", "brain-router", "codex", "local-model", "production"];
    const entries: LogEntry[] = [];
    for (const category of categories) {
      try {
        const content = await readFile(path.join(this.rootDir, `${category}.jsonl`), "utf8");
        for (const line of content.trim().split("\n")) {
          if (!line) continue;
          const entry = JSON.parse(line) as LogEntry;
          if (entry.level === "error") entries.push(entry);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    return entries
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(({ createdAt, category, message }) => ({ createdAt, category, message }));
  }

  private async write(entry: LogEntry) {
    await mkdir(this.rootDir, { recursive: true });
    const safe = {
      ...entry,
      message: sanitizeString(entry.message),
      data: entry.data ? redact(entry.data) : undefined,
    };
    await writeFile(
      path.join(this.rootDir, `${entry.category}.jsonl`),
      `${JSON.stringify(safe)}\n`,
      { encoding: "utf8", flag: "a" },
    );
  }
}
