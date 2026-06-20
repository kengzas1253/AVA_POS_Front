import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("app:get-version"),
});

contextBridge.exposeInMainWorld("electronStore", {
  get: (key: string): Promise<any> => ipcRenderer.invoke("electron-store-get", key),
  set: (key: string, value: any): Promise<boolean> =>
    ipcRenderer.invoke("electron-store-set", key, value),
});

contextBridge.exposeInMainWorld("electronDevice", {
  getInfo: () => ipcRenderer.invoke("electron-device-get-info"),
});
