import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconBaselineDensityMedium,
  IconBriefcase,
  IconCreditCard,
  IconDots,
  IconEyeglass,
  IconKeyboard,
  IconMenu2,
  IconMinus,
  IconPlus,
  IconQrcode,
  IconSearch,
  IconShirt,
  IconShoe,
  IconShoppingCart,
  IconStar,
  IconTrash,
  IconWind,
  IconWritingSign,
  IconX,
} from "@tabler/icons-react";
import Sidebar from "./Sidebar";
import SidebarProduct from "./SidebarProduct";
import Categories from "./Categories";
import { UserInfoPage } from "./UserInfoPage";

interface Product {
  name: string;
  cat: string;
  price: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface CartItem {
  name: string;
  price: number;
  qty: number;
}

const PRODUCTS: Product[] = [
  { name: "เสื้อยืด", cat: "เสื้อผ้า", price: 25, icon: IconShirt },
  { name: "กางเกงยีนส์", cat: "กางเกง", price: 40, icon: IconBaselineDensityMedium },
  { name: "แจ็กเก็ต", cat: "เสื้อผ้า", price: 60, icon: IconWind },
  { name: "หมวกแก๊ป", cat: "อื่นๆ", price: 15, icon: IconStar },
  { name: "รองเท้าผ้าใบ", cat: "รองเท้า", price: 75, icon: IconShoe },
  { name: "แว่นตา", cat: "แฟชั่น", price: 30, icon: IconEyeglass },
  { name: "กระเป๋า", cat: "กระเป๋า", price: 90, icon: IconBriefcase },
  { name: "เข็มขัด", cat: "แฟชั่น", price: 20, icon: IconWritingSign },
];

const TABS = [
  { key: "ทั้งหมด", label: "ทั้งหมด", icon: IconStar },
  { key: "เสื้อผ้า", label: "เสื้อผ้า", icon: IconShirt },
  { key: "กางเกง", label: "กางเกง", icon: IconBaselineDensityMedium },
  { key: "รองเท้า", label: "รองเท้า", icon: IconShoe },
  { key: "อื่นๆ", label: "อื่นๆ", icon: IconDots },
];

const formatBaht = (value: number): string => `฿${value.toFixed(2)}`;

export default function PosLandingPages() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState("pos");
  const [activeTab, setActiveTab] = useState("ทั้งหมด");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [selectedCartItemName, setSelectedCartItemName] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const isProductPage = ["products", "productList", "categories", "printBarcode"].includes(
    currentPage,
  );

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return PRODUCTS.filter((product) => {
      const matchesTab = activeTab === "ทั้งหมด" || product.cat === activeTab;
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.cat.toLowerCase().includes(query);

      return matchesTab && matchesSearch;
    });
  }, [activeTab, searchQuery]);

  const subTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart]
  );
  const tax = subTotal * 0.07;
  const total = subTotal + tax;

  const addProduct = (product: Product) => {
    setSelectedCartItemName(product.name);

    setCart((items) => {
      const found = items.find((item) => item.name === product.name);

      if (found) {
        return items.map((item) =>
          item.name === product.name ? { ...item, qty: item.qty + 1 } : item
        );
      }

      return [...items, { name: product.name, price: product.price, qty: 1 }];
    });
  };

  const changeQty = (name: string, delta: number) => {
    setCart((items) =>
      items
        .map((item) =>
          item.name === name ? { ...item, qty: item.qty + delta } : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const removeItem = (name: string) => {
    setCart((items) => items.filter((item) => item.name !== name));
    setSelectedCartItemName((current) => (current === name ? null : current));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCartItemName(null);
    setShowClearConfirm(false);
  };

  const processPayment = () => {
    if (!cart.length) {
      return;
    }

    window.alert(`ชำระเงินสำเร็จ ${formatBaht(total)}`);
    clearCart();
  };

  // จัดการคีย์บอร์ดสำหรับ Popup ยืนยันการลบ
  useEffect(() => {
    if (!showClearConfirm) return;

    const handlePopupKeyboard = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        cancelButtonRef.current?.focus();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        confirmButtonRef.current?.focus();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const activeElement = document.activeElement;

        if (
          activeElement === cancelButtonRef.current ||
          activeElement === confirmButtonRef.current
        ) {
          (activeElement as HTMLButtonElement).click();
          return;
        }

        confirmButtonRef.current?.click();
        return;
      }

      // ปุ่ม Escape -> ยกเลิก
      if (event.key === "Escape") {
        event.preventDefault();
        cancelButtonRef.current?.click();
        return;
      }

      // ปุ่ม Tab -> วนไปมาระหว่างปุ่ม ยกเลิก และ ยืนยัน
      if (event.key === "Tab") {
        event.preventDefault();
        if (document.activeElement === cancelButtonRef.current) {
          confirmButtonRef.current?.focus();
        } else {
          cancelButtonRef.current?.focus();
        }
      }
    };

    window.addEventListener("keydown", handlePopupKeyboard);

    // Auto-focus ที่ปุ่มยืนยันเมื่อ Popup เปิด
    setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener("keydown", handlePopupKeyboard);
    };
  }, [showClearConfirm]);

  // จัดการคีย์บอร์ดหลัก
  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      // ถ้า Popup ยืนยันการลบเปิดอยู่ ให้ข้ามการทำงานทั้งหมด
      if (showClearConfirm) {
        return;
      }

      if (event.key === "F2") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (event.key === "Escape" && showShortcuts) {
        event.preventDefault();
        setShowShortcuts(false);
        return;
      }

      if (isTyping) {
        return;
      }

      if (event.key === "F4") {
        event.preventDefault();
        processPayment();
        return;
      }

      if (event.key === "F6") {
        event.preventDefault();
        if (selectedCartItemName) {
          removeItem(selectedCartItemName);
        }
        return;
      }

      if (event.key === "F7") {
        event.preventDefault();
        if (cart.length > 0) {
          setShowClearConfirm(true);
        }
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        if (selectedCartItemName) {
          changeQty(selectedCartItemName, 1);
        }
        return;
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        if (selectedCartItemName) {
          changeQty(selectedCartItemName, -1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcut);

    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcut);
    };
  }, [cart, selectedCartItemName, showShortcuts, showClearConfirm, total]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans antialiased">
      {isProductPage ? (
        <SidebarProduct
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((value) => !value)}
          onNavigate={setCurrentPage}
          currentPage={currentPage}
          onSwitchSidebar={() => setCurrentPage("pos")}
        />
      ) : (
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((value) => !value)}
          onNavigate={(page) => setCurrentPage(page === "products" ? "productList" : page)}
          currentPage={currentPage}
        />
      )}

      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ${
          sidebarOpen ? "ml-[280px]" : "ml-[72px]"
        }`}
      >
        <header className="flex h-14 shrink-0 items-center justify-between bg-gradient-to-r from-[#1d6fd8] to-[#4d9bf0] px-5 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((value) => !value)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/15"
            >
              <IconMenu2 size={20} />
            </button>
            <span className="text-[15px] font-bold tracking-wide text-white">
              หน้าการขาย
            </span>
          </div>

          <div className="flex items-center gap-2">
            {barcodeBuffer ? (
              <span className="rounded-lg border border-white/40 bg-white/15 px-3 py-1 font-mono text-xs font-bold tracking-widest text-white">
                {barcodeBuffer}_
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/15"
              title="คีย์ลัด"
            >
              <IconKeyboard size={18} />
            </button>
            <button
              type="button"
              onClick={() => setBarcodeBuffer((value) => (value ? "" : "SCAN"))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/15"
            >
              <IconQrcode size={18} />
            </button>
          </div>
        </header>

        {currentPage === "categories" ? (
          <Categories />
        ) : currentPage === "userInfo" ? (
          <UserInfoPage />
        ) : (
          <main className="grid min-h-0 flex-1 grid-cols-[1fr_480px] gap-4 p-4">
            <section className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 p-4">
                <div className="relative">
                  <IconSearch
                    size={15}
                    className="pointer-events-none absolute inset-y-0 left-3.5 my-auto text-slate-400"
                  />
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="ค้นหาสินค้า ชื่อ / หมวดหมู่..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-[#4d9bf0] focus:ring-2 focus:ring-[#4d9bf0]/20"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute inset-y-0 right-3 my-auto text-slate-400 hover:text-slate-700"
                    >
                      <IconX size={14} />
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition ${
                          isActive
                            ? "border-[#4d9bf0] bg-[#4d9bf0] text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <Icon size={16} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid flex-1 auto-rows-min grid-cols-4 gap-3 overflow-y-auto p-4">
                {filteredProducts.map((product) => {
                  const Icon = product.icon;

                  return (
                    <button
                      key={product.name}
                      type="button"
                      onClick={() => addProduct(product)}
                      className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#4d9bf0] hover:shadow-md"
                    >
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4d9bf0]/10 text-[#1d6fd8]">
                        <Icon size={24} />
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {product.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{product.cat}</p>
                      <p className="mt-3 text-lg font-bold text-[#1d6fd8]">
                        {formatBaht(product.price)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white">
              <div className="flex h-14 items-center justify-between gap-2 border-b border-slate-100 px-4">
                <div className="flex items-center gap-2">
                  <IconShoppingCart size={20} className="text-[#1d6fd8]" />
                  <h2 className="font-bold text-slate-900">ตะกร้าสินค้า</h2>
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
                  >
                    <IconTrash size={16} />
                    ลบทั้งหมด
                  </button>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {cart.length ? (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div
                        key={item.name}
                        className="rounded-xl border border-slate-200 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{item.name}</p>
                            <p className="text-xs text-slate-500">
                              {formatBaht(item.price)} x {item.qty}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.name)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <IconTrash size={16} />
                          </button>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => changeQty(item.name, -1)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                            >
                              <IconMinus size={16} />
                            </button>
                            <span className="w-6 text-center font-bold">{item.qty}</span>
                            <button
                              type="button"
                              onClick={() => changeQty(item.name, 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                            >
                              <IconPlus size={16} />
                            </button>
                          </div>
                          <p className="font-bold text-slate-900">
                            {formatBaht(item.price * item.qty)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid h-full place-items-center text-center text-slate-400">
                    <div>
                      <IconShoppingCart size={40} className="mx-auto mb-3" />
                      <p className="text-sm">ยังไม่มีสินค้าในตะกร้า</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>ยอดก่อนภาษี</span>
                    <span>{formatBaht(subTotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>VAT 7%</span>
                    <span>{formatBaht(tax)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-slate-900">
                    <span>รวมทั้งหมด</span>
                    <span>{formatBaht(total)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={processPayment}
                  disabled={!cart.length}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1d6fd8] font-bold text-white transition hover:bg-[#1557ad] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <IconCreditCard size={18} />
                  ชำระเงิน
                </button>
              </div>
            </aside>
          </main>
        )}

        {/* Shortcuts Modal */}
        {showShortcuts ? (
          <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900">คีย์ลัด</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>
                  <span className="font-bold text-slate-900">F4</span> ชำระเงิน
                </p>
                <p>
                  <span className="font-bold text-slate-900">F6</span> ลบรายการที่เลือก
                </p>
                <p>
                  <span className="font-bold text-slate-900">F7</span> ลบรายการสินค้าทั้งหมด
                </p>
                <p>
                  <span className="font-bold text-slate-900">+</span> เพิ่มจำนวนสินค้า
                </p>
                <p>
                  <span className="font-bold text-slate-900">-</span> ลดจำนวนสินค้า
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                className="mt-4 h-10 w-full rounded-lg bg-slate-900 text-sm font-bold text-white"
              >
                ปิด
              </button>
            </div>
          </div>
        ) : null}

        {/* Clear Cart Confirmation Modal */}
        {showClearConfirm ? (
          <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4">
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
            >
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                  <IconTrash size={28} className="text-red-600" />
                </div>
                <h3 id="confirm-title" className="text-xl font-bold text-slate-900">
                  ยืนยันการลบทั้งหมด
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  คุณต้องการลบสินค้าทั้งหมด <span className="font-bold">{cart.length}</span>{" "}
                  รายการออกจากตะกร้าหรือไม่?
                </p>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  ref={cancelButtonRef}
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 h-11 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 transition hover:bg-slate-50 focus:ring-2 focus:ring-[#4d9bf0] focus:ring-offset-2"
                >
                  ยกเลิก
                </button>
                <button
                  ref={confirmButtonRef}
                  type="button"
                  onClick={clearCart}
                  className="flex-1 h-11 rounded-xl bg-red-600 font-semibold text-white transition hover:bg-red-700 focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
                >
                  ยืนยันการลบ
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
