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
  IconPlus,
  IconPower,
  IconQrcode,
  IconRefresh,
  IconSearch,
  IconShoppingCart,
  IconStar,
  IconTrash,
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
import StockPage from "./StockPage";
import PrintBarcode from "./PrintBarcode";
import POSPayment from "./POSPayment";
import DiscountPopup from "./DiscountPopup";
import HeldBillsPopup from "./HeldBillsPopup";
import KeyboardShortcutsPopup from "./KeyboardShortcutsPopup";
import QuotationPage from "./QuotationPage";
import ReceiptPage from "./ReceiptPage";
import PrinterSetting from "./PrinterSetting";
import POSSettingPage from "./POSSettingPage";
import SettingPages from "./SettingPages";
import CustomerPickerPopup, {
  getCustomerName,
  getCustomerPhone,
  type PosCustomer,
} from "./CustomerPickerPopup";
import { RegisterPage } from "./RegisterPage";
import { checkDiscount } from "./posDiscountService";
import FavoriteGroups, {
  getFavoriteGroupIcon,
  getFavoriteGroupName,
  type FavoriteGroup,
} from "./FavoriteGroups";
import {
  AllProducts,
  type FavoriteProduct,
  type FavoriteProductUnit,
} from "./FavoriteItems";
import { UserInfoPage } from "./UserInfoPage";
import { ensureValidAccessToken, refreshAccessToken } from "./auth";
import { normalizeBarcode } from "./BarcodeNormalizer";
import { usePosScanSound } from "./usePosScanSound";

interface CartItem {
  id?: number | string;
  product_id?: number | string | null;
  productUnitId?: number | string | null;
  sku?: string | null;
  barcode?: string | null;
  name: string;
  product_name?: string;
  category_id?: number | string | null;
  price: number;
  qty: number;
  unit?: string;
  unit_code?: string | null;
  unitId?: number | string | null;
  unitName?: string | null;
  conversionToBase?: number;
  stockBaseQty?: number;
  stock_qty?: number;
  totalBaseQty?: number;
  regularAmount?: number;
  calculatedAmount?: number;
  savingAmount?: number;
  price_mode?: string;
  cost_price?: number | string | null;
  sale_price?: number | string | null;
  unit_price?: number | string | null;
  discount_amount?: number | string | null;
  final_price?: number | string | null;
  total_amount?: number | string | null;
  track_stock?: boolean;
  allow_discount?: boolean | number | string | null;
  allowDiscount?: boolean | number | string | null;
  image_url?: string | null;
  note?: string;
  pricingBreakdown?: CalculateCartPricingBreakdown[];
  discount: number;
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
  product_type?: "FIXED_PRICE" | "WEIGHT" | "OPEN_PRICE" | "SERVICE_PRICE";
  unitId?: number | string;
  unit_id?: number | string;
  unitCode?: string;
  unit_code?: string;
  unitNameTh?: string;
  unit_name_th?: string;
  conversionToBase?: number;
  conversion_to_base?: number;
  sale_price?: number;
  salePrice?: number;
  costPrice?: number;
  cost_price?: number;
  stockBaseQty?: number;
  stock_base_qty?: number;
  stock_qty?: number;
  unit?: string;
  price_per_unit?: number;
  allow_discount?: boolean | number | string | null;
  allowDiscount?: boolean | number | string | null;
}

interface SearchedProduct {
  product_id?: number | string;
  id?: number | string;
  barcode?: string | null;
  sku?: string | null;
  name?: string;
  product_name?: string;
  product_type?: string;
  price_mode: "FIXED_PRICE" | "WEIGHT_PRICE" | "OPEN_PRICE" | "SERVICE_PRICE";
  price?: number | string | null;
  sale_price?: number | string | null;
  track_stock?: boolean;
  stock_qty?: number;
  allow_discount?: boolean | number | string | null;
  allowDiscount?: boolean | number | string | null;
  image_url?: string | null;
  unit?: string | null;
  unit_code?: string | null;
}

interface SearchProductResponse {
  status?: "success" | "not_found";
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
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasMore?: boolean;
  };
}

interface ScanProductResponse {
  success: boolean;
  code?: string;
  message?: string;
  product?: ScannedProduct;
}

type RawScanProductResponse =
  | ScanProductResponse
  | (ScannedProduct & { success?: boolean; code?: string; message?: string });

const isScannedProductPayload = (
  payload: RawScanProductResponse,
): payload is ScannedProduct & {
  success?: boolean;
  code?: string;
  message?: string;
} =>
  "productId" in payload ||
  "productUnitId" in payload ||
  "id" in payload;

interface StoreSettings {
  store_name?: string;
  vat_enabled?: boolean;
  vat_rate?: number;
  auto_pack_pricing_scope?: AutoPackPricingScope;
}

interface StoreSettingsResponse {
  status?: string;
  message?: string;
  data?: StoreSettings | StoreSettings[] | { store?: StoreSettings };
  store?: StoreSettings;
}

type AutoPackPricingScope =
  | "DISABLED"
  | "ALL_CUSTOMERS"
  | "MEMBERS_ONLY";

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
  allow_discount?: boolean | number | string | null;
  allowDiscount?: boolean | number | string | null;
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
  product_id?: number | string;
  productId?: number | string;
  barcode?: string | null;
  qty?: number | string | null;
  unit_price?: number | string | null;
  unitPrice?: number | string | null;
  discount_amount?: number | string | null;
  discountAmount?: number | string | null;
  final_price?: number | string | null;
  finalPrice?: number | string | null;
  total_amount?: number | string | null;
  totalAmount?: number | string | null;
}

interface CalculatePromotionsResponse {
  subtotal?: number | string | null;
  discount_total?: number | string | null;
  grand_total?: number | string | null;
  applied_promotions?: AppliedPromotion[];
  items?: CalculatedPromotionItem[];
  message?: string;
}

interface CalculateCartPricingBreakdown {
  productUnitId?: number | string | null;
  product_unit_id?: number | string | null;
  unitCode?: string | null;
  unit_code?: string | null;
  unitNameTh?: string | null;
  unit_name_th?: string | null;
  unitName?: string | null;
  unit_name?: string | null;
  qty?: number | string | null;
  conversionToBase?: number | string | null;
  conversion_to_base?: number | string | null;
  unitPrice?: number | string | null;
  unit_price?: number | string | null;
  totalAmount?: number | string | null;
  total_amount?: number | string | null;
}

interface CalculateCartItem {
  productId?: number | string | null;
  product_id?: number | string | null;
  productUnitId?: number | string | null;
  product_unit_id?: number | string | null;
  barcode?: string | null;
  productName?: string | null;
  product_name?: string | null;
  name?: string | null;
  unitCode?: string | null;
  unit_code?: string | null;
  unitName?: string | null;
  unit_name?: string | null;
  qty?: number | string | null;
  unitPrice?: number | string | null;
  unit_price?: number | string | null;
  salePrice?: number | string | null;
  sale_price?: number | string | null;
  subtotal?: number | string | null;
  totalAmount?: number | string | null;
  total_amount?: number | string | null;
  finalPrice?: number | string | null;
  final_price?: number | string | null;
  discountAmount?: number | string | null;
  discount_amount?: number | string | null;
  totalBaseQty?: number | string | null;
  total_base_qty?: number | string | null;
  regularAmount?: number | string | null;
  regular_amount?: number | string | null;
  calculatedAmount?: number | string | null;
  calculated_amount?: number | string | null;
  savingAmount?: number | string | null;
  saving_amount?: number | string | null;
  pricingBreakdown?: CalculateCartPricingBreakdown[];
  pricing_breakdown?: CalculateCartPricingBreakdown[];
  allow_discount?: boolean | number | string | null;
  allowDiscount?: boolean | number | string | null;
}

interface CalculateCartResponse {
  items?: CalculateCartItem[];
  subtotal?: number | string | null;
  grandTotal?: number | string | null;
  grand_total?: number | string | null;
  discountTotal?: number | string | null;
  discount_total?: number | string | null;
  pricingBreakdown?: unknown;
  pricing_breakdown?: unknown;
  data?: {
    items?: CalculateCartItem[];
    subtotal?: number | string | null;
    grandTotal?: number | string | null;
    grand_total?: number | string | null;
    discountTotal?: number | string | null;
    discount_total?: number | string | null;
    pricingBreakdown?: unknown;
    pricing_breakdown?: unknown;
  };
  message?: string;
}

const formatBaht = (value: number): string => `฿${value.toFixed(2)}`;

// à¸à¸³à¸«à¸™à¸”à¹€à¸§à¸¥à¸²à¹ƒà¸™à¸à¸²à¸£à¸£à¸­à¸£à¸±à¸šà¸šà¸²à¸£à¹Œà¹‚à¸„à¹‰à¸”à¸ˆà¸²à¸à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸ªà¹à¸น (หน่วย: มิลลิวินาที)
//const BARCODE_INPUT_TIMEOUT_MS = 5000;
const BARCODE_INPUT_TIMEOUT_MS = 300;
const SELECTED_POS_CUSTOMER_KEY = "pos_selected_customer";
const BARCODE_NOT_FOUND_MESSAGE = "ไม่พบบาร์โค้ดสินค้า";
const BARCODE_SCAN_FAILED_MESSAGE =
  "à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸šà¸²à¸£à¹Œà¹‚à¸„à¹‰à¸”à¹„à¸”à¹‰ à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆà¸­à¸µà¸ครั้ง";

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

const normalizeAutoPackPricingScope = (
  value: unknown,
): AutoPackPricingScope =>
  value === "ALL_CUSTOMERS" || value === "MEMBERS_ONLY" || value === "DISABLED"
    ? value
    : "DISABLED";

const isStoreSettings = (value: unknown): value is StoreSettings =>
  Boolean(
    value &&
      typeof value === "object" &&
      ("store_name" in value || "auto_pack_pricing_scope" in value),
  );

const unwrapStoreSettings = (
  data: StoreSettingsResponse | StoreSettings[],
): StoreSettings => {
  if (Array.isArray(data)) return data[0] ?? {};
  if (Array.isArray(data.data)) return data.data[0] ?? {};
  if (isStoreSettings(data.data)) return data.data;
  return data.data?.store ?? data.store ?? {};
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
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (["false", "0", "no", "n"].includes(normalizedValue)) {
      return false;
    }

    if (["true", "1", "yes", "y"].includes(normalizedValue)) {
      return true;
    }
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

const normalizeScanProductResponse = (
  payload: RawScanProductResponse,
): ScanProductResponse => {
  if ("product" in payload) {
    return payload;
  }

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
  Number(product.salePrice ?? product.sale_price ?? product.price_per_unit ?? 0) || 0;

const getScannedProductUnitCode = (product: ScannedProduct): string | undefined =>
  product.unitCode ?? product.unit_code ?? product.unit;

const hasScannedProductUnit = (product: ScannedProduct | null): product is ScannedProduct =>
  Boolean(product && getScannedProductUnitId(product) != null);

const getCalculableProductUnitId = (
  item: CartItem,
): number | null => {
  const productUnitId = Number(item.productUnitId);
  return Number.isFinite(productUnitId) && productUnitId > 0
    ? productUnitId
    : null;
};

const mapScannedProductToCartItem = (
  product: ScannedProduct,
  price = getScannedProductPrice(product),
  qty = 1,
): CartItem => {
  const productId = getScannedProductId(product);
  const productUnitId = getScannedProductUnitId(product);
  const productName = getScannedProductName(product);
  const unitCode = getScannedProductUnitCode(product);
  const unitPrice = Number(price) || 0;

  return {
    id: productUnitId ?? productId,
    product_id: productId || null,
    productUnitId,
    sku: product.sku ?? null,
    barcode: String(product.barcode ?? "").trim() || null,
    name: productName,
    product_name: productName,
    price: unitPrice,
    qty,
    unit: unitCode,
    unit_code: unitCode ?? null,
    unitId: product.unitId ?? product.unit_id ?? null,
    unitName: product.unitNameTh ?? product.unit_name_th ?? null,
    conversionToBase: Number(product.conversionToBase ?? product.conversion_to_base ?? 1),
    unit_price: unitPrice,
    sale_price: product.salePrice ?? product.sale_price ?? unitPrice,
    cost_price:
      product.costPrice !== undefined
        ? Number(product.costPrice)
        : product.cost_price !== undefined
          ? Number(product.cost_price)
          : undefined,
    stock_qty: product.stock_qty,
    stockBaseQty: Number(product.stockBaseQty ?? product.stock_base_qty ?? product.stock_qty ?? 0),
    allow_discount: getAllowDiscount(product),
    discount_amount: 0,
    final_price: unitPrice * qty,
    total_amount: unitPrice * qty,
    discount: 0,
  };
};

const isSameScannedCartItem = (
  item: CartItem,
  scannedProduct: ScannedProduct,
): boolean => {
  const scannedProductUnitId = getScannedProductUnitId(scannedProduct);

  if (item.productUnitId != null && scannedProductUnitId != null) {
    return String(item.productUnitId) === String(getScannedProductUnitId(scannedProduct));
  }

  return (
    String(item.product_id ?? item.id) === String(getScannedProductId(scannedProduct)) &&
    String(item.barcode ?? "") === String(scannedProduct.barcode ?? "")
  );
};

const scanProduct = async (barcode: string): Promise<ScanProductResponse> => {
  const normalizedBarcode = String(barcode ?? "").trim();
  console.log("Scanned barcode:", normalizedBarcode);

  const [apiPath, storedDevice] = await Promise.all([
    window.electronStore.get("apiPath"),
    window.electronStore.get("pos_device"),
  ]);
  const machineId = getStoredMachineId(storedDevice);

  if (typeof apiPath !== "string" || !apiPath.trim()) {
    throw new Error("ไม่พบ API endpoint ใน store");
  }
  if (!machineId) {
    throw new Error("ไม่พบ machine_id à¸รุณาลงทะเบียนเครื่อง POS à¸่อน");
  }
  if (!(await ensureValidAccessToken())) {
    throw new Error("à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™à¹„à¸”à¹‰ à¸รุณาเข้าสู่ระบบใหม่");
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

  try {
    let response = await request(accessToken);
    if (response.status === 401) {
      accessToken = await refreshAccessToken();
      response = await request(accessToken);
    }

    const data = (await response.json().catch(() => ({}))) as RawScanProductResponse;
    console.log("Scan API response:", data);
    if (!response.ok) {
      if (response.status === 404 || data.code === "PRODUCT_NOT_FOUND") {
        return {
          success: false,
          code: "PRODUCT_NOT_FOUND",
          message: data.message,
        };
      }
      console.error("Scan API error:", data);
    throw new Error((Array.isArray(data) ? "" : data.message) || `โหลดการตั้งค่าร้านไม่สำเร็จ (${response.status})`);
    }

    return normalizeScanProductResponse(data);
  } catch (error) {
    console.error("Scan API error:", error);
    throw error;
  }
};

const searchProducts = async (
  keyword: string,
): Promise<SearchProductResponse> => {
  const apiPath = await window.electronStore.get("apiPath");
  if (typeof apiPath !== "string" || !apiPath.trim()) {
    throw new Error("ไม่พบ API endpoint ใน store");
  }
  if (!(await ensureValidAccessToken())) {
    throw new Error("à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™à¹„à¸”à¹‰ à¸รุณาเข้าสู่ระบบใหม่");
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
    throw new Error((Array.isArray(data) ? "" : data.message) || `โหลดการตั้งค่าร้านไม่สำเร็จ (${response.status})`);
  }

  if (data.status) {
    return data;
  }

  const products = unwrapSearchedProducts(data.data);

  return {
    ...data,
    status: products.length ? "success" : "not_found",
    total: data.pagination?.total ?? products.length,
  };
};

const loadStoreSettings = async (): Promise<StoreSettings> => {
  const apiPath = await window.electronStore.get("apiPath");
  if (typeof apiPath !== "string" || !apiPath.trim()) {
    throw new Error("ไม่พบ API endpoint ใน store");
  }
  if (!(await ensureValidAccessToken())) {
    throw new Error("à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™à¹„à¸”à¹‰ à¸รุณาเข้าสู่ระบบใหม่");
  }

  let accessToken = await window.electronStore.get("access_token");
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw new Error("ไม่พบ access token");
  }

  const baseUrl = apiPath.trim().replace(/\/+$/, "");
  const request = (token: string) =>
    fetch(`${baseUrl}/store-settings`, {
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
    | StoreSettingsResponse
    | StoreSettings[];
  if (!response.ok) {
    throw new Error((Array.isArray(data) ? "" : data.message) || `โหลดการตั้งค่าร้านไม่สำเร็จ (${response.status})`);
  }

  return unwrapStoreSettings(data);
};

const loadCustomers = async (): Promise<PosCustomer[]> => {
  const apiPath = await window.electronStore.get("apiPath");
  if (typeof apiPath !== "string" || !apiPath.trim()) {
    throw new Error("ไม่พบ API endpoint ใน store");
  }
  if (!(await ensureValidAccessToken())) {
    throw new Error("à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™à¹„à¸”à¹‰ à¸รุณาเข้าสู่ระบบใหม่");
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
    throw new Error(message || `à¹‚à¸«à¸¥à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¥à¸¹à¸ค้าไม่สำเร็จ (${response.status})`);
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

  if ("product_id" in payload || "id" in payload) {
    return [payload as SearchedProduct];
  }

  return [];
};

const mergeSearchProductIntoScannedProduct = (
  scannedProduct: ScannedProduct,
  searchProduct: SearchedProduct,
): ScannedProduct => {
  const productName =
    scannedProduct.name ??
    scannedProduct.productName ??
    scannedProduct.product_name ??
    searchProduct.name ??
    searchProduct.product_name;
  const productPrice = Number(
    scannedProduct.salePrice ??
      scannedProduct.sale_price ??
      scannedProduct.price_per_unit ??
      searchProduct.price ??
      searchProduct.sale_price ??
      0,
  );
  const productUnit =
    scannedProduct.unit ??
    scannedProduct.unitCode ??
    scannedProduct.unit_code ??
    searchProduct.unit ??
    searchProduct.unit_code;

  return {
    ...scannedProduct,
    id: scannedProduct.id ?? searchProduct.product_id ?? searchProduct.id,
    productId:
      scannedProduct.productId ??
      scannedProduct.product_id ??
      searchProduct.product_id ??
      searchProduct.id,
    product_id:
      scannedProduct.product_id ??
      scannedProduct.productId ??
      searchProduct.product_id ??
      searchProduct.id,
    name: productName,
    productName: productName,
    product_name: productName,
    barcode: scannedProduct.barcode || searchProduct.barcode || "",
    sku: scannedProduct.sku ?? searchProduct.sku,
    salePrice: productPrice,
    sale_price: productPrice,
    price_per_unit: productPrice,
    stock_qty: scannedProduct.stock_qty ?? searchProduct.stock_qty,
    unit: productUnit ?? undefined,
    unitCode: productUnit ?? undefined,
    unit_code: productUnit ?? undefined,
    allow_discount: getAllowDiscount(searchProduct, getAllowDiscount(scannedProduct)),
  };
};

const enrichScannedProductFromSearch = async (
  scannedProduct: ScannedProduct,
  keyword: string,
): Promise<ScannedProduct> => {
  try {
    const result = await searchProducts(keyword);
    const products = unwrapSearchedProducts(result.data);
    const matchedProduct =
      products.find(
        (product) =>
          product.barcode?.toLowerCase() === keyword.toLowerCase() ||
          product.sku?.toLowerCase() === keyword.toLowerCase() ||
          String(product.product_id ?? product.id ?? "") ===
            String(scannedProduct.productId ?? scannedProduct.product_id ?? scannedProduct.id ?? ""),
      ) ?? products[0];

    return matchedProduct
      ? mergeSearchProductIntoScannedProduct(scannedProduct, matchedProduct)
      : scannedProduct;
  } catch (error) {
    console.error("Enrich scanned product error:", error);
    return scannedProduct;
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
    throw new Error("à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸¢à¸·à¸™à¸¢à¸±à¸™à¸•à¸±à¸§à¸•à¸™à¹„à¸”à¹‰ à¸รุณาเข้าสู่ระบบใหม่");
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
    throw new Error((Array.isArray(data) ? "" : data.message) || `โหลดการตั้งค่าร้านไม่สำเร็จ (${response.status})`);
  }

  return data;
};

const getCalculatedPromotionProductId = (
  item: CalculatedPromotionItem,
): number | string | undefined => item.product_id ?? item.productId;

const findCalculatedPromotionItem = (
  calculatedItems: CalculatedPromotionItem[],
  cartItem: CartItem,
): CalculatedPromotionItem | undefined => {
  const productId = cartItem.product_id ?? cartItem.id;
  const barcode = String(cartItem.barcode ?? "").trim();

  return calculatedItems.find((promotionItem) => {
    const promotionProductId = getCalculatedPromotionProductId(promotionItem);
    if (
      promotionProductId != null &&
      productId != null &&
      Number(promotionProductId) === Number(productId)
    ) {
      return true;
    }

    return (
      barcode !== "" &&
      String(promotionItem.barcode ?? "").trim() === barcode
    );
  });
};

const applyCalculatedPromotionsToCartItems = (
  items: CartItem[],
  calculatedItems: CalculatedPromotionItem[],
): CartItem[] =>
  items.map((item) => {
    const calculated = findCalculatedPromotionItem(calculatedItems, item);
    const promotionDiscountAmount =
      Number(calculated?.discount_amount ?? calculated?.discountAmount ?? 0) || 0;
    const promotionFinalPrice =
      Number(
        calculated?.final_price ??
          calculated?.finalPrice ??
          calculated?.total_amount ??
          calculated?.totalAmount ??
          item.final_price ??
          item.unit_price ??
          item.price ??
          item.sale_price ??
          0,
      ) || 0;
    const lineTotal =
      (Number(item.qty) || 0) *
      (Number(item.unit_price ?? item.price ?? item.sale_price ?? 0) || 0);
    const manualDiscountAmount = Math.min(
      Math.max(Number(item.discount ?? 0) || 0, 0),
      lineTotal,
    );
    const discountAmount = promotionDiscountAmount + manualDiscountAmount;
    const finalPrice = Math.max(promotionFinalPrice - manualDiscountAmount, 0);

    return {
      ...item,
      discount_amount: discountAmount,
      final_price: finalPrice,
      total_amount: Math.max(finalPrice, 0),
    };
  });

const calculateCartUnitPrices = async (
  machineId: string,
  items: CartItem[],
): Promise<CalculateCartResponse> => {
  const requestItemsByUnit = new Map<
    string,
    { productId: number; productUnitId: number; qty: number }
  >();

  items.forEach((item) => {
    const productId = Number(item.product_id ?? item.id);
    const productUnitId = getCalculableProductUnitId(item);

    if (!Number.isFinite(productId) || productId <= 0) {
      throw new Error(
        `ไม่พบ productId ของสินค้า ${item.product_name ?? item.name}`,
      );
    }
    if (productUnitId == null) {
      throw new Error(
        `ไม่พบ productUnitId ของสินค้า ${item.product_name ?? item.name}`,
      );
    }

    const key = `${productId}:${productUnitId}`;
    const existing = requestItemsByUnit.get(key);
    requestItemsByUnit.set(key, {
      productId,
      productUnitId,
      qty: (existing?.qty ?? 0) + (Number(item.qty) || 0),
    });
  });

  const requestItems = Array.from(requestItemsByUnit.values()).map((item) => ({
    productId: item.productId,
    productUnitId: item.productUnitId,
    qty: item.qty,
  }));

  console.log("Source cart before calculate:", items);
  console.log("POST /pos/calculate-cart payload", {
    machineId,
    items: requestItems,
  });

  const response = await heldBillFetch("/pos/calculate-cart", {
    method: "POST",
    body: JSON.stringify({
      machineId,
      items: requestItems,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as CalculateCartResponse;

  if (!response.ok) {
    throw new Error((Array.isArray(data) ? "" : data.message) || `โหลดการตั้งค่าร้านไม่สำเร็จ (${response.status})`);
  }

  return data;
};

const getCalculateCartItems = (
  result: CalculateCartResponse,
): CalculateCartItem[] => result.data?.items ?? result.items ?? [];

const getCalculateCartSubtotal = (
  result: CalculateCartResponse,
  fallback: number,
): number =>
  Number(result.data?.subtotal ?? result.subtotal ?? fallback) || fallback;

const getCalculateCartGrandTotal = (
  result: CalculateCartResponse,
  fallback: number,
): number =>
  Number(
    result.data?.grandTotal ??
      result.data?.grand_total ??
      result.grandTotal ??
      result.grand_total ??
      fallback,
  ) || fallback;

const getCalculateCartDiscountTotal = (
  result: CalculateCartResponse,
): number =>
  Number(
    result.data?.discountTotal ??
      result.data?.discount_total ??
      result.discountTotal ??
      result.discount_total ??
      0,
  ) || 0;

const getBreakdownProductUnitId = (
  line: CalculateCartPricingBreakdown,
): number | string | null => line.productUnitId ?? line.product_unit_id ?? null;

const getBreakdownUnitCode = (
  line: CalculateCartPricingBreakdown,
): string | undefined => line.unitCode ?? line.unit_code ?? undefined;

const getBreakdownUnitName = (
  line: CalculateCartPricingBreakdown,
): string | null =>
  line.unitNameTh ??
  line.unit_name_th ??
  line.unitName ??
  line.unit_name ??
  null;

const getBreakdownUnitPrice = (
  line: CalculateCartPricingBreakdown,
): number => Number(line.unitPrice ?? line.unit_price ?? 0) || 0;

const getBreakdownQty = (line: CalculateCartPricingBreakdown): number =>
  Number(line.qty ?? 0) || 0;

const getBreakdownConversionToBase = (
  line: CalculateCartPricingBreakdown,
): number =>
  Number(line.conversionToBase ?? line.conversion_to_base ?? 1) || 1;

const getBreakdownTotalAmount = (
  line: CalculateCartPricingBreakdown,
): number =>
  Number(
    line.totalAmount ??
      line.total_amount ??
      getBreakdownQty(line) * getBreakdownUnitPrice(line),
  ) || 0;

const getFavoriteProductUnits = (
  product: FavoriteProduct,
): FavoriteProductUnit[] =>
  product.productUnits ?? product.product_units ?? product.units ?? [];

const unwrapFavoriteProductUnitsResponse = (
  payload: unknown,
): FavoriteProductUnit[] => {
  if (Array.isArray(payload)) {
    return payload as FavoriteProductUnit[];
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const source = payload as {
    data?: unknown;
    items?: unknown;
    units?: unknown;
    productUnits?: unknown;
    product_units?: unknown;
  };
  if (Array.isArray(source.items)) return source.items as FavoriteProductUnit[];
  if (Array.isArray(source.units)) return source.units as FavoriteProductUnit[];
  if (Array.isArray(source.productUnits)) return source.productUnits as FavoriteProductUnit[];
  if (Array.isArray(source.product_units)) return source.product_units as FavoriteProductUnit[];
  if (Array.isArray(source.data)) return source.data as FavoriteProductUnit[];
  if (source.data && typeof source.data === "object") {
    return unwrapFavoriteProductUnitsResponse(source.data);
  }

  return [];
};

const getFavoriteUnitId = (
  unit: FavoriteProductUnit,
): number | string | null =>
  unit.productUnitId ?? unit.product_unit_id ?? unit.id ?? null;

const getFavoriteUnitUnitId = (
  unit: FavoriteProductUnit,
): number | string | undefined =>
  unit.unitId ?? unit.unit_id ?? unit.unit?.id;

const getFavoriteUnitCode = (
  unit: FavoriteProductUnit,
): string | undefined =>
  unit.unitCode ?? unit.unit_code ?? unit.unit?.unitCode ?? unit.unit?.unit_code ?? undefined;

const getFavoriteUnitName = (
  unit: FavoriteProductUnit,
): string | null =>
  unit.unitNameTh ??
  unit.unit_name_th ??
  unit.unitName ??
  unit.unit_name ??
  unit.unit?.unitNameTh ??
  unit.unit?.unit_name_th ??
  unit.unit?.unitName ??
  unit.unit?.unit_name ??
  null;

const getFavoriteUnitConversionToBase = (
  unit: FavoriteProductUnit,
): number => Number(unit.conversionToBase ?? unit.conversion_to_base ?? 1) || 1;

const getFavoriteUnitSalePrice = (
  unit: FavoriteProductUnit,
  fallback: number,
): number => Number(unit.salePrice ?? unit.sale_price ?? fallback) || fallback;

const isFavoriteUnitActive = (unit: FavoriteProductUnit): boolean => {
  const status = String(unit.status ?? unit.isActive ?? unit.is_active ?? "ACTIVE").toUpperCase();
  return status === "ACTIVE" || status === "TRUE";
};

const getDefaultProductUnit = (
  product: FavoriteProduct,
): FavoriteProductUnit | null => {
  const units = getFavoriteProductUnits(product);
  const savedProductUnitId = product.productUnitId ?? product.product_unit_id;

  return (
    units.find(
      (unit) =>
        savedProductUnitId != null &&
        String(getFavoriteUnitId(unit)) === String(savedProductUnitId),
    ) ??
    units.find((unit) => unit.isBase === true || unit.is_base === true) ??
    units.find(isFavoriteUnitActive) ??
    units.find((unit) => getFavoriteUnitConversionToBase(unit) === 1) ??
    units[0] ??
    null
  );
};

const getFallbackProductUnit = (
  product: FavoriteProduct,
): FavoriteProductUnit | null => {
  const productUnit =
    product.productUnit && typeof product.productUnit === "object"
      ? (product.productUnit as Record<string, unknown>)
      : {};
  const productUnitSnake =
    product.product_unit && typeof product.product_unit === "object"
      ? (product.product_unit as Record<string, unknown>)
      : {};
  const productUnitId =
    product.productUnitId ??
    product.product_unit_id ??
    productUnit.productUnitId ??
    productUnit.id ??
    productUnitSnake.product_unit_id ??
    productUnitSnake.id;
  const unitId = product.unitId ?? product.unit_id;

  if (productUnitId == null) {
    return null;
  }

  return {
    id: productUnitId as number | string,
    productUnitId: productUnitId as number | string,
    unitId: unitId as number | string | undefined,
    unitCode: product.unitCode as string | undefined,
    unit_code: product.unit_code,
    unitNameTh: product.unitNameTh as string | undefined,
    unit_name_th: product.unit_name_th as string | undefined,
    barcode: product.barcode,
    conversionToBase: product.conversionToBase as number | string | undefined,
    conversion_to_base: product.conversion_to_base as number | string | undefined,
    salePrice: product.salePrice as number | string | undefined,
    sale_price: product.sale_price,
    isBase: true,
  };
};

const fetchFavoriteProductUnits = async (
  productId: number | string,
): Promise<FavoriteProductUnit[]> => {
  const paths = [
    `/products/${productId}/units`,
    `/product-units/product/${productId}`,
  ];

  for (const path of paths) {
    const response = await heldBillFetch(path).catch(() => null);
    if (!response?.ok) continue;

    const payload = (await response.json().catch(() => ({}))) as
      | FavoriteProductUnit[]
      | { data?: FavoriteProductUnit[]; units?: FavoriteProductUnit[] };
    const units = unwrapFavoriteProductUnitsResponse(payload);
    if (units.length > 0) {
      return units;
    }
  }

  return [];
};

const unwrapUnitListResponse = (
  payload: unknown,
): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (!payload || typeof payload !== "object") return [];

  const source = payload as { data?: unknown; items?: unknown; units?: unknown };
  if (Array.isArray(source.items)) return source.items as Array<Record<string, unknown>>;
  if (Array.isArray(source.units)) return source.units as Array<Record<string, unknown>>;
  if (Array.isArray(source.data)) return source.data as Array<Record<string, unknown>>;
  if (source.data && typeof source.data === "object") {
    return unwrapUnitListResponse(source.data);
  }

  return [];
};

const fetchUnitIdByCode = async (
  unitCode?: string | null,
): Promise<number | string | null> => {
  const normalizedCode = unitCode?.trim();
  if (!normalizedCode) return null;

  const response = await heldBillFetch("/units").catch(() => null);
  if (!response?.ok) return null;

  const units = unwrapUnitListResponse(await response.json().catch(() => []));
  const matchedUnit = units.find((unit) => {
    const code = String(unit.unitCode ?? unit.unit_code ?? "").trim();
    return code === normalizedCode;
  });

  const unitId = matchedUnit?.id ?? matchedUnit?.unitId ?? matchedUnit?.unit_id;
  return typeof unitId === "number" || typeof unitId === "string" ? unitId : null;
};

const createLegacyBaseProductUnit = async (
  product: FavoriteProduct,
): Promise<FavoriteProductUnit | null> => {
  const productId = product.productId ?? product.product_id ?? product.id;
  const unitId =
    product.unitId ?? product.unit_id ?? (await fetchUnitIdByCode(product.unit_code));

  if (!productId || !unitId || !product.barcode) {
    console.warn("[Favorite Add To Cart] cannot create legacy base unit", {
      productId,
      unitId,
      unitCode: product.unit_code,
      barcode: product.barcode,
      product,
    });
    return null;
  }

  const response = await heldBillFetch(`/products/${productId}/units`, {
    method: "POST",
    body: JSON.stringify({
      unitId,
      barcode: product.barcode,
      conversionToBase: 1,
      salePrice: Number(product.sale_price) || 0,
      costPrice: Number(product.cost_price) || 0,
      isBase: true,
      isActive: true,
      sortOrder: 1,
    }),
  }).catch(() => null);

  const refreshedUnits = await fetchFavoriteProductUnits(productId).catch(() => []);
  const selectedUnit = getDefaultProductUnit({
    ...product,
    productUnits: refreshedUnits,
  });
  if (selectedUnit) return selectedUnit;

  if (!response?.ok) {
    console.warn("[Favorite Add To Cart] legacy base unit creation failed", {
      productId,
      unitId,
      unitCode: product.unit_code,
      responseStatus: response?.status,
    });
  }

  return null;
};

const unwrapFavoriteProductDetailResponse = (
  payload: unknown,
): FavoriteProduct | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const source = payload as { data?: unknown; product?: unknown; item?: unknown };
  if (source.product && typeof source.product === "object") {
    return source.product as FavoriteProduct;
  }
  if (source.item && typeof source.item === "object") {
    return source.item as FavoriteProduct;
  }
  if (source.data && typeof source.data === "object") {
    return unwrapFavoriteProductDetailResponse(source.data) ?? (source.data as FavoriteProduct);
  }
  return payload as FavoriteProduct;
};

const fetchFavoriteProductDetail = async (
  productId: number | string,
): Promise<FavoriteProduct | null> => {
  const response = await heldBillFetch(`/products/${productId}`);
  if (!response.ok) {
    return null;
  }
  return unwrapFavoriteProductDetailResponse(await response.json().catch(() => ({})));
};

const mapFavoriteProductUnitToScannedProduct = (
  product: FavoriteProduct,
  unit: FavoriteProductUnit,
): ScannedProduct | null => {
  const productUnitId = getFavoriteUnitId(unit);

  return {
    id: product.id,
    productId: product.id,
    productUnitId: productUnitId ?? undefined,
    sku: product.sku,
    barcode: String(unit.barcode ?? product.barcode ?? "").trim(),
    name: product.product_name,
    productName: product.product_name,
    product_type:
      product.price_mode === "WEIGHT_PRICE"
        ? "WEIGHT"
        : product.price_mode ?? "FIXED_PRICE",
    unitId: getFavoriteUnitUnitId(unit),
    unitCode: getFavoriteUnitCode(unit),
    unitNameTh: getFavoriteUnitName(unit) ?? undefined,
    conversionToBase: getFavoriteUnitConversionToBase(unit),
    salePrice: getFavoriteUnitSalePrice(unit, Number(product.sale_price) || 0),
    sale_price: getFavoriteUnitSalePrice(unit, Number(product.sale_price) || 0),
    stock_qty: product.stock_qty,
    unit: getFavoriteUnitCode(unit) ?? product.unit_code,
    price_per_unit: getFavoriteUnitSalePrice(unit, Number(product.sale_price) || 0),
    allow_discount: getAllowDiscount(product),
  };
};

const mapCalculateCartResponseToCart = (
  result: CalculateCartResponse,
): CartItem[] =>
  getCalculateCartItems(result)
    .map((item, index): CartItem | null => {
      const pricingBreakdown =
        item.pricingBreakdown ?? item.pricing_breakdown ?? [];
      const firstLine = pricingBreakdown[0];
      const productId = item.productId ?? item.product_id ?? null;
      const productName =
        item.productName ?? item.product_name ?? item.name ?? "-";
      const totalBaseQty =
        Number(item.totalBaseQty ?? item.total_base_qty) ||
        pricingBreakdown.reduce(
          (sum, line) =>
            sum + getBreakdownQty(line) * getBreakdownConversionToBase(line),
          0,
        );
      const calculatedAmount =
        Number(item.calculatedAmount ?? item.calculated_amount) ||
        pricingBreakdown.reduce(
          (sum, line) => sum + getBreakdownTotalAmount(line),
          0,
        );
      const regularAmount =
        Number(item.regularAmount ?? item.regular_amount) || calculatedAmount;
      const baseLine =
        pricingBreakdown.find(
          (line) => getBreakdownConversionToBase(line) === 1,
        ) ?? firstLine;
      const productUnitId =
        getBreakdownProductUnitId(baseLine ?? {}) ??
        item.productUnitId ??
        item.product_unit_id ??
        null;

      if (productId == null || !firstLine) {
        return null;
      }

      return {
        id: productId ?? index,
        product_id: productId,
        productUnitId,
        barcode: item.barcode ?? null,
        name: productName,
        product_name: productName,
        price: getBreakdownUnitPrice(firstLine),
        qty: totalBaseQty,
        unit: getBreakdownUnitCode(firstLine),
        unit_code: getBreakdownUnitCode(firstLine) ?? null,
        unitName: getBreakdownUnitName(firstLine),
        conversionToBase: getBreakdownConversionToBase(firstLine),
        unit_price: getBreakdownUnitPrice(firstLine),
        sale_price: getBreakdownUnitPrice(firstLine),
        discount_amount: Math.max(regularAmount - calculatedAmount, 0),
        final_price: calculatedAmount,
        total_amount: calculatedAmount,
        totalBaseQty,
        regularAmount,
        calculatedAmount,
        savingAmount: Number(item.savingAmount ?? item.saving_amount ?? 0) || 0,
        pricingBreakdown,
        allow_discount: getAllowDiscount(item, false),
        discount: 0,
      };
    })
    .filter((item): item is CartItem => item !== null);

const mapCalculatedCartItems = (
  currentItems: CartItem[],
  calculatedItems: CalculateCartItem[],
): CartItem[] => {
  const mappedItems = calculatedItems.flatMap((calculated, index) => {
    const productId = calculated.productId ?? calculated.product_id;
    const breakdown =
      calculated.pricingBreakdown ?? calculated.pricing_breakdown ?? [];
    const source =
      currentItems.find(
        (item) =>
          productId != null &&
          String(item.product_id ?? item.id) === String(productId),
      ) ??
      currentItems[index] ??
      currentItems[0];
    const productName =
      calculated.productName ??
      calculated.product_name ??
      calculated.name ??
      source?.product_name ??
      source?.name ??
      "-";

    if (breakdown.length > 0) {
      return breakdown.map((line, lineIndex) => {
        const productUnitId =
          line.productUnitId ?? line.product_unit_id ?? null;
        const qty = Number(line.qty ?? 0) || 0;
        const unitPrice =
          Number(line.unitPrice ?? line.unit_price ?? source?.unit_price ?? source?.price ?? 0) ||
          0;
        const totalAmount =
          Number(line.totalAmount ?? line.total_amount ?? qty * unitPrice) || 0;

        return {
          ...(source ?? mapScannedProductToCartItem({
            id: productId ?? productUnitId ?? `${index}-${lineIndex}`,
            productUnitId: productUnitId ?? undefined,
            barcode: calculated.barcode ?? "",
            name: productName,
          })),
          id: productUnitId ?? productId ?? source?.id ?? `${index}-${lineIndex}`,
          product_id: productId ?? source?.product_id ?? source?.id ?? null,
          productUnitId,
          barcode: calculated.barcode ?? source?.barcode ?? null,
          name: productName,
          product_name: productName,
          price: unitPrice,
          qty,
          unit: line.unitCode ?? line.unit_code ?? source?.unit,
          unit_code: line.unitCode ?? line.unit_code ?? source?.unit_code ?? null,
          unitName:
            line.unitNameTh ??
            line.unit_name_th ??
            line.unitName ??
            line.unit_name ??
            source?.unitName ??
            null,
          conversionToBase:
            Number(line.conversionToBase ?? line.conversion_to_base ?? source?.conversionToBase ?? 1) ||
            1,
          unit_price: unitPrice,
          sale_price: unitPrice,
          discount_amount: 0,
          final_price: totalAmount,
          total_amount: totalAmount,
          pricingBreakdown: [line],
          allow_discount: getAllowDiscount(
            calculated,
            normalizeAllowDiscount(source?.allow_discount),
          ),
          discount: Number(source?.discount ?? 0) || 0,
        };
      });
    }

    const productUnitId =
      calculated.productUnitId ?? calculated.product_unit_id ?? null;
    const qty = Number(calculated.qty ?? source?.qty ?? 0) || 0;
    const unitPrice =
      Number(
        calculated.unitPrice ??
          calculated.unit_price ??
          calculated.salePrice ??
          calculated.sale_price ??
          source?.unit_price ??
          source?.price ??
          0,
      ) || 0;
    const finalPrice =
      Number(
        calculated.finalPrice ??
          calculated.final_price ??
          calculated.totalAmount ??
          calculated.total_amount ??
          calculated.subtotal ??
          qty * unitPrice,
      ) || 0;

    return {
      ...(source ?? mapScannedProductToCartItem({
        id: productId ?? productUnitId ?? index,
        productUnitId: productUnitId ?? undefined,
        barcode: calculated.barcode ?? "",
        name: productName,
      })),
      id: productUnitId ?? productId ?? source?.id ?? index,
      product_id: productId ?? source?.product_id ?? source?.id ?? null,
      productUnitId,
      barcode: calculated.barcode ?? source?.barcode ?? null,
      name: productName,
      product_name: productName,
      price: unitPrice,
      qty,
      unit: calculated.unitCode ?? calculated.unit_code ?? source?.unit,
      unit_code: calculated.unitCode ?? calculated.unit_code ?? source?.unit_code ?? null,
      unitName: calculated.unitName ?? calculated.unit_name ?? source?.unitName ?? null,
      unit_price: unitPrice,
      sale_price: calculated.salePrice ?? calculated.sale_price ?? source?.sale_price ?? unitPrice,
      discount_amount:
        calculated.discountAmount ?? calculated.discount_amount ?? source?.discount_amount ?? 0,
      final_price: finalPrice,
      total_amount:
        calculated.totalAmount ?? calculated.total_amount ?? finalPrice,
      pricingBreakdown:
        calculated.pricingBreakdown ?? calculated.pricing_breakdown,
      allow_discount: getAllowDiscount(
        calculated,
        normalizeAllowDiscount(source?.allow_discount),
      ),
      discount: Number(source?.discount ?? 0) || 0,
    };
  });

  return mappedItems;
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
    throw new Error(message || `à¹‚à¸«à¸¥à¸”à¸£à¸²à¸¢à¸à¸²à¸£à¸šà¸´à¸¥à¸žà¸±à¸ไม่สำเร็จ (${response.status})`);
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
    throw new Error(message || `à¹‚à¸«à¸¥à¸”à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸šà¸´à¸¥à¸žà¸±à¸ไม่สำเร็จ (${response.status})`);
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
    throw new Error((Array.isArray(data) ? "" : data.message) || `โหลดการตั้งค่าร้านไม่สำเร็จ (${response.status})`);
  }
};

const deleteHeldBill = async (id: HeldBill["id"]): Promise<void> => {
  const response = await heldBillFetch(`/held-bills/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const data = (await response.json().catch(() => ({}))) as { message?: string };

  if (!response.ok) {
    throw new Error((Array.isArray(data) ? "" : data.message) || `โหลดการตั้งค่าร้านไม่สำเร็จ (${response.status})`);
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
    allow_discount: getAllowDiscount(item),
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
  const [sourceCart, setSourceCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchedProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isBarcodeScannerEnabled, setIsBarcodeScannerEnabled] = useState(true);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [pendingScanInput, setPendingScanInput] =
    useState<PendingScanInput | null>(null);
  const [scanInputValue, setScanInputValue] = useState("");
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    store_name: "AVA MY POS",
    vat_enabled: false,
    vat_rate: 0,
    auto_pack_pricing_scope: "DISABLED",
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
  const [discountPopupError, setDiscountPopupError] = useState<string | null>(null);
  const [isCheckingDiscount, setIsCheckingDiscount] = useState(false);
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
  const [autoConvertUnitPrice, setAutoConvertUnitPrice] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const holdBillNameRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<CartItem[]>([]);
  const sourceCartRef = useRef<CartItem[]>([]);
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
  const { playFirstProductScan, playNoProductsFound } = usePosScanSound();
  const isProductPage = [
    "products",
    "productList",
    "categories",
    "printBarcode",
    "productStocks",
    "priceQuotation",
    "promotion",
  ].includes(currentPage);

  const clearBarcodeBuffer = () => {
    barcodeBufferRef.current = "";
    setBarcodeBuffer("");
    if (barcodeTimerRef.current) {
      clearTimeout(barcodeTimerRef.current);
      barcodeTimerRef.current = null;
    }
  };
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
            item.discount ?? 0,
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

  const commitCartChange = async (
    nextSourceItems: CartItem[],
    options: { selectedName?: string | null; focus?: boolean } = {},
  ): Promise<boolean> => {
    const storedDevice = await window.electronStore.get("pos_device");
    const autoPackPricingScope = normalizeAutoPackPricingScope(
      storeSettings.auto_pack_pricing_scope,
    );
    const shouldAutoConvert =
      autoPackPricingScope === "ALL_CUSTOMERS" ||
      (autoPackPricingScope === "MEMBERS_ONLY" && Boolean(selectedCustomer));
    setAutoConvertUnitPrice(shouldAutoConvert);

    if (!shouldAutoConvert) {
      sourceCartRef.current = nextSourceItems;
      cartRef.current = nextSourceItems;
      setSourceCart(nextSourceItems);
      setCart(nextSourceItems);
      if (options.selectedName !== undefined) {
        setSelectedCartItemName(options.selectedName);
      }
      if (options.focus !== false) {
        focusBarcodeInput();
      }
      return true;
    }

    if (!nextSourceItems.length) {
      sourceCartRef.current = [];
      cartRef.current = [];
      setSourceCart([]);
      setCart([]);
      setPromotionSubtotal(0);
      setDiscountTotal(0);
      setGrandTotal(0);
      setAppliedPromotions([]);
      setPromotionError(null);
      if (options.selectedName !== undefined) {
        setSelectedCartItemName(options.selectedName);
      }
      if (options.focus !== false) {
        focusBarcodeInput();
      }
      return true;
    }

    const machineId = getStoredMachineId(storedDevice);
    if (!machineId) {
      setScanMessage("ไม่พบ machine_id à¸รุณาลงทะเบียนเครื่อง POS à¸่อน");
      return false;
    }

    setPromotionLoading(true);
    setPromotionError(null);
    try {
      sourceCartRef.current = nextSourceItems;
      setSourceCart(nextSourceItems);
      console.log("Source cart before calculate:", nextSourceItems);
      const calculableItems = nextSourceItems.filter(
        (item) => getCalculableProductUnitId(item) != null,
      );
      const uncalculableItems = nextSourceItems.filter(
        (item) => getCalculableProductUnitId(item) == null,
      );

      if (!calculableItems.length) {
        const fallbackTotal = nextSourceItems.reduce(
          (sum, item) =>
            sum + (Number(item.total_amount ?? item.final_price ?? item.price * item.qty) || 0),
          0,
        );
        const promotionResult = await calculateCartPromotions(nextSourceItems);
        const promotionItems = applyCalculatedPromotionsToCartItems(
          nextSourceItems,
          promotionResult.items ?? [],
        );

        cartRef.current = promotionItems;
        setCart(promotionItems);
        setPromotionSubtotal(Number(promotionResult.subtotal ?? fallbackTotal) || 0);
        setDiscountTotal(Number(promotionResult.discount_total ?? 0) || 0);
        setGrandTotal(Number(promotionResult.grand_total ?? fallbackTotal) || 0);
        setAppliedPromotions(promotionResult.applied_promotions ?? []);
        if (options.selectedName !== undefined) {
          setSelectedCartItemName(options.selectedName);
        }
        if (options.focus !== false) {
          focusBarcodeInput();
        }
        return true;
      }

      const result = await calculateCartUnitPrices(machineId, calculableItems);
      console.log("calculate-cart response", result);
      console.log("cart before update", cartRef.current);
      const updatedItems = [
        ...mapCalculatedCartItems(calculableItems, getCalculateCartItems(result)),
        ...uncalculableItems,
      ];
      console.log("cart after update", updatedItems);
      const uncalculableTotal = uncalculableItems.reduce(
        (sum, item) =>
          sum + (Number(item.total_amount ?? item.final_price ?? item.price * item.qty) || 0),
        0,
      );
      const fallbackSubtotal = updatedItems.reduce(
        (sum, item) =>
          sum + (Number(item.total_amount ?? item.final_price ?? item.price * item.qty) || 0),
        0,
      );
      const calculateCartSubtotal =
        getCalculateCartSubtotal(result, fallbackSubtotal - uncalculableTotal) +
        uncalculableTotal;
      const promotionResult = await calculateCartPromotions(updatedItems);
      const promotionItems = applyCalculatedPromotionsToCartItems(
        updatedItems,
        promotionResult.items ?? [],
      );

      cartRef.current = promotionItems;
      setCart(promotionItems);
      setPromotionSubtotal(Number(promotionResult.subtotal ?? calculateCartSubtotal) || 0);
      setDiscountTotal(Number(promotionResult.discount_total ?? getCalculateCartDiscountTotal(result)) || 0);
      setGrandTotal(
        Number(
          promotionResult.grand_total ??
            getCalculateCartGrandTotal(result, fallbackSubtotal - uncalculableTotal) +
              uncalculableTotal,
        ) || 0,
      );
      setAppliedPromotions(promotionResult.applied_promotions ?? []);
      if (options.selectedName !== undefined) {
        const selectedExists =
          options.selectedName &&
          promotionItems.some((item) => item.name === options.selectedName);
        setSelectedCartItemName(
          selectedExists ? options.selectedName ?? null : promotionItems[0]?.name ?? null,
        );
      }
      if (options.focus !== false) {
        focusBarcodeInput();
      }
      return true;
    } catch (error) {
      console.error("Calculate cart error:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "ไม่สามารถคำนวณราคาหน่วยสินค้าได้";
      setScanMessage(message);
      setPromotionError(message);
      return false;
    } finally {
      setPromotionLoading(false);
    }
  };

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    sourceCartRef.current = sourceCart;
  }, [sourceCart]);
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

      if (autoConvertUnitPrice) {
        return;
      }

      setPromotionLoading(true);
      setPromotionError(null);

      try {
        const result = await calculateCartPromotions(cart);
        if (isCancelled) {
          return;
        }

        const promotionDiscountTotal = Number(result.discount_total ?? 0) || 0;
        const manualDiscountTotal = cart.reduce((sum, item) => {
          const lineTotal =
            (Number(item.qty) || 0) *
            (Number(item.unit_price ?? item.price ?? item.sale_price ?? 0) || 0);
          const manualDiscount = Math.min(
            Math.max(Number(item.discount ?? 0) || 0, 0),
            lineTotal,
          );

          return sum + manualDiscount;
        }, 0);

        setPromotionSubtotal(Number(result.subtotal ?? normalSubTotal) || 0);
        setDiscountTotal(promotionDiscountTotal + manualDiscountTotal);
        setGrandTotal(
          Math.max(
            (Number(result.grand_total ?? normalSubTotal) || 0) -
              manualDiscountTotal,
            0,
          ),
        );
        setAppliedPromotions(result.applied_promotions ?? []);

        const calculatedItems = result.items ?? [];
        setCart((currentItems) =>
          applyCalculatedPromotionsToCartItems(currentItems, calculatedItems),
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
  }, [autoConvertUnitPrice, cartPromotionSignature, normalSubTotal]);

  const changeQty = (name: string, delta: number) => {
    const currentSourceCart = sourceCartRef.current;
    const changedIndex = currentSourceCart.findIndex((item) => item.name === name);
    const nextItems = currentSourceCart
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

    let nextSelectedName = selectedCartItemName;
    if (!nextItems.some((item) => item.name === name)) {
      if (
        selectedCartItemName !== name &&
        selectedCartItemName !== null &&
        nextItems.some((item) => item.name === selectedCartItemName)
      ) {
        nextSelectedName = selectedCartItemName;
      } else if (nextItems.length === 0) {
        nextSelectedName = null;
      } else {
        const nextIndex = Math.min(
          Math.max(changedIndex, 0),
          nextItems.length - 1,
        );
        nextSelectedName = nextItems[nextIndex].name;
      }
    }

    void commitCartChange(nextItems, { selectedName: nextSelectedName });
  };

  const removeItem = (name: string) => {
    const currentSourceCart = sourceCartRef.current;
    const removedIndex = currentSourceCart.findIndex((item) => item.name === name);
    const remainingItems = currentSourceCart.filter((item) => item.name !== name);

    let nextSelectedName = selectedCartItemName;
    if (
      selectedCartItemName !== name &&
      selectedCartItemName !== null &&
      remainingItems.some((item) => item.name === selectedCartItemName)
    ) {
      nextSelectedName = selectedCartItemName;
    } else if (remainingItems.length === 0) {
      nextSelectedName = null;
    } else {
      const nextIndex = Math.min(
        Math.max(removedIndex, 0),
        remainingItems.length - 1,
      );
      nextSelectedName = remainingItems[nextIndex].name;
    }

    void commitCartChange(remainingItems, { selectedName: nextSelectedName });
  };

  const clearCart = () => {
    sourceCartRef.current = [];
    setSourceCart([]);
    setCart([]);
    setPromotionSubtotal(0);
    setDiscountTotal(0);
    setGrandTotal(0);
    setAppliedPromotions([]);
    setPromotionError(null);
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
      throw new Error("à¹„à¸¡à¹ˆà¸žà¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸‡à¸²à¸™ à¸รุณา Login ใหม่");
    }

    if (!machineId) {
      throw new Error("ไม่พบ machine_id à¸รุณาลงทะเบียนเครื่อง POS à¸่อน");
    }

    if (cart.length === 0) {
      throw new Error("à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸ªà¸´à¸™à¸„à¹‰à¸²à¹ƒà¸™à¸•à¸°à¸ร้า");
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
          allow_discount: getAllowDiscount(item),
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
      throw new Error("à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¸´à¸™à¸„à¹‰à¸²à¹ƒà¸™à¸•à¸°à¸à¸£à¹‰à¸²à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡ à¸à¸£à¸¸à¸“à¸²à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸£à¸²à¸¢à¸ารสินค้า");
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
        holdBillName.trim() || "à¸šà¸´à¸¥à¸žà¸±à¸",
      );
      console.log("POST /held-bills payload", payload);
      await createHeldBill(payload);
      clearCart();
      setShowHoldBillModal(false);
      setHoldBillName("");
      setPosToast("à¸žà¸±à¸บิลสำเร็จ");
    } catch (error) {
      setHoldBillError(getHeldBillErrorMessage(error, "à¸žà¸±à¸บิลไม่สำเร็จ"));
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
        getHeldBillErrorMessage(error, "à¹‚à¸«à¸¥à¸”à¸£à¸²à¸¢à¸à¸²à¸£à¸šà¸´à¸¥à¸žà¸±à¸ไม่สำเร็จ"),
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
        "à¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¹à¸—à¸™à¸—à¸µà¹ˆà¸•à¸°à¸à¸£à¹‰à¸²à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¸”à¹‰à¸§à¸¢à¸šà¸´à¸¥à¸žà¸±à¸นี้หรือไม่?",
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
        getHeldBillErrorMessage(error, "à¹‚à¸«à¸¥à¸”à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸šà¸´à¸¥à¸žà¸±à¸ไม่สำเร็จ"),
      );
    } finally {
      setOpeningHeldBillId(null);
    }
  };

  const openPriceInput = (product: ScannedProduct) => {
    const price = getScannedProductPrice(product);
    setScanInputValue(price > 0 ? String(price) : "");
    setScanMessage(null);
    setPendingScanInput({ type: "PRICE", product });
  };

  const closeScanInput = () => {
    setPendingScanInput(null);
    setScanInputValue("");
    setScanMessage(null);
  };

  const addFavoriteProduct = async (product: FavoriteProduct) => {
    console.log("Favorite product clicked:", product);
    let resolvedProduct = product;
    const priceMode = resolvedProduct.price_mode ?? "FIXED_PRICE";
    let defaultUnit =
      getDefaultProductUnit(resolvedProduct) ?? getFallbackProductUnit(resolvedProduct);
    console.log("Resolved default unit:", defaultUnit);
    let cartProduct = defaultUnit
      ? mapFavoriteProductUnitToScannedProduct(resolvedProduct, defaultUnit)
      : null;

    if (!cartProduct && resolvedProduct.barcode) {
      try {
        const scanResult = await scanProduct(resolvedProduct.barcode);
        if (scanResult.success && scanResult.product) {
          cartProduct = scanResult.product;
        }
      } catch (error) {
        console.error("Resolve favorite product by barcode error:", error);
      }
    }

    if (!cartProduct) {
      const detail = await fetchFavoriteProductDetail(resolvedProduct.id).catch(() => null);
      if (detail) {
        resolvedProduct = { ...resolvedProduct, ...detail };
      }
      const units = await fetchFavoriteProductUnits(resolvedProduct.id);
      defaultUnit =
        getDefaultProductUnit({ ...resolvedProduct, productUnits: units }) ??
        getFallbackProductUnit(resolvedProduct);
      if (!defaultUnit && units.length === 0) {
        defaultUnit = await createLegacyBaseProductUnit(resolvedProduct);
      }
      console.log("Resolved default unit from product units API:", defaultUnit);
      cartProduct = defaultUnit
        ? mapFavoriteProductUnitToScannedProduct(resolvedProduct, defaultUnit)
        : null;
    }

    if (!cartProduct) {
      console.warn("[Favorite Add To Cart] product unit not found", {
        productId: resolvedProduct.id,
        productName: resolvedProduct.product_name,
        savedProductUnitId: resolvedProduct.productUnitId ?? resolvedProduct.product_unit_id,
        units: getFavoriteProductUnits(resolvedProduct),
        product: resolvedProduct,
      });
      setScanMessage(`ไม่พบหน่วยขายของสินค้า ${resolvedProduct.product_name}`);
      return;
    }

    console.log("[Favorite Add To Cart]", {
      favoriteProductId: product.id,
      productId: getScannedProductId(cartProduct),
      productUnitId: getScannedProductUnitId(cartProduct),
      productName: getScannedProductName(cartProduct),
    });

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

    void addScannedProductToCart(
      cartProduct,
      getScannedProductPrice(cartProduct),
    );
  };

  const addFavoriteProductLegacy = (product: FavoriteProduct) => {
    const priceMode = product.price_mode ?? "FIXED_PRICE";
    const cartProduct: ScannedProduct = {
      id: product.id,
      barcode: product.barcode ?? "",
      name: product.product_name,
      product_type:
        priceMode === "WEIGHT_PRICE" ? "WEIGHT" : priceMode,
      sale_price: Number(product.sale_price) || 0,
      stock_qty: product.stock_qty,
      allow_discount: getAllowDiscount(product),
      unit:
        product.unit_code ||
        (priceMode === "WEIGHT_PRICE" ? "à¸à¸." : undefined),
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

    void addScannedProductToCart(cartProduct, Number(product.sale_price) || 0);
  };

  const addScannedProductToCart = async (
    product: ScannedProduct,
    price: number,
    qty = 1,
  ): Promise<boolean> => {
    const productName = getScannedProductName(product);
    const productUnitId = getScannedProductUnitId(product);
    const currentCart = sourceCartRef.current;
    const found = currentCart.find((item) => isSameScannedCartItem(item, product));
    const nextItems = found
      ? currentCart.map((item) =>
          item === found
            ? {
                ...item,
                product_id: item.product_id ?? getScannedProductId(product),
                productUnitId: item.productUnitId ?? productUnitId,
                barcode: item.barcode ?? product.barcode ?? null,
                allow_discount: getAllowDiscount(product, getAllowDiscount(item)),
                qty: item.qty + qty,
                totalBaseQty: Number(item.totalBaseQty ?? item.qty) + qty,
                final_price: (item.qty + qty) * item.price,
                total_amount: (item.qty + qty) * item.price,
              }
            : item,
        )
      : [...currentCart, mapScannedProductToCartItem(product, price, qty)];

    return commitCartChange(nextItems, { selectedName: productName });
  };

  const changeItemDiscount = (name: string, discount: number) => {
    const applyDiscount = (items: CartItem[]): CartItem[] =>
      items.map((item) => {
        if (item.name !== name || !item.allow_discount) {
          return item;
        }

        const lineTotal =
          Number(item.regularAmount ?? item.price * item.qty) || item.price * item.qty;
        const nextDiscount = Math.min(Math.max(discount, 0), lineTotal);
        const nextTotal = Math.max(lineTotal - nextDiscount, 0);

        return {
          ...item,
          discount: nextDiscount,
          discount_amount: nextDiscount,
          final_price: nextTotal,
          total_amount: nextTotal,
        };
      });

    setSourceCart((items) => {
      const nextItems = applyDiscount(items);
      sourceCartRef.current = nextItems;
      return nextItems;
    });
    setCart((items) => {
      const nextItems = applyDiscount(items);
      cartRef.current = nextItems;
      return nextItems;
    });
  };

  const openDiscountPopup = (name: string) => {
    const item = cart.find((cartItem) => cartItem.name === name);
    if (!item || !item.allow_discount) {
      return;
    }

    setSelectedCartItemName(name);
    setDiscountPopupItemName(name);
    setDiscountInputValue(item.discount ? String(item.discount) : "");
    setDiscountPopupError(null);
  };

  const closeDiscountPopup = () => {
    if (isCheckingDiscount) {
      return;
    }

    setDiscountPopupItemName(null);
    setDiscountInputValue("");
    setDiscountPopupError(null);
  };

  const confirmDiscountPopup = async () => {
    if (!discountPopupItemName || isCheckingDiscount) {
      return;
    }

    setDiscountPopupError(null);

    const discountAmount = Number(discountInputValue);
    const currentItem = cart.find((item) => item.name === discountPopupItemName);
    const lineTotal = currentItem ? currentItem.price * currentItem.qty : 0;

    if (!currentItem) {
      setDiscountPopupError("à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸ªà¸´à¸™à¸„à¹‰à¸²à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸ารให้ส่วนลด");
      return;
    }

    if (!Number.isFinite(discountAmount)) {
      setDiscountPopupError("à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸ส่วนลดเป็นตัวเลข");
      return;
    }

    if (discountAmount < 0) {
      setDiscountPopupError("ส่วนลดต้องไม่ติดลบ");
      return;
    }

    if (discountAmount > lineTotal) {
      setDiscountPopupError("à¸ªà¹ˆà¸§à¸™à¸¥à¸”à¸•à¹‰à¸­à¸‡à¹„à¸¡à¹ˆà¹€à¸à¸´à¸™à¸¢à¸­à¸”à¸£à¸§à¸¡à¸£à¸²à¸¢à¸ารสินค้า");
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
      changeItemDiscount(discountPopupItemName, discountAmount);
      closeDiscountPopup();
      return;
    }

    const productId = currentItem.product_id ?? currentItem.id;
    const machineId = getStoredMachineId(storedDevice);

    if (
      productId === undefined ||
      productId === null ||
      !String(productId).trim() ||
      !machineId
    ) {
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
        product_id: String(productId),
        qty: currentItem.qty,
        machine_id: machineId,
        discount_amount: discountAmount,
      });

      if (!response.permitted) {
        setDiscountPopupError(
          getDiscountErrorMessage(
            response.message || "This discount exceeds the allowed limit.",
          ),
        );
        return;
      }

      changeItemDiscount(discountPopupItemName, discountAmount);
      setDiscountPopupItemName(null);
      setDiscountInputValue("");
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

  const fetchCustomerList = async () => {
    setIsLoadingCustomers(true);
    setCustomerLoadError(null);

    try {
      setCustomers(await loadCustomers());
    } catch (error) {
      setCustomerLoadError(
        error instanceof Error
          ? error.message
          : "à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¹‚à¸«à¸¥à¸”à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸¥à¸¹à¸ค้าได้",
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
    const productId = product.product_id ?? product.id;
    const productName = product.name ?? product.product_name ?? "-";
    const productPrice = Number(product.price ?? product.sale_price) || 0;
    const productUnit = product.unit ?? product.unit_code ?? undefined;
    const cartProduct: ScannedProduct = {
      id: productId,
      barcode: product.barcode ?? "",
      name: productName,
      productName,
      product_name: productName,
      product_type:
        product.price_mode === "WEIGHT_PRICE"
          ? "WEIGHT"
          : product.price_mode,
      sale_price: productPrice,
      salePrice: productPrice,
      stock_qty: product.stock_qty,
      allow_discount: getAllowDiscount(product),
      unit: productUnit || (product.price_mode === "WEIGHT_PRICE" ? "à¸à¸." : undefined),
      unitCode: productUnit,
      unit_code: productUnit ?? undefined,
      price_per_unit: productPrice,
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

    void addScannedProductToCart(cartProduct, Number(product.price) || 0);
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
          const scannedProduct = await enrichScannedProductFromSearch(
            scanResult.product,
            normalizedBarcode,
          );

          if (
            scanResult.code === "WEIGHT_REQUIRED" ||
            scannedProduct.product_type === "WEIGHT"
          ) {
            setScanInputValue("");
            setPendingScanInput({ type: "WEIGHT", product: scannedProduct });
            setSearchQuery("");
            shouldRefocusSearch = false;
            return;
          }

          if (
            scanResult.code === "PRICE_REQUIRED" ||
            scannedProduct.product_type === "OPEN_PRICE" ||
            scannedProduct.product_type === "SERVICE_PRICE"
          ) {
            openPriceInput(scannedProduct);
            setSearchQuery("");
            shouldRefocusSearch = false;
            return;
          }

          await addScannedProductToCart(
            scannedProduct,
            getScannedProductPrice(scannedProduct),
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
          (product.name ?? product.product_name ?? "").toLowerCase() ===
            keyword.toLowerCase(),
      );

      if (products.length === 1 || exactMatch) {
        selectSearchedProduct(exactMatch ?? products[0]);
        return;
      }

      setSearchResults(products);
      setSearchMessage(`พบสินค้า ${products.length} à¸£à¸²à¸¢à¸à¸²à¸£ à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¸£à¸²à¸¢à¸าร`);
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

  // ประมวลผลบาร์โค้ดที่ "normalize à¹à¸¥à¹‰à¸§" à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ à¸«à¹‰à¸²à¸¡à¹€à¸£à¸µà¸¢à¸ normalizeBarcode ซ้ำที่นี่
  // (ของเดิม bug à¸­à¸¢à¸¹à¹ˆà¸•à¸£à¸‡à¸—à¸µà¹ˆà¸„à¸´à¸§à¹€à¸็บค่าที่ normalize à¹à¸¥à¹‰à¸§ à¹ต่ดันเอาไปวนเข้า
  // handleBarcodeScan ใหม่ ทำให้ normalizeBarcode à¸–à¸¹à¸à¹€à¸£à¸µà¸¢à¸à¸‹à¹‰à¸³à¸ªà¸­à¸‡à¸„à¸£à¸±à¹‰à¸‡à¸à¸±à¸šà¸šà¸²à¸£à¹Œà¹‚à¸„à¹‰à¸”
  // à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™ à¸–à¹‰à¸²à¹€à¸à¸´à¸”à¸¡à¸µà¸­à¸±à¸à¸‚à¸£à¸°à¸­à¸¢à¹ˆà¸²à¸‡ "-", "/", "." à¸›à¸™à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸šà¸²à¸£à¹Œà¹‚à¸„à¹‰à¸”à¸ˆà¸£à¸´à¸‡ à¸¡à¸±à¸™à¸ˆà¸°à¸–à¸¹à¸
  // à¹à¸›à¸¥à¸‡à¹€à¸›à¹‡à¸™à¸•à¸±à¸§à¹€à¸¥à¸‚à¸œà¸´à¸”à¹† à¸‹à¹‰à¸³à¸­à¸µà¸à¸£à¸­à¸š à¸—à¸³à¹ƒà¸«à¹‰à¸¢à¸´à¸‡à¸šà¸²à¸£à¹Œà¹‚à¸„à¹‰à¸”à¸‹à¹‰à¸³à¹ล้วหาไม่เจอ)
  const processNormalizedBarcode = async (normalizedBarcode: string) => {
    if (!normalizedBarcode) {
      return;
    }

    if (!isBarcodeScannerEnabled) {
      setScanMessage(BARCODE_NOT_FOUND_MESSAGE);
      clearBarcodeBuffer();
      pendingBarcodeScanQueueRef.current = [];
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
        playNoProductsFound();
        setScanMessage(BARCODE_NOT_FOUND_MESSAGE);
        return;
      }

      if (!result.success || !result.product) {
        playNoProductsFound();
        setScanMessage(BARCODE_NOT_FOUND_MESSAGE);
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

      const isFirstProductScan = cartRef.current.length === 0;
      await addScannedProductToCart(
        result.product,
        getScannedProductPrice(result.product),
      );
      if (isFirstProductScan) {
        playFirstProductScan();
      }
    } catch (error) {
      console.error("Scan API error:", error);
      setScanMessage(
        error instanceof Error && error.message
          ? error.message
          : BARCODE_SCAN_FAILED_MESSAGE,
      );
    } finally {
      barcodeBufferRef.current = "";
      setBarcodeBuffer("");
      isScanningRef.current = false;
      setIsScanning(false);

      const pendingBarcode = pendingBarcodeScanQueueRef.current.shift();
      if (pendingBarcode) {
        // pendingBarcode à¸–à¸¹à¸ normalize à¸¡à¸²à¹à¸¥à¹‰à¸§à¸•à¸±à¹‰à¸‡à¹ต่ตอน push à¹€à¸‚à¹‰à¸²à¸„à¸´à¸§
        // à¸ˆà¸¶à¸‡à¹€à¸£à¸µà¸¢à¸ processNormalizedBarcode à¸•à¸£à¸‡à¹† à¸«à¹‰à¸²à¸¡à¸§à¸™à¸ลับไป normalize ซ้ำ
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

  const confirmScanInput = async () => {
    if (!pendingScanInput) {
      return;
    }

    const value = Number(scanInputValue);
    if (!Number.isFinite(value) || value <= 0) {
      setScanMessage(
        pendingScanInput.type === "WEIGHT"
          ? "à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸™à¹‰à¸³à¸«à¸™à¸±à¸à¸¡à¸²à¸à¸ว่า 0"
          : "à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸£à¸²à¸„à¸²à¸¡à¸²à¸à¸ว่า 0",
      );
      scanInputRef.current?.focus();
      return;
    }

    const didUpdate =
      pendingScanInput.type === "WEIGHT"
        ? await addScannedProductToCart(
        pendingScanInput.product,
        getScannedProductPrice(pendingScanInput.product),
        value,
          )
        : await addScannedProductToCart(pendingScanInput.product, value);

    if (!didUpdate) {
      return;
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
          getHeldBillErrorMessage(error, "à¸¥à¸šà¸šà¸´à¸¥à¸žà¸±à¸หลังชำระเงินไม่สำเร็จ"),
        );
        return;
      }
    }

    window.alert(`ชำระเงินสำเร็จ ${formatBaht(total)}`);
    clearCart();
  };

  // à¸ˆà¸±à¸”à¸ารคีย์บอร์ดสำหรับ Popup à¸¢à¸·à¸™à¸¢à¸±à¸™à¸ารลบ
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

  // à¹‚à¸Ÿà¸à¸±à¸ªà¸Šà¹ˆà¸­à¸‡à¸à¸£à¸­à¸ส่วนลดเมื่อ popup ส่วนลดเปิดขึ้น
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

  // ปิด popup à¸ªà¹ˆà¸§à¸™à¸¥à¸”à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¸–à¹‰à¸²à¸£à¸²à¸¢à¸à¸²à¸£à¸ªà¸´à¸™à¸„à¹‰à¸²à¸™à¸±à¹‰à¸™à¸–à¸¹à¸à¸¥à¸šà¸­à¸­à¸à¸ˆà¸²à¸à¸•à¸°à¸à¸£à¹‰à¸²à¹ล้ว
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
          const autoPackPricingScope = normalizeAutoPackPricingScope(
            settings.auto_pack_pricing_scope,
          );
          setStoreSettings({
            store_name: settings.store_name?.trim() || "AVA MY POS",
            vat_enabled: Boolean(settings.vat_enabled),
            vat_rate: Number(settings.vat_rate) || 0,
            auto_pack_pricing_scope: autoPackPricingScope,
          });
          setAutoConvertUnitPrice(
            autoPackPricingScope === "ALL_CUSTOMERS" ||
              (autoPackPricingScope === "MEMBERS_ONLY" &&
                Boolean(selectedCustomer)),
          );
        }
      } catch (err) {
        console.error("Error loading store settings:", err);
        if (!isCancelled) {
          setStoreSettings({
            store_name: "AVA MY POS",
            vat_enabled: false,
            vat_rate: 0,
            auto_pack_pricing_scope: "DISABLED",
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
  }, [currentPage, selectedCustomer]);

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
    isBarcodeScannerEnabled,
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

      // ปุ่ม Escape -> à¸¢à¸à¹€à¸¥à¸´à¸
      if (event.key === "Escape") {
        event.preventDefault();
        cancelButtonRef.current?.click();
        return;
      }

      // ปุ่ม Tab -> à¸§à¸™à¹„à¸›à¸¡à¸²à¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡à¸›à¸¸à¹ˆà¸¡ à¸¢à¸à¹€à¸¥à¸´à¸ à¹ละ ยืนยัน
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

  // à¸ˆà¸±à¸”à¸à¸²à¸£à¸„à¸µà¸¢à¹Œà¸šà¸­à¸£à¹Œà¸”à¸«à¸¥à¸±à¸
  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      const isTyping = isEditableKeyboardTarget(event.target);
      const isBarcodeScannerInput = event.target === barcodeInputRef.current;

      // ถ้า Popup à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¸¥à¸šà¹€à¸›à¸´à¸”à¸­à¸¢à¸¹à¹ˆ à¹ƒà¸«à¹‰à¸‚à¹‰à¸²à¸¡à¸ารทำงานทั้งหมด
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

      if (event.key === "F4") {
        event.preventDefault();
        if (cart.length > 0) {
          setCurrentPage("posPayment");
        }
        return;
      }

      if (isTyping && !isBarcodeScannerInput) {
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
              onClick={() => {
                setIsBarcodeScannerEnabled((enabled) => {
                  const nextEnabled = !enabled;
                  clearBarcodeBuffer();
                  pendingBarcodeScanQueueRef.current = [];
                  setScanMessage(null);
                  if (nextEnabled) {
                    focusBarcodeInput();
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
            >
              <IconKeyboard size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                clearBarcodeBuffer();
                focusBarcodeInput();
              }}
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
        ) : currentPage === "receipts" ? (
          <ReceiptPage />
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
                      const pricingBreakdown = item.pricingBreakdown ?? [];
                      const storedNetTotal =
                        Number(item.total_amount ?? item.final_price) || 0;
                      const lineTotal =
                        Number(item.regularAmount) ||
                        (storedNetTotal > 0 &&
                        Number(item.discount_amount ?? item.discount ?? 0) > 0
                          ? storedNetTotal +
                            Number(item.discount_amount ?? item.discount ?? 0)
                          : item.price * item.qty);
                      const unitLabel =
                        item.unitName ?? item.unit_code ?? item.unit ?? "";
                      const lineDiscount = Math.min(
                        Math.max(
                          Number(item.discount_amount ?? item.discount ?? 0) || 0,
                          0,
                        ),
                        lineTotal,
                      );
                      const lineNetTotal =
                        storedNetTotal > 0
                          ? storedNetTotal
                          : Math.max(lineTotal - lineDiscount, 0);

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
                            {pricingBreakdown.length > 0 ? (
                              <div className="mt-1 space-y-0.5">
                                {pricingBreakdown.map((line, lineIndex) => {
                                  const breakdownUnitLabel =
                                    getBreakdownUnitName(line) ??
                                    getBreakdownUnitCode(line) ??
                                    "หน่วย";
                                  const breakdownQty = getBreakdownQty(line);
                                  const breakdownTotal = getBreakdownTotalAmount(line);

                                  return (
                                    <p
                                      key={`${getBreakdownProductUnitId(line) ?? lineIndex}-${lineIndex}`}
                                      className="flex min-w-[190px] justify-between gap-3 text-xs text-slate-500"
                                    >
                                      <span>
                                        {breakdownUnitLabel} x {breakdownQty}
                                      </span>
                                      <span>{formatBaht(breakdownTotal)}</span>
                                    </p>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500">
                                {formatBaht(item.price)} x {item.qty}
                                {unitLabel ? ` ${unitLabel}` : ""}
                              </p>
                            )}
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
                                className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                                  lineDiscount > 0
                                    ? "border-blue-200 bg-blue-50 text-[#1d6fd8] hover:border-blue-300 hover:bg-blue-100"
                                    : "border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-[#1d6fd8]"
                                }`}
                              >
                                <IconDiscount size={16} stroke={2.2} />
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
                          <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                            <span>ส่วนลด {formatBaht(lineDiscount)}</span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openDiscountPopup(item.name);
                              }}
                              title="แก้ไขส่วนลดรายการนี้"
                              aria-label="แก้ไขส่วนลดรายการนี้"
                              className="flex h-7 w-7 items-center justify-center rounded-md text-emerald-700 transition hover:bg-emerald-100 hover:text-emerald-900"
                            >
                              <IconPencil size={16} />
                            </button>
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
          <HeldBillsPopup
            heldBills={heldBills}
            heldBillsError={heldBillsError}
            isLoadingHeldBills={isLoadingHeldBills}
            openingHeldBillId={openingHeldBillId}
            formatBaht={formatBaht}
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

        {pendingScanInput ? (
          <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4">
            <form
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
              onSubmit={(event) => {
                event.preventDefault();
                void confirmScanInput();
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

        {discountPopupItemName && discountPopupItem ? (
          <DiscountPopup
            item={discountPopupItem}
            value={discountInputValue}
            inputRef={discountInputRef}
            formatBaht={formatBaht}
            onChange={setDiscountInputValue}
            onClose={closeDiscountPopup}
            onConfirm={confirmDiscountPopup}
            isLoading={isCheckingDiscount}
            errorMessage={discountPopupError}
          />
        ) : null}

        {showShortcuts ? (
          <KeyboardShortcutsPopup onClose={() => setShowShortcuts(false)} />
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
