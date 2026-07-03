import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconLoader2,
  IconLogout,
  IconPlugConnected,
  IconPlugConnectedX,
} from "@tabler/icons-react";
import { logoutAndClearSession } from "./auth";

interface LogoutbarProps {
  isOpen: boolean;
}

type ConnectionStatus = "checking" | "connected" | "disconnected";

interface TestConnectResponse {
  status?: string;
  message?: string;
  port?: number;
  timestamp?: string;
}

const CONNECTION_CHECK_INTERVAL_MS = 30_000;

const buildTestConnectUrl = (apiPath: unknown): string | null => {
  if (typeof apiPath !== "string" || apiPath.trim() === "") {
    return null;
  }

  return `${apiPath.replace(/\/+$/, "")}/test-connect`;
};

export default function Logoutbar({ isOpen }: LogoutbarProps) {
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

  const statusText =
    connectionStatus === "connected"
      ? "เชื่อมต่อสำเร็จ"
      : connectionStatus === "checking"
        ? "กำลังเชื่อมต่อ"
        : "ไม่ได้เชื่อมต่อ";

  const statusClass =
    connectionStatus === "connected"
      ? "bg-emerald-400/20 text-emerald-200"
      : connectionStatus === "checking"
        ? "bg-white/15 text-white/80"
        : "bg-rose-400/20 text-rose-200";

  const StatusIcon =
    connectionStatus === "connected"
      ? IconPlugConnected
      : connectionStatus === "checking"
        ? IconLoader2
        : IconPlugConnectedX;

  return (
    <>
      <div
        className={`border-t border-white/20 px-4 py-3 ${
          isOpen ? "block" : "flex justify-center"
        }`}
      >
        {isOpen ? (
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/70">สถานะ API</span>
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}
            >
              <StatusIcon
                size={14}
                className={`shrink-0 ${
                  connectionStatus === "checking" ? "animate-spin" : ""
                }`}
              />
              {statusText}
            </span>
          </div>
        ) : (
          <span
            title={statusText}
            className={`flex h-7 w-7 items-center justify-center rounded-full ${statusClass}`}
          >
            <StatusIcon
              size={14}
              className={connectionStatus === "checking" ? "animate-spin" : ""}
            />
          </span>
        )}
      </div>

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
    </>
  );
}
