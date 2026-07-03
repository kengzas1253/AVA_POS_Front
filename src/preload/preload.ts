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

contextBridge.exposeInMainWorld("electronPrinter", {
  getPrinters: () => ipcRenderer.invoke("electron-printer-get-printers"),
  printHtml: (payload: { html: string; printerName?: string }) =>
    ipcRenderer.invoke("electron-printer-print-html", payload),
  exportPdf: (payload: { html: string; defaultPath?: string }) =>
    ipcRenderer.invoke("electron-printer-export-pdf", payload),
});
