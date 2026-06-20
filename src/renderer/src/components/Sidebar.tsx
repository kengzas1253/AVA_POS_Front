import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDeviceLaptop,
  IconLoader2,
  IconLogout,
  IconPackage,
  IconPlugConnected,
  IconPlugConnectedX,
  IconReceipt,
  IconSettings,
  IconShoppingCart,
  IconUser,
  IconUserCircle,
} from "@tabler/icons-react";
import { logoutAndClearSession } from "./auth";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: (page: string) => void;
  currentPage: string;
}

interface SidebarUserData {
  device_name: string;
  username: string;
  full_name: string;
  role: string;
}

interface StoredUser {
  username?: string;
  full_name?: string;
  role?: string;
}

interface StoredDevice {
  device_name?: string;
  pos_device?: {
    device_name?: string;
  };
}

type ConnectionStatus = "checking" | "connected" | "disconnected";

interface TestConnectResponse {
  status?: string;
  message?: string;
  port?: number;
  timestamp?: string;
}

const CONNECTION_CHECK_INTERVAL_MS = 30_000;

const fallbackUserData: SidebarUserData = {
  device_name: "-",
  username: "-",
  full_name: "ผู้ใช้งาน",
  role: "-",
};

const getDeviceName = (value: unknown): string => {
  if (!value || typeof value !== "object") {
    return "-";
  }

  const device = value as StoredDevice;
  return device.device_name || device.pos_device?.device_name || "-";
};

const buildTestConnectUrl = (apiPath: unknown): string | null => {
  if (typeof apiPath !== "string" || apiPath.trim() === "") {
    return null;
  }

  return `${apiPath.replace(/\/+$/, "")}/test-connect`;
};

const getUserData = (value: unknown): Omit<SidebarUserData, "device_name"> => {
  if (!value || typeof value !== "object") {
    return {
      username: "-",
      full_name: "ผู้ใช้งาน",
      role: "-",
    };
  }

  const user = value as StoredUser;

  return {
    username: user.username || "-",
    full_name: user.full_name || user.username || "ผู้ใช้งาน",
    role: user.role || "-",
  };
};

export default function Sidebar({
  isOpen,
  onToggle,
  onNavigate,
  currentPage,
}: SidebarProps) {
  const [userData, setUserData] = useState<SidebarUserData>(fallbackUserData);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("checking");
  const testConnectUrlRef = useRef<string | null>(null);

  const checkConnection = useCallback(async () => {
    let url = testConnectUrlRef.current;

    if (!url) {
      try {
        const apiPath = await window.electronStore.get("apiPath");
        url = buildTestConnectUrl(apiPath);
        testConnectUrlRef.current = url;
      } catch (error) {
        console.error("Error reading apiPath from electron store:", error);
        setConnectionStatus("disconnected");
        return;
      }
    }

    if (!url) {
      setConnectionStatus("disconnected");
      return;
    }

    try {
      const response = await fetch(url);

      if (!response.ok) {
        setConnectionStatus("disconnected");
        return;
      }

      const data = (await response.json()) as TestConnectResponse;
      setConnectionStatus(data.status === "ok" ? "connected" : "disconnected");
    } catch (error) {
      console.error("Error checking API connection:", error);
      setConnectionStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const runCheck = async () => {
      if (!isMounted) {
        return;
      }
      await checkConnection();
    };

    runCheck();
    const intervalId = window.setInterval(runCheck, CONNECTION_CHECK_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [checkConnection]);

  useEffect(() => {
    let isMounted = true;

    const loadSidebarData = async () => {
      try {
        const [storedUser, storedDevice] = await Promise.all([
          window.electronStore.get("user"),
          window.electronStore.get("pos_device"),
        ]);

        if (!isMounted) {
          return;
        }

        const user = getUserData(storedUser);

        setUserData({
          ...user,
          device_name: getDeviceName(storedDevice),
        });
      } catch (error) {
        console.error("Error loading sidebar data:", error);
      }
    };

    loadSidebarData();

    return () => {
      isMounted = false;
    };
  }, []);

  const menuItems = [
    { id: "userInfo", label: "ข้อมูลผู้ใช้งาน", icon: IconUserCircle },
    { id: "pos", label: "หน้าร้านขาย", icon: IconShoppingCart },
    { id: "receipts", label: "ใบเสร็จรับเงิน", icon: IconReceipt },
    { id: "products", label: "รายการสินค้า", icon: IconPackage },
    { id: "settings", label: "การตั้งค่า", icon: IconSettings },
  ];

  const handleLogout = async () => {
    if (!window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      return;
    }

    try {
      await logoutAndClearSession();
    } catch (error) {
      console.error("Error logging out:", error);
    }

    window.location.reload();
  };

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full flex-col bg-gradient-to-b from-[#1d6fd8] to-[#4d9bf0] transition-all duration-300 ease-in-out ${
          isOpen ? "w-[280px]" : "w-[72px]"
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          className="absolute -right-3 top-6 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-lg hover:bg-slate-50"
        >
          {isOpen ? <IconChevronLeft size={14} /> : <IconChevronRight size={14} />}
        </button>

        <div
          className={`flex h-16 items-center border-b border-white/20 px-4 ${
            isOpen ? "justify-start" : "justify-center"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <IconDeviceLaptop size={22} className="text-white" />
            </div>
            {isOpen ? (
              <span className="text-lg font-bold tracking-tight text-white">
                AVA MY POS
              </span>
            ) : null}
          </div>
        </div>

        <div
          className={`border-b border-white/20 px-4 py-4 ${
            isOpen ? "block" : "flex justify-center"
          }`}
        >
          {isOpen ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                  <IconUser size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {userData.full_name}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <IconUser size={18} className="text-white" />
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-white/25 text-white shadow-lg"
                        : "text-white/80 hover:bg-white/15 hover:text-white"
                    }`}
                  >
                    <Icon size={20} className="shrink-0" />
                    {isOpen ? <span className="truncate">{item.label}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* API Status - moved to bottom */}
        <div
          className={`border-t border-white/20 px-4 py-3 ${
            isOpen ? "block" : "flex justify-center"
          }`}
        >
          {isOpen ? (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/70">
                สถานะ API
              </span>
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  connectionStatus === "connected"
                    ? "bg-emerald-400/20 text-emerald-200"
                    : connectionStatus === "checking"
                      ? "bg-white/15 text-white/80"
                      : "bg-rose-400/20 text-rose-200"
                }`}
              >
                {connectionStatus === "connected" ? (
                  <IconPlugConnected size={14} className="shrink-0" />
                ) : connectionStatus === "checking" ? (
                  <IconLoader2 size={14} className="shrink-0 animate-spin" />
                ) : (
                  <IconPlugConnectedX size={14} className="shrink-0" />
                )}
                {connectionStatus === "connected"
                  ? "เชื่อมต่อสำเร็จ"
                  : connectionStatus === "checking"
                    ? "กำลังเชื่อมต่อ"
                    : "ไม่ได้เชื่อมต่อ"}
              </span>
            </div>
          ) : (
            <span
              title={
                connectionStatus === "connected"
                  ? "เชื่อมต่อสำเร็จ"
                  : connectionStatus === "checking"
                    ? "กำลังเชื่อมต่อ"
                    : "ไม่ได้เชื่อมต่อ"
              }
              className={`flex h-7 w-7 items-center justify-center rounded-full ${
                connectionStatus === "connected"
                  ? "bg-emerald-400/20 text-emerald-200"
                  : connectionStatus === "checking"
                    ? "bg-white/15 text-white/80"
                    : "bg-rose-400/20 text-rose-200"
              }`}
            >
              {connectionStatus === "connected" ? (
                <IconPlugConnected size={14} />
              ) : connectionStatus === "checking" ? (
                <IconLoader2 size={14} className="animate-spin" />
              ) : (
                <IconPlugConnectedX size={14} />
              )}
            </span>
          )}
        </div>

        {/* Logout button */}
        <div className="border-t border-white/20 px-3 py-4">
          <button
            type="button"
            onClick={handleLogout}
            className={`group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-white/80 shadow-none transition-all duration-200 hover:border-red-400/40 hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60 active:scale-[0.98] ${
              isOpen ? "justify-start" : "justify-center"
            }`}
          >
            <IconLogout
              size={20}
              className="shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
            />
            {isOpen ? <span>ออกจากระบบ</span> : null}
          </button>
        </div>
      </aside>
    </>
  );
}
