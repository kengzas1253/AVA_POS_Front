// LoginPage.tsx
import { FormEvent, useState, useEffect, useCallback } from "react";
import { LoginPin } from "./LoginPin";
import { ApiPathSetting } from "./ApiPathSetting";
import logoUrl from "../assets/logo.png";
import { saveAuthTokens } from "./auth";

const API_PATH_KEY = "apiPath";
const POLL_INTERVAL = 10_000; // poll every 10 seconds

interface ApiStatus {
  connected: boolean;
  checking: boolean;
  message?: string;
  port?: number;
  timestamp?: string;
}

interface PosDevice {
  id: number;
  device_name: string;
  machine_id: string;
  hostname: string;
  ip_address: string;
  os_platform: string;
  os_release: string;
  app_version: string;
  printer_name: string;
  printer_type: string;
  created_at: string;
  updated_at: string;
}

// User data from login response
interface UserData {
  user_id: string;
  username: string;
  full_name: string;
  phone_number: string;
  role: string;
  is_active: boolean;
  last_login_at: string;
  created_at: string;
  updated_at: string;
}

interface LoginResponse {
  status: string;
  message: string;
  token: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
  data: UserData;
}

interface LoginPageProps {
  onLoginSuccess: () => void;
}

function BarcodeScannerIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="6" width="14" height="9" rx="2" fill="white" opacity="0.95" />
      <rect x="16" y="9" width="6" height="3" rx="1" fill="white" opacity="0.85" />
      <rect x="4" y="15" width="5" height="7" rx="1.5" fill="white" opacity="0.85" />
      <path d="M9 15 Q11 17 9 19" stroke="white" strokeWidth="1.2" fill="none" opacity="0.7" />
      <rect x="4" y="8" width="1" height="5" rx="0.3" fill="#0f172a" opacity="0.6" />
      <rect x="6.5" y="8" width="1.5" height="5" rx="0.3" fill="#0f172a" opacity="0.6" />
      <rect x="9.5" y="8" width="1" height="5" rx="0.3" fill="#0f172a" opacity="0.6" />
      <rect x="11.5" y="8" width="1.5" height="5" rx="0.3" fill="#0f172a" opacity="0.6" />
      <line x1="22" y1="10.5" x2="26" y2="10.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

// ── API Status Indicator ────────────────────────────────────────────────────
function ApiStatusBadge({ status }: { status: ApiStatus }) {
  if (status.checking) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-400">
        <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        กำลังเชื่อมต่อ…
      </span>
    );
  }
  if (status.connected) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        เชื่อมต่อสำเร็จ
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-400">
      <span className="h-2 w-2 rounded-full bg-red-500" />
      ไม่สามารถเชื่อมต่อได้
    </span>
  );
}

// ── POS Device List ─────────────────────────────────────────────────────────
function PosDeviceList({ devices, loading }: { devices: PosDevice[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="mt-3 space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-white/[0.04]" />
        ))}
      </div>
    );
  }
  if (!devices.length) {
    return (
      <p className="mt-3 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5 text-[11px] text-slate-500">
        ยังไม่มีเครื่อง POS ที่ลงทะเบียน
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
      {devices.map((d) => (
        <div
          key={d.id}
          className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.04] px-3 py-2"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-teal-500/15 text-[10px] font-bold text-teal-400">
            {d.id}
          </span>
          <div className="flex-1 min-w-0">
            <p className="truncate text-[12px] font-medium text-white">{d.device_name}</p>
            <p className="text-[10px] text-slate-500">
              {d.hostname} · {d.ip_address}
              {d.printer_name ? ` · ${d.printer_name}` : ""}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 uppercase tracking-wide">
            Online
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
const hasMachineId = (value: unknown): boolean => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const device = value as { machine_id?: unknown; pos_device?: { machine_id?: unknown } };
  return Boolean(device.machine_id || device.pos_device?.machine_id);
};

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [loginMode, setLoginMode] = useState<"password" | "pin" | "apiSetting">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiPath, setHasApiPath] = useState(false);
  const [hasPosDevice, setHasPosDevice] = useState(false);

  const [apiStatus, setApiStatus] = useState<ApiStatus>({ connected: false, checking: true });
  const [posDevices, setPosDevices] = useState<PosDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  // ── Check if API Path and POS Device exist ───────────────────────────────
  const checkSettings = useCallback(async () => {
    try {
      const apiPath = await window.electronStore.get(API_PATH_KEY);
      const posDevice = await window.electronStore.get("pos_device");
      
      setHasApiPath(!!apiPath && typeof apiPath === "string" && apiPath.trim().length > 0);
      setHasPosDevice(hasMachineId(posDevice));
    } catch {
      setHasApiPath(false);
      setHasPosDevice(false);
    }
  }, []);

  // ── Poll API status ────────────────────────────────────────────────────────
  const checkApi = useCallback(async () => {
    try {
      const stored = await window.electronStore.get(API_PATH_KEY);
      if (!stored || typeof stored !== "string") {
        setApiStatus({ connected: false, checking: false, message: "ยังไม่ได้ตั้งค่า API path" });
        return;
      }
      const base = stored.replace(/\/+$/, "");
      const res = await fetch(`${base}/test-connect`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setApiStatus({
        connected: true,
        checking: false,
        message: data.message,
        port: data.port,
        timestamp: data.timestamp,
      });
    } catch {
      setApiStatus({ connected: false, checking: false });
    }
  }, []);

  // ── Fetch POS devices ──────────────────────────────────────────────────────
  const fetchDevices = useCallback(async () => {
    try {
      const stored = await window.electronStore.get(API_PATH_KEY);
      if (!stored || typeof stored !== "string") return;
      const base = stored.replace(/\/+$/, "");
      setDevicesLoading(true);
      const res = await fetch(`${base}/pos-devices`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return;
      const data: PosDevice[] = await res.json();
      setPosDevices(data);
    } catch {
      // silently fail — status badge already shows error
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  // initial + periodic polling
  useEffect(() => {
    checkSettings();
    checkApi();
    fetchDevices();
    const id = setInterval(() => {
      checkSettings();
      checkApi();
      fetchDevices();
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [checkApi, fetchDevices, checkSettings]);

  // ── Handle Login ──────────────────────────────────────────────────────────
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // Check if API Path and POS Device exist
    if (!hasApiPath) {
      setMessage("กรุณาตั้งค่า API path ก่อนเข้าสู่ระบบ");
      return;
    }
    if (!hasPosDevice) {
      setMessage("กรุณาตั้งค่าเครื่อง POS ก่อนเข้าสู่ระบบ");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      // Get API path from store
      const apiPath = await window.electronStore.get(API_PATH_KEY);
      if (!apiPath || typeof apiPath !== "string") {
        setMessage("ไม่พบ API path กรุณาตั้งค่าใหม่");
        setIsLoading(false);
        return;
      }

      const base = apiPath.replace(/\/+$/, "");
      
      // Send login request
      const response = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: email,
          password: password,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data: LoginResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
      }

      if (data.status === "ok") {
        // Save user data to electron store
        await window.electronStore.set("user", {
          user_id: data.data.user_id,
          username: data.data.username,
          full_name: data.data.full_name,
          role: data.data.role,
        });

        await saveAuthTokens(data);

        setMessage(`ยินดีต้อนรับ, ${data.data.full_name}`);
        onLoginSuccess();
      } else {
        setMessage(data.message || "เข้าสู่ระบบไม่สำเร็จ");
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "TimeoutError" || error.message.includes("timeout")) {
          setMessage("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
        } else {
          setMessage(error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        }
      } else {
        setMessage("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loginMode === "pin") return <LoginPin onBack={() => setLoginMode("password")} onLoginSuccess={onLoginSuccess} />;
  if (loginMode === "apiSetting") return <ApiPathSetting onBack={() => setLoginMode("password")} />;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 py-10">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl md:grid-cols-[1fr_400px]">

        {/* ── Left brand panel ── */}
        <div className="hidden flex-col justify-between bg-[#0f172a] p-10 md:flex">

          {/* Logo + brand */}
          <div className="flex items-center gap-2.5">
            <img
              src={logoUrl}
              alt="AVA POS logo"
              className="h-12 w-12 rounded-full border-2 border-pink-300 bg-white object-cover shadow-lg shadow-pink-500/20"
            />
            <span className="text-[37px] font-medium tracking-wide text-white">
              AVA <span className="text-teal-400">MY POS</span>
            </span>
          </div>

          {/* Headline */}
          <div>
            <h1 className="mb-3 text-[30px] font-medium leading-snug text-white">
              Point of Sale<br />made simple.
            </h1>
            <p className="text-[13px] leading-7 text-slate-400">
              จัดการร้านค้า ออกบิล ติดตามยอดขาย<br />
              ทุกอย่างในที่เดียว ใช้งานง่ายทุกสาขา
            </p>
          </div>

          {/* ── API Status section ── */}
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
            {/* Header row */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  สถานะ API
                </span>
              </div>
              <ApiStatusBadge status={apiStatus} />
            </div>

            {/* Status detail */}
            {apiStatus.connected && apiStatus.timestamp && (
              <p className="mb-0 text-[10px] font-mono text-slate-600">
                อัปเดตล่าสุด: {new Date(apiStatus.timestamp).toLocaleTimeString("th-TH")}
              </p>
            )}
            {!apiStatus.connected && !apiStatus.checking && (
              <p className="mb-0 text-[11px] text-red-400/70">
                {apiStatus.message ?? "ไม่สามารถเข้าถึง API server ได้ กรุณาตรวจสอบการตั้งค่า"}
              </p>
            )}

            {/* POS Devices — only when connected */}
            {apiStatus.connected && (
              <>
                <div className="my-3 border-t border-white/8" />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    เครื่อง POS
                  </span>
                  {posDevices.length > 0 && (
                    <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold text-teal-400">
                      {posDevices.length} เครื่อง
                    </span>
                  )}
                </div>
                <PosDeviceList devices={posDevices} loading={devicesLoading} />
              </>
            )}
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="relative flex flex-col justify-center bg-white p-8 dark:bg-slate-900 sm:p-10">

          {/* API Setting gear button */}
          <button
            type="button"
            onClick={() => setLoginMode("apiSetting")}
            aria-label="ตั้งค่า API"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {/* ── Mobile-only status strip ── */}
          <div className="mb-5 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:hidden dark:border-slate-700 dark:bg-slate-800">
            <span className="text-[11px] text-slate-500">สถานะ API</span>
            <ApiStatusBadge status={apiStatus} />
          </div>

          {/* Header */}
          <div className="mb-8 text-center">
            <img
              src={logoUrl}
              alt="AVA POS logo"
              className="mx-auto mb-5 h-28 w-28 rounded-full border-4 border-pink-100 bg-white object-cover shadow-xl shadow-pink-500/20"
            />
            <p className="mb-2 text-[20px] font-medium uppercase tracking-widest text-teal-500">
              AVA Point of Sale
            </p>
            <h2 className="mb-1.5 text-[22px] font-medium text-slate-900 dark:text-white">
              เข้าสู่ระบบ
            </h2>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">
              กรอกข้อมูลผู้ใช้งานเพื่อเริ่มต้นกะงาน
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <label className="mb-4 block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-600 dark:text-slate-300">
                อีเมล / รหัสพนักงาน
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="employee@ava.co.th"
                  required
                  disabled={isLoading}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                />
              </div>
            </label>

            {/* Password */}
            <label className="mb-5 block">
              <span className="mb-1.5 block text-[13px] font-medium text-slate-600 dark:text-slate-300">
                รหัสผ่าน
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  disabled={isLoading}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 disabled:opacity-50 dark:hover:text-slate-300"
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            {/* Remember me + Forgot */}
            <div className="mb-6 flex items-center justify-between gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  className="size-4 rounded border-slate-300 accent-teal-400 disabled:opacity-50 dark:border-slate-600"
                />
                จำฉันไว้
              </label>
              <button type="button" className="text-[13px] font-medium text-teal-500 hover:text-teal-400">
                ลืมรหัสผ่าน?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !hasApiPath || !hasPosDevice}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-500 text-sm font-medium text-white transition hover:bg-teal-400 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  เข้าสู่ระบบ
                </>
              )}
            </button>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <hr className="flex-1 border-slate-200 dark:border-slate-700" />
              <span className="text-xs text-slate-400">หรือ</span>
              <hr className="flex-1 border-slate-200 dark:border-slate-700" />
            </div>

            {/* PIN login */}
            <button
              type="button"
              onClick={() => setLoginMode("pin")}
              disabled={isLoading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="3" width="20" height="18" rx="2" />
                <line x1="8" y1="8" x2="8" y2="8" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="8" strokeWidth="2" />
                <line x1="16" y1="8" x2="16" y2="8" strokeWidth="2" />
                <line x1="8" y1="12" x2="8" y2="12" strokeWidth="2" />
                <line x1="12" y1="12" x2="12" y2="12" strokeWidth="2" />
                <line x1="16" y1="12" x2="16" y2="12" strokeWidth="2" />
                <line x1="8" y1="16" x2="8" y2="16" strokeWidth="2" />
                <line x1="12" y1="16" x2="16" y2="16" strokeWidth="2" />
              </svg>
              เข้าสู่ระบบด้วย PIN
            </button>

            {/* Settings status message */}
            {(!hasApiPath || !hasPosDevice) && !message && (
              <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-[12px] text-amber-600 dark:text-amber-400">
                {!hasApiPath && !hasPosDevice && "⚠️ กรุณาตั้งค่า API path และเครื่อง POS ก่อนเข้าสู่ระบบ"}
                {!hasApiPath && hasPosDevice && "⚠️ กรุณาตั้งค่า API path ก่อนเข้าสู่ระบบ"}
                {hasApiPath && !hasPosDevice && "⚠️ กรุณาตั้งค่าเครื่อง POS ก่อนเข้าสู่ระบบ"}
                <br />
                <span className="text-[11px] opacity-70">คลิกไอคอนเฟืองที่มุมขวาบนเพื่อตั้งค่า</span>
              </p>
            )}

            {/* Message */}
            {message && (
              <p className={`mt-4 rounded-lg border px-4 py-3 text-[13px] font-medium ${
                message.includes("ยินดีต้อนรับ") 
                  ? "border-teal-400/30 bg-teal-400/10 text-teal-600 dark:text-teal-300"
                  : "border-red-400/30 bg-red-400/10 text-red-600 dark:text-red-300"
              }`}>
                {message}
              </p>
            )}
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            ต้องการความช่วยเหลือ?{" "}
            <span className="text-teal-500">ติดต่อผู้ดูแลระบบ</span>
          </p>
        </div>
      </section>
    </main>
  );
}
