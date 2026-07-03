import { app, BrowserWindow, dialog, ipcMain } from "electron";
import os from "node:os";
import path from "node:path";

const getLocalIpAddress = (): string => {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const networkInterface = interfaces[name];

    if (!networkInterface) {
      continue;
    }

    for (const iface of networkInterface) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }

  return "";
};

const createWindow = (): void => {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  const iconPath = path.join(__dirname, "../../assets/icon.ico");

  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 520,
    backgroundColor: "#f7f7f2",
    icon: iconPath,
    title: "AVA MY POS",
    show: false,  // ✅ ซ่อนไว้ก่อนตอนสร้าง
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // ✅ ขยายหน้าต่างให้เต็มจอทันที
  mainWindow.maximize();
  
  // ✅ เมื่อเนื้อหาพร้อมแล้วค่อยแสดง (ทำให้เนียนไม่มีกระพริบ)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
};

const createPrintWindow = async (html: string): Promise<BrowserWindow> => {
  const printWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return printWindow;
};

app.whenReady().then(async () => {
  const [{ default: Store }, { default: contextMenu }] = await Promise.all([
    import("electron-store"),
    import("electron-context-menu"),
  ]);
  const store = new Store();

  contextMenu({
    showLookUpSelection: false,
    showSearchWithGoogle: false,
    showSelectAll: true,
    showInspectElement: false,
  });

  ipcMain.handle("app:get-version", () => app.getVersion());

  ipcMain.handle("electron-store-get", (_event, key: string) => {
    return store.get(key);
  });

  ipcMain.handle("electron-store-set", (_event, key: string, value: unknown) => {
    store.set(key, value);
    return true;
  });

  ipcMain.handle("electron-device-get-info", () => ({
    hostname: os.hostname(),
    ip_address: getLocalIpAddress(),
    os_platform: os.platform(),
    os_release: os.release(),
  }));

  ipcMain.handle("electron-printer-get-printers", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return [];
    }

    return window.webContents.getPrintersAsync();
  });

  ipcMain.handle(
    "electron-printer-print-html",
    async (_event, payload: { html: string; printerName?: string }) => {
      const printWindow = await createPrintWindow(payload.html);

      try {
        await new Promise<void>((resolve, reject) => {
          printWindow.webContents.print(
            {
              silent: Boolean(payload.printerName),
              deviceName: payload.printerName || undefined,
              printBackground: true,
            },
            (success, failureReason) => {
              if (success) {
                resolve();
                return;
              }

              reject(new Error(failureReason || "Print failed"));
            },
          );
        });

        return true;
      } finally {
        printWindow.close();
      }
    },
  );

  ipcMain.handle(
    "electron-printer-export-pdf",
    async (_event, payload: { html: string; defaultPath?: string }) => {
      const printWindow = await createPrintWindow(payload.html);

      try {
        const result = await dialog.showSaveDialog({
          title: "Export barcode PDF",
          defaultPath: payload.defaultPath || "barcodes.pdf",
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });

        if (result.canceled || !result.filePath) {
          return null;
        }

        const pdf = await printWindow.webContents.printToPDF({
          printBackground: true,
          preferCSSPageSize: true,
        });

        const { writeFile } = await import("node:fs/promises");
        await writeFile(result.filePath, pdf);

        return result.filePath;
      } finally {
        printWindow.close();
      }
    },
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
