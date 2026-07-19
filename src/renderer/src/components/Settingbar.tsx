import {
  IconArrowBackUp,
  IconBuildingStore,
  IconCashBanknote,
  IconChevronLeft,
  IconChevronRight,
  IconDeviceDesktop,
  IconPrinter,
  IconReceipt,
  IconSettings,
  IconUserCog,
  IconUsersGroup,
} from "@tabler/icons-react";
import AccountBar from "./AccountBar";
import Logoutbar from "./Logoutbar";

interface SettingbarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: (page: string) => void;
  currentPage: string;
  onSwitchSidebar?: () => void;
  storeName?: string;
}

export default function Settingbar({
  isOpen,
  onToggle,
  onNavigate,
  currentPage,
  onSwitchSidebar,
  storeName = "AVA MY POS",
}: SettingbarProps) {
  const menuItems = [
    { id: "storeInfo", label: "ข้อมูลร้านค้า", icon: IconBuildingStore, title: "ข้อมูลร้านค้า" },
    { id: "tax", label: "ภาษี", icon: IconSettings, title: "ตั้งค่าภาษี" },
    { id: "payment", label: "ช่องทางชำระเงิน", icon: IconCashBanknote, title: "ช่องทางชำระเงิน" },
    { id: "receipt", label: "ใบเสร็จ", icon: IconReceipt, title: "ตั้งค่าใบเสร็จ" },
    { id: "printer", label: "เครื่องพิมพ์", icon: IconPrinter, title: "ตั้งค่าเครื่องพิมพ์" },
    { id: "posSetting", label: "ตั้งค่าเครื่อง POS", icon: IconDeviceDesktop, title: "ตั้งค่าเครื่อง POS" },
    { id: "userInfo", label: "ข้อมูลผู้ใช้", icon: IconUserCog, title: "ข้อมูลผู้ใช้" },
    { id: "employees", label: "พนักงาน", icon: IconUsersGroup, title: "จัดการพนักงาน" },
  ];

  const activeMenu = menuItems.find((item) => item.id === currentPage);
  const currentTitle = activeMenu?.title || "การตั้งค่า";

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
              <IconBuildingStore size={22} className="text-white" />
            </div>
            {isOpen ? (
              <span
                className="truncate text-lg font-bold tracking-tight text-white"
                title={storeName}
              >
                {storeName}
              </span>
            ) : null}
          </div>
        </div>

        <AccountBar isOpen={isOpen} />

        {isOpen ? (
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="truncate text-base font-medium text-white/70">
              {currentTitle}
            </h2>
          </div>
        ) : null}

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
                    title={item.title}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-white/25 text-white shadow-lg"
                        : "text-white/80 hover:bg-white/15 hover:text-white"
                    }`}
                  >
                    <Icon size={24} className="shrink-0" />
                    {isOpen ? <span className="truncate">{item.label}</span> : null}
                  </button>
                </li>
              );
            })}

            {isOpen ? (
              <li className="my-2 border-t border-white/20" />
            ) : (
              <li className="my-2 flex justify-center">
                <div className="h-px w-8 bg-white/20" />
              </li>
            )}

            <li>
              <button
                type="button"
                onClick={handleGoBack}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium text-white/80 transition-all duration-200 hover:bg-white/15 hover:text-white ${
                  isOpen ? "justify-start" : "justify-center"
                }`}
                title="ย้อนกลับไปหน้าหลัก"
              >
                <IconArrowBackUp size={20} className="shrink-0" />
                {isOpen ? <span className="truncate">ย้อนกลับ</span> : null}
              </button>
            </li>
          </ul>
        </nav>

        <Logoutbar isOpen={isOpen} />
      </aside>
    </>
  );
}
