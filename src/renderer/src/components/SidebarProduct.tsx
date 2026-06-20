import { useEffect, useState } from "react";
import {
  IconBarcode,
  IconCategory,
  IconChevronLeft,
  IconChevronRight,
  IconDeviceLaptop,
  IconLogout,
  IconPackage,
  IconUser,
  IconArrowBackUp,
} from "@tabler/icons-react";
import { logoutAndClearSession } from "./auth";

interface SidebarProductProps {
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: (page: string) => void;
  currentPage: string;
  onSwitchSidebar?: () => void; // เพิ่ม prop สำหรับสลับไป Sidebar.tsx
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

export default function SidebarProduct({
  isOpen,
  onToggle,
  onNavigate,
  currentPage,
  onSwitchSidebar,
}: SidebarProductProps) {
  const [userData, setUserData] = useState<SidebarUserData>(fallbackUserData);

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
    { id: "productList", label: "รายการสินค้า", icon: IconPackage },
    { id: "categories", label: "หมวดหมู่", icon: IconCategory },
    { id: "printBarcode", label: "พิมพ์บาร์โค้ด", icon: IconBarcode },
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

  // ฟังก์ชันสำหรับจัดการการย้อนกลับ - สลับไป Sidebar.tsx
  const handleGoBack = () => {
    if (onSwitchSidebar) {
      onSwitchSidebar();
    }
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

            {/* เส้นแบ่งก่อนปุ่มย้อนกลับ */}
            {isOpen ? (
              <li className="my-2 border-t border-white/20" />
            ) : (
              <li className="my-2 flex justify-center">
                <div className="h-px w-8 bg-white/20" />
              </li>
            )}

            {/* ปุ่มย้อนกลับ - อยู่ใต้พิมพ์บาร์โค้ด */}
            <li>
              <button
                type="button"
                onClick={handleGoBack}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 text-white/80 hover:bg-white/15 hover:text-white ${
                  isOpen ? "justify-start" : "justify-center"
                }`}
                title="ย้อนกลับไปหน้าแรก"
              >
                <IconArrowBackUp size={20} className="shrink-0" />
                {isOpen ? <span className="truncate">ย้อนกลับ</span> : null}
              </button>
            </li>
          </ul>
        </nav>

        <div className="border-t border-white/20 px-3 py-4">
          <button
            type="button"
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/80 transition-all duration-200 hover:bg-red-500/30 hover:text-white ${
              isOpen ? "justify-start" : "justify-center"
            }`}
          >
            <IconLogout size={20} className="shrink-0" />
            {isOpen ? <span>ออกจากระบบ</span> : null}
          </button>
        </div>
      </aside>
    </>
  );
}