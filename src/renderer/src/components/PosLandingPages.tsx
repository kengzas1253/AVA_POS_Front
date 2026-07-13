import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  IconCreditCard,
  IconDiscount,
  IconFolderOpen,
  IconKeyboard,
  IconMenu2,
  IconMinus,
  IconPencil,
  IconPhone,
  IconPlus,
  IconQrcode,
  IconRefresh,
  IconSearch,
  IconShoppingCart,
  IconStar,
  IconTrash,
  IconUser,
  IconUserPlus,
  IconX,
} from "@tabler/icons-react";
import Sidebar from "./Sidebar";
import SidebarProduct from "./SidebarProduct";
import Settingbar from "./Settingbar";
import Categories from "./Categories";
import Customer from "./Customer";
import ProductLandingpage from "./ProductLandingpage";
import PromotionPage from "./PromotionPage";
import PrintBarcode from "./PrintBarcode";
import POSPayment from "./POSPayment";
import QuotationPage from "./QuotationPage";
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
import { normalizeBarcode } from "./BarcodeNormalizer";

interface CartItem {
  id?: number | string;
  product_id?: number | string | null;
  sku?: string | null;
  barcode?: string | null;
  name: string;
  product_name?: string;
  category_id?: number | string | null;
  price: number;
  qty: number;
  unit?: string;
  unit_code?: string | null;
  price_mode?: string;
  cost_price?: number | string | null;
  sale_price?: number | string | null;
  unit_price?: number | string | null;
  discount_amount?: number | string | null;
  final_price?: number | string | null;
  total_amount?: number | string | null;
  track_stock?: boolean;
  allow_discount?: boolean;
  image_url?: string | null;
  note?: string;
  discount: number;
}

interface ScannedProduct {
  id: number | string;
  barcode?: string;
  name: string;
  product_type: "FIXED_PRICE" | "WEIGHT" | "OPEN_PRICE" | "SERVICE_PRICE";
  sale_price?: number;
  stock_qty?: number;
  unit?: string;
  price_per_unit?: number;
  allow_discount?: boolean;
}

interface SearchedProduct {
  product_id: number | string;
  barcode?: string | null;
  sku?: string | null;
  name: string;
  product_type: string;
  price_mode: "FIXED_PRICE" | "WEIGHT_PRICE" | "OPEN_PRICE" | "SERVICE_PRICE";
  price: number;
  track_stock?: boolean;
  stock_qty?: number;
  allow_discount?: boolean;
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

interface StoreSettings {
  store_name?: string;
  vat_enabled?: boolean;
  vat_rate?: number;
}

interface StoreSettingsResponse {
  status?: string;
  message?: string;
  data?: {
    store?: StoreSettings;
  };
}

interface PosCustomer {
  id: number | string;
  customer_code?: string;
  customer_name?: string;
  name?: string;
  full_name?: string;
  phone?: string | null;
  phone_number?: string | null;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  points_balance?: number;
  total_purchase_amount?: number;
}

interface CustomersResponse {
  data?: PosCustomer[] | { customers?: PosCustomer[]; data?: PosCustomer[] };
  customers?: PosCustomer[];
  message?: string;
}

interface PendingScanInput {
  type: "WEIGHT" | "PRICE";
  product: ScannedProduct;
}

interface HeldBill {
  id: number | string;
  hold_no?: string | null;
  hold_name?: string | null;
  customer_id?: string | null;
  item_count?: number | string | null;
  total_qty?: number | string | null;
  total_amount?: number | string | null;
  created_at?: string | null;
}

interface HeldBillItem {
  id?: number | string;
  product_id?: number | string | null;
  sku?: string | null;
  barcode?: string | null;
  product_name?: string | null;
  name?: string | null;
  category_id?: number | string | null;
  unit_code?: string | null;
  price_mode?: string | null;
  qty?: number | string | null;
  cost_price?: number | string | null;
  sale_price?: number | string | null;
  unit_price?: number | string | null;
  discount_amount?: number | string | null;
  total_amount?: number | string | null;
  track_stock?: boolean | null;
  allow_discount?: boolean | null;
  image_url?: string | null;
  note?: string | null;
}

interface HeldBillDetail extends HeldBill {
  items?: HeldBillItem[];
  held_bill_items?: HeldBillItem[];
}

interface HeldBillsResponse {
  data?: HeldBill[] | { data?: HeldBill[]; held_bills?: HeldBill[] };
  held_bills?: HeldBill[];
  message?: string;
}

interface HeldBillDetailResponse {
  data?: HeldBillDetail;
  held_bill?: HeldBillDetail;
  message?: string;
}

type HeldBillPayloadItem = {
  product_id: number | null;
  sku: string | null;
  barcode: string;
  product_name: string;
  category_id: number | null;
  unit_code: string | null;
  price_mode: string;
  qty: number;
  cost_price: number;
  sale_price: number;
  unit_price: number;
  discount_amount: number;
  total_amount: number;
  track_stock: boolean;
  allow_discount: boolean;
  image_url: string | null;
  note: string;
};

interface HeldBillPayload {
  hold_name: string;
  customer_id: string | null;
  machine_id: string;
  user_id: string;
  note: string;
  items: HeldBillPayloadItem[];
}

interface AppliedPromotion {
  promotion_id: number | string;
  promotion_name: string;
  promotion_type?: string;
  discount_amount?: number | string | null;
  matched_qty?: number | string | null;
}

interface CalculatedPromotionItem {
  product_id: number | string;
  qty?: number | string | null;
  unit_price?: number | string | null;
  discount_amount?: number | string | null;
  final_price?: number | string | null;
}

interface CalculatePromotionsResponse {
  subtotal?: number | string | null;
  discount_total?: number | string | null;
  grand_total?: number | string | null;
  applied_promotions?: AppliedPromotion[];
  items?: CalculatedPromotionItem[];
  message?: string;
}

const formatBaht = (value: number): string => `฿${value.toFixed(2)}`;

// กำหนดเวลาในการรอรับบาร์โค้ดจากเครื่องสแกน (หน่วย: มิลลิวินาที)
//const BARCODE_INPUT_TIMEOUT_MS = 5000;
const BARCODE_INPUT_TIMEOUT_MS = 300;
const SELECTED_POS_CUSTOMER_KEY = "pos_selected_customer";

const isEditableKeyboardTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.isContentEditable ||
      target.closest("input, textarea, select, [contenteditable]"),
  );
};

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

const loadStoreSettings = async (): Promise<StoreSettings> => {
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
    fetch(`${baseUrl}/store/settings`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

  let response = await request(accessToken);
  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    response = await request(accessToken);
  }

  const data = (await response.json().catch(() => ({}))) as StoreSettingsResponse;
  if (!response.ok) {
    throw new Error(data.message || `โหลดการตั้งค่าร้านไม่สำเร็จ (${response.status})`);
  }

  return data.data?.store ?? {};
};

const loadCustomers = async (): Promise<PosCustomer[]> => {
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
    fetch(`${baseUrl}/customers`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

  let response = await request(accessToken);
  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    response = await request(accessToken);
  }

  const data = (await response.json().catch(() => ({}))) as
    | PosCustomer[]
    | CustomersResponse;
  if (!response.ok) {
    const message =
      !Array.isArray(data) && typeof data === "object" && "message" in data
        ? String(data.message)
        : "";
    throw new Error(message || `โหลดข้อมูลลูกค้าไม่สำเร็จ (${response.status})`);
  }

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.data)) {
    return data.data;
  }

  if (Array.isArray(data.customers)) {
    return data.customers;
  }

  if (data.data && !Array.isArray(data.data)) {
    if (Array.isArray(data.data.customers)) {
      return data.data.customers;
    }

    if (Array.isArray(data.data.data)) {
      return data.data.data;
    }
  }

  return [];
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

const getCustomerName = (customer: PosCustomer): string =>
  customer.customer_name ?? customer.name ?? customer.full_name ?? "-";

const getCustomerPhone = (customer: PosCustomer): string =>
  customer.phone ?? customer.phone_number ?? customer.mobile ?? "-";

const toPositiveInteger = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1 ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);
    return Number.isInteger(numericValue) && numericValue >= 1
      ? numericValue
      : null;
  }

  return null;
};

const normalizeHeldBillBarcode = (
  value: unknown,
  productId: number | string | null | undefined,
): string => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  const normalizedProductId =
    productId !== null && productId !== undefined && String(productId).trim()
      ? String(productId).trim()
      : "UNKNOWN";

  return `NO-BARCODE-${normalizedProductId}`;
};

const getStoredUserId = (storedUser: unknown): string | null => {
  if (!storedUser || typeof storedUser !== "object") {
    return null;
  }

  const user = storedUser as { user_id?: unknown; id?: unknown };
  const userId = user.user_id ?? user.id;
  return typeof userId === "string" && userId.trim()
    ? userId.trim()
    : typeof userId === "number" && Number.isFinite(userId)
      ? String(userId)
      : null;
};

const getUserIdFromAccessToken = (accessToken: unknown): string | null => {
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    return null;
  }

  try {
    const payload = accessToken.split(".")[1];
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const decoded = JSON.parse(window.atob(padded)) as {
      user_id?: unknown;
      id?: unknown;
      sub?: unknown;
    };

    const userId = decoded.user_id ?? decoded.id ?? decoded.sub;
    return typeof userId === "string" && userId.trim()
      ? userId.trim()
      : typeof userId === "number" && Number.isFinite(userId)
        ? String(userId)
        : null;
  } catch {
    return null;
  }
};

const getAccessTokenClaims = (accessToken: unknown): Record<string, unknown> | null => {
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    return null;
  }

  try {
    const payload = accessToken.split(".")[1];
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const decoded = JSON.parse(window.atob(padded));
    return decoded && typeof decoded === "object"
      ? (decoded as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const getHeldBillMachineId = (storedDevice: unknown): string | null => {
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

const getHeldBillErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof TypeError) {
    return "ไม่สามารถเชื่อมต่อ API ได้";
  }

  if (error instanceof Error) {
    if (
      error.name === "AbortError" ||
      error.name === "TimeoutError" ||
      error.message.toLowerCase().includes("network")
    ) {
      return "ไม่สามารถเชื่อมต่อ API ได้";
    }

    return error.message || fallback;
  }

  return fallback;
};

const heldBillFetch = async (
  path: string,
  init: RequestInit = {},
): Promise<Response> => {
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
  const buildRequest = (token: string) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });

  let response = await buildRequest(accessToken);
  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    response = await buildRequest(accessToken);
  }

  return response;
};

const calculateCartPromotions = async (
  items: CartItem[],
): Promise<CalculatePromotionsResponse> => {
  const response = await heldBillFetch("/pos/calculate-promotions", {
    method: "POST",
    body: JSON.stringify({
      items: items.map((item) => ({
        product_id: Number(item.product_id ?? item.id),
        barcode: item.barcode ?? "",
        product_name: item.product_name ?? item.name,
        qty: Number(item.qty) || 0,
        unit_price: Number(item.unit_price ?? item.price ?? item.sale_price ?? 0),
      })),
    }),
  });
  const data = (await response.json().catch(() => ({}))) as CalculatePromotionsResponse;

  if (!response.ok) {
    throw new Error(data.message || `Calculate promotions failed (${response.status})`);
  }

  return data;
};

const unwrapHeldBills = (payload: HeldBillsResponse | HeldBill[]): HeldBill[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.held_bills)) {
    return payload.held_bills;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (payload.data && !Array.isArray(payload.data)) {
    if (Array.isArray(payload.data.held_bills)) {
      return payload.data.held_bills;
    }

    if (Array.isArray(payload.data.data)) {
      return payload.data.data;
    }
  }

  return [];
};

const loadHeldBills = async (): Promise<HeldBill[]> => {
  const response = await heldBillFetch("/held-bills");
  const data = (await response.json().catch(() => ({}))) as
    | HeldBillsResponse
    | HeldBill[];

  if (!response.ok) {
    const message =
      !Array.isArray(data) && typeof data.message === "string"
        ? data.message
        : "";
    throw new Error(message || `โหลดรายการบิลพักไม่สำเร็จ (${response.status})`);
  }

  return unwrapHeldBills(data);
};

const loadHeldBillDetail = async (
  id: HeldBill["id"],
): Promise<HeldBillDetail> => {
  const response = await heldBillFetch(`/held-bills/${encodeURIComponent(id)}`);
  const data = (await response.json().catch(() => ({}))) as
    | HeldBillDetail
    | HeldBillDetailResponse;

  if (!response.ok) {
    const message =
      "message" in data && typeof data.message === "string" ? data.message : "";
    throw new Error(message || `โหลดรายละเอียดบิลพักไม่สำเร็จ (${response.status})`);
  }

  if ("held_bill" in data && data.held_bill) {
    return data.held_bill;
  }

  if ("data" in data && data.data) {
    return data.data;
  }

  return data as HeldBillDetail;
};

const createHeldBill = async (payload: HeldBillPayload): Promise<void> => {
  const response = await heldBillFetch("/held-bills", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as { message?: string };

  if (!response.ok) {
    throw new Error(data.message || `พักบิลไม่สำเร็จ (${response.status})`);
  }
};

const deleteHeldBill = async (id: HeldBill["id"]): Promise<void> => {
  const response = await heldBillFetch(`/held-bills/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const data = (await response.json().catch(() => ({}))) as { message?: string };

  if (!response.ok) {
    throw new Error(data.message || `ลบบิลพักไม่สำเร็จ (${response.status})`);
  }
};

const mapHeldBillItemToCartItem = (item: HeldBillItem): CartItem => {
  const qty = Number(item.qty) || 0;
  const unitPrice = Number(item.unit_price ?? item.sale_price ?? 0);
  const productName = item.product_name ?? item.name ?? "-";

  return {
    id: item.product_id ?? item.id,
    product_id: item.product_id ?? item.id ?? null,
    sku: item.sku ?? null,
    barcode: item.barcode ?? null,
    name: productName,
    product_name: productName,
    category_id: item.category_id ?? null,
    price: unitPrice,
    qty,
    unit: item.unit_code ?? undefined,
    unit_code: item.unit_code ?? null,
    price_mode: item.price_mode ?? "FIXED_PRICE",
    cost_price: item.cost_price ?? 0,
    sale_price: item.sale_price ?? unitPrice,
    unit_price: unitPrice,
    discount_amount: item.discount_amount ?? 0,
    total_amount: item.total_amount ?? qty * unitPrice,
    track_stock: item.track_stock ?? false,
    allow_discount: item.allow_discount ?? true,
    image_url: item.image_url ?? null,
    note: item.note ?? "",
    discount: Number(item.discount_amount ?? 0),
  };
};

const formatHeldBillDate = (value?: string | null): string => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  });
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
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    store_name: "AVA MY POS",
    vat_enabled: false,
    vat_rate: 0,
  });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [selectedCartItemName, setSelectedCartItemName] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearConfirmSelection, setClearConfirmSelection] = useState<
    "cancel" | "confirm"
  >("confirm");
  const [discountPopupItemName, setDiscountPopupItemName] = useState<
    string | null
  >(null);
  const [discountInputValue, setDiscountInputValue] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<PosCustomer | null>(
    null,
  );
  const [showCustomerPopup, setShowCustomerPopup] = useState(false);
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [customerLoadError, setCustomerLoadError] = useState<string | null>(
    null,
  );
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [showHeldBillsModal, setShowHeldBillsModal] = useState(false);
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [isLoadingHeldBills, setIsLoadingHeldBills] = useState(false);
  const [heldBillsError, setHeldBillsError] = useState<string | null>(null);
  const [openingHeldBillId, setOpeningHeldBillId] = useState<
    HeldBill["id"] | null
  >(null);
  const [activeHeldBillId, setActiveHeldBillId] = useState<
    HeldBill["id"] | null
  >(null);
  const [showHoldBillModal, setShowHoldBillModal] = useState(false);
  const [holdBillName, setHoldBillName] = useState("");
  const [isHoldingBill, setIsHoldingBill] = useState(false);
  const [holdBillError, setHoldBillError] = useState<string | null>(null);
  const [posToast, setPosToast] = useState<string | null>(null);
  const [promotionSubtotal, setPromotionSubtotal] = useState(0);
  const [discountTotal, setDiscountTotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [appliedPromotions, setAppliedPromotions] = useState<AppliedPromotion[]>(
    [],
  );
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const holdBillNameRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const barcodeBufferRef = useRef("");
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScanningRef = useRef(false);
  const pendingBarcodeScanQueueRef = useRef<string[]>([]);
  const scanInputFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const clearConfirmFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const clearConfirmSelectionRef = useRef<"cancel" | "confirm">("confirm");
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const isProductPage = [
    "products",
    "productList",
    "categories",
    "printBarcode",
    "priceQuotation",
    "promotion",
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

  const normalSubTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart]
  );
  const cartPromotionSignature = useMemo(
    () =>
      cart
        .map((item) =>
          [
            item.product_id ?? item.id ?? "",
            item.barcode ?? "",
            item.product_name ?? item.name,
            item.qty,
            item.unit_price ?? item.price ?? item.sale_price ?? 0,
          ].join(":"),
        )
        .join("|"),
    [cart],
  );
  const itemCount = cart.length;
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const subTotal = cart.length ? promotionSubtotal : 0;
  const discountAmount = cart.length ? discountTotal : 0;
  const netTotal = cart.length ? grandTotal : 0;
  const discountPopupItem = discountPopupItemName
    ? cart.find((item) => item.name === discountPopupItemName) ?? null
    : null;
  const vatRate = Number(storeSettings.vat_rate) || 0;
  const isVatEnabled = Boolean(storeSettings.vat_enabled) && vatRate > 0;
  const tax = isVatEnabled ? Math.max(subTotal - discountAmount, 0) * (vatRate / 100) : 0;
  const total = netTotal;
  const displayStoreName = storeSettings.store_name?.trim() || "AVA MY POS";
  const canFocusBarcodeInput = () =>
    currentPage === "pos" &&
    !showClearConfirm &&
    !showShortcuts &&
    !showCustomerPopup &&
    !showHeldBillsModal &&
    !showHoldBillModal &&
    !pendingScanInput &&
    !discountPopupItemName;

  const focusBarcodeInput = (retry = true) => {
    if (!canFocusBarcodeInput()) {
      return;
    }

    const focusInput = () => {
      barcodeInputRef.current?.focus();
    };

    requestAnimationFrame(focusInput);

    if (retry) {
      window.setTimeout(focusInput, 80);
      window.setTimeout(focusInput, 200);
    }
  };

  const focusSearchInput = (retry = true) => {
    if (
      currentPage !== "pos" ||
      showClearConfirm ||
      showShortcuts ||
      showCustomerPopup ||
      showHeldBillsModal ||
      showHoldBillModal ||
      pendingScanInput ||
      discountPopupItemName
    ) {
      return;
    }

    const focusInput = () => {
      searchRef.current?.focus();
      searchRef.current?.select();
    };

    requestAnimationFrame(focusInput);

    if (retry) {
      window.setTimeout(focusInput, 80);
      window.setTimeout(focusInput, 200);
    }
  };
  const filteredCustomers = useMemo(() => {
    const keyword = customerSearchQuery.trim().toLowerCase();

    if (!keyword) {
      return customers;
    }

    return customers.filter((customer) =>
      [
        getCustomerName(customer),
        customer.customer_code ?? "",
        getCustomerPhone(customer),
        customer.email ?? "",
        customer.address ?? "",
      ]
        .join(" ")
        .toLowerCase()
      .includes(keyword),
    );
  }, [customerSearchQuery, customers]);

  useEffect(() => {
    let isCancelled = false;

    const resetPromotionState = () => {
      setPromotionSubtotal(0);
      setDiscountTotal(0);
      setGrandTotal(0);
      setAppliedPromotions([]);
      setPromotionError(null);
      setPromotionLoading(false);
    };

    const applyPromotions = async () => {
      if (!cart.length) {
        resetPromotionState();
        return;
      }

      setPromotionLoading(true);
      setPromotionError(null);

      try {
        const result = await calculateCartPromotions(cart);
        if (isCancelled) {
          return;
        }

        setPromotionSubtotal(Number(result.subtotal ?? normalSubTotal) || 0);
        setDiscountTotal(Number(result.discount_total ?? 0) || 0);
        setGrandTotal(Number(result.grand_total ?? normalSubTotal) || 0);
        setAppliedPromotions(result.applied_promotions ?? []);

        const calculatedItems = result.items ?? [];
        setCart((currentItems) =>
          currentItems.map((item) => {
            const productId = item.product_id ?? item.id;
            const calculated = calculatedItems.find(
              (promotionItem) =>
                Number(promotionItem.product_id) === Number(productId),
            );
            const discountAmount = Number(calculated?.discount_amount ?? 0) || 0;
            const finalPrice =
              Number(
                calculated?.final_price ??
                  item.final_price ??
                  item.unit_price ??
                  item.price ??
                  item.sale_price ??
                  0,
              ) || 0;

            return {
              ...item,
              discount_amount: discountAmount,
              final_price: finalPrice,
              total_amount: Math.max(finalPrice, 0),
            };
          }),
        );
      } catch (error) {
        console.error("Calculate promotions error:", error);
        if (isCancelled) {
          return;
        }

        setPromotionSubtotal(normalSubTotal);
        setDiscountTotal(0);
        setGrandTotal(normalSubTotal);
        setAppliedPromotions([]);
        setPromotionError(
          error instanceof Error
            ? error.message
            : "Cannot calculate promotions",
        );
        setCart((currentItems) =>
          currentItems.map((item) => ({
            ...item,
            discount_amount: 0,
            final_price:
              (Number(item.qty) || 0) *
              (Number(item.unit_price ?? item.price ?? item.sale_price ?? 0) || 0),
            total_amount:
              (Number(item.qty) || 0) *
              (Number(item.unit_price ?? item.price ?? item.sale_price ?? 0) || 0),
          })),
        );
      } finally {
        if (!isCancelled) {
          setPromotionLoading(false);
        }
      }
    };

    void applyPromotions();

    return () => {
      isCancelled = true;
    };
  }, [cartPromotionSignature, normalSubTotal]);

  const changeQty = (name: string, delta: number) => {
    const changedIndex = cart.findIndex((item) => item.name === name);
    const nextItems = cart
      .map((item) =>
        item.name === name
          ? {
              ...item,
              qty: item.qty + delta,
              discount: Math.min(
                item.discount || 0,
                item.price * Math.max(item.qty + delta, 0),
              ),
            }
          : item,
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
    focusBarcodeInput();
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCartItemName(null);
    setActiveHeldBillId(null);
    setShowClearConfirm(false);
    focusBarcodeInput();
  };

  const buildHeldBillPayload = async (
    holdName: string,
  ): Promise<HeldBillPayload> => {
    const [storedDevice, storedUser, accessToken] = await Promise.all([
      window.electronStore.get("pos_device"),
      window.electronStore.get("user"),
      window.electronStore.get("access_token"),
    ]);
    const machineId = getHeldBillMachineId(storedDevice);
    const userId =
      getStoredUserId(storedUser) ?? getUserIdFromAccessToken(accessToken);
    const customerId =
      typeof selectedCustomer?.customer_code === "string" &&
      selectedCustomer.customer_code.trim()
        ? selectedCustomer.customer_code.trim()
        : null;
    const tokenClaims = getAccessTokenClaims(accessToken);

    console.log("Held bill auth source", {
      storedUser,
      tokenUserClaims: tokenClaims
        ? {
            user_id: tokenClaims.user_id,
            id: tokenClaims.id,
            sub: tokenClaims.sub,
          }
        : null,
      resolvedUserId: userId,
      storedDevice,
      resolvedMachineId: machineId,
    });

    if (!userId) {
      throw new Error("ไม่พบข้อมูลผู้ใช้งาน กรุณา Login ใหม่");
    }

    if (!machineId) {
      throw new Error("ไม่พบ machine_id กรุณาลงทะเบียนเครื่อง POS ก่อน");
    }

    if (cart.length === 0) {
      throw new Error("ไม่พบรายการสินค้าในตะกร้า");
    }

    const payload: HeldBillPayload = {
      hold_name: holdName,
      customer_id: customerId,
      machine_id: machineId,
      user_id: userId,
      note: "",
      items: cart.map((item) => {
        const unitPrice = Number(item.unit_price ?? item.price ?? item.sale_price ?? 0);
        const qty = Number(item.qty) || 0;
        const discountAmount = Number(item.discount_amount ?? item.discount ?? 0);
        const costPrice = Number(item.cost_price ?? 0);
        const salePrice = Number(item.sale_price ?? item.price ?? 0);
        const finalPrice = Number(item.final_price ?? qty * unitPrice);
        const totalAmount = Number(
          item.total_amount ?? Math.max(finalPrice, 0),
        );
        const productId = toPositiveInteger(item.product_id ?? item.id);

        return {
          product_id: productId,
          sku: item.sku ?? null,
          barcode: normalizeHeldBillBarcode(item.barcode, productId),
          product_name: item.product_name ?? item.name,
          category_id: toPositiveInteger(item.category_id),
          unit_code: item.unit_code ?? item.unit ?? null,
          price_mode: item.price_mode ?? "FIXED_PRICE",
          qty,
          cost_price: Number.isFinite(costPrice) ? costPrice : 0,
          sale_price: Number.isFinite(salePrice) ? salePrice : 0,
          unit_price: Number.isFinite(unitPrice) ? unitPrice : 0,
          discount_amount: Number.isFinite(discountAmount)
            ? discountAmount
            : 0,
          total_amount: Number.isFinite(totalAmount) ? totalAmount : 0,
          track_stock: item.track_stock ?? false,
          allow_discount: item.allow_discount ?? true,
          image_url: item.image_url ?? null,
          note: item.note ?? "",
        };
      }),
    };

    const invalidItem = payload.items.find(
      (item) =>
        !Number.isFinite(item.qty) ||
        item.qty <= 0 ||
        !Number.isFinite(item.unit_price) ||
        !Number.isFinite(item.cost_price) ||
        !Number.isFinite(item.sale_price) ||
        !Number.isFinite(item.discount_amount) ||
        !Number.isFinite(item.total_amount),
    );

    if (invalidItem) {
      throw new Error("ข้อมูลสินค้าในตะกร้าไม่ถูกต้อง กรุณาตรวจสอบรายการสินค้า");
    }

    return payload;
  };

  const openHoldBillModal = () => {
    if (!cart.length) {
      return;
    }

    setHoldBillError(null);
    setHoldBillName("");
    setShowHoldBillModal(true);
  };

  const closeHoldBillModal = () => {
    if (isHoldingBill) {
      return;
    }

    setShowHoldBillModal(false);
    setHoldBillError(null);
    setHoldBillName("");
  };

  const submitHoldBill = async () => {
    if (!cart.length || isHoldingBill) {
      return;
    }

    setIsHoldingBill(true);
    setHoldBillError(null);

    try {
      const payload = await buildHeldBillPayload(
        holdBillName.trim() || "บิลพัก",
      );
      console.log("POST /held-bills payload", payload);
      await createHeldBill(payload);
      clearCart();
      setShowHoldBillModal(false);
      setHoldBillName("");
      setPosToast("พักบิลสำเร็จ");
    } catch (error) {
      setHoldBillError(getHeldBillErrorMessage(error, "พักบิลไม่สำเร็จ"));
    } finally {
      setIsHoldingBill(false);
    }
  };

  const fetchHeldBillList = async () => {
    setIsLoadingHeldBills(true);
    setHeldBillsError(null);

    try {
      setHeldBills(await loadHeldBills());
    } catch (error) {
      setHeldBillsError(
        getHeldBillErrorMessage(error, "โหลดรายการบิลพักไม่สำเร็จ"),
      );
    } finally {
      setIsLoadingHeldBills(false);
    }
  };

  const openHeldBillsModal = () => {
    setShowHeldBillsModal(true);
    void fetchHeldBillList();
  };

  const handleHeldBillShortcut = () => {
    if (cart.length > 0) {
      openHoldBillModal();
      return;
    }

    openHeldBillsModal();
  };

  const closeHeldBillsModal = () => {
    if (openingHeldBillId !== null) {
      return;
    }

    setShowHeldBillsModal(false);
    setHeldBillsError(null);
  };

  const openHeldBill = async (heldBill: HeldBill) => {
    if (cart.length > 0) {
      const shouldReplace = window.confirm(
        "ต้องการแทนที่ตะกร้าปัจจุบันด้วยบิลพักนี้หรือไม่?",
      );
      if (!shouldReplace) {
        return;
      }
    }

    setOpeningHeldBillId(heldBill.id);
    setHeldBillsError(null);

    try {
      const detail = await loadHeldBillDetail(heldBill.id);
      const items = detail.held_bill_items ?? detail.items ?? [];
      const nextCart = items.map(mapHeldBillItemToCartItem);
      await restoreHeldBillCustomer(detail.customer_id);

      setCart(nextCart);
      setSelectedCartItemName(nextCart[0]?.name ?? null);
      setActiveHeldBillId(heldBill.id);
      setShowHeldBillsModal(false);
    } catch (error) {
      setHeldBillsError(
        getHeldBillErrorMessage(error, "โหลดรายละเอียดบิลพักไม่สำเร็จ"),
      );
    } finally {
      setOpeningHeldBillId(null);
    }
  };

  const openPriceInput = (product: ScannedProduct) => {
    const price = Number(product.sale_price ?? product.price_per_unit) || 0;
    setScanInputValue(price > 0 ? String(price) : "");
    setScanMessage(null);
    setPendingScanInput({ type: "PRICE", product });
  };

  const closeScanInput = () => {
    setPendingScanInput(null);
    setScanInputValue("");
    setScanMessage(null);
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
      allow_discount: product.allow_discount,
      unit:
        product.unit_code ||
        (priceMode === "WEIGHT_PRICE" ? "กก." : undefined),
      price_per_unit: Number(product.sale_price) || 0,
    };

    if (priceMode === "OPEN_PRICE" || priceMode === "SERVICE_PRICE") {
      openPriceInput(cartProduct);
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
          String(item.id) === String(product.id) &&
          item.price === price &&
          item.unit === product.unit,
      );

      if (found) {
        return items.map((item) =>
          item === found
            ? {
                ...item,
                product_id: item.product_id ?? product.id,
                barcode: item.barcode ?? product.barcode ?? null,
                qty: item.qty + qty,
                final_price: (item.qty + qty) * item.price,
                total_amount: (item.qty + qty) * item.price,
              }
            : item,
        );
      }

      return [
        ...items,
        {
          id: product.id,
          product_id: product.id,
          barcode: product.barcode ?? null,
          name: product.name,
          product_name: product.name,
          price,
          qty,
          unit: product.unit,
          unit_price: price,
          sale_price: product.sale_price ?? price,
          allow_discount: product.allow_discount ?? true,
          discount_amount: 0,
          final_price: price * qty,
          total_amount: price * qty,
          discount: 0,
        },
      ];
    });
    focusBarcodeInput();
  };

  const changeItemDiscount = (name: string, discount: number) => {
    setCart((items) =>
      items.map((item) => {
        if (item.name !== name || !item.allow_discount) {
          return item;
        }

        const lineTotal = item.price * item.qty;
        return {
          ...item,
          discount: Math.min(Math.max(discount, 0), lineTotal),
        };
      }),
    );
  };

  const openDiscountPopup = (name: string) => {
    const item = cart.find((cartItem) => cartItem.name === name);
    if (!item || !item.allow_discount) {
      return;
    }

    setSelectedCartItemName(name);
    setDiscountPopupItemName(name);
    setDiscountInputValue(item.discount ? String(item.discount) : "");
  };

  const closeDiscountPopup = () => {
    setDiscountPopupItemName(null);
    setDiscountInputValue("");
  };

  const confirmDiscountPopup = () => {
    if (!discountPopupItemName) {
      return;
    }

    changeItemDiscount(discountPopupItemName, Number(discountInputValue) || 0);
    closeDiscountPopup();
  };

  const fetchCustomerList = async () => {
    setIsLoadingCustomers(true);
    setCustomerLoadError(null);

    try {
      setCustomers(await loadCustomers());
    } catch (error) {
      setCustomerLoadError(
        error instanceof Error
          ? error.message
          : "ไม่สามารถโหลดข้อมูลลูกค้าได้",
      );
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const openCustomerPopup = () => {
    setCustomerSearchQuery("");
    setShowCustomerPopup(true);
    void fetchCustomerList();
  };

  const closeCustomerPopup = () => {
    setShowCustomerPopup(false);
    setCustomerLoadError(null);
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);
    void window.electronStore.set(SELECTED_POS_CUSTOMER_KEY, null);
  };

  const selectCustomer = (customer: PosCustomer) => {
    setSelectedCustomer(customer);
    void window.electronStore.set(SELECTED_POS_CUSTOMER_KEY, customer);
    closeCustomerPopup();
  };

  const restoreHeldBillCustomer = async (customerCode?: string | null) => {
    const normalizedCustomerCode =
      typeof customerCode === "string" && customerCode.trim()
        ? customerCode.trim()
        : null;

    if (!normalizedCustomerCode) {
      clearSelectedCustomer();
      return;
    }

    const customerList = await loadCustomers();
    const matchedCustomer =
      customerList.find(
        (customer) => customer.customer_code === normalizedCustomerCode,
      ) ?? null;

    setSelectedCustomer(matchedCustomer);
    void window.electronStore.set(
      SELECTED_POS_CUSTOMER_KEY,
      matchedCustomer,
    );
  };

  const confirmQuitApp = () => {
    if (currentPage !== "pos") {
      return;
    }

    const shouldQuit = window.confirm("คุณต้องการปิดโปรแกรมหรือไม่?");
    if (shouldQuit) {
      void window.electronAPI.quitApp();
    }
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
      allow_discount: product.allow_discount,
      unit: product.unit || (product.price_mode === "WEIGHT_PRICE" ? "กก." : undefined),
      price_per_unit: Number(product.price) || 0,
    };

    setSearchResults([]);
    setSearchMessage(null);

    if (product.price_mode === "OPEN_PRICE" || product.price_mode === "SERVICE_PRICE") {
      openPriceInput(cartProduct);
      return;
    }

    if (product.price_mode === "WEIGHT_PRICE") {
      setScanInputValue("");
      setPendingScanInput({ type: "WEIGHT", product: cartProduct });
      return;
    }

    addScannedProductToCart(cartProduct, Number(product.price) || 0);
    setSearchQuery("");
    focusBarcodeInput();
  };

  const handleProductSearch = async () => {
    const keyword = searchQuery.trim();
    if (!keyword || isSearching) {
      return;
    }
    let shouldRefocusSearch = true;

    setIsSearching(true);
    setSearchMessage(null);
    setSearchResults([]);

    try {
      const normalizedBarcode = normalizeBarcode(keyword);
      if (/^\d{4,}$/.test(normalizedBarcode)) {
        const scanResult = await scanProduct(normalizedBarcode);

        if (scanResult.success && scanResult.product) {
          if (
            scanResult.code === "WEIGHT_REQUIRED" ||
            scanResult.product.product_type === "WEIGHT"
          ) {
            setScanInputValue("");
            setPendingScanInput({ type: "WEIGHT", product: scanResult.product });
            setSearchQuery("");
            shouldRefocusSearch = false;
            return;
          }

          if (
            scanResult.code === "PRICE_REQUIRED" ||
            scanResult.product.product_type === "OPEN_PRICE" ||
            scanResult.product.product_type === "SERVICE_PRICE"
          ) {
            openPriceInput(scanResult.product);
            setSearchQuery("");
            shouldRefocusSearch = false;
            return;
          }

          addScannedProductToCart(
            scanResult.product,
            Number(scanResult.product.sale_price) || 0,
          );
          setSearchQuery("");
          return;
        }
      }

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
      if (shouldRefocusSearch) {
        focusBarcodeInput();
      }
    }
  };

  // ประมวลผลบาร์โค้ดที่ "normalize แล้ว" เท่านั้น ห้ามเรียก normalizeBarcode ซ้ำที่นี่
  // (ของเดิม bug อยู่ตรงที่คิวเก็บค่าที่ normalize แล้ว แต่ดันเอาไปวนเข้า
  // handleBarcodeScan ใหม่ ทำให้ normalizeBarcode ถูกเรียกซ้ำสองครั้งกับบาร์โค้ด
  // เดียวกัน ถ้าเกิดมีอักขระอย่าง "-", "/", "." ปนอยู่ในบาร์โค้ดจริง มันจะถูก
  // แปลงเป็นตัวเลขผิดๆ ซ้ำอีกรอบ ทำให้ยิงบาร์โค้ดซ้ำแล้วหาไม่เจอ)
  const processNormalizedBarcode = async (normalizedBarcode: string) => {
    if (!normalizedBarcode) {
      return;
    }
    let shouldRefocusBarcode = true;

    if (isScanningRef.current) {
      pendingBarcodeScanQueueRef.current.push(normalizedBarcode);
      return;
    }

    isScanningRef.current = true;
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
        shouldRefocusBarcode = false;
        return;
      }

      if (
        result.code === "PRICE_REQUIRED" ||
        result.product.product_type === "OPEN_PRICE" ||
        result.product.product_type === "SERVICE_PRICE"
      ) {
        openPriceInput(result.product);
        shouldRefocusBarcode = false;
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
      isScanningRef.current = false;
      setIsScanning(false);

      const pendingBarcode = pendingBarcodeScanQueueRef.current.shift();
      if (pendingBarcode) {
        // pendingBarcode ถูก normalize มาแล้วตั้งแต่ตอน push เข้าคิว
        // จึงเรียก processNormalizedBarcode ตรงๆ ห้ามวนกลับไป normalize ซ้ำ
        void processNormalizedBarcode(pendingBarcode);
      } else if (shouldRefocusBarcode) {
        focusBarcodeInput();
      }
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    const normalizedBarcode = normalizeBarcode(barcode);
    await processNormalizedBarcode(normalizedBarcode);
  };

  const handleBarcodeInputKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
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

    event.preventDefault();
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
    focusBarcodeInput();
  };

  const processPayment = async () => {
    if (!cart.length) {
      return;
    }

    if (activeHeldBillId !== null) {
      try {
        await deleteHeldBill(activeHeldBillId);
      } catch (error) {
        setScanMessage(
          getHeldBillErrorMessage(error, "ลบบิลพักหลังชำระเงินไม่สำเร็จ"),
        );
        return;
      }
    }

    window.alert(`ชำระเงินสำเร็จ ${formatBaht(total)}`);
    clearCart();
  };

  // จัดการคีย์บอร์ดสำหรับ Popup ยืนยันการลบ
  useEffect(() => {
    if (scanInputFocusTimerRef.current) {
      clearTimeout(scanInputFocusTimerRef.current);
      scanInputFocusTimerRef.current = null;
    }

    if (pendingScanInput) {
      scanInputFocusTimerRef.current = setTimeout(() => {
        scanInputRef.current?.focus();
        scanInputFocusTimerRef.current = null;
      }, 50);
    }

    return () => {
      if (scanInputFocusTimerRef.current) {
        clearTimeout(scanInputFocusTimerRef.current);
        scanInputFocusTimerRef.current = null;
      }
    };
  }, [pendingScanInput]);

  // โฟกัสช่องกรอกส่วนลดเมื่อ popup ส่วนลดเปิดขึ้น
  useEffect(() => {
    if (!discountPopupItemName) {
      return;
    }

    const timer = setTimeout(() => {
      discountInputRef.current?.focus();
      discountInputRef.current?.select();
    }, 50);

    return () => clearTimeout(timer);
  }, [discountPopupItemName]);

  useEffect(() => {
    if (!showCustomerPopup) {
      return;
    }

    const timer = setTimeout(() => {
      customerSearchRef.current?.focus();
      customerSearchRef.current?.select();
    }, 50);

    return () => clearTimeout(timer);
  }, [showCustomerPopup]);

  useEffect(() => {
    let isCancelled = false;

    const restoreSelectedCustomer = async () => {
      const storedCustomer = await window.electronStore.get(
        SELECTED_POS_CUSTOMER_KEY,
      );

      if (
        !isCancelled &&
        storedCustomer &&
        typeof storedCustomer === "object" &&
        "id" in storedCustomer
      ) {
        setSelectedCustomer(storedCustomer as PosCustomer);
      }
    };

    if (currentPage === "pos") {
      void restoreSelectedCustomer();
    }

    return () => {
      isCancelled = true;
    };
  }, [currentPage]);

  useEffect(() => {
    if (!showHoldBillModal) {
      return;
    }

    const timer = setTimeout(() => {
      holdBillNameRef.current?.focus();
      holdBillNameRef.current?.select();
    }, 50);

    return () => clearTimeout(timer);
  }, [showHoldBillModal]);

  useEffect(() => {
    if (!posToast) {
      return;
    }

    const timer = setTimeout(() => setPosToast(null), 2400);
    return () => clearTimeout(timer);
  }, [posToast]);

  // ปิด popup ส่วนลดอัตโนมัติถ้ารายการสินค้านั้นถูกลบออกจากตะกร้าแล้ว
  useEffect(() => {
    if (
      discountPopupItemName &&
      !cart.some((item) => item.name === discountPopupItemName)
    ) {
      setDiscountPopupItemName(null);
      setDiscountInputValue("");
    }
  }, [cart, discountPopupItemName]);

  useEffect(() => {
    let isCancelled = false;

    const fetchStoreSettings = async () => {
      try {
        const settings = await loadStoreSettings();
        if (!isCancelled) {
          setStoreSettings({
            store_name: settings.store_name?.trim() || "AVA MY POS",
            vat_enabled: Boolean(settings.vat_enabled),
            vat_rate: Number(settings.vat_rate) || 0,
          });
        }
      } catch (err) {
        console.error("Error loading store settings:", err);
        if (!isCancelled) {
          setStoreSettings({
            store_name: "AVA MY POS",
            vat_enabled: false,
            vat_rate: 0,
          });
        }
      }
    };

    if (currentPage === "pos") {
      void fetchStoreSettings();
    }

    return () => {
      isCancelled = true;
    };
  }, [currentPage]);

  useEffect(() => {
    if (currentPage === "pos") {
      return;
    }

    closeScanInput();
    setShowShortcuts(false);
    setShowClearConfirm(false);
    setShowCustomerPopup(false);
    setSearchResults([]);
    setSearchMessage(null);
  }, [currentPage]);

  useEffect(() => {
    if (currentPage !== "pos") {
      return;
    }

    const timer = setTimeout(() => {
      focusBarcodeInput();
    }, 50);

    return () => clearTimeout(timer);
  }, [currentPage]);

  useEffect(() => {
    const handleScannerKeyboard = (event: KeyboardEvent) => {
      const isTyping = isEditableKeyboardTarget(event.target);

      if (
        currentPage !== "pos" ||
        isTyping ||
        showClearConfirm ||
        showShortcuts ||
        showCustomerPopup ||
        showHeldBillsModal ||
        showHoldBillModal ||
        pendingScanInput
      ) {
        return;
      }

      if (event.key === "Enter") {
        if (barcodeBufferRef.current) {
          event.preventDefault();
          event.stopImmediatePropagation();
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
        event.stopImmediatePropagation();
        barcodeBufferRef.current = barcodeBufferRef.current.slice(0, -1);
        setBarcodeBuffer(barcodeBufferRef.current);
        return;
      }

      if (event.key === "Escape" && barcodeBufferRef.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
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

      if (
        !barcodeBufferRef.current &&
        ["+", "=", "-", "_"].includes(event.key)
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
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
    pendingScanInput,
    showClearConfirm,
    showShortcuts,
    showCustomerPopup,
    showHeldBillsModal,
    showHoldBillModal,
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
    clearConfirmFocusTimerRef.current = setTimeout(() => {
      confirmButtonRef.current?.focus();
      clearConfirmFocusTimerRef.current = null;
    }, 50);

    return () => {
      if (clearConfirmFocusTimerRef.current) {
        clearTimeout(clearConfirmFocusTimerRef.current);
        clearConfirmFocusTimerRef.current = null;
      }
      window.removeEventListener("keydown", handlePopupKeyboard, true);
    };
  }, [showClearConfirm]);

  // จัดการคีย์บอร์ดหลัก
  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      const isTyping = isEditableKeyboardTarget(event.target);

      // ถ้า Popup ยืนยันการลบเปิดอยู่ ให้ข้ามการทำงานทั้งหมด
      if (showClearConfirm) {
        return;
      }

      if (event.key === "Escape" && showCustomerPopup) {
        event.preventDefault();
        closeCustomerPopup();
        return;
      }

      if (event.key === "Escape" && showHeldBillsModal) {
        event.preventDefault();
        closeHeldBillsModal();
        return;
      }

      if (event.key === "Escape" && showHoldBillModal) {
        event.preventDefault();
        closeHoldBillModal();
        return;
      }

      if (event.key === "Escape" && pendingScanInput) {
        event.preventDefault();
        closeScanInput();
        return;
      }

      if (event.key === "Escape" && discountPopupItemName) {
        event.preventDefault();
        closeDiscountPopup();
        return;
      }

      if (event.key === "Escape" && showShortcuts) {
        event.preventDefault();
        setShowShortcuts(false);
        return;
      }

      if (event.key === "Escape" && currentPage === "pos") {
        event.preventDefault();
        confirmQuitApp();
        return;
      }

      if (event.key === "F2") {
        event.preventDefault();
        handleHeldBillShortcut();
        return;
      }

      if (event.key === "F3" && currentPage === "pos") {
        event.preventDefault();
        openCustomerPopup();
        return;
      }

      if (isTyping) {
        return;
      }

      if (event.key === "F4") {
        event.preventDefault();
        if (cart.length > 0) {
          setCurrentPage("posPayment");
        }
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

      if (event.key === "F8") {
        event.preventDefault();
        if (selectedCartItemName) {
          openDiscountPopup(selectedCartItemName);
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
  }, [
    cart,
    currentPage,
    pendingScanInput,
    discountPopupItemName,
    showCustomerPopup,
    showHeldBillsModal,
    showHoldBillModal,
    selectedCartItemName,
    showShortcuts,
    showClearConfirm,
    total,
    isHoldingBill,
    activeHeldBillId,
  ]);

  if (currentPage === "posPayment") {
    return (
      <POSPayment
        cartItems={cart}
        subtotal={subTotal}
        discount={discountAmount}
        total={total}
        onBack={() => setCurrentPage("pos")}
        onPaymentComplete={() => {
          clearCart();
          setCurrentPage("pos");
        }}
      />
    );
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] min-h-[100svh] w-full overflow-hidden bg-slate-50 font-sans antialiased">
      {isProductPage ? (
        <SidebarProduct
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((value) => !value)}
          onNavigate={setCurrentPage}
          currentPage={currentPage}
          onSwitchSidebar={() => setCurrentPage("pos")}
          storeName={displayStoreName}
        />
      ) : isSettingPage ? (
        <Settingbar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((value) => !value)}
          onNavigate={setCurrentPage}
          currentPage={currentPage}
          onSwitchSidebar={() => setCurrentPage("pos")}
          storeName={displayStoreName}
        />
      ) : (
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((value) => !value)}
          onNavigate={(page) => setCurrentPage(page === "products" ? "productList" : page)}
          currentPage={currentPage}
          storeName={displayStoreName}
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
            <input
              ref={barcodeInputRef}
              value={barcodeBuffer}
              onChange={() => undefined}
              onKeyDown={handleBarcodeInputKeyDown}
              aria-label="Barcode scanner input"
              autoComplete="off"
              inputMode="none"
              className="h-8 w-80 rounded-lg border border-transparent bg-transparent px-2 font-mono text-transparent caret-transparent outline-none focus:border-white/20 focus:bg-white/5"
            />
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
                focusBarcodeInput();
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
        ) : currentPage === "priceQuotation" ? (
          <QuotationPage />
        ) : currentPage === "promotion" ? (
          <PromotionPage />
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
          <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(360px,480px)] gap-4 overflow-hidden p-4 [@media(max-height:720px)]:gap-3 [@media(max-height:720px)]:p-3">
            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="shrink-0 border-b border-slate-100 p-4 [@media(max-height:720px)]:p-3">
                <form
                  className="relative z-20"
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
                    className="relative z-10 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-[13px] text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-[#4d9bf0] focus:ring-2 focus:ring-[#4d9bf0]/20"
                  />
                  {isSearching ? (
                    <span className="pointer-events-none absolute inset-y-0 right-3 z-20 my-auto flex items-center text-xs text-slate-400">
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
                      className="absolute inset-y-0 right-3 z-20 my-auto text-slate-400 hover:text-slate-700"
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
                              {product.price_mode === "SERVICE_PRICE"
                                ? "กรอกราคาตอนขาย"
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

            <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 [@media(max-height:720px)]:h-12 [@media(max-height:720px)]:px-3">
                <div className="flex min-w-0 items-center gap-2">
                  <IconShoppingCart size={20} className="text-[#1d6fd8]" />
                  <div className="min-w-0">
                    <h2 className="font-bold text-slate-900">ตะกร้าสินค้า</h2>
                    {selectedCustomer ? (
                      <p className="mt-0.5 max-w-[260px] truncate text-base font-bold leading-5 text-[#1d6fd8]">
                        {getCustomerName(selectedCustomer)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={openHeldBillsModal}
                    title="เปิดบิลที่พัก"
                    aria-label="เปิดบิลที่พัก"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
                  >
                    <IconFolderOpen size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={openCustomerPopup}
                    title="เลือกลูกค้า (F3)"
                    aria-label="เลือกลูกค้า"
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                      selectedCustomer
                        ? "border-[#1d6fd8] bg-blue-50 text-[#1d6fd8] hover:bg-blue-100"
                        : "border-slate-200 text-slate-500 hover:border-[#1d6fd8] hover:text-[#1d6fd8]"
                    }`}
                  >
                    <IconUserPlus size={18} />
                  </button>
                  {selectedCustomer ? (
                    <button
                      type="button"
                      onClick={clearSelectedCustomer}
                      title="ล้างลูกค้า"
                      aria-label="ล้างลูกค้า"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <IconX size={16} />
                    </button>
                  ) : null}
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
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 [@media(max-height:720px)]:p-3">
                {cart.length ? (
                  <div className="space-y-3">
                    {cart.map((item) => {
                      const lineTotal = item.price * item.qty;
                      const lineDiscount = Math.min(
                        Math.max(
                          Number(item.discount_amount ?? item.discount ?? 0) || 0,
                          0,
                        ),
                        lineTotal,
                      );
                      const lineFinalPrice =
                        Number(item.final_price ?? item.total_amount ?? lineTotal) ||
                        lineTotal;
                      const lineNetTotal = Math.max(lineFinalPrice, 0);

                      return (
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
                            {lineDiscount > 0 ? (
                              <p className="text-xs text-slate-400">
                                ราคาก่อนลด {formatBaht(lineTotal)}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            {item.allow_discount ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openDiscountPopup(item.name);
                                }}
                                title="ใส่ส่วนลดรายการนี้"
                                className={`transition ${
                                  lineDiscount > 0
                                    ? "text-[#1d6fd8] hover:text-[#1557ad]"
                                    : "text-slate-400 hover:text-[#1d6fd8]"
                                }`}
                              >
                                <IconDiscount size={18} />
                              </button>
                            ) : null}
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
                            {formatBaht(lineNetTotal)}
                          </p>
                        </div>
                        {item.allow_discount && lineDiscount > 0 ? (
                          <div className="mt-3">
                            <label className="block text-xs text-slate-500">
                              <span className="mb-1 block">
                                ส่วนลดรายการนี้ (บาท)
                              </span>
                              <input
                                type="number"
                                min="0"
                                max={item.price * item.qty}
                                step="0.01"
                                inputMode="decimal"
                                value={item.discount || ""}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => {
                                  setSelectedCartItemName(item.name);
                                  changeItemDiscount(
                                    item.name,
                                    Number(event.target.value) || 0,
                                  );
                                }}
                                placeholder="0.00"
                                className="h-9 w-full rounded-lg border border-[#1d6fd8] px-3 text-right text-sm font-semibold text-slate-800 outline-none transition focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                              />
                            </label>
                          </div>
                        ) : null}
                      </div>
                      );
                    })}
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

              <div className="shrink-0 border-t border-slate-100 p-4 [@media(max-height:720px)]:p-3">
                <div className="space-y-2 text-sm [@media(max-height:720px)]:space-y-1">
                  {isVatEnabled ? (
                    <>
                      <div className="flex justify-between text-slate-500">
                        <span>ยอดก่อนภาษี</span>
                        <span>{formatBaht(subTotal)}</span>
                      </div>
                      {discountAmount > 0 ? (
                        <div className="flex justify-between text-emerald-600">
                          <span>ส่วนลด</span>
                          <span>-{formatBaht(discountAmount)}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-slate-500">
                        <span>VAT {vatRate}%</span>
                        <span>{formatBaht(tax)}</span>
                      </div>
                    </>
                  ) : null}
                  <div className="flex justify-between text-slate-500">
                    <span>รายการ / จำนวนสินค้า</span>
                    <span>
                      {itemCount} รายการ / {totalQty} ชิ้น
                    </span>
                  </div>
                  {discountAmount > 0 ? (
                    <div className="flex justify-between text-slate-500">
                      <span>ยอดก่อนลด</span>
                      <span>{formatBaht(subTotal)}</span>
                    </div>
                  ) : null}
                  {!isVatEnabled && discountAmount > 0 ? (
                    <div className="flex justify-between text-emerald-600">
                      <span>ส่วนลด</span>
                      <span>-{formatBaht(discountAmount)}</span>
                    </div>
                  ) : null}
                  {appliedPromotions.length > 0 ? (
                    <div className="space-y-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      {appliedPromotions.map((promotion) => (
                        <div
                          key={String(promotion.promotion_id)}
                          className="flex justify-between gap-3"
                        >
                          <span className="truncate">
                            {promotion.promotion_name}
                          </span>
                          <span className="shrink-0">
                            -{formatBaht(Number(promotion.discount_amount) || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {promotionError ? (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      {promotionError}
                    </p>
                  ) : null}
                  <div className="flex justify-between text-lg font-bold text-slate-900">
                    <span>รวมทั้งหมด</span>
                    <span>{promotionLoading ? "..." : formatBaht(total)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openHoldBillModal}
                  disabled={!cart.length}
                  className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40 [@media(max-height:720px)]:mt-3 [@media(max-height:720px)]:h-10"
                >
                  <IconFolderOpen size={18} />
                  พักบิล
                </button>

                  <button
                    type="button"
                  onClick={() => setCurrentPage("posPayment")}
                    disabled={!cart.length}
                  className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1d6fd8] font-bold text-white transition hover:bg-[#1557ad] disabled:cursor-not-allowed disabled:opacity-40 [@media(max-height:720px)]:h-10"
                >
                  <IconCreditCard size={18} />
                  ชำระเงิน
                </button>
              </div>
            </aside>
          </main>
        )}

        {posToast ? (
          <div className="fixed bottom-5 right-5 z-[95] rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-xl">
            {posToast}
          </div>
        ) : null}

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

        {showHeldBillsModal ? (
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"
            onClick={closeHeldBillsModal}
          >
            <div
              className="flex max-h-[82vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="held-bills-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                    <IconFolderOpen size={20} />
                  </div>
                  <div>
                    <h3 id="held-bills-title" className="text-xl font-bold text-slate-900">
                      เปิดบิลที่พัก
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      เลือกบิลพักเพื่อแทนที่รายการในตะกร้าปัจจุบัน
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeHeldBillsModal}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="ปิด"
                >
                  <IconX size={20} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {heldBillsError ? (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {heldBillsError}
                  </div>
                ) : null}

                {isLoadingHeldBills ? (
                  <div className="grid min-h-40 place-items-center text-sm font-medium text-slate-500">
                    กำลังโหลดบิลพัก...
                  </div>
                ) : heldBills.length ? (
                  <div className="space-y-3">
                    {heldBills.map((bill) => {
                      const isOpening = openingHeldBillId === bill.id;

                      return (
                        <button
                          key={String(bill.id)}
                          type="button"
                          onClick={() => void openHeldBill(bill)}
                          disabled={openingHeldBillId !== null}
                          className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-amber-300 hover:bg-amber-50/60 disabled:cursor-wait disabled:opacity-60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-bold text-slate-900">
                                {bill.hold_name || "บิลพัก"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {bill.hold_no || "-"} · {formatHeldBillDate(bill.created_at)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-slate-900">
                                {formatBaht(Number(bill.total_amount) || 0)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {Number(bill.item_count) || 0} รายการ / {Number(bill.total_qty) || 0} ชิ้น
                              </p>
                            </div>
                          </div>
                          {isOpening ? (
                            <p className="mt-2 text-sm font-semibold text-amber-700">
                              กำลังเปิดบิล...
                            </p>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-400">
                    ยังไม่มีบิลพัก
                  </div>
                )}
              </div>

              <div className="flex gap-3 border-t border-slate-100 p-5">
                <button
                  type="button"
                  onClick={() => void fetchHeldBillList()}
                  disabled={isLoadingHeldBills || openingHeldBillId !== null}
                  className="h-11 flex-1 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  โหลดใหม่
                </button>
                <button
                  type="button"
                  onClick={closeHeldBillsModal}
                  className="h-11 flex-1 rounded-xl bg-slate-900 font-semibold text-white hover:bg-slate-800"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showHoldBillModal ? (
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"
            onClick={closeHoldBillModal}
          >
            <form
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
              onSubmit={(event) => {
                event.preventDefault();
                void submitHoldBill();
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                    <IconFolderOpen size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">พักบิล</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      ตั้งชื่อเพื่อจำบิลนี้ได้ง่ายขึ้น
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeHoldBillModal}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="ปิด"
                >
                  <IconX size={20} />
                </button>
              </div>

              <label className="mt-5 block text-sm font-medium text-slate-700">
                ชื่อบิลพัก
              </label>
              <input
                ref={holdBillNameRef}
                value={holdBillName}
                onChange={(event) => setHoldBillName(event.target.value)}
                placeholder="ลูกค้ารอโอน, โต๊ะ 3"
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-lg font-semibold text-slate-900 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
              />

              {holdBillError ? (
                <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {holdBillError}
                </p>
              ) : null}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={closeHoldBillModal}
                  disabled={isHoldingBill}
                  className="h-11 flex-1 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isHoldingBill || !cart.length}
                  className="h-11 flex-1 rounded-xl bg-amber-500 font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isHoldingBill ? "กำลังพักบิล..." : "ยืนยัน"}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {showCustomerPopup ? (
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"
            onClick={closeCustomerPopup}
          >
            <div
              className="flex max-h-[82vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="customer-picker-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#1d6fd8]">
                    <IconUserPlus size={20} />
                  </div>
                  <div>
                    <h3
                      id="customer-picker-title"
                      className="text-xl font-bold text-slate-900"
                    >
                      เลือกลูกค้า
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      ค้นหาแล้วเลือกลูกค้าสำหรับบิลนี้
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeCustomerPopup}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="ปิด"
                >
                  <IconX size={20} />
                </button>
              </div>

              <div className="border-b border-slate-100 p-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <IconSearch
                      size={16}
                      className="pointer-events-none absolute inset-y-0 left-3 my-auto text-slate-400"
                    />
                    <input
                      ref={customerSearchRef}
                      type="text"
                      value={customerSearchQuery}
                      onChange={(event) =>
                        setCustomerSearchQuery(event.target.value)
                      }
                      placeholder="ค้นหาชื่อ / รหัส / เบอร์โทร"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void fetchCustomerList()}
                    disabled={isLoadingCustomers}
                    title="โหลดข้อมูลใหม่"
                    aria-label="โหลดข้อมูลลูกค้าใหม่"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-[#1d6fd8] hover:text-[#1d6fd8] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IconRefresh size={18} />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {isLoadingCustomers ? (
                  <div className="grid h-40 place-items-center text-sm text-slate-400">
                    กำลังโหลดข้อมูลลูกค้า...
                  </div>
                ) : customerLoadError ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
                    <p className="text-sm text-red-500">{customerLoadError}</p>
                    <button
                      type="button"
                      onClick={() => void fetchCustomerList()}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <IconRefresh size={16} />
                      ลองอีกครั้ง
                    </button>
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="grid h-40 place-items-center text-center text-sm text-slate-400">
                    ไม่พบลูกค้า
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredCustomers.map((customer) => {
                      const isSelected = selectedCustomer?.id === customer.id;

                      return (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => selectCustomer(customer)}
                          className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                            isSelected
                              ? "border-[#1d6fd8] bg-blue-50"
                              : "border-slate-200 hover:border-[#4d9bf0] hover:bg-blue-50/50"
                          }`}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1d6fd8]">
                            <IconUser size={20} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-bold text-slate-900">
                                {getCustomerName(customer)}
                              </p>
                              {customer.customer_code ? (
                                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                                  {customer.customer_code}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-500">
                              <IconPhone size={13} className="shrink-0" />
                              <span className="truncate">
                                {getCustomerPhone(customer)}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
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
                  onClick={closeScanInput}
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
                  onClick={closeScanInput}
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

        {/* Discount Popup */}
        {discountPopupItemName && discountPopupItem ? (
          <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4">
            <form
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
              onSubmit={(event) => {
                event.preventDefault();
                confirmDiscountPopup();
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#1d6fd8]">
                    <IconDiscount size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      ใส่ส่วนลด
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {discountPopupItem.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDiscountPopup}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="ปิด"
                >
                  <IconX size={20} />
                </button>
              </div>

              <p className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700">
                ยอดรวมรายการ{" "}
                {formatBaht(discountPopupItem.price * discountPopupItem.qty)}
              </p>

              <label className="mt-4 block text-sm font-medium text-slate-700">
                ส่วนลดรายการนี้ (บาท)
              </label>
              <input
                ref={discountInputRef}
                type="number"
                min="0"
                max={discountPopupItem.price * discountPopupItem.qty}
                step="0.01"
                inputMode="decimal"
                value={discountInputValue}
                onChange={(event) => setDiscountInputValue(event.target.value)}
                placeholder="0.00"
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-lg font-semibold text-slate-900 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
              />

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={closeDiscountPopup}
                  className="h-11 flex-1 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="h-11 flex-1 rounded-xl bg-[#1d6fd8] font-semibold text-white hover:bg-[#1557ad]"
                >
                  บันทึกส่วนลด
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
                  <span className="font-bold text-slate-900">F2</span> เปิดรายการพักบิล / พักบิล
                </p>
                <p>
                  <span className="font-bold text-slate-900">F3</span> เลือกลูกค้า
                </p>
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
                  <span className="font-bold text-slate-900">F8</span> ใส่ส่วนลดรายการที่เลือก
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
