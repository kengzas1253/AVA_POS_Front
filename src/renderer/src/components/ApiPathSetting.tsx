// ApiPathSetting.tsx
import { FormEvent, useEffect, useState } from "react";
import { RegisterPosDevice } from "./RegisterPosDevice";
import logoUrl from "../assets/logo.png";

const API_PATH_KEY = "apiPath";

const normalizeApiPath = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
};

interface ApiPathSettingProps {
  onBack: () => void;
  onExit?: () => void;
}

type MenuItem = "api-setting" | "register-pos";

export function ApiPathSetting({ onBack, onExit }: ApiPathSettingProps) {
  const [apiPath, setApiPath] = useState("");
  const [savedPath, setSavedPath] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    data?: { status: string; message: string; port: number; timestamp: string };
    error?: string;
  } | null>(null);
  const [activeMenu, setActiveMenu] = useState<MenuItem>("api-setting");
  
  // ✅ สถานะการเชื่อมต่อ API
  const [apiStatus, setApiStatus] = useState<{
    isConnected: boolean;
    checking: boolean;
    message?: string;
  }>({ isConnected: false, checking: true });

  useEffect(() => {
    const loadApiPath = async () => {
      try {
        const stored = await window.electronStore.get(API_PATH_KEY);
        if (stored) {
          setApiPath(stored);
          setSavedPath(stored);
        }
      } catch {
        setMessage("ไม่สามารถโหลดการตั้งค่าได้");
      } finally {
        setIsLoading(false);
      }
    };
    loadApiPath();
  }, []);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBack();
    };
    window.addEventListener("keydown", handleEscKey);
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [onBack]);

  // ✅ ฟังก์ชันตรวจสอบสถานะ API
  const checkApiStatus = async () => {
    try {
      const stored = await window.electronStore.get(API_PATH_KEY);
      if (!stored) {
        setApiStatus({ isConnected: false, checking: false, message: "ไม่มีการตั้งค่า API" });
        return;
      }

      setApiStatus(prev => ({ ...prev, checking: true }));
      
      const base = stored.replace(/\/$/, "");
      const res = await fetch(`${base}/test-connect`, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) {
        setApiStatus({ 
          isConnected: false, 
          checking: false, 
          message: `HTTP ${res.status}` 
        });
        return;
      }

      const data = await res.json();
      
      // ✅ ตรวจสอบว่า API ตอบกลับตามรูปแบบที่คาดหวัง
      if (data.status === "ok" && data.message === "AVA API connected successfully") {
        setApiStatus({ 
          isConnected: true, 
          checking: false,
          message: `Port: ${data.port}`
        });
      } else {
        setApiStatus({ 
          isConnected: false, 
          checking: false,
          message: "API ตอบกลับไม่ถูกต้อง"
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ไม่สามารถเชื่อมต่อได้";
      setApiStatus({ 
        isConnected: false, 
        checking: false,
        message: msg
      });
    }
  };

  // ✅ ตรวจสอบสถานะ API เมื่อ savedPath เปลี่ยนแปลง
  useEffect(() => {
    if (savedPath) {
      checkApiStatus();
      
      // ตรวจสอบทุก 30 วินาที
      const interval = setInterval(checkApiStatus, 30000);
      return () => clearInterval(interval);
    } else {
      setApiStatus({ isConnected: false, checking: false, message: "ไม่มีการตั้งค่า API" });
    }
  }, [savedPath]);

  const handleTestApi = async () => {
    setTestResult(null);
    setIsTesting(true);
    try {
      const stored = await window.electronStore.get(API_PATH_KEY);
      if (!stored) {
        setTestResult({ success: false, error: "ยังไม่ได้บันทึกที่อยู่ API กรุณาบันทึกก่อนทดสอบ" });
        return;
      }
      const base = stored.replace(/\/$/, "");
      const res = await fetch(`${base}/test-connect`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        setTestResult({ success: false, error: `เซิร์ฟเวอร์ตอบกลับ HTTP ${res.status}` });
        return;
      }
      const data = await res.json();
      setTestResult({ success: true, data });
      
      // ✅ อัปเดตสถานะ API หลังจากทดสอบสำเร็จ
      await checkApiStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ไม่สามารถเชื่อมต่อได้";
      setTestResult({ success: false, error: msg });
      
      // ✅ อัปเดตสถานะ API หลังจากทดสอบไม่สำเร็จ
      setApiStatus({ isConnected: false, checking: false, message: msg });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setTestResult(null);

    if (!window.electronStore) {
      setMessage("ไม่พบระบบบันทึกข้อมูล กรุณาปิดแล้วเปิดแอปใหม่อีกครั้ง");
      return;
    }

    const trimmed = normalizeApiPath(apiPath);
    if (!trimmed) {
      setMessage("กรุณากรอกที่อยู่ API");
      return;
    }

    try {
      new URL(trimmed);
    } catch {
      setMessage("รูปแบบ URL ไม่ถูกต้อง เช่น http://localhost:3000");
      return;
    }

    try {
      const saved = await window.electronStore.set(API_PATH_KEY, trimmed);
      const stored = await window.electronStore.get(API_PATH_KEY);
      if (!saved || stored !== trimmed) {
        setMessage("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
        return;
      }
      setApiPath(trimmed);
      setSavedPath(trimmed);
      setMessage("บันทึกที่อยู่ API เรียบร้อยแล้ว");
      
      // ✅ ตรวจสอบ API หลังจากบันทึก
      setTimeout(checkApiStatus, 500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "ไม่ทราบสาเหตุ";
      setMessage(`ไม่สามารถบันทึกที่อยู่ API ได้: ${errorMessage}`);
    }
  };

  const handleExit = () => {
    if (onExit) {
      onExit();
    } else {
      window.close?.();
    }
  };

  const isInputEmpty = !apiPath.trim();

  const menuItems = [
    { id: "api-setting" as MenuItem, label: "ตั้งค่า API", icon: ApiIcon },
    { id: "register-pos" as MenuItem, label: "ลงทะเบียนเครื่อง POS", icon: PosIcon },
    { id: "back", label: "ย้อนกลับ", icon: BackIcon, action: onBack },
    { id: "exit", label: "ออกจากโปรแกรม", icon: ExitIcon, action: handleExit },
  ];

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="AVA POS Logo" className="h-9 w-auto object-contain" />
          <div className="h-5 w-px bg-slate-700" />
          <span className="text-[32px] font-semibold tracking-widest text-teal-500 uppercase">
            AVA Point of Sale
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            กลับ
            <kbd className="ml-1 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[10px] text-slate-500">ESC</kbd>
          </button>
          <button
            type="button"
            onClick={handleExit}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            ออกจากระบบ
          </button>
        </div>
      </header>

      {/* Two-column layout with side menu */}
      <div className="flex flex-1 min-h-0">
        {/* ─── LEFT SIDEBAR MENU ─── */}
        <aside className="w-64 flex-shrink-0 border-r border-slate-800/60 bg-slate-950/50 flex flex-col">
          <nav className="flex-1 py-6 px-3 space-y-1">
            {menuItems.map((item) => {
              const isActive = item.id === activeMenu && !item.action;
              const Icon = item.icon;
              
              const handleClick = () => {
                if (item.action) {
                  item.action();
                } else if (item.id) {
                  setActiveMenu(item.id);
                }
              };

              return (
                <button
                  key={item.label}
                  onClick={handleClick}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                    ${isActive 
                      ? "bg-gradient-to-r from-teal-500/15 to-pink-500/10 text-teal-300 border-l-2 border-teal-400" 
                      : item.action
                        ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.id === "register-pos" && savedPath && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                  {item.label === "ย้อนกลับ" && (
                    <kbd className="ml-auto text-[10px] text-slate-600">ESC</kbd>
                  )}
                </button>
              );
            })}
          </nav>
          
          {/* ─── ✅ STATUS FOOTER IN SIDEBAR (แก้ไขแล้ว) ─── */}
          <div className="p-4 border-t border-slate-800/60">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[10px]">
                {apiStatus.checking ? (
                  <>
                    <svg className="animate-spin w-2.5 h-2.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    <span className="text-slate-500">กำลังตรวจสอบ API...</span>
                  </>
                ) : (
                  <>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      apiStatus.isConnected ? "bg-emerald-500" : "bg-red-500"
                    }`} />
                    <span className={apiStatus.isConnected ? "text-emerald-400" : "text-red-400"}>
                      {apiStatus.isConnected ? "✅ เชื่อมต่อ API สำเร็จ" : "❌ เชื่อมต่อ API ไม่สำเร็จ"}
                    </span>
                  </>
                )}
              </div>
              
              {/* แสดงรายละเอียดเพิ่มเติม */}
              {!apiStatus.checking && apiStatus.message && (
                <div className={`text-[9px] truncate ${
                  apiStatus.isConnected ? "text-emerald-400/60" : "text-red-400/60"
                }`}>
                  {apiStatus.message}
                </div>
              )}
              
              {/* แสดง path ที่บันทึกไว้ */}
              {savedPath && (
                <div className="text-[9px] text-slate-500 truncate font-mono">
                  {savedPath}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ─── RIGHT CONTENT AREA ─── */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-8 max-w-3xl mx-auto">
            {activeMenu === "api-setting" ? (
              // API Setting Content
              <div>
                <div className="mb-8">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                    <span className="text-[11px] font-semibold tracking-widest text-teal-400 uppercase">การตั้งค่า</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white">ตั้งค่า API</h2>
                  <p className="mt-1.5 text-[13px] text-slate-400 leading-relaxed">
                    กรอกที่อยู่ API ของระบบเพื่อเชื่อมต่อฐานข้อมูล
                  </p>
                </div>

                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                  <div>
                    <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-slate-400">
                      ที่อยู่ API
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-500">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="2" y1="12" x2="22" y2="12" />
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        value={apiPath}
                        onChange={(e) => setApiPath(e.target.value)}
                        placeholder="https://api.example.com"
                        disabled={isLoading}
                        className="h-12 w-full rounded-xl border border-slate-700 bg-slate-900 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:opacity-50"
                      />
                    </div>
                    {savedPath && (
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          apiStatus.isConnected ? "bg-emerald-500" : "bg-red-500"
                        }`} />
                        สถานะ: <span className={apiStatus.isConnected ? "text-emerald-400" : "text-red-400"}>
                          {apiStatus.isConnected ? "เชื่อมต่อแล้ว" : "ไม่สามารถเชื่อมต่อได้"}
                        </span>
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || isInputEmpty}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-500 text-sm font-semibold text-white transition hover:bg-teal-400 active:scale-[0.98] disabled:opacity-40 shadow-lg shadow-teal-500/20"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    บันทึกการตั้งค่า
                  </button>

                  <button
                    type="button"
                    onClick={handleTestApi}
                    disabled={isLoading || isTesting || isInputEmpty || !savedPath}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-teal-500/30 bg-teal-500/8 text-sm font-semibold text-teal-400 transition hover:bg-teal-500/15 active:scale-[0.98] disabled:opacity-30"
                  >
                    {isTesting ? (
                      <>
                        <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        กำลังทดสอบ…
                      </>
                    ) : (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                          <circle cx="12" cy="20" r="1" fill="currentColor" />
                        </svg>
                        ทดสอบการเชื่อมต่อ
                      </>
                    )}
                  </button>

                  {testResult && (
                    <div className={`rounded-xl border px-4 py-3.5 text-[12px] ${
                      testResult.success
                        ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-300"
                        : "border-red-500/25 bg-red-500/8 text-red-300"
                    }`}>
                      {testResult.success && testResult.data ? (
                        <div className="space-y-1">
                          <p className="font-semibold">✅ เชื่อมต่อสำเร็จ</p>
                          <p className="text-[11px] opacity-80">สถานะ: {testResult.data.status}</p>
                          <p className="text-[11px] opacity-80">{testResult.data.message}</p>
                          <p className="text-[10px] opacity-50 font-mono">
                            Port: {testResult.data.port} · {new Date(testResult.data.timestamp).toLocaleTimeString("th-TH")}
                          </p>
                        </div>
                      ) : (
                        <p>❌ {testResult.error} เชื่อมต่อ API ไม่สำเร็จ</p>
                      )}
                    </div>
                  )}

                  {message && (
                    <div className="rounded-xl border border-teal-500/25 bg-teal-500/8 px-4 py-3 text-[12px] font-medium text-teal-300">
                      {message}
                    </div>
                  )}
                </form>
              </div>
            ) : (
              // Register POS Device Content
              <div>
                <div className="mb-8">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
                    <span className="text-[11px] font-semibold tracking-widest text-pink-400 uppercase">อุปกรณ์</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white">ลงทะเบียนเครื่อง POS</h2>
                  <p className="mt-1.5 text-[13px] text-slate-400 leading-relaxed">
                    ตรวจสอบและลงทะเบียนเครื่องนี้กับระบบ API
                  </p>
                </div>
                <RegisterPosDevice key={savedPath || "no-api-path"} apiPath={savedPath} />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// Icon components
const ApiIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const PosIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const BackIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const ExitIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);