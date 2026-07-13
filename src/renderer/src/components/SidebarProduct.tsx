import {
  IconCategory,
  IconArrowBackUp,
  IconBuildingStore,
  IconChevronLeft,
  IconChevronRight,
  IconPackage,
  IconBarcode,
  IconFileInvoice, // เพิ่มไอคอนสำหรับใบเสนอราคา
  IconGift, // เพิ่มไอคอนสำหรับโปรโมชั่น
} from "@tabler/icons-react";
import AccountBar from "./AccountBar";
import Logoutbar from "./Logoutbar";

interface SidebarProductProps {
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: (page: string) => void;
  currentPage: string;
  onSwitchSidebar?: () => void;
  storeName?: string;
}

export default function SidebarProduct({
  isOpen,
  onToggle,
  onNavigate,
  currentPage,
  onSwitchSidebar,
  storeName = "AVA MY POS",
}: SidebarProductProps) {
  const menuItems = [
    { id: "productList", label: "รายการสินค้า", icon: IconPackage, title: "รายการสินค้า" },
    { id: "categories", label: "หมวดหมู่", icon: IconCategory, title: "หมวดหมู่สินค้า" },
    { id: "printBarcode", label: "พิมพ์บาร์โค้ดสินค้า", icon: IconBarcode, title: "พิมพ์บาร์โค้ดสินค้า" },
    { id: "priceQuotation", label: "ใบเสนอราคา", icon: IconFileInvoice, title: "ใบเสนอราคา" },
    { id: "promotion", label: "โปรโมชั่น", icon: IconGift, title: "โปรโมชั่น" },
  ];

  // หา title ของเมนูที่กำลัง active
  const activeMenu = menuItems.find((item) => item.id === currentPage);
  const currentTitle = activeMenu?.title || "";

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

        {/* แสดง Title ของเมนูที่ถูกเลือก */}
        {isOpen && currentTitle && (
          <div className="px-4 py-3 border-b border-white/10">
            <h2 className="text-sm font-medium text-white/70 truncate">
              {currentTitle}
            </h2>
          </div>
        )}

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

        <Logoutbar isOpen={isOpen} />
      </aside>
    </>
  );
}
