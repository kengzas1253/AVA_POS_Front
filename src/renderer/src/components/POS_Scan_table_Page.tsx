import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  IconFolderOpen,
  IconKeyboard,
  IconMenu2,
  IconMinus,
  IconPencil,
  IconPlus,
  IconPower,
  IconQrcode,
  IconStar,
  IconTrash,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import Categories from "./Categories";
import Customer from "./Customer";
import CustomerPickerPopup, {
  getCustomerName,
  getCustomerPhone,
  type PosCustomer,
} from "./CustomerPickerPopup";
import HeldBillsPopup, { type HeldBillSummary } from "./HeldBillsPopup";
import KeyboardShortcutsPopup from "./KeyboardShortcutsPopup";
import POSPayment from "./POSPayment";
import DiscountPopup from "./DiscountPopup";
import POSSettingPage from "./POSSettingPage";
import ProductLandingpage from "./ProductLandingpage";
import PrintBarcode from "./PrintBarcode";
import PrinterSetting from "./PrinterSetting";
import PromotionPage from "./PromotionPage";
import QuotationPage from "./QuotationPage";
import ReceiptPage from "./ReceiptPage";
import { RegisterPage } from "./RegisterPage";
import FavoriteGroups, {
  getFavoriteGroupIcon,
  getFavoriteGroupName,
  type FavoriteGroup,
} from "./FavoriteGroups";
import FavoriteItems, {
  AllProducts,
  type FavoriteProduct,
} from "./FavoriteItems";
import Sidebar from "./Sidebar";
import SidebarProduct from "./SidebarProduct";
import Settingbar from "./Settingbar";
import SettingPages from "./SettingPages";
import StockPage from "./StockPage";
import { UserInfoPage } from "./UserInfoPage";
import { checkDiscount } from "./posDiscountService";
import {
  normalizeBarcode,
  normalizeBarcodeScannerKey,
} from "./BarcodeNormalizer";
import { ensureValidAccessToken, refreshAccessToken } from "./auth";
import { usePosScanSound } from "./usePosScanSound";
import {
  calculateAutoPackCart,
  SELECTED_POS_CUSTOMER_KEY,
} from "./autoPackPricingService";

interface CustomersResponse {
  data?: PosCustomer[] | { customers?: PosCustomer[]; data?: PosCustomer[] };
  customers?: PosCustomer[];
  message?: string;
}

interface ScannedProduct {
  id?: number | string;
  productId?: number | string;
  product_id?: number | string;
  productUnitId?: number | string;
  product_unit_id?: number | string;
  productUnit?: { id?: number | string; productUnitId?: number | string };
  product_unit?: { id?: number | string; product_unit_id?: number | string };
  sku?: string | null;
  barcode: string;
  name?: string;
  productName?: string;
  product_name?: string;
  sale_price?: number;
  salePrice?: number;
  price_per_unit?: number;
  unit?: string;
  unitCode?: string;
  unit_code?: string;
  unitNameTh?: string | null;
  unit_name_th?: string | null;
  unitName?: string | null;
  unit_name?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  allow_discount?: boolean | number | string | null;
  allowDiscount?: boolean | number | string | null;
}

interface ScanProductResponse {
  success: boolean;
  code?: string;
  message?: string;
  product?: ScannedProduct;
}

interface ProductsSearchResponse {
  data?: ScannedProduct[] | { data?: ScannedProduct[]; items?: ScannedProduct[] };
  items?: ScannedProduct[];
  products?: ScannedProduct[];
  message?: string;
}

type RawScanProductResponse =
  | ScanProductResponse
  | (ScannedProduct & { success?: boolean; code?: string; message?: string });

interface ScanCartItem {
  id: string;
  productId: number | string;
  productUnitId: number | string | null;
  barcode: string;
  name: string;
  unit?: string;
  unit_code?: string | null;
  unitNameTh?: string | null;
  unit_name_th?: string | null;
  unitName?: string | null;
  unit_name?: string | null;
  qty: number;
  price: number;
  image_url?: string | null;
  allow_discount: boolean;
  discount: number;
  discount_amount: number;
}

interface HeldBillItem {
  id?: number | string;
  product_id?: number | string | null;
  barcode?: string | null;
  product_name?: string | null;
  name?: string | null;
  unit_code?: string | null;
  qty?: number | string | null;
  sale_price?: number | string | null;
  unit_price?: number | string | null;
  discount_amount?: number | string | null;
  allow_discount?: boolean | number | string | null;
  allowDiscount?: boolean | number | string | null;
}

interface HeldBillDetail extends HeldBillSummary {
  items?: HeldBillItem[];
  held_bill_items?: HeldBillItem[];
  customer_id?: string | null;
}

interface HeldBillsResponse {
  data?: HeldBillSummary[] | { data?: HeldBillSummary[]; held_bills?: HeldBillSummary[] };
  held_bills?: HeldBillSummary[];
  message?: string;
}

interface HeldBillDetailResponse {
  data?: HeldBillDetail;
  held_bill?: HeldBillDetail;
  message?: string;
}

interface StoreSettings {
  store_name?: string;
}

interface StoreSettingsResponse {
  data?: { store?: StoreSettings };
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

const BARCODE_INPUT_TIMEOUT_MS = 300;
const BARCODE_NOT_FOUND_MESSAGE = "ไม่พบบาร์โค้ดสินค้า";
const BARCODE_SCAN_FAILED_MESSAGE =
  "ไม่สามารถตรวจสอบบาร์โค้ดได้ กรุณาลองใหม่อีกครั้ง";

const getStoredMachineId = (storedDevice: unknown): string | null => {
  if (!storedDevice || typeof storedDevice !== "object") return null;

  const device = storedDevice as {
    machine_id?: unknown;
    pos_device?: { machine_id?: unknown };
  };
  const machineId = device.machine_id ?? device.pos_device?.machine_id;

  return typeof machineId === "string" && machineId.trim()
    ? machineId.trim()
    : null;
};

const getStoredAllowBelowCost = (storedDevice: unknown): boolean => {
  if (!storedDevice || typeof storedDevice !== "object") {
    return false;
  }

  const device = storedDevice as {
    allow_below_cost?: unknown;
    allowBelowCost?: unknown;
    pos_device?: {
      allow_below_cost?: unknown;
      allowBelowCost?: unknown;
    };
  };

  const value =
    device.allow_below_cost ??
    device.allowBelowCost ??
    device.pos_device?.allow_below_cost ??
    device.pos_device?.allowBelowCost;

  return value === true || value === "true";
};

const getDiscountErrorMessage = (message?: string): string => {
  if (message === "This discount exceeds the allowed limit.") {
    return "ส่วนลดนี้เกินวงเงินที่อนุญาต";
  }

  if (message === "Unable to validate the discount. Please try again.") {
    return "ไม่สามารถตรวจสอบส่วนลดได้ กรุณาลองใหม่อีกครั้ง";
  }

  if (
    message ===
    "Unable to validate the discount because POS device information is missing."
  ) {
    return "ไม่สามารถตรวจสอบส่วนลดได้ เนื่องจากไม่พบข้อมูลเครื่อง POS";
  }

  if (message && !message.includes("à")) {
    return message;
  }

  return "ไม่สามารถตรวจสอบส่วนลดได้ กรุณาลองใหม่อีกครั้ง";
};

const normalizeAllowDiscount = (
  value: boolean | number | string | null | undefined,
  fallback = true,
): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();
    if (["false", "0", "no", "n"].includes(normalizedValue)) return false;
    if (["true", "1", "yes", "y"].includes(normalizedValue)) return true;
  }

  return fallback;
};

const getAllowDiscount = (
  product: {
    allow_discount?: boolean | number | string | null;
    allowDiscount?: boolean | number | string | null;
  },
  fallback = true,
): boolean =>
  normalizeAllowDiscount(product.allow_discount ?? product.allowDiscount, fallback);

const getStoredUserId = (storedUser: unknown): string | null => {
  if (!storedUser || typeof storedUser !== "object") return null;

  const user = storedUser as { user_id?: unknown; id?: unknown };
  const userId = user.user_id ?? user.id;
  return typeof userId === "string" && userId.trim()
    ? userId.trim()
    : typeof userId === "number" && Number.isFinite(userId)
      ? String(userId)
      : null;
};

const getUserIdFromAccessToken = (accessToken: unknown): string | null => {
  if (typeof accessToken !== "string" || !accessToken.trim()) return null;

  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;

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

const isScannedProductPayload = (
  payload: RawScanProductResponse,
): payload is ScannedProduct & {
  success?: boolean;
  code?: string;
  message?: string;
} =>
  "productId" in payload ||
  "productUnitId" in payload ||
  "product_id" in payload ||
  "product_unit_id" in payload ||
  "id" in payload;

const normalizeScanProductResponse = (
  payload: RawScanProductResponse,
): ScanProductResponse => {
  if ("product" in payload) return payload;

  if (isScannedProductPayload(payload)) {
    return {
      success: payload.success ?? true,
      code: payload.code,
      message: payload.message,
      product: payload,
    };
  }

  return {
    success: payload.success ?? false,
    code: payload.code,
    message: payload.message,
  };
};

const unwrapProductsSearchResponse = (
  payload: ProductsSearchResponse | ScannedProduct[],
): ScannedProduct[] => {
  if (Array.isArray(payload)) return payload;

  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && typeof payload.data === "object") {
    if (Array.isArray(payload.data.data)) return payload.data.data;
    if (Array.isArray(payload.data.items)) return payload.data.items;
  }
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.products)) return payload.products;

  return [];
};

const getScannedProductId = (product: ScannedProduct): number | string =>
  product.productId ?? product.product_id ?? product.id ?? "";

const getScannedProductUnitId = (
  product: ScannedProduct,
): number | string | null =>
  product.productUnitId ??
  product.product_unit_id ??
  product.productUnit?.productUnitId ??
  product.productUnit?.id ??
  product.product_unit?.product_unit_id ??
  product.product_unit?.id ??
  null;

const getScannedProductName = (product: ScannedProduct): string =>
  product.productName ?? product.product_name ?? product.name ?? "-";

const getScannedProductPrice = (product: ScannedProduct): number =>
  Number(product.salePrice ?? product.sale_price ?? product.price_per_unit ?? 0) ||
  0;

const getScannedProductUnitCode = (product: ScannedProduct): string | undefined =>
  product.unitCode ?? product.unit_code ?? product.unit;

const getScannedProductUnitName = (product: ScannedProduct): string | null =>
  product.unitNameTh ??
  product.unit_name_th ??
  product.unitName ??
  product.unit_name ??
  null;

const getScannedProductImageUrl = (product: ScannedProduct): string | null =>
  product.image_url ?? product.imageUrl ?? null;

const mapFavoriteProductToScannedProduct = (
  product: FavoriteProduct,
): ScannedProduct => ({
  id: product.productId ?? product.product_id ?? product.id,
  productId: product.productId ?? product.product_id ?? product.id,
  product_id: product.product_id,
  productUnitId: product.productUnitId ?? product.product_unit_id ?? undefined,
  product_unit_id: product.product_unit_id ?? undefined,
  sku: product.sku ?? null,
  barcode: String(product.barcode ?? "").trim(),
  name: product.productName ?? product.product_name,
  productName: product.productName ?? product.product_name,
  product_name: product.product_name,
  sale_price: Number(product.salePrice ?? product.sale_price ?? 0) || 0,
  salePrice: Number(product.salePrice ?? product.sale_price ?? 0) || 0,
  unit: product.unitCode ?? product.unit_code,
  unitCode: product.unitCode ?? product.unit_code,
  unit_code: product.unit_code,
  unitNameTh: product.unitNameTh ?? product.unit_name_th ?? null,
  unit_name_th: product.unit_name_th ?? product.unitNameTh ?? null,
  unitName: product.unitNameTh ?? product.unit_name_th ?? null,
  unit_name: product.unit_name_th ?? product.unitNameTh ?? null,
  image_url: product.image_url ?? null,
  allow_discount: normalizeAllowDiscount(
    product.allow_discount as boolean | number | string | null | undefined,
  ),
  allowDiscount: normalizeAllowDiscount(
    product.allowDiscount as boolean | number | string | null | undefined,
  ),
});

const isBarcodeSearchKeyword = (keyword: string): boolean => {
  const normalizedKeyword = normalizeBarcode(keyword);
  const digitCount = normalizedKeyword.replace(/\D/g, "").length;
  return digitCount >= 6 && /^[A-Z0-9-]+$/.test(normalizedKeyword);
};

const isIncreaseQtyKey = (event: KeyboardEvent): boolean =>
  event.key === "+" || event.key === "=" || event.code === "NumpadAdd";

const isDecreaseQtyKey = (event: KeyboardEvent): boolean =>
  event.key === "-" || event.key === "_" || event.code === "NumpadSubtract";

const isValidEan13 = (barcode: string): boolean => {
  if (!/^\d{13}$/.test(barcode)) return false;

  const sum = barcode
    .slice(0, 12)
    .split("")
    .reduce(
      (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
      0,
    );
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(barcode[12]);
};

const getEan13RepairCandidates = (barcode: string): string[] => {
  if (!/^\d{12}$/.test(barcode)) return [];

  const candidates = new Set<string>();
  for (let position = barcode.length - 1; position >= 0; position -= 1) {
    for (let digit = 0; digit <= 9; digit += 1) {
      const candidate =
        barcode.slice(0, position) + String(digit) + barcode.slice(position);
      if (isValidEan13(candidate)) {
        candidates.add(candidate);
      }
    }
  }

  return Array.from(candidates);
};

const getScannerDigitFromKeyEvent = (
  event: ReactKeyboardEvent<HTMLInputElement>,
): string | null => {
  if (/^Digit\d$/.test(event.code)) {
    return event.code.replace("Digit", "");
  }

  if (/^Numpad\d$/.test(event.code)) {
    return event.code.replace("Numpad", "");
  }

  return null;
};

const getApiBaseUrl = async (): Promise<string> => {
  const apiPath = await window.electronStore.get("apiPath");
  if (typeof apiPath !== "string" || !apiPath.trim()) {
    throw new Error("ไม่พบ API endpoint ใน store");
  }

  return apiPath.trim().replace(/\/+$/, "");
};

const resolveImageUrl = async (imageUrl?: string | null): Promise<string | null> => {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;

  try {
    const apiBaseUrl = await getApiBaseUrl();
    return `${apiBaseUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
  } catch {
    return imageUrl;
  }
};

const authorizedApiFetch = async (
  path: string,
  init: RequestInit = {},
): Promise<Response> => {
  if (!(await ensureValidAccessToken())) {
    throw new Error("ไม่สามารถยืนยันตัวตนได้ กรุณาเข้าสู่ระบบใหม่");
  }

  const baseUrl = await getApiBaseUrl();
  let accessToken = await window.electronStore.get("access_token");
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw new Error("ไม่พบ access token");
  }

  const request = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });
  };

  let response = await request(accessToken);
  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    response = await request(accessToken);
  }

  return response;
};

const unwrapHeldBills = (
  payload: HeldBillsResponse | HeldBillSummary[],
): HeldBillSummary[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.held_bills)) return payload.held_bills;
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && !Array.isArray(payload.data)) {
    if (Array.isArray(payload.data.held_bills)) return payload.data.held_bills;
    if (Array.isArray(payload.data.data)) return payload.data.data;
  }

  return [];
};

const loadHeldBills = async (): Promise<HeldBillSummary[]> => {
  const response = await authorizedApiFetch("/held-bills");
  const data = (await response.json().catch(() => ({}))) as
    | HeldBillsResponse
    | HeldBillSummary[];

  if (!response.ok) {
    const message =
      !Array.isArray(data) && typeof data.message === "string"
        ? data.message
        : "";
    throw new Error(
      message || `โหลดรายการบิลพักไม่สำเร็จ (${response.status})`,
    );
  }

  return unwrapHeldBills(data);
};

const loadHeldBillDetail = async (
  id: HeldBillSummary["id"],
): Promise<HeldBillDetail> => {
  const response = await authorizedApiFetch(
    `/held-bills/${encodeURIComponent(id)}`,
  );
  const data = (await response.json().catch(() => ({}))) as
    | HeldBillDetail
    | HeldBillDetailResponse;

  if (!response.ok) {
    const message =
      "message" in data && typeof data.message === "string" ? data.message : "";
    throw new Error(
      message || `โหลดรายละเอียดบิลพักไม่สำเร็จ (${response.status})`,
    );
  }

  if ("held_bill" in data && data.held_bill) return data.held_bill;
  if ("data" in data && data.data) return data.data;

  return data as HeldBillDetail;
};

const createHeldBill = async (payload: HeldBillPayload): Promise<void> => {
  const response = await authorizedApiFetch("/held-bills", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(data.message || `พักบิลไม่สำเร็จ (${response.status})`);
  }
};

const mapHeldBillItemToScanItem = (
  item: HeldBillItem,
  index: number,
): ScanCartItem => {
  const productId = item.product_id ?? item.id ?? `held-${index}`;
  const barcode = item.barcode?.trim() || `NO-BARCODE-${productId}`;
  const qty = Number(item.qty) || 0;
  const price = Number(item.unit_price ?? item.sale_price ?? 0) || 0;

  return {
    id: `${productId}-${barcode}-${index}`,
    productId,
    productUnitId: null,
    barcode,
    name: item.product_name ?? item.name ?? "-",
    unit: item.unit_code ?? undefined,
    qty,
    price,
    allow_discount: getAllowDiscount(item),
    discount: Number(item.discount_amount ?? 0) || 0,
    discount_amount: Number(item.discount_amount ?? 0) || 0,
  };
};

const getHeldBillErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

const formatHeldBillDate = (value?: string | null): string => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  });
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

const scanProduct = async (barcode: string): Promise<ScanProductResponse> => {
  const normalizedBarcode = String(barcode ?? "").trim();
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
        barcode: normalizedBarcode,
        machine_id: machineId,
      }),
    });

  let response = await request(accessToken);
  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    response = await request(accessToken);
  }

  const data = (await response.json().catch(() => ({}))) as RawScanProductResponse;
  if (!response.ok) {
    if (response.status === 404 || data.code === "PRODUCT_NOT_FOUND") {
      return {
        success: false,
        code: "PRODUCT_NOT_FOUND",
        message: data.message,
      };
    }

    throw new Error(data.message || `สแกนสินค้าไม่สำเร็จ (${response.status})`);
  }

  return normalizeScanProductResponse(data);
};

const searchProducts = async (keyword: string): Promise<ScannedProduct[]> => {
  const trimmedKeyword = keyword.trim();
  if (!trimmedKeyword) return [];

  const response = await authorizedApiFetch(
    `/products?page=1&limit=50&search=${encodeURIComponent(trimmedKeyword)}`,
  );
  const data = (await response.json().catch(() => ({}))) as ProductsSearchResponse;

  if (!response.ok) {
    throw new Error(data.message || `Search products failed (${response.status})`);
  }

  return unwrapProductsSearchResponse(data);
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

  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.customers)) return data.customers;
  if (data.data && !Array.isArray(data.data)) {
    if (Array.isArray(data.data.customers)) return data.data.customers;
    if (Array.isArray(data.data.data)) return data.data.data;
  }

  return [];
};

export default function POSScanTablePage() {
  const [activeTab, setActiveTab] = useState("all-products");
  const [isAllProductsPopupOpen, setIsAllProductsPopupOpen] = useState(false);
  const [favoritePopupGroupId, setFavoritePopupGroupId] = useState<
    FavoriteGroup["id"] | null
  >(null);
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState("pos");
  const [isBarcodeScannerEnabled, setIsBarcodeScannerEnabled] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<PosCustomer | null>(
    null,
  );
  const [showCustomerPopup, setShowCustomerPopup] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showHeldBillsModal, setShowHeldBillsModal] = useState(false);
  const [showHoldBillModal, setShowHoldBillModal] = useState(false);
  const [clearConfirmSelection, setClearConfirmSelection] = useState<
    "cancel" | "confirm"
  >("confirm");
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [customerLoadError, setCustomerLoadError] = useState<string | null>(null);
  const [heldBills, setHeldBills] = useState<HeldBillSummary[]>([]);
  const [isLoadingHeldBills, setIsLoadingHeldBills] = useState(false);
  const [heldBillsError, setHeldBillsError] = useState<string | null>(null);
  const [openingHeldBillId, setOpeningHeldBillId] = useState<
    HeldBillSummary["id"] | null
  >(null);
  const [holdBillName, setHoldBillName] = useState("");
  const [isHoldingBill, setIsHoldingBill] = useState(false);
  const [holdBillError, setHoldBillError] = useState<string | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [searchResults, setSearchResults] = useState<ScannedProduct[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [scanItems, setScanItems] = useState<ScanCartItem[]>([]);
  const [scanItemImageUrls, setScanItemImageUrls] = useState<Record<string, string>>({});
  const [discountPopupItemId, setDiscountPopupItemId] = useState<string | null>(null);
  const [discountInputValue, setDiscountInputValue] = useState("");
  const [discountPopupError, setDiscountPopupError] = useState<string | null>(null);
  const [isCheckingDiscount, setIsCheckingDiscount] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    store_name: "AVA MY POS",
  });
  const [selectedScanItemId, setSelectedScanItemId] = useState<string | null>(
    null,
  );
  const [isScanningProduct, setIsScanningProduct] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const sourceScanItemsRef = useRef<ScanCartItem[]>([]);
  const barcodeBufferRef = useRef("");
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const isScanningRef = useRef(false);
  const pendingBarcodeScanQueueRef = useRef<string[]>([]);
  const holdBillNameRef = useRef<HTMLInputElement>(null);
  const clearConfirmSelectionRef = useRef<"cancel" | "confirm">("confirm");
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const { playFirstProductScan, playNoProductsFound } = usePosScanSound();

  const isProductPage = [
    "productList",
    "categories",
    "printBarcode",
    "productStocks",
    "priceQuotation",
    "promotion",
  ].includes(currentPage);

  const focusScannerInput = useCallback((delay = 0) => {
    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        scannerInputRef.current?.focus({ preventScroll: true });
        scannerInputRef.current?.select();
      });
    }, delay);
  }, []);

  const clearBarcodeBuffer = useCallback(() => {
    barcodeBufferRef.current = "";
    setBarcodeBuffer("");
    if (barcodeTimerRef.current) {
      clearTimeout(barcodeTimerRef.current);
      barcodeTimerRef.current = null;
    }
  }, []);

  const isSettingPage = [
    "settings",
    "tax",
    "printer",
    "receipt",
    "payment",
    "posSetting",
    "userInfo",
    "employees",
    "storeInfo",
  ].includes(currentPage);

  const filteredCustomers = useMemo(() => {
    const keyword = customerSearchQuery.trim().toLowerCase();
    if (!keyword) return customers;

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
  const favoritePopupGroup =
    favoritePopupGroupId == null
      ? null
      : favoriteGroups.find(
          (group) => String(group.id) === String(favoritePopupGroupId),
        ) ?? null;

  const closeFavoritePopup = useCallback(() => {
    setFavoritePopupGroupId(null);
    setActiveTab("all-products");
    focusScannerInput();
  }, [focusScannerInput]);
  const closeAllProductsPopup = useCallback(() => {
    setIsAllProductsPopupOpen(false);
    setActiveTab("all-products");
    focusScannerInput();
  }, [focusScannerInput]);

  const itemCount = scanItems.length;
  const totalQty = scanItems.reduce((sum, item) => sum + item.qty, 0);
  const subTotal = scanItems.reduce(
    (sum, item) => sum + item.price * item.qty,
    0,
  );
  const discountAmount = scanItems.reduce(
    (sum, item) => sum + Math.max(Number(item.discount ?? item.discount_amount ?? 0) || 0, 0),
    0,
  );
  const totalAmount = Math.max(subTotal - discountAmount, 0);
  const discountPopupItem = discountPopupItemId
    ? scanItems.find((item) => item.id === discountPopupItemId) ?? null
    : null;
  const displayStoreName = storeSettings.store_name?.trim() || "AVA MY POS";

  const commitScanItemsChange = async (
    nextSourceItems: ScanCartItem[],
    selectedItemId?: string | null,
  ) => {
    sourceScanItemsRef.current = nextSourceItems;

    try {
      const autoPackResult = await calculateAutoPackCart(nextSourceItems);
      setStoreSettings((current) => ({
        ...current,
        ...autoPackResult.settings,
      }));
      setScanItems(autoPackResult.items);
      setSelectedScanItemId(
        selectedItemId ??
          autoPackResult.items.at(-1)?.id ??
          nextSourceItems.at(-1)?.id ??
          null,
      );
    } catch (error) {
      console.error("Calculate scan-only auto pack pricing error:", error);
      setScanItems(nextSourceItems);
      setSelectedScanItemId(selectedItemId ?? nextSourceItems.at(-1)?.id ?? null);
      setScanMessage(
        error instanceof Error && error.message
          ? error.message
          : "ไม่สามารถคำนวณราคาแพ็คได้",
      );
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const resolveScanItemImages = async () => {
      const entries = await Promise.all(
        scanItems.map(async (item) => {
          const url = await resolveImageUrl(item.image_url);
          return [item.id, url] as const;
        }),
      );

      if (isCancelled) return;

      const nextUrls: Record<string, string> = {};
      entries.forEach(([id, url]) => {
        if (url) nextUrls[id] = url;
      });
      setScanItemImageUrls(nextUrls);
    };

    void resolveScanItemImages();

    return () => {
      isCancelled = true;
    };
  }, [scanItems]);

  const addScannedProductToTable = async (product: ScannedProduct) => {
    const productId = getScannedProductId(product);
    const productUnitId = getScannedProductUnitId(product);
    const barcode = String(product.barcode ?? "").trim();
    const imageUrl = getScannedProductImageUrl(product);
    const nextItemId = `${productUnitId ?? productId}-${barcode}`;
    const items = sourceScanItemsRef.current;

    const existingIndex = items.findIndex((item) => {
      if (item.productUnitId != null && productUnitId != null) {
        return String(item.productUnitId) === String(productUnitId);
      }

      return (
        String(item.productId) === String(productId) &&
        String(item.barcode) === barcode
      );
    });

    const nextItems =
      existingIndex >= 0
        ? items.map((item, index) =>
            index === existingIndex
              ? { ...item, image_url: item.image_url ?? imageUrl, qty: item.qty + 1 }
              : item,
          )
        : [
            ...items,
            {
              id: nextItemId,
              productId,
              productUnitId,
              barcode,
              name: getScannedProductName(product),
              unit: getScannedProductUnitCode(product),
              unit_code: getScannedProductUnitCode(product) ?? null,
              unitNameTh: getScannedProductUnitName(product),
              unitName: getScannedProductUnitName(product),
              qty: 1,
              price: getScannedProductPrice(product),
              image_url: imageUrl,
              allow_discount: getAllowDiscount(product),
              discount: 0,
              discount_amount: 0,
            },
          ];

    await commitScanItemsChange(
      nextItems,
      existingIndex >= 0 ? items[existingIndex].id : nextItemId,
    );
  };

  const selectSearchedProduct = async (product: ScannedProduct) => {
    const isFirstProductScan = scanItems.length === 0;
    await addScannedProductToTable(product);
    if (isFirstProductScan) {
      playFirstProductScan();
    }
    setBarcodeInput("");
    setBarcodeBuffer("");
    setSearchResults([]);
    setScanMessage(null);
    focusScannerInput();
  };

  const addFavoriteProduct = (product: FavoriteProduct) => {
    void selectSearchedProduct(mapFavoriteProductToScannedProduct(product));
  };

  const updateItemQty = (itemId: string, delta: number) => {
    const displayItem = scanItems.find((item) => item.id === itemId);
    const sourceItemId =
      sourceScanItemsRef.current.find((item) => item.id === itemId)?.id ??
      sourceScanItemsRef.current.find(
        (item) =>
          displayItem &&
          String(item.productId) === String(displayItem.productId),
      )?.id ??
      itemId;
    const nextItems = sourceScanItemsRef.current
      .map((item) =>
        item.id === sourceItemId
          ? {
              ...item,
              qty: Math.max(0, item.qty + delta),
              discount: Math.min(
                item.discount || 0,
                item.price * Math.max(0, item.qty + delta),
              ),
              discount_amount: Math.min(
                item.discount_amount || 0,
                item.price * Math.max(0, item.qty + delta),
              ),
            }
          : item,
      )
      .filter((item) => item.qty > 0);
    void commitScanItemsChange(
      nextItems,
      nextItems.some((item) => item.id === sourceItemId)
        ? sourceItemId
        : nextItems.at(-1)?.id ?? null,
    );
  };

  const removeItem = (itemId: string) => {
    const displayItem = scanItems.find((item) => item.id === itemId);
    const sourceItemId =
      sourceScanItemsRef.current.find((item) => item.id === itemId)?.id ??
      sourceScanItemsRef.current.find(
        (item) =>
          displayItem &&
          String(item.productId) === String(displayItem.productId),
      )?.id ??
      itemId;
    const nextItems = sourceScanItemsRef.current.filter(
      (item) => item.id !== sourceItemId,
    );
    void commitScanItemsChange(nextItems, nextItems.at(-1)?.id ?? null);
  };

  const clearAllItems = () => {
    sourceScanItemsRef.current = [];
    setScanItems([]);
    setSelectedScanItemId(null);
    setScanMessage(null);
    setShowClearConfirm(false);
    focusScannerInput();
  };

  const getActiveScanItemId = () =>
    selectedScanItemId && scanItems.some((item) => item.id === selectedScanItemId)
      ? selectedScanItemId
      : scanItems.at(-1)?.id ?? null;

  const updateSelectedItemQty = (delta: number) => {
    const itemId = getActiveScanItemId();
    if (!itemId) return;
    setSelectedScanItemId(itemId);
    updateItemQty(itemId, delta);
  };

  const removeSelectedItem = () => {
    const itemId = getActiveScanItemId();
    if (!itemId) return;
    removeItem(itemId);
  };

  const changeItemDiscount = (itemId: string, discount: number) => {
    setScanItems((items) =>
      items.map((item) => {
        if (item.id !== itemId || !item.allow_discount) {
          return item;
        }

        const lineTotal = item.price * item.qty;
        const nextDiscount = Math.min(Math.max(discount, 0), lineTotal);
        return {
          ...item,
          discount: nextDiscount,
          discount_amount: nextDiscount,
        };
      }),
    );
  };

  const openDiscountPopup = (itemId: string) => {
    const item = scanItems.find((scanItem) => scanItem.id === itemId);
    if (!item || !item.allow_discount) return;

    setSelectedScanItemId(itemId);
    setDiscountPopupItemId(itemId);
    setDiscountInputValue(item.discount ? String(item.discount) : "");
    setDiscountPopupError(null);
  };

  const closeDiscountPopup = () => {
    if (isCheckingDiscount) return;

    setDiscountPopupItemId(null);
    setDiscountInputValue("");
    setDiscountPopupError(null);
    focusScannerInput();
  };

  const confirmDiscountPopup = async () => {
    if (!discountPopupItemId || isCheckingDiscount) return;

    setDiscountPopupError(null);

    const currentItem = scanItems.find((item) => item.id === discountPopupItemId);
    const discount = Number(discountInputValue);
    const lineTotal = currentItem ? currentItem.price * currentItem.qty : 0;

    if (!currentItem) {
      setDiscountPopupError("ไม่พบรายการสินค้าที่ต้องการให้ส่วนลด");
      return;
    }

    if (!Number.isFinite(discount)) {
      setDiscountPopupError("กรุณากรอกส่วนลดเป็นตัวเลข");
      return;
    }

    if (discount < 0) {
      setDiscountPopupError("ส่วนลดต้องไม่ติดลบ");
      return;
    }

    if (discount > lineTotal) {
      setDiscountPopupError("ส่วนลดต้องไม่เกินยอดรวมรายการสินค้า");
      return;
    }

    let storedDevice: unknown;
    try {
      storedDevice = await window.electronStore.get("pos_device");
    } catch (error) {
      console.error("Read POS device settings error:", error);
      setDiscountPopupError(getDiscountErrorMessage());
      return;
    }

    const allowBelowCost = getStoredAllowBelowCost(storedDevice);
    if (allowBelowCost !== true) {
      changeItemDiscount(discountPopupItemId, discount);
      closeDiscountPopup();
      return;
    }

    const machineId = getStoredMachineId(storedDevice);
    if (!currentItem.productId || !machineId) {
      setDiscountPopupError(
        getDiscountErrorMessage(
          "Unable to validate the discount because POS device information is missing.",
        ),
      );
      return;
    }

    try {
      setIsCheckingDiscount(true);
      const response = await checkDiscount({
        product_id: String(currentItem.productId),
        qty: currentItem.qty,
        machine_id: machineId,
        discount_amount: discount,
      });

      if (!response.permitted) {
        setDiscountPopupError(
          getDiscountErrorMessage(
            response.message || "This discount exceeds the allowed limit.",
          ),
        );
        return;
      }

      changeItemDiscount(discountPopupItemId, discount);
      setDiscountPopupItemId(null);
      setDiscountInputValue("");
      focusScannerInput();
    } catch (error) {
      console.error("Check discount error:", error);
      setDiscountPopupError(
        error instanceof Error && error.message
          ? getDiscountErrorMessage(error.message)
          : getDiscountErrorMessage(),
      );
    } finally {
      setIsCheckingDiscount(false);
    }
  };

  const openClearConfirm = () => {
    if (scanItems.length === 0) return;
    clearConfirmSelectionRef.current = "confirm";
    setClearConfirmSelection("confirm");
    setShowClearConfirm(true);
  };

  const buildHeldBillPayload = async (
    holdName: string,
  ): Promise<HeldBillPayload> => {
    const [storedDevice, storedUser, accessToken] = await Promise.all([
      window.electronStore.get("pos_device"),
      window.electronStore.get("user"),
      window.electronStore.get("access_token"),
    ]);
    const machineId = getStoredMachineId(storedDevice);
    const userId =
      getStoredUserId(storedUser) ?? getUserIdFromAccessToken(accessToken);
    const customerId =
      typeof selectedCustomer?.customer_code === "string" &&
      selectedCustomer.customer_code.trim()
        ? selectedCustomer.customer_code.trim()
        : null;

    if (!userId) {
      throw new Error("ไม่พบข้อมูลผู้ใช้งาน กรุณา Login ใหม่");
    }

    if (!machineId) {
      throw new Error("ไม่พบ machine_id กรุณาลงทะเบียนเครื่อง POS ก่อน");
    }

    if (scanItems.length === 0) {
      throw new Error("ไม่พบรายการสินค้าในรายการขาย");
    }

    const payload: HeldBillPayload = {
      hold_name: holdName,
      customer_id: customerId,
      machine_id: machineId,
      user_id: userId,
      note: "",
      items: scanItems.map((item) => {
        const qty = Number(item.qty) || 0;
        const unitPrice = Number(item.price) || 0;
        const productId = toPositiveInteger(item.productId);

        return {
          product_id: productId,
          sku: null,
          barcode: item.barcode || `NO-BARCODE-${productId ?? item.id}`,
          product_name: item.name,
          category_id: null,
          unit_code: item.unit ?? null,
          price_mode: "FIXED_PRICE",
          qty,
          cost_price: 0,
          sale_price: unitPrice,
          unit_price: unitPrice,
          discount_amount: Math.max(Number(item.discount ?? item.discount_amount ?? 0) || 0, 0),
          total_amount:
            qty * unitPrice -
            Math.max(Number(item.discount ?? item.discount_amount ?? 0) || 0, 0),
          track_stock: false,
          allow_discount: item.allow_discount,
          image_url: null,
          note: "",
        };
      }),
    };

    const invalidItem = payload.items.find(
      (item) =>
        !Number.isFinite(item.qty) ||
        item.qty <= 0 ||
        !Number.isFinite(item.unit_price) ||
        !Number.isFinite(item.total_amount),
    );

    if (invalidItem) {
      throw new Error("ข้อมูลสินค้าในรายการขายไม่ถูกต้อง กรุณาตรวจสอบรายการสินค้า");
    }

    return payload;
  };

  const openHoldBillModal = () => {
    if (scanItems.length === 0) return;

    setHoldBillError(null);
    setHoldBillName("");
    setShowHoldBillModal(true);
  };

  const closeHoldBillModal = () => {
    if (isHoldingBill) return;

    setShowHoldBillModal(false);
    setHoldBillError(null);
    setHoldBillName("");
    focusScannerInput();
  };

  const submitHoldBill = async () => {
    if (scanItems.length === 0 || isHoldingBill) return;

    setIsHoldingBill(true);
    setHoldBillError(null);

    try {
      const payload = await buildHeldBillPayload(
        holdBillName.trim() || "บิลพัก",
      );
      await createHeldBill(payload);
      clearAllItems();
      setShowHoldBillModal(false);
      setHoldBillName("");
    } catch (error) {
      setHoldBillError(getHeldBillErrorMessage(error, "พักบิลไม่สำเร็จ"));
    } finally {
      setIsHoldingBill(false);
    }
  };

  const processNormalizedBarcode = async (normalizedBarcode: string) => {
    if (!normalizedBarcode) return;

    if (!isBarcodeScannerEnabled) {
      setScanMessage(BARCODE_NOT_FOUND_MESSAGE);
      clearBarcodeBuffer();
      pendingBarcodeScanQueueRef.current = [];
      return;
    }

    let shouldRefocusScanner = true;

    if (isScanningRef.current) {
      pendingBarcodeScanQueueRef.current.push(normalizedBarcode);
      return;
    }

    isScanningRef.current = true;
    setIsScanningProduct(true);
    setIsSearchingProducts(true);
    setScanMessage(null);
    setSearchResults([]);

    try {
      const barcodeCandidates = [
        normalizedBarcode,
        ...getEan13RepairCandidates(normalizedBarcode),
      ];

      for (const barcodeCandidate of barcodeCandidates) {
        const result = await scanProduct(barcodeCandidate);

        if (result.code === "PRODUCT_NOT_FOUND") {
          continue;
        }

        if (!result.success || !result.product) {
          continue;
        }

        await selectSearchedProduct(result.product);
        return;
      }

      playNoProductsFound();
      setScanMessage(BARCODE_NOT_FOUND_MESSAGE);
    } catch (error) {
      console.error("Scan product error:", error);
      setScanMessage(
        error instanceof Error && error.message
          ? error.message
          : BARCODE_SCAN_FAILED_MESSAGE,
      );
    } finally {
      barcodeBufferRef.current = "";
      setBarcodeBuffer("");
      setBarcodeInput("");
      isScanningRef.current = false;
      setIsScanningProduct(false);
      setIsSearchingProducts(false);

      const pendingBarcode = pendingBarcodeScanQueueRef.current.shift();
      if (pendingBarcode) {
        void processNormalizedBarcode(pendingBarcode);
      } else if (shouldRefocusScanner) {
        focusScannerInput();
      }
    }
  };

  const submitBarcodeScan = async (rawBarcode = barcodeInput) => {
    await processNormalizedBarcode(normalizeBarcode(rawBarcode));
  };

  const submitProductSearch = async (rawKeyword = barcodeInput) => {
    const keyword = rawKeyword.trim();
    if (!keyword || isScanningProduct) return;

    if (isBarcodeSearchKeyword(keyword)) {
      await submitBarcodeScan(keyword);
      return;
    }

    setIsScanningProduct(true);
    setIsSearchingProducts(true);
    setScanMessage(null);
    setSearchResults([]);

    try {
      const products = await searchProducts(keyword);

      if (products.length === 0) {
        playNoProductsFound();
        setScanMessage(`ไม่พบสินค้าสำหรับคำค้นหา ${keyword}`);
        barcodeInputRef.current?.focus();
        return;
      }

      const loweredKeyword = keyword.toLowerCase();
      const exactMatch = products.find((product) => {
        return (
          String(product.barcode ?? "").toLowerCase() === loweredKeyword ||
          String(product.sku ?? "").toLowerCase() === loweredKeyword ||
          getScannedProductName(product).toLowerCase() === loweredKeyword
        );
      });

      if (products.length === 1 || exactMatch) {
        await selectSearchedProduct(exactMatch ?? products[0]);
        return;
      }

      setSearchResults(products);
      setScanMessage(`พบสินค้า ${products.length} รายการ กรุณาเลือกรายการ`);
      barcodeInputRef.current?.focus();
    } catch (error) {
      console.error("Search products error:", error);
      setScanMessage(
        error instanceof Error ? error.message : "ไม่สามารถค้นหาสินค้าได้",
      );
    } finally {
      setIsScanningProduct(false);
      setIsSearchingProducts(false);
    }
  };

  const handleScannerInputKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      if (barcodeBufferRef.current) {
        event.preventDefault();
        const barcode = barcodeBufferRef.current;
        clearBarcodeBuffer();
        void submitBarcodeScan(barcode);
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
      clearBarcodeBuffer();
      return;
    }

    const scannerDigit = getScannerDigitFromKeyEvent(event);
    if (scannerDigit) {
      event.preventDefault();
      event.stopPropagation();
      barcodeBufferRef.current += scannerDigit;
      setBarcodeBuffer(barcodeBufferRef.current);

      if (barcodeTimerRef.current) {
        clearTimeout(barcodeTimerRef.current);
      }
      barcodeTimerRef.current = setTimeout(() => {
        barcodeBufferRef.current = "";
        setBarcodeBuffer("");
      }, BARCODE_INPUT_TIMEOUT_MS);
      return;
    }

    if (
      event.key.length !== 1 ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      ["+", "=", "_"].includes(event.key)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    barcodeBufferRef.current += normalizeBarcodeScannerKey(event.key);
    setBarcodeBuffer(barcodeBufferRef.current);

    if (barcodeTimerRef.current) {
      clearTimeout(barcodeTimerRef.current);
    }
    barcodeTimerRef.current = setTimeout(() => {
      barcodeBufferRef.current = "";
      setBarcodeBuffer("");
    }, BARCODE_INPUT_TIMEOUT_MS);
  };

  const fetchCustomerList = async () => {
    setIsLoadingCustomers(true);
    setCustomerLoadError(null);

    try {
      setCustomers(await loadCustomers());
    } catch (error) {
      console.error("Error loading customers:", error);
      setCustomerLoadError(
        error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลลูกค้าได้",
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
    focusScannerInput();
  };

  const selectCustomer = (customer: PosCustomer) => {
    setSelectedCustomer(customer);
    void window.electronStore
      .set(SELECTED_POS_CUSTOMER_KEY, customer)
      .then(() => commitScanItemsChange(sourceScanItemsRef.current, selectedScanItemId))
      .catch((error) => {
        console.error("Select scan-only customer error:", error);
        setScanMessage("ไม่สามารถบันทึกสมาชิกที่เลือกได้");
      });
    closeCustomerPopup();
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);
    void window.electronStore
      .set(SELECTED_POS_CUSTOMER_KEY, null)
      .then(() => commitScanItemsChange(sourceScanItemsRef.current, selectedScanItemId))
      .catch((error) => {
        console.error("Clear scan-only customer error:", error);
      });
    focusScannerInput();
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

  const closeHeldBillsModal = () => {
    if (openingHeldBillId !== null) return;

    setShowHeldBillsModal(false);
    setHeldBillsError(null);
    focusScannerInput();
  };

  const openHeldBill = async (heldBill: HeldBillSummary) => {
    if (scanItems.length > 0) {
      const shouldReplace = window.confirm(
        "ต้องการแทนที่รายการขายปัจจุบันด้วยบิลพักนี้หรือไม่?",
      );
      if (!shouldReplace) return;
    }

    setOpeningHeldBillId(heldBill.id);
    setHeldBillsError(null);

    try {
      const detail = await loadHeldBillDetail(heldBill.id);
      const items = detail.held_bill_items ?? detail.items ?? [];
      const nextItems = items.map(mapHeldBillItemToScanItem);
      await commitScanItemsChange(nextItems, nextItems.at(-1)?.id ?? null);
      setShowHeldBillsModal(false);
      setScanMessage(null);
      focusScannerInput();
    } catch (error) {
      setHeldBillsError(
        getHeldBillErrorMessage(error, "โหลดรายละเอียดบิลพักไม่สำเร็จ"),
      );
    } finally {
      setOpeningHeldBillId(null);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const loadDisplayStoreName = async () => {
      try {
        const nextStoreSettings = await loadStoreSettings();
        if (!isCancelled) {
          setStoreSettings((current) => ({ ...current, ...nextStoreSettings }));
        }
      } catch (error) {
        console.error("Load scan layout store settings failed:", error);
      }
    };

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

    void loadDisplayStoreName();
    void restoreSelectedCustomer();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showCustomerPopup) return;

    const timer = window.setTimeout(() => {
      customerSearchRef.current?.focus();
      customerSearchRef.current?.select();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [showCustomerPopup]);

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

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelButtonRef.current?.click();
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        selectClearConfirmAction(
          clearConfirmSelectionRef.current === "cancel" ? "confirm" : "cancel",
        );
      }
    };

    window.addEventListener("keydown", handlePopupKeyboard, true);

    const timer = window.setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 50);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handlePopupKeyboard, true);
    };
  }, [showClearConfirm]);

  useEffect(() => {
    if (!showHoldBillModal) return;

    const timer = window.setTimeout(() => {
      holdBillNameRef.current?.focus();
      holdBillNameRef.current?.select();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [showHoldBillModal]);

  useEffect(() => {
    if (!favoritePopupGroup && !isAllProductsPopupOpen) return;

    const handleProductsPopupKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (favoritePopupGroup) {
        closeFavoritePopup();
      } else {
        closeAllProductsPopup();
      }
    };

    window.addEventListener("keydown", handleProductsPopupKeyDown, true);
    return () =>
      window.removeEventListener("keydown", handleProductsPopupKeyDown, true);
  }, [
    closeAllProductsPopup,
    closeFavoritePopup,
    favoritePopupGroup,
    isAllProductsPopupOpen,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (currentPage !== "pos") return;

      if (event.key === "Escape" && showShortcuts) {
        event.preventDefault();
        setShowShortcuts(false);
        focusScannerInput();
        return;
      }

      if (showShortcuts) return;

      if (event.key === "Escape" && discountPopupItemId) {
        event.preventDefault();
        closeDiscountPopup();
        return;
      }

      if (
        showClearConfirm ||
        showHeldBillsModal ||
        showHoldBillModal ||
        discountPopupItemId
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        const shouldQuit = window.confirm("คุณต้องการปิดโปรแกรมหรือไม่?");
        if (shouldQuit) {
          void window.electronAPI.quitApp();
        } else {
          focusScannerInput();
        }
        return;
      }

      const isScannerInput = event.target === scannerInputRef.current;
      const isManualBarcodeInput = event.target === barcodeInputRef.current;
      const isEditableTarget =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable);
      const isTypingOutsideScanner =
        isEditableTarget && !isScannerInput && !isManualBarcodeInput;

      if (event.key === "F6") {
        event.preventDefault();
        removeSelectedItem();
        focusScannerInput();
        return;
      }

      if (event.key === "F8") {
        event.preventDefault();
        const itemId = getActiveScanItemId();
        if (itemId) {
          openDiscountPopup(itemId);
        }
        return;
      }

      if (isIncreaseQtyKey(event) && !isTypingOutsideScanner) {
        if (isScannerInput && barcodeBuffer.trim()) return;
        event.preventDefault();
        updateSelectedItemQty(1);
        focusScannerInput();
        return;
      }

      if (isDecreaseQtyKey(event) && !isTypingOutsideScanner) {
        if (isScannerInput && barcodeBuffer.trim()) return;
        event.preventDefault();
        updateSelectedItemQty(-1);
        focusScannerInput();
        return;
      }

      if (event.key === "F7") {
        event.preventDefault();
        openClearConfirm();
        return;
      }

      if (event.key === "F4") {
        event.preventDefault();
        if (scanItems.length > 0) {
          setCurrentPage("posPayment");
        }
        return;
      }

      if (event.key !== "F3") return;

      event.preventDefault();
      openCustomerPopup();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    barcodeBuffer,
    discountPopupItemId,
    currentPage,
    focusScannerInput,
    scanItems,
    selectedScanItemId,
    showClearConfirm,
    showHeldBillsModal,
    showHoldBillModal,
    showShortcuts,
  ]);

  useEffect(() => {
    if (!discountPopupItemId) return;

    const timer = setTimeout(() => {
      discountInputRef.current?.focus();
      discountInputRef.current?.select();
    }, 50);

    return () => clearTimeout(timer);
  }, [discountPopupItemId]);

  useEffect(() => {
    if (
      discountPopupItemId &&
      !scanItems.some((item) => item.id === discountPopupItemId)
    ) {
      setDiscountPopupItemId(null);
      setDiscountInputValue("");
    }
  }, [discountPopupItemId, scanItems]);

  useEffect(() => {
    if (currentPage !== "pos" || !isBarcodeScannerEnabled) return;

    focusScannerInput(50);
  }, [currentPage, isBarcodeScannerEnabled, focusScannerInput]);

  useEffect(() => {
    return () => {
      clearBarcodeBuffer();
    };
  }, [clearBarcodeBuffer]);

  const formatPrice = (price: number) => price.toFixed(2);

  const renderMainPage = () => (
    <>
      <div className="shrink-0 border-b border-gray-300 bg-white px-4 py-3 xl:px-6 xl:py-4">
        <div className="flex min-w-0 flex-wrap items-stretch gap-3">
          <div className="relative flex min-w-[320px] flex-[1_1_520px] items-center gap-3 rounded-2xl border-2 border-blue-100 bg-blue-50 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-sm text-blue-600">
              ▥
            </div>
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(event) => {
                setBarcodeInput(event.target.value);
                setSearchResults([]);
                setScanMessage(null);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void submitProductSearch();
              }}
              placeholder="สแกนบาร์โค้ด หรือพิมพ์ชื่อ / รหัสสินค้า"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-gray-500"
              disabled={isScanningProduct}
              autoFocus
            />
            {isSearchingProducts ? (
              <span className="pointer-events-none absolute inset-y-0 right-4 my-auto flex items-center text-xs text-slate-400">
                กำลังค้นหา...
              </span>
            ) : null}
            {searchResults.length > 0 ? (
              <div className="absolute left-0 right-0 top-[68px] z-40 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {searchResults.map((product) => (
                  <button
                    key={`${getScannedProductId(product)}-${product.barcode ?? ""}`}
                    type="button"
                    onClick={() => void selectSearchedProduct(product)}
                    className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-3 text-left transition hover:bg-blue-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {getScannedProductName(product)}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {[product.sku, product.barcode].filter(Boolean).join(" · ") ||
                          "ไม่มี SKU / บาร์โค้ด"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-sm font-bold text-blue-600">
                      ฿{formatPrice(getScannedProductPrice(product))}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={openHeldBillsModal}
            title="เปิดบิลที่พัก"
            className="flex h-[60px] flex-[0_1_190px] items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
          >
            <IconFolderOpen size={20} />
            เปิดบิลที่พัก
          </button>

          <button
            type="button"
            onClick={openCustomerPopup}
            title="เลือกลูกค้า (F3)"
            className={`flex h-[60px] min-w-[120px] flex-[0_1_210px] items-center justify-center gap-2 rounded-2xl border px-4 font-semibold hover:bg-gray-50 ${
              selectedCustomer
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-gray-300 bg-white text-blue-700"
            }`}
          >
            <IconUser size={18} className="shrink-0" />
            <span className="truncate">
              {selectedCustomer ? getCustomerName(selectedCustomer) : "ลูกค้า"}
            </span>
            {selectedCustomer ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  clearSelectedCustomer();
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  event.stopPropagation();
                  clearSelectedCustomer();
                }}
                className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-sm leading-none text-blue-500 hover:bg-blue-100 hover:text-red-600"
                title="ลบลูกค้าที่เลือก"
                aria-label="ลบลูกค้าที่เลือก"
              >
                ×
              </span>
            ) : null}
          </button>
        </div>
        {scanMessage ? (
          <div
            className="mt-2 flex w-fit max-w-full items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
            role="alert"
          >
            <span className="min-w-0 break-words">{scanMessage}</span>
            <button
              type="button"
              onClick={() => {
                setScanMessage(null);
                focusScannerInput();
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-red-500 transition hover:bg-red-100 hover:text-red-700"
              aria-label="ปิดข้อความแจ้งเตือน"
              title="ปิดข้อความแจ้งเตือน"
            >
              <IconX size={16} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid shrink-0 grid-cols-[minmax(110px,150px)_minmax(76px,100px)_minmax(96px,130px)_minmax(240px,360px)_112px_150px_minmax(220px,280px)] items-center justify-center gap-2.5 border-b border-gray-300 bg-white px-4 py-4 xl:gap-3 xl:px-6">
        <div className="min-w-0 text-center">
          <div className="mb-1 text-xs font-semibold text-gray-500">
            จำนวนรายการ
          </div>
          <div className="text-xl font-bold text-blue-700">
            {itemCount} รายการ / {totalQty} ชิ้น
          </div>
        </div>
        <div className="min-w-0 text-center">
          <div className="mb-1 text-xs font-semibold text-gray-500">ส่วนลด</div>
          <div className="text-xl font-bold text-blue-700">
            {formatPrice(discountAmount)}
          </div>
        </div>
        <div className="min-w-0 text-center">
          <div className="mb-1 text-xs font-semibold text-gray-500">
            ภาษีมูลค่าเพิ่ม 7%
          </div>
          <div className="text-xl font-bold text-blue-700">0.00</div>
        </div>
        <div className="min-w-0 rounded-2xl bg-gradient-to-br from-blue-700 to-blue-500 px-6 py-5 text-center text-white shadow-lg shadow-blue-600/30 xl:py-6">
          <div className="mb-1 text-[16px] font-semibold tracking-wide opacity-85">
            ยอดชำระทั้งหมด
          </div>
          <div className="text-[clamp(42px,4.2vw,72px)] font-extrabold leading-none">
            {formatPrice(totalAmount)}
          </div>
        </div>
        <button
          type="button"
          onClick={openHoldBillModal}
          disabled={scanItems.length === 0}
          className="h-[46px] w-full whitespace-nowrap rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-bold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
          title="พักบิล"
        >
          พักบิล
        </button>
        <button
          type="button"
          onClick={openClearConfirm}
          disabled={scanItems.length === 0}
          className="h-[46px] w-full whitespace-nowrap rounded-2xl border border-red-200 bg-white px-4 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          title="ลบสินค้าทั้งหมด (F7)"
        >
          ลบทั้งหมด (F7)
        </button>
        <button
          type="button"
          onClick={() => {
            if (scanItems.length > 0) {
              setCurrentPage("posPayment");
            }
          }}
          disabled={scanItems.length === 0}
          className="h-[46px] w-full whitespace-nowrap rounded-2xl bg-blue-600 px-5 text-base font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ดำเนินการชำระเงิน (F4)
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-4 pb-0 pt-4 xl:px-6 xl:pt-5">
        <div className="h-full overflow-auto rounded-2xl border border-gray-300 bg-white">
          <table className="min-w-[1200px] w-full border-separate border-spacing-0 overflow-hidden bg-white">
            <thead>
              <tr className="bg-blue-50">
                <th className="border-b border-gray-300 px-4 py-3 text-center text-xs font-bold tracking-wider text-gray-500">
                  ลำดับ
                </th>
                <th className="border-b border-gray-300 px-4 py-3 text-left text-xs font-bold tracking-wider text-gray-500">
                  สินค้า
                </th>
                <th className="border-b border-gray-300 px-4 py-3 text-left text-xs font-bold tracking-wider text-gray-500">
                  บาร์โค้ด
                </th>
                <th className="border-b border-gray-300 px-4 py-3 text-center text-xs font-bold tracking-wider text-gray-500">
                  จำนวน
                </th>
                <th className="w-[120px] border-b border-gray-300 px-4 py-3 text-center text-xs font-bold tracking-wider text-gray-500">
                  หน่วย
                </th>
                <th className="w-[150px] border-b border-gray-300 px-4 py-3 text-center text-xs font-bold tracking-wider text-gray-500">
                  ราคา/หน่วย
                </th>
                <th className="w-[150px] border-b border-gray-300 px-4 py-3 text-center text-xs font-bold tracking-wider text-gray-500">
                  ส่วนลด
                </th>
                <th className="w-[150px] border-b border-gray-300 px-4 py-3 text-center text-xs font-bold tracking-wider text-gray-500">
                  ยอดรวม
                </th>
                <th className="w-[72px] border-b border-gray-300 px-4 py-3 text-center text-xs font-bold tracking-wider text-gray-500" />
              </tr>
            </thead>
            <tbody>
              {scanItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="border-b border-gray-300 px-4 py-16 text-center text-lg text-slate-400"
                  >
                    ยังไม่มีสินค้าในรายการ สแกนบาร์โค้ดเพื่อเพิ่มสินค้า
                  </td>
                </tr>
              ) : null}
              {scanItems.map((item, index) => {
                const isSelected = selectedScanItemId === item.id;
                const itemImageUrl = scanItemImageUrls[item.id];
                const lineDiscount =
                  Number(item.discount ?? item.discount_amount ?? 0) || 0;
                const lineTotal = item.price * item.qty;
                const lineNetTotal = Math.max(lineTotal - lineDiscount, 0);
                const unitLabel =
                  item.unitNameTh?.trim() ||
                  item.unit_name_th?.trim() ||
                  item.unitName?.trim() ||
                  item.unit_name?.trim() ||
                  item.unit_code?.trim() ||
                  item.unit?.trim() ||
                  "ชิ้น";

                return (
                <tr
                  key={item.id}
                  onClick={() => {
                    setSelectedScanItemId(item.id);
                    focusScannerInput();
                  }}
                  className={`cursor-pointer transition ${
                    isSelected ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "hover:bg-blue-50"
                  }`}
                >
                  <td className="w-[110px] border-b border-gray-300 px-4 py-4 text-center">
                    <span
                      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-bold ${
                        isSelected ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="border-b border-gray-300 px-4 py-4">
                    <div className="flex items-center gap-3">
                      {itemImageUrl ? (
                        <div className="flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-100 bg-white">
                          <img
                            src={itemImageUrl}
                            alt={item.name}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-[42px] min-w-[42px] shrink-0 items-center justify-center rounded-xl bg-blue-100 px-2 text-sm font-semibold text-blue-600">
                          {item.unit || "สินค้า"}
                        </div>
                      )}
                      <div className="text-lg font-semibold">{item.name}</div>
                    </div>
                  </td>
                  <td className="border-b border-gray-300 px-4 py-4 text-lg text-slate-600">
                    {item.barcode || "-"}
                  </td>
                  <td className="border-b border-gray-300 px-4 py-4">
                    <div className="flex items-center justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedScanItemId(item.id);
                          updateItemQty(item.id, -1);
                          focusScannerInput();
                        }}
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-blue-100 text-lg font-bold text-blue-600 hover:bg-blue-200"
                        title="ลดจำนวน"
                        aria-label="ลดจำนวน"
                      >
                        <IconMinus size={15} />
                      </button>
                      <span className="min-w-[18px] text-center font-bold">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedScanItemId(item.id);
                          updateItemQty(item.id, 1);
                          focusScannerInput();
                        }}
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-blue-100 text-lg font-bold text-blue-600 hover:bg-blue-200"
                        title="เพิ่มจำนวน"
                        aria-label="เพิ่มจำนวน"
                      >
                        <IconPlus size={15} />
                      </button>
                    </div>
                  </td>
                  <td className="w-[120px] border-b border-gray-300 px-4 py-4 text-center">
                    <span className="inline-flex min-w-16 justify-center rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                      {unitLabel}
                    </span>
                  </td>
                  <td className="w-[150px] border-b border-gray-300 px-4 py-4 text-center text-lg font-semibold">
                    {formatPrice(item.price)}
                  </td>
                  <td className="w-[150px] border-b border-gray-300 px-4 py-4">
                    <div className="relative flex items-center justify-center">
                    {item.allow_discount && lineDiscount > 0 ? (
                      <div className="font-bold text-emerald-600">
                        -{formatPrice(lineDiscount)}
                      </div>
                    ) : (
                      <div className="text-slate-400">0.00</div>
                    )}
                    {item.allow_discount ? (
                      <button
                        type="button"
                        title={
                          lineDiscount > 0
                            ? "แก้ไขส่วนลดรายการนี้"
                            : "ใส่ส่วนลดรายการนี้"
                        }
                        aria-label={
                          lineDiscount > 0
                            ? "แก้ไขส่วนลดรายการนี้"
                            : "ใส่ส่วนลดรายการนี้"
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          openDiscountPopup(item.id);
                        }}
                        className={`absolute left-[calc(50%+22px)] inline-flex h-7 w-7 items-center justify-center rounded-lg border-none align-middle transition ${
                          lineDiscount > 0
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-transparent text-gray-300 hover:bg-blue-50 hover:text-blue-600"
                        }`}
                      >
                        <IconPencil size={15} />
                      </button>
                    ) : null}
                    </div>
                  </td>
                  <td className="w-[150px] border-b border-gray-300 px-4 py-4 text-center font-bold text-lg text-blue-700">
                    <div>{formatPrice(lineNetTotal)}</div>
                  </td>
                  <td className="w-[72px] border-b border-gray-300 px-4 py-4 text-center">
                    <button
                      type="button"
                      title="ลบสินค้าที่เลือก"
                      aria-label="ลบสินค้าที่เลือก"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedScanItemId(item.id);
                        removeItem(item.id);
                        focusScannerInput();
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border-none bg-transparent align-middle text-base text-gray-300 hover:bg-red-50 hover:text-red-600"
                    >
                      ×
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fixed left-0 top-0 h-0 w-0 overflow-visible">
        <FavoriteGroups
          activeGroupId={null}
          onGroupsChange={(groups) => {
            setFavoriteGroups(groups);

            if (
              activeTab.startsWith("favorite-group:") &&
              !groups.some((group) => `favorite-group:${group.id}` === activeTab)
            ) {
              setActiveTab("all-products");
            }
          }}
          rootContent={<div />}
          createRequestKey={createGroupRequestKey}
          editGroupRequest={editGroupRequest}
          deleteGroupRequest={deleteGroupRequest}
        />
      </div>

      <div className="flex shrink-0 items-center gap-2.5 border-t border-gray-300 bg-white px-4 py-3 xl:px-7 xl:py-3.5">
        <div className="mr-1.5 shrink-0 text-xs font-bold text-gray-500">
          <IconStar size={14} className="inline-block text-amber-400" /> รายการโปรด
        </div>
        <div className="flex flex-1 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab("all-products");
              setIsAllProductsPopupOpen(true);
            }}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-[13.5px] font-semibold transition-all ${
              activeTab === "all-products"
                ? "bg-blue-600 text-white"
                : "border border-transparent bg-blue-50 text-blue-700 hover:bg-blue-100"
            }`}
          >
            <IconStar size={14} /> ทั้งหมด
          </button>

          {favoriteGroups.map((group) => {
            const tabKey = `favorite-group:${group.id}`;
            const isActive = activeTab === tabKey;
            const GroupIcon = getFavoriteGroupIcon(group);

            return (
              <div
                key={group.id}
                className={`group flex items-center whitespace-nowrap rounded-xl transition-all ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "border border-transparent bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(tabKey);
                    setFavoritePopupGroupId(group.id);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-[13.5px] font-semibold"
                >
                  <GroupIcon size={14} />
                  <span className="max-w-36 truncate">{getFavoriteGroupName(group)}</span>
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
            onClick={() => setCreateGroupRequestKey((current) => current + 1)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2.5 text-[13.5px] font-semibold text-white transition-all hover:bg-blue-700"
          >
            <IconPlus size={14} />
            เพิ่มกลุ่ม
          </button>
        </div>
      </div>
    </>
  );

  if (currentPage === "posPayment") {
    return (
      <POSPayment
        cartItems={scanItems}
        subtotal={subTotal}
        discount={discountAmount}
        total={totalAmount}
        onBack={() => setCurrentPage("pos")}
        onPaymentComplete={() => {
          clearSelectedCustomer();
          clearAllItems();
          setCurrentPage("pos");
        }}
      />
    );
  }

  return (
    <div
      className="flex h-screen overflow-hidden bg-blue-50 font-sans text-slate-900"
      style={{ fontFamily: '"Sarabun", ui-sans-serif, system-ui, sans-serif' }}
    >
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
          onNavigate={(page) => {
            if (page === "products") {
              setCurrentPage("productList");
              return;
            }

            if (page === "settings") {
              setCurrentPage("storeInfo");
              return;
            }

            setCurrentPage(page);
          }}
          currentPage={currentPage}
          storeName={displayStoreName}
        />
      )}

      <div
        className={`flex h-screen min-w-0 flex-col overflow-hidden transition-all duration-300 ${
          sidebarOpen ? "ml-[280px] w-[calc(100%-280px)]" : "ml-[72px] w-[calc(100%-72px)]"
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
              ref={scannerInputRef}
              value={barcodeBuffer}
              onChange={() => undefined}
              onKeyDown={handleScannerInputKeyDown}
              aria-label="Barcode scanner input"
              autoComplete="off"
              inputMode="none"
              className="h-8 w-80 rounded-lg border border-white/30 bg-white/10 px-3 font-semibold text-white placeholder:text-white/60 outline-none focus:border-white/60 focus:bg-white/15"
              placeholder="สแกนบาร์โค้ด"
            />
            <button
              type="button"
              onClick={() => {
                setIsBarcodeScannerEnabled((enabled) => {
                  const nextEnabled = !enabled;
                  if (nextEnabled) {
                    focusScannerInput();
                  }
                  return nextEnabled;
                });
              }}
              className={`relative flex h-9 w-9 items-center justify-center rounded-full border text-[0px] transition ${
                isBarcodeScannerEnabled
                  ? "border-emerald-200/80 bg-white text-emerald-600 shadow-sm shadow-emerald-950/20 hover:bg-emerald-50"
                  : "border-white/25 bg-white/10 text-white/55 hover:bg-white/15 hover:text-white/80"
              }`}
              title={
                isBarcodeScannerEnabled
                  ? "เครื่องอ่านบาร์โค้ดออนไลน์"
                  : "เครื่องอ่านบาร์โค้ดปิดอยู่"
              }
            >
              <IconQrcode size={18} stroke={2.2} />
              <span
                className={`absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-[#2f84e4] ${
                  isBarcodeScannerEnabled ? "bg-emerald-400" : "bg-slate-300"
                }`}
              >
                <IconPower
                  size={8}
                  stroke={3}
                  className={
                    isBarcodeScannerEnabled ? "text-emerald-950" : "text-slate-500"
                  }
                />
              </span>
              {isBarcodeScannerEnabled ? "ออนไลน์" : "ปิด"}
            </button>
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/15"
              title="คีย์ลัด"
              aria-label="คีย์ลัด"
            >
              <IconKeyboard size={18} />
            </button>
            <button
              type="button"
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                isBarcodeScannerEnabled
                  ? "text-emerald-100 hover:bg-white/15"
                  : "text-white/60 hover:bg-white/15"
              }`}
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
        ) : currentPage === "productStocks" ? (
          <StockPage />
        ) : currentPage === "priceQuotation" ? (
          <QuotationPage />
        ) : currentPage === "promotion" ? (
          <PromotionPage />
        ) : currentPage === "receipts" ? (
          <ReceiptPage />
        ) : currentPage === "customers" ? (
          <Customer />
        ) : currentPage === "userInfo" ? (
          <UserInfoPage />
        ) : currentPage === "employees" ? (
          <RegisterPage />
        ) : currentPage === "printer" ? (
          <PrinterSetting />
        ) : currentPage === "posSetting" ? (
          <POSSettingPage />
        ) : currentPage === "storeInfo" ||
          currentPage === "settings" ||
          currentPage === "tax" ||
          currentPage === "payment" ||
          currentPage === "receipt" ? (
          <SettingPages page={currentPage} />
        ) : (
          renderMainPage()
        )}
      </div>

      {isAllProductsPopupOpen ? (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onClick={closeAllProductsPopup}
          role="dialog"
          aria-modal="true"
          aria-label="รายการสินค้าทั้งหมด"
        >
          <div
            className="flex max-h-[86vh] min-h-[520px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-white px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                  <IconStar size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-xl font-extrabold text-slate-900">
                    สินค้าทั้งหมด
                  </h3>
                  <p className="text-xs font-medium text-slate-500">
                    เลือกสินค้าเพื่อเพิ่มลงรายการขาย · กด Esc เพื่อปิด
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAllProductsPopup}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-800"
                aria-label="ปิดรายการสินค้าทั้งหมด"
              >
                <IconX size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-5">
              <div className="min-h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <AllProducts searchQuery="" onAddToCart={addFavoriteProduct} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {favoritePopupGroup ? (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onClick={closeFavoritePopup}
          role="dialog"
          aria-modal="true"
          aria-label={`รายการสินค้า ${getFavoriteGroupName(favoritePopupGroup)}`}
        >
          <div
            className="flex max-h-[86vh] min-h-[460px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-white px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                  {(() => {
                    const GroupIcon = getFavoriteGroupIcon(favoritePopupGroup);
                    return <GroupIcon size={20} />;
                  })()}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-xl font-extrabold text-slate-900">
                    {getFavoriteGroupName(favoritePopupGroup)}
                  </h3>
                  <p className="text-xs font-medium text-slate-500">
                    เลือกสินค้าเพื่อเพิ่มลงรายการขาย · กด Esc เพื่อปิด
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteGroupRequest({
                      key: Date.now(),
                      group: favoritePopupGroup,
                    });
                    setFavoritePopupGroupId(null);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-500 shadow-sm hover:bg-red-50 hover:text-red-600"
                  aria-label={`ลบกลุ่ม ${getFavoriteGroupName(favoritePopupGroup)}`}
                  title="ลบกลุ่ม Favorite"
                >
                  <IconTrash size={18} />
                </button>
                <button
                  type="button"
                  onClick={closeFavoritePopup}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-800"
                  aria-label="ปิดรายการ Favorite"
                >
                  <IconX size={20} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-5">
              <div className="min-h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <FavoriteItems
                  groupId={favoritePopupGroup.id}
                  groupName={getFavoriteGroupName(favoritePopupGroup)}
                  onAddToCart={addFavoriteProduct}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showClearConfirm ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4">
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-clear-confirm-title"
          >
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <IconTrash size={28} className="text-red-600" />
              </div>
              <h3
                id="scan-clear-confirm-title"
                className="text-xl font-bold text-slate-900"
              >
                ยืนยันการลบทั้งหมด
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                คุณต้องการลบสินค้าทั้งหมด{" "}
                <span className="font-bold">{scanItems.length}</span>{" "}
                รายการออกจากรายการขายหรือไม่?
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
                className={`h-11 flex-1 rounded-xl border bg-white font-semibold transition ${
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
                onClick={clearAllItems}
                onFocus={() => {
                  clearConfirmSelectionRef.current = "confirm";
                  setClearConfirmSelection("confirm");
                }}
                className={`h-11 flex-1 rounded-xl bg-red-600 font-semibold text-white transition hover:bg-red-700 ${
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

      {showHeldBillsModal ? (
        <HeldBillsPopup
          heldBills={heldBills}
          heldBillsError={heldBillsError}
          isLoadingHeldBills={isLoadingHeldBills}
          openingHeldBillId={openingHeldBillId}
          formatBaht={(value) => `฿${formatPrice(value)}`}
          formatHeldBillDate={formatHeldBillDate}
          onClose={closeHeldBillsModal}
          onRefresh={fetchHeldBillList}
          onOpenHeldBill={openHeldBill}
        />
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
                disabled={isHoldingBill || scanItems.length === 0}
                className="h-11 flex-1 rounded-xl bg-amber-500 font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isHoldingBill ? "กำลังพักบิล..." : "ยืนยัน"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {showCustomerPopup ? (
        <CustomerPickerPopup
          searchInputRef={customerSearchRef}
          searchQuery={customerSearchQuery}
          onSearchQueryChange={setCustomerSearchQuery}
          customers={filteredCustomers}
          selectedCustomer={selectedCustomer}
          isLoading={isLoadingCustomers}
          error={customerLoadError}
          onClose={closeCustomerPopup}
          onRefresh={fetchCustomerList}
          onSelectCustomer={selectCustomer}
        />
      ) : null}

      {discountPopupItemId && discountPopupItem ? (
        <DiscountPopup
          item={discountPopupItem}
          value={discountInputValue}
          inputRef={discountInputRef}
          formatBaht={(value) => `฿${formatPrice(value)}`}
          onChange={setDiscountInputValue}
          onClose={closeDiscountPopup}
          onConfirm={confirmDiscountPopup}
          isLoading={isCheckingDiscount}
          errorMessage={discountPopupError}
        />
      ) : null}

      {showShortcuts ? (
        <KeyboardShortcutsPopup
          onClose={() => {
            setShowShortcuts(false);
            focusScannerInput();
          }}
        />
      ) : null}
    </div>
  );
}
