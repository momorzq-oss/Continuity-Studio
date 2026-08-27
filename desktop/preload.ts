import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("continuityDesktop", {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
});
