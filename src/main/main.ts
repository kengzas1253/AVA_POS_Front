import { app, BrowserWindow, ipcMain } from "electron";
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

app.whenReady().then(async () => {
  const { default: Store } = await import("electron-store");
  const store = new Store();

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
