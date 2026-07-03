import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconCreditCard,
  IconKeyboard,
  IconMenu2,
  IconMinus,
  IconPencil,
  IconPlus,
  IconQrcode,
  IconSearch,
  IconShoppingCart,
  IconStar,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import Sidebar from "./Sidebar";
import SidebarProduct from "./SidebarProduct";
import Settingbar from "./Settingbar";
import Categories from "./Categories";
import Customer from "./Customer";
import ProductLandingpage from "./ProductLandingpage";
import PrintBarcode from "./PrintBarcode";
import PrinterSetting from "./PrinterSetting";
import SettingPages from "./SettingPages";
import { RegisterPage } from "./RegisterPage";
import FavoriteGroups, {
  getFavoriteGroupIcon,
  getFavoriteGroupName,
  type FavoriteGroup,
} from "./FavoriteGroups";
import {
  AllProducts,
  type FavoriteProduct,
} from "./FavoriteItems";
import { UserInfoPage } from "./UserInfoPage";
import { ensureValidAccessToken, refreshAccessToken } from "./auth";

interface CartItem {
  id?: number | string;
  name: string;
  price: number;
  qty: number;
  unit?: string;
}

interface ScannedProduct {
  id: number | string;
  barcode?: string;
  name: string;
  product_type: "FIXED_PRICE" | "WEIGHT" | "OPEN_PRICE";
  sale_price?: number;
  stock_qty?: number;
  unit?: string;
  price_per_unit?: number;
}

interface SearchedProduct {
  product_id: number | string;
  barcode?: string | null;
  sku?: string | null;
  name: string;
  product_type: string;
  price_mode: "FIXED_PRICE" | "WEIGHT_PRICE" | "OPEN_PRICE";
  price: number;
  track_stock?: boolean;
  stock_qty?: number;
  image_url?: string | null;
  unit?: string | null;
}

interface SearchProductResponse {
  status: "success" | "not_found";
  keyword?: string;
  total?: number;
  message?: string;
  data?:
    | SearchedProduct[]
    | SearchedProduct
    | {
        products?: SearchedProduct[];
        data?: SearchedProduct[];
      };
}

interface ScanProductResponse {
  success: boolean;
  code?: string;
  message?: string;
  product?: ScannedProduct;
}

interface PendingScanInput {
  type: "WEIGHT" | "PRICE";
  product: ScannedProduct;
}

const formatBaht = (value: number): string => `฿${value.toFixed(2)}`;

// กำหนดเวลาในการรอรับบาร์โค้ดจากเครื่องสแกน (หน่วย: มิลลิวินาที)
const BARCODE_INPUT_TIMEOUT_MS = 5000;
// const BARCODE_INPUT_TIMEOUT_MS = 300;

const getStoredMachineId = (storedDevice: unknown): string | null => {
  if (!storedDevice || typeof storedDevice !== "object") {
    return null;
  }

  const device = storedDevice as {
    machine_id?: unknown;
    pos_device?: { machine_id?: unknown };
  };
  const machineId = device.machine_id ?? device.pos_device?.machine_id;

  return typeof machineId === "string" && machineId.trim()
    ? machineId.trim()
    : null;
};

const scanProduct = async (barcode: string): Promise<ScanProductResponse> => {
  const [apiPath, storedDevice] = await Promise.all([
    window.electronStore.get("apiPath"),
    window.electronStore.get("pos_device"),
  ]);
  const machineId = getStoredMachineId(storedDevice);

  if (typeof apiPath !== "string" || !apiPath.trim()) {
    throw new Error("ไม่พบ API endpoint ใน store");
  }
  if (!machineId) {
    throw new Error("ไม่พบ machine_id กรุณาลงทะเบียนเครื่อง POS ก่อน");
  }
  if (!(await ensureValidAccessToken())) {
    throw new Error("ไม่สามารถยืนยันตัวตนได้ กรุณาเข้าสู่ระบบใหม่");
  }

  let accessToken = await window.electronStore.get("access_token");
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw new Error("ไม่พบ access token");
  }

  const request = (token: string) =>
    fetch(`${apiPath.trim().replace(/\/+$/, "")}/pos/scan-product`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        barcode,
        machine_id: machineId,
      }),
    });

  let response = await request(accessToken);
  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    response = await request(accessToken);
  }

  const data = (await response.json().catch(() => ({}))) as ScanProductResponse;
  if (!response.ok) {
    if (data.code === "PRODUCT_NOT_FOUND") {
      return data;
    }
    throw new Error(data.message || `สแกนสินค้าไม่สำเร็จ (${response.status})`);
  }

  return data;
};

const searchProducts = async (
  keyword: string,
): Promise<SearchProductResponse> => {
  const apiPath = await window.electronStore.get("apiPath");
  if (typeof apiPath !== "string" || !apiPath.trim()) {
    throw new Error("ไม่พบ API endpoint ใน store");
  }
  if (!(await ensureValidAccessToken())) {
    throw new Error("ไม่สามารถยืนยันตัวตนได้ กรุณาเข้าสู่ระบบใหม่");
  }

  let accessToken = await window.electronStore.get("access_token");
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw new Error("ไม่พบ access token");
  }

  const baseUrl = apiPath.trim().replace(/\/+$/, "");
  const request = (token: string) =>
    fetch(
      `${baseUrl}/pos/products/search?q=${encodeURIComponent(keyword)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

  let response = await request(accessToken);
  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    response = await request(accessToken);
  }

  const data = (await response.json().catch(() => ({}))) as SearchProductResponse;
  if (!response.ok && data.status !== "not_found") {
    throw new Error(data.message || `ค้นหาสินค้าไม่สำเร็จ (${response.status})`);
  }

  return data;
};

const unwrapSearchedProducts = (
  payload: SearchProductResponse["data"],
): SearchedProduct[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  if ("products" in payload && Array.isArray(payload.products)) {
    return payload.products;
  }

  if ("data" in payload && Array.isArray(payload.data)) {
    return payload.data;
  }

  if ("product_id" in payload) {
    return [payload as SearchedProduct];
  }

  return [];
};

export default function PosLandingPages() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState("pos");
  const [activeTab, setActiveTab] = useState("all-products");
  const [favoriteGroups, setFavoriteGroups] = useState<FavoriteGroup[]>([]);
  const [createGroupRequestKey, setCreateGroupRequestKey] = useState(0);
  const [editGroupRequest, setEditGroupRequest] = useState<{
    key: number;
    group: FavoriteGroup;
  } | null>(null);
  const [deleteGroupRequest, setDeleteGroupRequest] = useState<{
    key: number;
    group: FavoriteGroup;
  } | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchedProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [pendingScanInput, setPendingScanInput] =
    useState<PendingScanInput | null>(null);
  const [scanInputValue, setScanInputValue] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [selectedCartItemName, setSelectedCartItemName] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearConfirmSelection, setClearConfirmSelection] = useState<
    "cancel" | "confirm"
  >("confirm");
  const searchRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const barcodeBufferRef = useRef("");
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearConfirmSelectionRef = useRef<"cancel" | "confirm">("confirm");
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const isProductPage = [
    "products",
    "productList",
    "categories",
    "printBarcode",
  ].includes(currentPage);
  const isSettingPage = [
    "settings",
    "tax",
    "printer",
    "receipt",
    "payment",
    "userInfo",
    "employees",
    "storeInfo",
  ].includes(currentPage);

  const subTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart]
  );
  const tax = subTotal * 0.07;
  const total = subTotal + tax;

  const changeQty = (name: string, delta: number) => {
    const changedIndex = cart.findIndex((item) => item.name === name);
    const nextItems = cart
      .map((item) =>
        item.name === name ? { ...item, qty: item.qty + delta } : item,
      )
      .filter((item) => item.qty > 0);

    setCart(nextItems);

    if (!nextItems.some((item) => item.name === name)) {
      setSelectedCartItemName((current) => {
        if (
          current !== name &&
          current !== null &&
          nextItems.some((item) => item.name === current)
        ) {
          return current;
        }

        if (nextItems.length === 0) {
          return null;
        }

        const nextIndex = Math.min(
          Math.max(changedIndex, 0),
          nextItems.length - 1,
        );
        return nextItems[nextIndex].name;
      });
    }
  };

  const removeItem = (name: string) => {
    const removedIndex = cart.findIndex((item) => item.name === name);
    const remainingItems = cart.filter((item) => item.name !== name);

    setCart(remainingItems);
    setSelectedCartItemName((current) => {
      if (
        current !== name &&
        current !== null &&
        remainingItems.some((item) => item.name === current)
      ) {
        return current;
      }

      if (remainingItems.length === 0) {
        return null;
      }

      const nextIndex = Math.min(
        Math.max(removedIndex, 0),
        remainingItems.length - 1,
      );
      return remainingItems[nextIndex].name;
    });
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCartItemName(null);
    setShowClearConfirm(false);
  };

  const addFavoriteProduct = (product: FavoriteProduct) => {
    const priceMode = product.price_mode ?? "FIXED_PRICE";
    const cartProduct: ScannedProduct = {
      id: product.id,
      barcode: product.barcode,
      name: product.product_name,
      product_type:
        priceMode === "WEIGHT_PRICE" ? "WEIGHT" : priceMode,
      sale_price: Number(product.sale_price) || 0,
      stock_qty: product.stock_qty,
      unit:
        product.unit_code ||
        (priceMode === "WEIGHT_PRICE" ? "กก." : undefined),
      price_per_unit: Number(product.sale_price) || 0,
    };

    if (priceMode === "OPEN_PRICE") {
      setScanInputValue("");
      setScanMessage(null);
      setPendingScanInput({ type: "PRICE", product: cartProduct });
      return;
    }

    if (priceMode === "WEIGHT_PRICE") {
      setScanInputValue("");
      setScanMessage(null);
      setPendingScanInput({ type: "WEIGHT", product: cartProduct });
      return;
    }

    addScannedProductToCart(cartProduct, Number(product.sale_price) || 0);
  };

  const addScannedProductToCart = (
    product: ScannedProduct,
    price: number,
    qty = 1,
  ) => {
    setSelectedCartItemName(product.name);
    setCart((items) => {
      const found = items.find(
        (item) =>
          item.id === product.id &&
          item.price === price &&
          item.unit === product.unit,
      );

      if (found) {
        return items.map((item) =>
          item === found ? { ...item, qty: item.qty + qty } : item,
        );
      }

      return [
        ...items,
        {
          id: product.id,
          name: product.name,
          price,
          qty,
          unit: product.unit,
        },
      ];
    });
  };

  const selectSearchedProduct = (product: SearchedProduct) => {
    const cartProduct: ScannedProduct = {
      id: product.product_id,
      barcode: product.barcode ?? undefined,
      name: product.name,
      product_type:
        product.price_mode === "WEIGHT_PRICE"
          ? "WEIGHT"
          : product.price_mode,
      sale_price: Number(product.price) || 0,
      stock_qty: product.stock_qty,
      unit: product.unit || (product.price_mode === "WEIGHT_PRICE" ? "กก." : undefined),
      price_per_unit: Number(product.price) || 0,
    };

    setSearchResults([]);
    setSearchMessage(null);

    if (product.price_mode === "OPEN_PRICE") {
      setScanInputValue("");
      setPendingScanInput({ type: "PRICE", product: cartProduct });
      return;
    }

    if (product.price_mode === "WEIGHT_PRICE") {
      setScanInputValue("");
      setPendingScanInput({ type: "WEIGHT", product: cartProduct });
      return;
    }

    addScannedProductToCart(cartProduct, Number(product.price) || 0);
    setSearchQuery("");
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const handleProductSearch = async () => {
    const keyword = searchQuery.trim();
    if (!keyword || isSearching) {
      return;
    }

    setIsSearching(true);
    setSearchMessage(null);
    setSearchResults([]);

    try {
      const result = await searchProducts(keyword);
      const products = unwrapSearchedProducts(result.data);

      if (result.status === "not_found" || products.length === 0) {
        setSearchMessage(result.message || "ไม่พบสินค้า");
        return;
      }

      const exactMatch = products.find(
        (product) =>
          product.barcode?.toLowerCase() === keyword.toLowerCase() ||
          product.sku?.toLowerCase() === keyword.toLowerCase() ||
          product.name.toLowerCase() === keyword.toLowerCase(),
      );

      if (products.length === 1 || exactMatch) {
        selectSearchedProduct(exactMatch ?? products[0]);
        return;
      }

      setSearchResults(products);
      setSearchMessage(`พบสินค้า ${products.length} รายการ กรุณาเลือกรายการ`);
    } catch (error) {
      setSearchMessage(
        error instanceof Error ? error.message : "ไม่สามารถค้นหาสินค้าได้",
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    const normalizedBarcode = barcode.trim();
    if (!normalizedBarcode || isScanning) {
      return;
    }

    setIsScanning(true);
    setScanMessage(null);

    try {
      const result = await scanProduct(normalizedBarcode);

      if (result.code === "PRODUCT_NOT_FOUND") {
        window.confirm("ไม่เจอบาร์โค้ดในระบบ");
        return;
      }

      if (!result.success || !result.product) {
        window.confirm("ไม่เจอบาร์โค้ดในระบบ");
        return;
      }

      if (
        result.code === "WEIGHT_REQUIRED" ||
        result.product.product_type === "WEIGHT"
      ) {
        setScanInputValue("");
        setPendingScanInput({ type: "WEIGHT", product: result.product });
        return;
      }

      if (
        result.code === "PRICE_REQUIRED" ||
        result.product.product_type === "OPEN_PRICE"
      ) {
        setScanInputValue("");
        setPendingScanInput({ type: "PRICE", product: result.product });
        return;
      }

      addScannedProductToCart(
        result.product,
        Number(result.product.sale_price) || 0,
      );
    } catch (error) {
      setScanMessage(
        error instanceof Error ? error.message : "ไม่สามารถสแกนสินค้าได้",
      );
    } finally {
      setIsScanning(false);
    }
  };

  const confirmScanInput = () => {
    if (!pendingScanInput) {
      return;
    }

    const value = Number(scanInputValue);
    if (!Number.isFinite(value) || value <= 0) {
      setScanMessage(
        pendingScanInput.type === "WEIGHT"
          ? "กรุณากรอกน้ำหนักมากกว่า 0"
          : "กรุณากรอกราคามากกว่า 0",
      );
      scanInputRef.current?.focus();
      return;
    }

    if (pendingScanInput.type === "WEIGHT") {
      addScannedProductToCart(
        pendingScanInput.product,
        Number(pendingScanInput.product.price_per_unit) || 0,
        value,
      );
    } else {
      addScannedProductToCart(pendingScanInput.product, value);
    }

    setPendingScanInput(null);
    setScanInputValue("");
    setScanMessage(null);
    setSearchQuery("");
    setSearchResults([]);
    setSearchMessage(null);
    requestAnimationFrame(() => searchRef.current?.focus());
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
    if (pendingScanInput) {
      setTimeout(() => scanInputRef.current?.focus(), 50);
    }
  }, [pendingScanInput]);

  useEffect(() => {
    const handleScannerKeyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (
        currentPage !== "pos" ||
        isTyping ||
        showClearConfirm ||
        showShortcuts ||
        pendingScanInput
      ) {
        return;
      }

      if (event.key === "Enter") {
        if (barcodeBufferRef.current) {
          event.preventDefault();
          const barcode = barcodeBufferRef.current;
          barcodeBufferRef.current = "";
          setBarcodeBuffer("");
          if (barcodeTimerRef.current) {
            clearTimeout(barcodeTimerRef.current);
          }
          void handleBarcodeScan(barcode);
        }
        return;
      }

      if (event.key === "Backspace" && barcodeBufferRef.current) {
        event.preventDefault();
        barcodeBufferRef.current = barcodeBufferRef.current.slice(0, -1);
        setBarcodeBuffer(barcodeBufferRef.current);
        return;
      }

      if (event.key === "Escape" && barcodeBufferRef.current) {
        event.preventDefault();
        barcodeBufferRef.current = "";
        setBarcodeBuffer("");
        if (barcodeTimerRef.current) {
          clearTimeout(barcodeTimerRef.current);
        }
        return;
      }

      if (
        event.key.length !== 1 ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey
      ) {
        return;
      }

      barcodeBufferRef.current += event.key;
      setBarcodeBuffer(barcodeBufferRef.current);

      if (barcodeTimerRef.current) {
        clearTimeout(barcodeTimerRef.current);
      }
      barcodeTimerRef.current = setTimeout(() => {
        barcodeBufferRef.current = "";
        setBarcodeBuffer("");
      }, BARCODE_INPUT_TIMEOUT_MS);
    };

    window.addEventListener("keydown", handleScannerKeyboard);
    return () => {
      window.removeEventListener("keydown", handleScannerKeyboard);
      if (barcodeTimerRef.current) {
        clearTimeout(barcodeTimerRef.current);
      }
    };
  }, [
    currentPage,
    isScanning,
    pendingScanInput,
    showClearConfirm,
    showShortcuts,
  ]);

  useEffect(() => {
    if (!showClearConfirm) return;

    clearConfirmSelectionRef.current = "confirm";
    setClearConfirmSelection("confirm");

    const selectClearConfirmAction = (selection: "cancel" | "confirm") => {
      clearConfirmSelectionRef.current = selection;
      setClearConfirmSelection(selection);

      if (selection === "cancel") {
        cancelButtonRef.current?.focus();
      } else {
        confirmButtonRef.current?.focus();
      }
    };

    const handlePopupKeyboard = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        event.stopPropagation();
        selectClearConfirmAction("cancel");
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        selectClearConfirmAction("confirm");
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        if (clearConfirmSelectionRef.current === "cancel") {
          cancelButtonRef.current?.click();
        } else {
          confirmButtonRef.current?.click();
        }
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
        event.stopPropagation();
        selectClearConfirmAction(
          clearConfirmSelectionRef.current === "cancel" ? "confirm" : "cancel",
        );
      }
    };

    window.addEventListener("keydown", handlePopupKeyboard, true);

    // Auto-focus ที่ปุ่มยืนยันเมื่อ Popup เปิด
    setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener("keydown", handlePopupKeyboard, true);
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
      ) : isSettingPage ? (
        <Settingbar
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
            <button
              type="button"
              onClick={() => setCurrentPage("pos")}
              className="text-[15px] font-bold tracking-wide text-white transition hover:text-white/80"
            >
              หน้าการขาย
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isScanning ? (
              <span className="rounded-lg border border-white/40 bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                กำลังค้นหาสินค้า...
              </span>
            ) : barcodeBuffer ? (
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
              onClick={() => {
                barcodeBufferRef.current = "";
                setBarcodeBuffer("");
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/15"
              title="พร้อมรับบาร์โค้ดจากเครื่องสแกน"
            >
              <IconQrcode size={18} />
            </button>
          </div>
        </header>

        {currentPage === "productList" ? (
          <ProductLandingpage />
        ) : currentPage === "categories" ? (
          <Categories />
        ) : currentPage === "printBarcode" ? (
          <PrintBarcode />
        ) : currentPage === "customers" ? (
          <Customer />
        ) : currentPage === "userInfo" ? (
          <UserInfoPage />
        ) : currentPage === "employees" ? (
          <RegisterPage />
        ) : currentPage === "printer" ? (
          <PrinterSetting />
        ) : currentPage === "storeInfo" ||
          currentPage === "settings" ||
          currentPage === "tax" ||
          currentPage === "payment" ||
          currentPage === "receipt" ? (
          <SettingPages page={currentPage} />
        ) : (
          <main className="grid min-h-0 flex-1 grid-cols-[1fr_480px] gap-4 p-4">
            <section className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 p-4">
                <form
                  className="relative"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleProductSearch();
                  }}
                >
                  <IconSearch
                    size={15}
                    className="pointer-events-none absolute inset-y-0 left-3.5 my-auto text-slate-400"
                  />
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setSearchResults([]);
                      setSearchMessage(null);
                    }}
                    placeholder="ค้นหาสินค้า ชื่อ / SKU / บาร์โค้ด แล้วกด Enter"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-[#4d9bf0] focus:ring-2 focus:ring-[#4d9bf0]/20"
                  />
                  {isSearching ? (
                    <span className="absolute inset-y-0 right-3 my-auto flex items-center text-xs text-slate-400">
                      กำลังค้นหา...
                    </span>
                  ) : searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults([]);
                        setSearchMessage(null);
                        searchRef.current?.focus();
                      }}
                      className="absolute inset-y-0 right-3 my-auto text-slate-400 hover:text-slate-700"
                    >
                      <IconX size={14} />
                    </button>
                  ) : null}
                  {searchResults.length > 0 ? (
                    <div className="absolute left-0 right-0 top-12 z-40 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                      {searchResults.map((product) => (
                        <button
                          key={product.product_id}
                          type="button"
                          onClick={() => selectSearchedProduct(product)}
                          className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-3 text-left transition hover:bg-blue-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {product.name}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-400">
                              {[product.sku, product.barcode]
                                .filter(Boolean)
                                .join(" · ") || "ไม่มี SKU / บาร์โค้ด"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-[#1d6fd8]">
                              {product.price_mode === "OPEN_PRICE"
                                ? "ระบุราคา"
                                : formatBaht(Number(product.price) || 0)}
                            </p>
                            {product.price_mode === "WEIGHT_PRICE" ? (
                              <p className="text-xs text-slate-400">ต่อหน่วยน้ำหนัก</p>
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </form>

                {searchMessage ? (
                  <p
                    className={`mt-2 text-xs ${
                      searchResults.length > 0 ? "text-blue-600" : "text-red-500"
                    }`}
                  >
                    {searchMessage}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("all-products")}
                    className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition ${
                      activeTab === "all-products"
                        ? "border-[#4d9bf0] bg-[#4d9bf0] text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <IconStar size={16} />
                    สินค้าทั้งหมด
                  </button>

                  {favoriteGroups.map((group) => {
                    const tabKey = `favorite-group:${group.id}`;
                    const isActive = activeTab === tabKey;
                    const GroupIcon = getFavoriteGroupIcon(group);

                    return (
                      <div
                        key={group.id}
                        className={`group flex h-9 items-center rounded-lg border transition ${
                          isActive
                            ? "border-[#4d9bf0] bg-[#4d9bf0] text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveTab(tabKey)}
                          className="flex h-full min-w-0 items-center gap-2 pl-3 pr-2 text-sm"
                        >
                          <GroupIcon size={16} className="shrink-0" />
                          <span className="max-w-36 truncate">
                            {getFavoriteGroupName(group)}
                          </span>
                        </button>
                        <div
                          className={`mr-1 flex items-center gap-0.5 overflow-hidden transition-all ${
                            isActive
                              ? "max-w-16 opacity-100"
                              : "max-w-0 opacity-0 group-hover:max-w-16 group-hover:opacity-100"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setEditGroupRequest({
                                key: Date.now(),
                                group,
                              })
                            }
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                              isActive
                                ? "hover:bg-white/20"
                                : "hover:bg-blue-50 hover:text-[#1d6fd8]"
                            }`}
                            aria-label={`แก้ไขกลุ่ม ${getFavoriteGroupName(group)}`}
                          >
                            <IconPencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteGroupRequest({
                                key: Date.now(),
                                group,
                              })
                            }
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                              isActive
                                ? "hover:bg-red-500/30"
                                : "hover:bg-red-50 hover:text-red-500"
                            }`}
                            aria-label={`ลบกลุ่ม ${getFavoriteGroupName(group)}`}
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() =>
                      setCreateGroupRequestKey((current) => current + 1)
                    }
                    className="flex h-9 items-center gap-2 rounded-lg bg-[#1d6fd8] px-3 text-sm font-medium text-white transition hover:bg-[#1557ad]"
                  >
                    <IconPlus size={16} />
                    เพิ่มกลุ่ม
                  </button>
                </div>
              </div>

              <FavoriteGroups
                activeGroupId={
                  activeTab.startsWith("favorite-group:")
                    ? activeTab.slice("favorite-group:".length)
                    : null
                }
                onGroupsChange={(groups) => {
                  setFavoriteGroups(groups);

                  if (
                    activeTab.startsWith("favorite-group:") &&
                    !groups.some(
                      (group) =>
                        `favorite-group:${group.id}` === activeTab,
                    )
                  ) {
                    setActiveTab("all-products");
                  }
                }}
                onAddToCart={addFavoriteProduct}
                rootContent={
                  activeTab === "all-products" ? (
                    <AllProducts
                      searchQuery={searchQuery}
                      onAddToCart={addFavoriteProduct}
                    />
                  ) : null
                }
                createRequestKey={createGroupRequestKey}
                editGroupRequest={editGroupRequest}
                deleteGroupRequest={deleteGroupRequest}
              />
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
                        key={`${item.id ?? item.name}-${item.price}-${item.unit ?? ""}`}
                        onClick={() => setSelectedCartItemName(item.name)}
                        className={`cursor-pointer rounded-xl border p-3 transition ${
                          selectedCartItemName === item.name
                            ? "border-[#4d9bf0] bg-blue-50/50 ring-1 ring-[#4d9bf0]/20"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
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
                            onClick={(event) => {
                              event.stopPropagation();
                              removeItem(item.name);
                            }}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <IconTrash size={16} />
                          </button>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedCartItemName(item.name);
                                changeQty(item.name, -1);
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                            >
                              <IconMinus size={16} />
                            </button>
                            <span className="w-6 text-center font-bold">{item.qty}</span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedCartItemName(item.name);
                                changeQty(item.name, 1);
                              }}
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

        {scanMessage && !pendingScanInput ? (
          <div className="fixed bottom-5 right-5 z-[95] flex max-w-md items-start gap-3 rounded-xl border border-red-200 bg-white px-4 py-3 shadow-xl">
            <p className="flex-1 text-sm text-red-600">{scanMessage}</p>
            <button
              type="button"
              onClick={() => setScanMessage(null)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="ปิดข้อความ"
            >
              <IconX size={16} />
            </button>
          </div>
        ) : null}

        {pendingScanInput ? (
          <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4">
            <form
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
              onSubmit={(event) => {
                event.preventDefault();
                confirmScanInput();
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {pendingScanInput.type === "WEIGHT"
                      ? "กรอกน้ำหนักสินค้า"
                      : "กรอกราคาขาย"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {pendingScanInput.product.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPendingScanInput(null);
                    setScanInputValue("");
                    setScanMessage(null);
                  }}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="ปิด"
                >
                  <IconX size={20} />
                </button>
              </div>

              {pendingScanInput.type === "WEIGHT" ? (
                <p className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  ราคา {formatBaht(
                    Number(pendingScanInput.product.price_per_unit) || 0,
                  )}{" "}
                  ต่อ {pendingScanInput.product.unit || "หน่วย"}
                </p>
              ) : null}

              <label className="mt-4 block text-sm font-medium text-slate-700">
                {pendingScanInput.type === "WEIGHT"
                  ? `น้ำหนัก (${pendingScanInput.product.unit || "หน่วย"})`
                  : "ราคา (บาท)"}
              </label>
              <input
                ref={scanInputRef}
                type="number"
                min="0"
                step={pendingScanInput.type === "WEIGHT" ? "0.001" : "0.01"}
                inputMode="decimal"
                value={scanInputValue}
                onChange={(event) => {
                  setScanInputValue(event.target.value);
                  setScanMessage(null);
                }}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-lg font-semibold text-slate-900 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
              />

              {scanMessage ? (
                <p className="mt-2 text-sm text-red-500">{scanMessage}</p>
              ) : null}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPendingScanInput(null);
                    setScanInputValue("");
                    setScanMessage(null);
                  }}
                  className="h-11 flex-1 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="h-11 flex-1 rounded-xl bg-[#1d6fd8] font-semibold text-white hover:bg-[#1557ad]"
                >
                  เพิ่มลงตะกร้า
                </button>
              </div>
            </form>
          </div>
        ) : null}

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
                  onFocus={() => {
                    clearConfirmSelectionRef.current = "cancel";
                    setClearConfirmSelection("cancel");
                  }}
                  className={`flex-1 h-11 rounded-xl border bg-white font-semibold transition ${
                    clearConfirmSelection === "cancel"
                      ? "border-[#1d6fd8] text-[#1d6fd8] ring-2 ring-[#4d9bf0] ring-offset-2"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  ยกเลิก
                </button>
                <button
                  ref={confirmButtonRef}
                  type="button"
                  onClick={clearCart}
                  onFocus={() => {
                    clearConfirmSelectionRef.current = "confirm";
                    setClearConfirmSelection("confirm");
                  }}
                  className={`flex-1 h-11 rounded-xl bg-red-600 font-semibold text-white transition hover:bg-red-700 ${
                    clearConfirmSelection === "confirm"
                      ? "ring-2 ring-red-600 ring-offset-2"
                      : ""
                  }`}
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
