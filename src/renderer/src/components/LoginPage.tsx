// LoginPage.tsx
import { FormEvent, ReactNode, useState, useEffect, useCallback } from "react";
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

// ── API Status Indicator (compact icon-only) ────────────────────────────────
function ApiStatusBadge({ status }: { status: ApiStatus }) {
  if (status.checking) {
    return (
      <span
        title="กำลังเชื่อมต่อ…"
        className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-400"
      >
        <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </span>
    );
  }
  if (status.connected) {
    return (
      <span
        title="เชื่อมต่อสำเร็จ"
        className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      </span>
    );
  }
  return (
    <span
      title="ไม่สามารถเชื่อมต่อได้"
      className="flex h-6 w-6 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10"
    >
      <span className="h-2 w-2 rounded-full bg-red-500" />
    </span>
  );
}

// ── Feature icon item ────────────────────────────────────────────────────────
function FeatureItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.04] px-3 py-2.5 [@media(max-height:820px)]:py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-500/15 text-teal-400 [@media(max-height:820px)]:h-7 [@media(max-height:820px)]:w-7">
        {icon}
      </span>
      <span className="text-[12px] font-medium text-slate-200">{label}</span>
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

  // initial + periodic polling
  useEffect(() => {
    checkSettings();
    checkApi();
    const id = setInterval(() => {
      checkSettings();
      checkApi();
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [checkApi, checkSettings]);

  // ── Keyboard shortcut: F4 to open PIN login ─────────────────────────────
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // F4 key
      if (event.key === "F4") {
        event.preventDefault(); // Prevent default browser behavior
        // Only allow switching if not already in PIN mode and not disabled
        if (loginMode !== "pin" && !isLoading) {
          setLoginMode("pin");
        }
      }

      if (event.key === "Escape") {
        event.preventDefault();

        const shouldQuit = window.confirm("คุณต้องการปิดโปรแกรมหรือไม่?");
        if (shouldQuit) {
          void window.electronAPI.quitApp();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loginMode, isLoading]);

  // ── Handle Login ──────────────────────────────────────────────────────────
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // ✨ NEW: Check if API is connected first
    if (!apiStatus.connected) {
      setMessage("⚠️ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการตั้งค่า API");
      return;
    }

    // Check if API Path and POS Device exist
    if (!hasApiPath) {
      setMessage("⚠️ กรุณาตั้งค่า API path ก่อนเข้าสู่ระบบ");
      return;
    }
    if (!hasPosDevice) {
      setMessage("⚠️ กรุณาตั้งค่าเครื่อง POS ก่อนเข้าสู่ระบบ");
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

  // ✨ NEW: Check if login should be disabled
  const isLoginDisabled = isLoading || !hasApiPath || !hasPosDevice || !apiStatus.connected || apiStatus.checking;

  if (loginMode === "pin") return <LoginPin onBack={() => setLoginMode("password")} onLoginSuccess={onLoginSuccess} />;
  if (loginMode === "apiSetting") return <ApiPathSetting onBack={() => setLoginMode("password")} />;

  return (
    <main className="grid h-[100dvh] min-h-[100svh] place-items-center overflow-y-auto bg-slate-950 px-6 py-6 [@media(max-height:820px)]:py-2">
      <section className="grid max-h-[calc(100dvh-3rem)] w-full max-w-5xl overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl md:grid-cols-[minmax(0,1fr)_400px] [@media(max-height:820px)]:max-h-[calc(100dvh-1rem)]">

        {/* ── Left brand panel ── */}
        <div className="hidden min-h-0 flex-col justify-between overflow-y-auto bg-[#0f172a] p-10 md:flex [@media(max-height:820px)]:gap-5 [@media(max-height:820px)]:p-6">

          {/* Logo + brand */}
          <div className="flex items-center gap-2.5">
            <img
              src={logoUrl}
              alt="AVA POS logo"
              className="h-12 w-12 rounded-full border-2 border-pink-300 bg-white object-cover shadow-lg shadow-pink-500/20 [@media(max-height:820px)]:h-9 [@media(max-height:820px)]:w-9"
            />
            <span className="text-[37px] font-medium tracking-wide text-white [@media(max-height:820px)]:text-[30px]">
              AVA <span className="text-teal-400">MY POS</span>
            </span>
          </div>

          {/* Headline */}
          <div>
            <h1 className="mb-3 text-[30px] font-medium leading-snug text-white [@media(max-height:820px)]:mb-2 [@media(max-height:820px)]:text-[25px]">
              Point of Sale<br />made simple.
            </h1>
            <p className="text-[13px] leading-7 text-slate-400 [@media(max-height:820px)]:leading-6">
              จัดการร้านค้า ออกบิล ติดตามยอดขาย<br />
              ทุกอย่างในที่เดียว ใช้งานง่ายทุกสาขา
            </p>
          </div>

          {/* ── Status + Features section ── */}
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 [@media(max-height:820px)]:p-3">
            {/* Header row — connection status shown as a small icon only */}
            <div className="mb-3 flex items-center justify-between gap-3 [@media(max-height:820px)]:mb-2">
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

            {/* Status detail (only shown when there's something noteworthy to say) */}
            {!apiStatus.connected && !apiStatus.checking && (
              <p className="mb-3 text-[11px] text-red-400/70">
                {apiStatus.message ?? "ไม่สามารถเข้าถึง API server ได้ กรุณาตรวจสอบการตั้งค่า"}
              </p>
            )}

            <div className="my-3 border-t border-white/8 [@media(max-height:820px)]:my-2" />

            {/* Feature highlights */}
            <span className="mb-3 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 [@media(max-height:820px)]:mb-2">
              คุณสมบัติเด่น
            </span>
            <div className="grid grid-cols-2 gap-2">
              <FeatureItem
                label="ใช้งานง่าย"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                }
              />
              <FeatureItem
                label="สร้างบาร์โค้ดได้"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                    <path d="M3 4v16" />
                    <path d="M7 4v16" />
                    <path d="M10 4v16" strokeWidth="2.4" />
                    <path d="M13 4v16" />
                    <path d="M16 4v16" strokeWidth="2.4" />
                    <path d="M19 4v16" />
                    <path d="M21 4v16" strokeWidth="2.4" />
                  </svg>
                }
              />
              <FeatureItem
                label="รองรับหลายเครื่อง"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="4" width="14" height="10" rx="1.5" />
                    <path d="M6 18h6" />
                    <path d="M9 14v4" />
                    <rect x="17" y="8" width="6" height="10" rx="1.2" />
                    <path d="M19 20h2" />
                  </svg>
                }
              />
              <FeatureItem
                label="ปลอดภัย"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 2l8 3.5v5.5c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V5.5L12 2z" />
                    <path d="M9.5 12l1.8 1.8L15 10" />
                  </svg>
                }
              />
            </div>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="relative flex min-h-0 flex-col justify-center overflow-y-auto bg-white p-8 dark:bg-slate-900 sm:p-10 [@media(max-height:820px)]:justify-start [@media(max-height:820px)]:p-6">

          {/* Keyboard shortcut hint - F4
          <div className="absolute left-4 top-4 hidden rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500 md:block">
            F4 → PIN
          </div> */}

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
          <div className="mb-8 text-center [@media(max-height:820px)]:mb-4">
            <img
              src={logoUrl}
              alt="AVA POS logo"
              className="mx-auto mb-5 h-28 w-28 rounded-full border-4 border-pink-100 bg-white object-cover shadow-xl shadow-pink-500/20 [@media(max-height:820px)]:mb-3 [@media(max-height:820px)]:h-16 [@media(max-height:820px)]:w-16"
            />
            <p className="mb-2 text-[20px] font-medium uppercase tracking-widest text-teal-500 [@media(max-height:820px)]:mb-1 [@media(max-height:820px)]:text-[17px]">
              AVA Point of Sale
            </p>
            <h2 className="mb-1.5 text-[22px] font-medium text-slate-900 dark:text-white [@media(max-height:820px)]:text-[19px]">
              เข้าสู่ระบบ
            </h2>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">
              กรอกข้อมูลผู้ใช้งานเพื่อเริ่มต้นกะงาน
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <label className="mb-4 block [@media(max-height:820px)]:mb-3">
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
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 [@media(max-height:820px)]:h-10"
                />
              </div>
            </label>

            {/* Password */}
            <label className="mb-5 block [@media(max-height:820px)]:mb-3">
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
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 [@media(max-height:820px)]:h-10"
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
            <div className="mb-6 flex items-center justify-between gap-4 [@media(max-height:820px)]:mb-4">
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
              disabled={isLoginDisabled}
              className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 [@media(max-height:820px)]:h-10 ${
                isLoginDisabled ? "bg-slate-400" : "bg-teal-500 hover:bg-teal-400"
              }`}
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
            <div className="my-5 flex items-center gap-3 [@media(max-height:820px)]:my-3">
              <hr className="flex-1 border-slate-200 dark:border-slate-700" />
              <span className="text-xs text-slate-400">หรือ</span>
              <hr className="flex-1 border-slate-200 dark:border-slate-700" />
            </div>

            {/* PIN login */}
            <button
              type="button"
              onClick={() => setLoginMode("pin")}
              disabled={isLoginDisabled}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 [@media(max-height:820px)]:h-10"
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

            {/* ✨ NEW: API connection error message - more visible */}
            {!apiStatus.connected && !apiStatus.checking && (
              <div className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-[12px] text-red-600 dark:text-red-400">
                <span className="font-semibold">❌ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้</span>
                <br />
                <span className="text-[11px] opacity-70">
                  {apiStatus.message ?? "กรุณาตรวจสอบการตั้งค่า API path และให้แน่ใจว่าเซิร์ฟเวอร์กำลังทำงานอยู่"}
                </span>
              </div>
            )}

            {/* Settings status message */}
            {(!hasApiPath || !hasPosDevice) && !message && apiStatus.connected && (
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

          <p className="mt-6 text-center text-xs text-slate-400 [@media(max-height:820px)]:mt-4">
            ต้องการความช่วยเหลือ?{" "}
            <span className="text-teal-500">ติดต่อผู้ดูแลระบบ</span>
          </p>
        </div>
      </section>
    </main>
  );
}
