import {
  IconBuildingStore,
  IconChevronLeft,
  IconChevronRight,
  IconPackage,
  IconReceipt,
  IconSettings,
  IconShoppingCart,
  IconUsers,
} from "@tabler/icons-react";
import AccountBar from "./AccountBar";
import Logoutbar from "./Logoutbar";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: (page: string) => void;
  currentPage: string;
  storeName?: string;
}

export default function Sidebar({
  isOpen,
  onToggle,
  onNavigate,
  currentPage,
  storeName = "AVA MY POS",
}: SidebarProps) {
  const menuItems = [
    { id: "pos", label: "หน้าร้านขาย", icon: IconShoppingCart },
    { id: "receipts", label: "ใบเสร็จรับเงิน", icon: IconReceipt },
    { id: "products", label: "รายการสินค้า", icon: IconPackage },
    { id: "customers", label: "ลูกค้า", icon: IconUsers },
    { id: "settings", label: "การตั้งค่า", icon: IconSettings },
  ];

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
                    title={item.label}
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
          </ul>
        </nav>

        <Logoutbar isOpen={isOpen} />
      </aside>
    </>
  );
}
