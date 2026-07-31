import { useEffect, useState } from "react";
import { LoginPage } from "./components/LoginPage";
import PosLandingPages from "./components/PosLandingPages";
import POSScanTablePage from "./components/POS_Scan_table_Page";
import { ensureValidAccessToken } from "./components/auth";
import {
  getStoredPosLayoutMode,
  normalizePosLayoutMode,
  POS_LAYOUT_MODE_CHANGED_EVENT,
  type PosLayoutMode,
} from "./components/posLayoutMode";

export function App() {
  const [page, setPage] = useState<"login" | "pos">("login");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [posLayoutMode, setPosLayoutMode] = useState<PosLayoutMode>("STANDARD");
  const [isLoadingPosLayoutMode, setIsLoadingPosLayoutMode] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkStoredToken = async () => {
      try {
        const isAuthenticated = await ensureValidAccessToken();

        if (isMounted) {
          setPage(isAuthenticated ? "pos" : "login");
        }
      } catch (error) {
        console.error("Error checking auth token:", error);
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    };

    checkStoredToken();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (page !== "pos") {
      return;
    }

    const validateSession = async () => {
      const isAuthenticated = await ensureValidAccessToken();
      if (!isAuthenticated) {
        setPage("login");
      }
    };

    const intervalId = window.setInterval(validateSession, 30_000);
    return () => window.clearInterval(intervalId);
  }, [page]);

  useEffect(() => {
    if (page !== "pos") {
      setIsLoadingPosLayoutMode(false);
      return;
    }

    let isMounted = true;
    setIsLoadingPosLayoutMode(true);

    const loadPosLayoutMode = async () => {
      const storedMode = await getStoredPosLayoutMode();
      if (isMounted) {
        setPosLayoutMode(storedMode);
        setIsLoadingPosLayoutMode(false);
      }
    };

    void loadPosLayoutMode();

    const handlePosLayoutModeChanged = (event: Event) => {
      if (event instanceof CustomEvent) {
        setPosLayoutMode(normalizePosLayoutMode(event.detail));
      }
    };

    window.addEventListener(
      POS_LAYOUT_MODE_CHANGED_EVENT,
      handlePosLayoutModeChanged,
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        POS_LAYOUT_MODE_CHANGED_EVENT,
        handlePosLayoutModeChanged,
      );
    };
  }, [page]);

  if (isCheckingAuth) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
          <p className="text-sm text-slate-300">กำลังตรวจสอบการเข้าสู่ระบบ...</p>
        </div>
      </main>
    );
  }

  if (page === "pos") {
    if (isLoadingPosLayoutMode) {
      return (
        <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
            <p className="text-sm text-slate-300">กำลังโหลดรูปแบบหน้าขาย...</p>
          </div>
        </main>
      );
    }

    return posLayoutMode === "SCAN_ONLY" ? (
      <POSScanTablePage />
    ) : (
      <PosLandingPages />
    );
  }

  return <LoginPage onLoginSuccess={() => setPage("pos")} />;
}
