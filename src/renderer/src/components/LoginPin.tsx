import { useEffect, useState } from "react";
import logoUrl from "../assets/logo.png";
import { AuthTokens, saveAuthTokens } from "./auth";

interface LoginPinProps {
  onBack: () => void;
  onLoginSuccess: () => void;
}

interface LoginPinResponse extends AuthTokens {
  status?: string;
  message?: string;
  data?: {
    user_id?: string;
    username?: string;
    full_name?: string;
    role?: string;
  };
}

const API_PATH_KEY = "apiPath";
const pinNumbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

export function LoginPin({ onBack, onLoginSuccess }: LoginPinProps) {
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const addNumber = (value: string) => {
    setMessage("");
    setPin((currentPin) => {
      if (currentPin.length >= 6) {
        return currentPin;
      }
      return `${currentPin}${value}`;
    });
  };

  const removeLastNumber = () => {
    setMessage("");
    setPin((currentPin) => currentPin.slice(0, -1));
  };

  const clearPin = () => {
    setMessage("");
    setPin("");
  };

  const submitPin = async () => {
    if (isLoading) {
      return;
    }

    if (pin.length < 6) {
      setMessage("กรุณากรอก PIN ให้ครบ 6 หลัก");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const apiPath = await window.electronStore.get(API_PATH_KEY);
      if (!apiPath || typeof apiPath !== "string") {
        setMessage("ไม่พบ API path กรุณาตั้งค่าใหม่");
        return;
      }

      const base = apiPath.replace(/\/+$/, "");
      const response = await fetch(`${base}/auth/login-pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pin_code: pin,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data: LoginPinResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "เข้าสู่ระบบด้วย PIN ไม่สำเร็จ");
      }

      if (data.status === "ok" && (data.access_token || data.token)) {
        if (data.data) {
          await window.electronStore.set("user", {
            user_id: data.data.user_id ?? "",
            username: data.data.username ?? "",
            full_name: data.data.full_name ?? "",
            role: data.data.role ?? "",
          });
        }

        await saveAuthTokens(data);
        onLoginSuccess();
        return;
      }

      setMessage(data.message || "เข้าสู่ระบบด้วย PIN ไม่สำเร็จ");
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

  const handleKeyPress = (value: string) => {
    if (isLoading) {
      return;
    }

    if (value === "clear") {
      clearPin();
      return;
    }

    if (value === "back") {
      removeLastNumber();
      return;
    }

    addNumber(value);
  };

  // Auto submit when pin reaches 6 digits
  useEffect(() => {
    if (pin.length === 6 && !isLoading) {
      submitPin();
    }
  }, [pin]);

  useEffect(() => {
    const handleKeyboardInput = (event: KeyboardEvent) => {
      if (isLoading) {
        return;
      }

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        addNumber(event.key);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        removeLastNumber();
        return;
      }

      if (event.key === "Delete") {
        event.preventDefault();
        clearPin();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onBack();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        submitPin();
      }
    };

    window.addEventListener("keydown", handleKeyboardInput);

    return () => {
      window.removeEventListener("keydown", handleKeyboardInput);
    };
  }, [isLoading, pin]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 py-10">
      <section className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-2xl sm:p-10">
        <div className="mb-8 text-center">
          <img
            src={logoUrl}
            alt="AVA POS logo"
            className="mx-auto mb-5 h-28 w-28 rounded-full border-4 border-pink-100 bg-white object-cover shadow-xl shadow-pink-500/20"
          />
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-teal-400">
            AVA MY POS
          </p>
          <h1 className="text-2xl font-semibold text-white">
            เข้าสู่ระบบด้วย PIN
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            กดตัวเลขเพื่อกรอกรหัส PIN ของพนักงาน
          </p>
        </div>

        <div className="mb-6 flex justify-center gap-3" aria-label="PIN digits">
          {Array.from({ length: 6 }).map((_, index) => (
            <span
              key={index}
              className={`h-4 w-4 rounded-full border ${
                index < pin.length
                  ? "border-teal-300 bg-teal-300"
                  : "border-slate-600 bg-slate-800"
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {pinNumbers.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleKeyPress(value)}
              disabled={isLoading}
              className={`h-16 rounded-lg border text-lg font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                value === "clear" || value === "back"
                  ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                  : "border-slate-700 bg-slate-950 text-white hover:border-teal-400 hover:bg-slate-800"
              }`}
            >
              {value === "clear" ? "ล้าง" : value === "back" ? "ลบ" : value}
            </button>
          ))}
        </div>

        {message ? (
          <p className="mt-5 rounded-lg border border-teal-400/30 bg-teal-400/10 px-4 py-3 text-center text-sm font-medium text-teal-200">
            {message}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onBack}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 py-3 text-sm font-medium text-slate-300 transition hover:border-teal-400 hover:bg-slate-700 hover:text-white"
        >
          <span aria-hidden="true">←</span>
          กลับไปเข้าสู่ระบบด้วยรหัสผ่าน
        </button>
      </section>
    </main>
  );
}