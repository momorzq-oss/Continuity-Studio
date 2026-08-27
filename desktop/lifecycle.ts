export interface BackendHandle {
  port: number;
  close(): Promise<void>;
}

export interface BackendStartupResult<T extends BackendHandle> {
  backend: T;
  portCollision: boolean;
}

export const withStartupTimeout = async <T>(
  work: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> => {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

export const startBackendWithCollisionFallback = async <T extends BackendHandle>(
  start: (port: number) => Promise<T>,
  preferredPort = 8787,
): Promise<BackendStartupResult<T>> => {
  try {
    return { backend: await start(preferredPort), portCollision: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    return { backend: await start(0), portCollision: true };
  }
};

export const boundedWindowState = (
  state: { x?: number; y?: number; width?: number; height?: number; maximized?: boolean } | undefined,
  workArea: { x: number; y: number; width: number; height: number },
) => {
  const width = Math.min(Math.max(state?.width ?? 1440, 1100), workArea.width);
  const height = Math.min(Math.max(state?.height ?? 900, 700), workArea.height);
  const x = state?.x !== undefined && state.x >= workArea.x && state.x < workArea.x + workArea.width
    ? state.x
    : Math.round(workArea.x + (workArea.width - width) / 2);
  const y = state?.y !== undefined && state.y >= workArea.y && state.y < workArea.y + workArea.height
    ? state.y
    : Math.round(workArea.y + (workArea.height - height) / 2);
  return { x, y, width, height, maximized: Boolean(state?.maximized) };
};
