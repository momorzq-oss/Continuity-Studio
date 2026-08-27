import { EventEmitter } from "node:events";
import readline from "node:readline";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

interface RpcResponse {
  id: number | string;
  result?: unknown;
  error?: { code?: number; message: string; data?: unknown };
}

export interface RpcNotification {
  method: string;
  params?: Record<string, unknown>;
  id?: number | string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class CodexRpcClient extends EventEmitter {
  private nextId = 1;
  private readonly pending = new Map<number | string, PendingRequest>();
  private readonly reader: readline.Interface;
  private closed = false;

  constructor(readonly process: ChildProcessWithoutNullStreams) {
    super();
    this.reader = readline.createInterface({ input: process.stdout });
    this.reader.on("line", (line) => this.handleLine(line));
    process.once("exit", (code, signal) => {
      this.closed = true;
      this.rejectPending(new Error(`Codex App Server exited (${code ?? signal ?? "unknown"}).`));
      this.emit("exit", { code, signal });
    });
    process.once("error", (error) => {
      this.rejectPending(error);
      this.emit("transportError", error);
    });
  }

  async initialize(version: string) {
    const result = await this.request("initialize", {
      clientInfo: {
        name: "continuity_studio",
        title: "Continuity Studio",
        version,
      },
    });
    this.notify("initialized", {});
    return result;
  }

  request<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 30_000) {
    if (this.closed) return Promise.reject(new Error("Codex App Server is not connected."));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex request timed out: ${method}.`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      this.send({ method, id, params });
    });
  }

  notify(method: string, params: Record<string, unknown> = {}) {
    this.send({ method, params });
  }

  respond(id: number | string, result: unknown) {
    this.send({ id, result });
  }

  respondError(id: number | string, code: number, message: string) {
    this.send({ id, error: { code, message } });
  }

  close() {
    this.closed = true;
    this.reader.close();
    this.rejectPending(new Error("Codex App Server connection closed."));
  }

  private send(message: unknown) {
    if (this.closed || this.process.stdin.destroyed) throw new Error("Codex App Server is not connected.");
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string) {
    let message: RpcResponse | RpcNotification;
    try {
      message = JSON.parse(line) as RpcResponse | RpcNotification;
    } catch {
      this.emit("protocolError", new Error("Codex App Server returned invalid JSON."));
      return;
    }

    if ("id" in message && message.id !== undefined && !("method" in message)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
      return;
    }

    if ("method" in message) {
      if (message.id !== undefined) this.emit("serverRequest", message);
      else this.emit("notification", message);
    }
  }

  private rejectPending(error: Error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
