import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  IconBox,
  IconChevronDown,
  IconEye,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { ensureValidAccessToken, refreshAccessToken } from "./auth";
import { normalizeBarcode } from "./BarcodeNormalizer";

interface Category {
  id: number | string;
  category_name: string;
  product_count?: number;
  [key: string]: unknown;
}

interface Product {
  id: number | string;
  sku?: string;
  barcode?: string;
  description?: string | null;
  product_name: string;
  category_id: number | string;
  unit_code: string;
  unit_id?: number | string | null;
  unit?: {
    id?: number | string;
    unit_group_id?: number | string;
    unit_code?: string;
    unit_name_th?: string;
    [key: string]: unknown;
  } | null;
  price_mode: PriceMode;
  cost_price: number;
  sale_price: number;
  stock_qty: number;
  min_stock_qty: number;
  track_stock: boolean;
  allow_discount: boolean;
  status?: string;
  image_url?: string | null;
  [key: string]: unknown;
}

interface PaginatedProductsResponse {
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface ProductStockResponse {
  productId?: number | string;
  stockBaseQty?: number | string | null;
  minStockBaseQty?: number | string | null;
}

interface Unit {
  id: number | string;
  unit_code: string;
  unit_name_th: string;
  unit_name_en?: string;
  unitCode?: string;
  unitNameTh?: string;
  unitNameEn?: string;
  symbol?: string;
  unit_group_id?: number | string;
}

interface ProductUnit {
  id?: number | string;
  productUnitId?: number | string;
  product_unit_id?: number | string;
  productId?: number | string;
  product_id?: number | string;
  unitId?: number | string;
  unit_id?: number | string;
  unitCode?: string;
  unit_code?: string;
  barcode: string;
  conversionToBase?: number;
  conversion_to_base?: number;
  salePrice?: number;
  sale_price?: number;
  costPrice?: number;
  cost_price?: number;
  isBase?: boolean;
  is_base?: boolean;
  isActive?: boolean;
  is_active?: boolean;
  sortOrder?: number;
  sort_order?: number;
  unit?: Unit;
}

interface ProductUnitFormItem {
  clientId: string;
  productUnitId?: number | string;
  unitId: number | string | "";
  barcode: string;
  conversionToBase: string;
  salePrice: string;
  costPrice: string;
  isBase: boolean;
  isActive: boolean;
  sortOrder: number;
  isNew: boolean;
  isDirty: boolean;
  isDeleted: boolean;
}

interface CreateProductUnitPayload {
  unitId: number | string;
  barcode: string;
  conversionToBase: number;
  salePrice: number;
  costPrice: number;
  isBase: boolean;
  isActive: boolean;
  sortOrder: number;
}

type UpdateProductUnitPayload = Partial<CreateProductUnitPayload>;

type ProductUnitSnapshot = {
  unitId: string;
  barcode: string;
  conversionToBase: string;
  salePrice: string;
  costPrice: string;
  isBase: boolean;
  isActive: boolean;
  sortOrder: number;
};

interface UnitGroup {
  id: number | string;
  group_code: string;
  group_name_th: string;
  group_name_en?: string;
  units: Unit[];
}

type PriceMode = "FIXED_PRICE" | "WEIGHT_PRICE" | "OPEN_PRICE" | "SERVICE_PRICE";

interface ScannedProduct {
  id: number | string;
  barcode?: string;
  name: string;
  product_type: "FIXED_PRICE" | "WEIGHT" | "WEIGHT_PRICE" | "OPEN_PRICE" | "SERVICE_PRICE";
  sale_price?: number;
  stock_qty?: number;
}

interface ScanProductResponse {
  success: boolean;
  code?: string;
  message?: string;
  product?: ScannedProduct;
}

interface OpeningStockPayload {
  productId: number | string;
  unitId: number | string;
  storeId: number;
  stockBaseQty: number;
  deviceId: number;
  referenceType: "MANUAL";
  referenceId: string;
  reasonCode: "OPENING";
  note: string;
}

const PRICE_MODE_OPTIONS: { value: PriceMode; label: string; hint: string }[] = [
  {
    value: "FIXED_PRICE",
    label: "สินค้าปกติ",
    hint: "ราคา = จำนวน × ราคาต่อหน่วย",
  },
  {
    value: "WEIGHT_PRICE",
    label: "สินค้าชั่งน้ำหนัก",
    hint: "ราคา = น้ำหนัก × ราคาต่อกก./หน่วยน้ำหนัก",
  },
  {
    value: "OPEN_PRICE",
    label: "สินค้าปรับราคาได้",
    hint: "พนักงานกรอกราคาเองตอนขาย",
  },
  {
    value: "SERVICE_PRICE",
    label: "บริการ",
    hint: "ไม่มีต้นทุน กรอกเฉพาะราคาขาย เช่น บริการโอนเงิน 1,000 บาท",
  },
];

const EMPTY_FORM = {
  sku: "",
  barcode: "",
  description: "",
  product_name: "",
  category_id: "",
  unit_code: "",
  unit_id: "",
  price_mode: "FIXED_PRICE" as PriceMode,
  cost_price: "",
  sale_price: "",
  stock_qty: "",
  min_stock_qty: "",
  track_stock: true,
  allow_discount: true,
  image_url: "" as string | null | "",
};

const PRODUCT_NOT_FOUND_ADDABLE_MESSAGE = "ไม่มีสินค้าในระบบ สามารถเพิ่มสินค้าได้";

const SCANNER_INPUT_INTERVAL_MS = 45;
const SCANNER_NORMALIZE_DELAY_MS = 80;
const SCANNER_MIN_RAPID_CHARS = 5;
const BARCODE_MIN_DIGITS = 6;

const shouldNormalizeScannerSearch = (
  rawValue: string,
  rapidInputCount: number,
): boolean => {
  if (rapidInputCount < SCANNER_MIN_RAPID_CHARS) {
    return false;
  }

  const normalizedValue = normalizeBarcode(rawValue);
  if (normalizedValue === rawValue.trim()) {
    return false;
  }

  const digitCount = normalizedValue.replace(/\D/g, "").length;
  return digitCount >= BARCODE_MIN_DIGITS && !/[\u0E00-\u0E7F]/.test(normalizedValue);
};

const createClientId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `unit-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createEmptyProductUnit = (sortOrder: number): ProductUnitFormItem => ({
  clientId: createClientId(),
  unitId: "",
  barcode: "",
  conversionToBase: sortOrder === 1 ? "1" : "",
  salePrice: "",
  costPrice: "",
  isBase: sortOrder === 1,
  isActive: true,
  sortOrder,
  isNew: true,
  isDirty: false,
  isDeleted: false,
});

const getDisplayCategoryName = (categoryName: string): string =>
  categoryName === "General" ? "สินค้าทั่วไป" : categoryName;

const buildProductsPath = (
  page: number,
  limit: number,
  search: string,
  categoryId: string,
) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const trimmedSearch = search.trim();
  if (trimmedSearch) params.set("search", trimmedSearch);
  if (categoryId) params.set("category_id", categoryId);
  return `/products?${params.toString()}`;
};

const mergeUniqueProducts = (
  currentProducts: Product[],
  nextProducts: Product[],
) => {
  const byId = new Map<string, Product>();
  currentProducts.forEach((product) => byId.set(String(product.id), product));
  nextProducts.forEach((product) => byId.set(String(product.id), product));
  return Array.from(byId.values());
};

const getApiBaseUrl = async (): Promise<string> => {
  const apiPath = await window.electronStore.get("apiPath");

  if (typeof apiPath !== "string" || !apiPath.trim()) {
    throw new Error("ไม่พบ API endpoint ใน store");
  }

  return apiPath.trim().replace(/\/+$/, "");
};

const authorizedFetch = async (
  path: string,
  init: RequestInit = {},
): Promise<Response> => {
  const isAuthenticated = await ensureValidAccessToken();

  if (!isAuthenticated) {
    throw new Error("ไม่สามารถยืนยันตัวตนได้");
  }

  const apiBaseUrl = await getApiBaseUrl();
  let accessToken = await window.electronStore.get("access_token");

  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw new Error("ไม่พบ access token");
  }

  const request = (token: string) =>
    fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: (() => {
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${token}`);
        return headers;
      })(),
    });

  let response = await request(accessToken);

  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    response = await request(accessToken);
  }

  return response;
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

const scanProductByBarcode = async (
  barcode: string,
): Promise<ScanProductResponse> => {
  const storedDevice = await window.electronStore.get("pos_device");
  const machineId = getStoredMachineId(storedDevice);

  if (!machineId) {
    throw new Error("ไม่พบ machine_id กรุณาลงทะเบียนเครื่อง POS ก่อน");
  }

  const response = await authorizedFetch("/pos/scan-product", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      barcode,
      machine_id: machineId,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as ScanProductResponse;

  if (!response.ok && data.code !== "PRODUCT_NOT_FOUND") {
    throw new Error(data.message || `สแกนสินค้าไม่สำเร็จ (${response.status})`);
  }

  return data;
};

const getApiErrorMessage = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  try {
    const data: { message?: string | string[]; error?: string } =
      await response.json();

    if (Array.isArray(data.message)) {
      return data.message.join(", ");
    }

    return data.message || data.error || fallback;
  } catch {
    return fallback;
  }
};

const numberValue = (value: unknown, fallback = 0): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const getDeviceId = async (): Promise<number> => {
  const stored = await window.electronStore.get("pos_device");
  const device =
    stored && typeof stored === "object"
      ? (stored as {
          id?: unknown;
          deviceId?: unknown;
          device_id?: unknown;
          pos_device?: {
            id?: unknown;
            deviceId?: unknown;
            device_id?: unknown;
          };
        })
      : {};
  const deviceId = numberValue(
    device.device_id ??
      device.deviceId ??
      device.id ??
      device.pos_device?.device_id ??
      device.pos_device?.deviceId ??
      device.pos_device?.id,
  );
  if (!deviceId) throw new Error("ไม่พบ deviceId กรุณาลงทะเบียนเครื่อง POS ก่อน");
  return deviceId;
};

const getCurrentStoreId = async (): Promise<number> => {
  const response = await authorizedFetch("/store/settings");
  if (!response.ok) {
    const message = await getApiErrorMessage(
      response,
      `โหลดข้อมูลร้านไม่สำเร็จ (${response.status})`,
    );
    throw new Error(message);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    data?: {
      store?: {
        id?: unknown;
        storeId?: unknown;
        store_id?: unknown;
      };
    };
    store?: {
      id?: unknown;
      storeId?: unknown;
      store_id?: unknown;
    };
  };
  const store = payload.data?.store ?? payload.store;
  const storeId = numberValue(store?.id ?? store?.storeId ?? store?.store_id);
  if (!storeId) throw new Error("ไม่พบ storeId สำหรับบันทึกสต๊อก");
  return storeId;
};

const createStockReferenceId = (): string => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `OPEN-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const createOpeningStock = async (payload: OpeningStockPayload): Promise<void> => {
  const response = await authorizedFetch("/stocks/opening", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await getApiErrorMessage(
      response,
      `บันทึกสต๊อกเริ่มต้นไม่สำเร็จ (${response.status})`,
    );
    throw new Error(message);
  }
};

const getProductStock = async (
  productId: number | string,
): Promise<ProductStockResponse | null> => {
  const response = await authorizedFetch(`/stocks/${productId}`);

  if (response.status === 404) return null;

  if (!response.ok) {
    const message = await getApiErrorMessage(
      response,
      `Check product stock failed (${response.status})`,
    );
    throw new Error(message);
  }

  return (await response.json().catch(() => null)) as ProductStockResponse | null;
};

const ensureProductStockExists = async (
  productId: number | string,
  openingStockPayload?: OpeningStockPayload,
): Promise<void> => {
  const stock = await getProductStock(productId);
  if (stock) return;

  if (!openingStockPayload) {
    throw new Error("Product stock not found. Cannot update minimum stock.");
  }

  await createOpeningStock(openingStockPayload);
};

const updateMinStock = async (
  productId: number | string,
  minStockBaseQty: number,
  storeId: number,
  openingStockPayload?: OpeningStockPayload,
): Promise<void> => {
  await ensureProductStockExists(productId, openingStockPayload);

  const response = await authorizedFetch(`/stocks/${productId}/min-stock`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ minStockBaseQty, storeId }),
  });

  if (!response.ok) {
    const message = await getApiErrorMessage(
      response,
      `กำหนดสต๊อกขั้นต่ำไม่สำเร็จ (${response.status})`,
    );
    throw new Error(message);
  }
};

const translateApiErrorMessage = (message: string): string => {
  if (/Barcode already exists/i.test(message)) {
    return "บาร์โค้ดนี้มีอยู่ในระบบแล้ว";
  }
  if (/This product unit has stock movement history/i.test(message)) {
    return "หน่วยนี้มีประวัติการเคลื่อนไหวสต๊อกแล้ว กรุณาปิดการขายหน่วยนี้แทนการลบ";
  }
  if (/Product unit not found/i.test(message)) {
    return "ไม่พบหน่วยสินค้านี้";
  }
  if (/Base unit conversion must be 1/i.test(message)) {
    return "หน่วยฐานต้องมีจำนวนเทียบหน่วยฐานเท่ากับ 1";
  }
  return message;
};

const isActiveProduct = (product: Product): boolean =>
  String(product.status ?? "ACTIVE").toUpperCase() !== "INACTIVE";

const unwrapUnitGroupsResponse = (payload: unknown): UnitGroup[] => {
  if (Array.isArray(payload)) {
    return payload as UnitGroup[];
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: unknown }).data;
    if (data && typeof data === "object" && "data" in data) {
      const nestedData = (data as { data?: unknown }).data;
      return Array.isArray(nestedData) ? (nestedData as UnitGroup[]) : [];
    }
    return Array.isArray(data) ? (data as UnitGroup[]) : [];
  }

  return [];
};

const unwrapUnitsResponse = (payload: unknown): Unit[] => {
  if (Array.isArray(payload)) {
    return payload as Unit[];
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: unknown }).data;
    if (data && typeof data === "object" && "data" in data) {
      const nestedData = (data as { data?: unknown }).data;
      return Array.isArray(nestedData) ? (nestedData as Unit[]) : [];
    }
    return Array.isArray(data) ? (data as Unit[]) : [];
  }

  return [];
};

const unwrapProductUnitsResponse = (payload: unknown): ProductUnit[] => {
  if (Array.isArray(payload)) {
    return payload as ProductUnit[];
  }

  if (payload && typeof payload === "object" && "items" in payload) {
    const items = (payload as { items?: unknown }).items;
    return Array.isArray(items) ? (items as ProductUnit[]) : [];
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data as ProductUnit[];
    }
    if (data && typeof data === "object" && "items" in data) {
      const items = (data as { items?: unknown }).items;
      return Array.isArray(items) ? (items as ProductUnit[]) : [];
    }
    if (data && typeof data === "object" && "data" in data) {
      const nestedData = (data as { data?: unknown }).data;
      return Array.isArray(nestedData) ? (nestedData as ProductUnit[]) : [];
    }
  }

  return [];
};

const unwrapProductUnitResponse = (payload: unknown): ProductUnit => {
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: unknown }).data;
    if (data && typeof data === "object" && "data" in data) {
      return ((data as { data?: ProductUnit }).data ?? {}) as ProductUnit;
    }
    return (data ?? {}) as ProductUnit;
  }
  return (payload ?? {}) as ProductUnit;
};

const unwrapProductResponse = (payload: unknown): Product | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("data" in payload) {
    const data = (payload as { data?: unknown }).data;
    if (data && typeof data === "object" && "data" in data) {
      return ((data as { data?: Product }).data ?? null) as Product | null;
    }
    return (data ?? null) as Product | null;
  }

  return payload as Product;
};

const unwrapProductsListResponse = (payload: unknown): Product[] => {
  if (Array.isArray(payload)) {
    return payload as Product[];
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data as Product[];
    }
    if (data && typeof data === "object" && "data" in data) {
      const nestedData = (data as { data?: unknown }).data;
      return Array.isArray(nestedData) ? (nestedData as Product[]) : [];
    }
  }

  return [];
};

const fetchUnitGroupsWithUnits = async (): Promise<UnitGroup[]> => {
  const response = await authorizedFetch("/unit-groups/with-units");

  if (!response.ok) {
    const message = await getApiErrorMessage(
      response,
      `โหลดข้อมูลหน่วยไม่สำเร็จ (${response.status})`,
    );
    throw new Error(message);
  }

  return unwrapUnitGroupsResponse(await response.json().catch(() => []));
};

const getUnits = async (): Promise<Unit[]> => {
  const response = await authorizedFetch("/units");

  if (!response.ok) {
    const message = await getApiErrorMessage(
      response,
      `โหลดข้อมูลหน่วยไม่สำเร็จ (${response.status})`,
    );
    throw new Error(translateApiErrorMessage(message));
  }

  return unwrapUnitsResponse(await response.json().catch(() => []));
};

const getProductUnits = async (
  productId: string | number,
): Promise<ProductUnit[]> => {
  const response = await authorizedFetch(`/products/${productId}/units`);

  if (!response.ok) {
    const message = await getApiErrorMessage(
      response,
      `โหลดหน่วยสินค้าไม่สำเร็จ (${response.status})`,
    );
    throw new Error(translateApiErrorMessage(message));
  }

  return unwrapProductUnitsResponse(await response.json().catch(() => []));
};

const createProductUnit = async (
  productId: string | number,
  payload: CreateProductUnitPayload,
): Promise<ProductUnit> => {
  const response = await authorizedFetch(`/products/${productId}/units`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await getApiErrorMessage(
      response,
      `เพิ่มหน่วยสินค้าไม่สำเร็จ (${response.status})`,
    );
    throw new Error(translateApiErrorMessage(message));
  }

  return unwrapProductUnitResponse(await response.json().catch(() => ({})));
};

const updateProductUnit = async (
  productId: string | number,
  productUnitId: string | number,
  payload: UpdateProductUnitPayload,
): Promise<ProductUnit> => {
  const response = await authorizedFetch(
    `/products/${productId}/units/${productUnitId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const message = await getApiErrorMessage(
      response,
      `แก้ไขหน่วยสินค้าไม่สำเร็จ (${response.status})`,
    );
    throw new Error(translateApiErrorMessage(message));
  }

  return unwrapProductUnitResponse(await response.json().catch(() => ({})));
};

const deleteProductUnit = async (
  productId: string | number,
  productUnitId: string | number,
): Promise<void> => {
  const response = await authorizedFetch(
    `/products/${productId}/units/${productUnitId}`,
    { method: "DELETE" },
  );

  if (!response.ok) {
    const message = await getApiErrorMessage(
      response,
      `ลบหน่วยสินค้าไม่สำเร็จ (${response.status})`,
    );
    throw new Error(translateApiErrorMessage(message));
  }
};

const setBaseProductUnit = async (
  productId: string | number,
  productUnitId: string | number,
): Promise<ProductUnit> => {
  const response = await authorizedFetch(
    `/products/${productId}/units/${productUnitId}/set-base`,
    { method: "POST" },
  );

  if (!response.ok) {
    const message = await getApiErrorMessage(
      response,
      `ตั้งหน่วยฐานไม่สำเร็จ (${response.status})`,
    );
    throw new Error(translateApiErrorMessage(message));
  }

  return unwrapProductUnitResponse(await response.json().catch(() => ({})));
};

const deactivateProduct = async (product: Product): Promise<void> => {
  const patchResponse = await authorizedFetch(`/products/${product.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "INACTIVE" }),
  });

  if (patchResponse.ok) {
    return;
  }

  const unitId = product.unit_id ?? product.unit?.id;
  const payload = {
    sku: product.sku,
    barcode: product.barcode,
    description: product.description ?? null,
    product_name: product.product_name,
    category_id: Number(product.category_id) || product.category_id,
    unit_code: product.unit_code,
    unit_id: Number(unitId) || unitId,
    price_mode: product.price_mode,
    cost_price: Number(product.cost_price) || 0,
    sale_price: Number(product.sale_price) || 0,
    stock_qty: Number(product.stock_qty) || 0,
    min_stock_qty: Number(product.min_stock_qty) || 0,
    track_stock: product.track_stock,
    allow_discount: product.allow_discount,
    status: "INACTIVE",
    image_url: product.image_url ?? null,
  };
  const putResponse = await authorizedFetch(`/products/${product.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!putResponse.ok) {
    const message = await getApiErrorMessage(
      putResponse,
      `ปิดการใช้งานสินค้าไม่สำเร็จ (${putResponse.status})`,
    );
    throw new Error(translateApiErrorMessage(message));
  }
};

const findUnitByCode = (
  groups: UnitGroup[],
  unitCode?: string | null,
): { unitGroup: UnitGroup; unit: Unit } | null => {
  const code = unitCode?.trim();
  if (!code) {
    return null;
  }

  for (const unitGroup of groups) {
    const unit = unitGroup.units.find(
      (item) => item.unit_code.trim() === code,
    );
    if (unit) {
      return { unitGroup, unit };
    }
  }

  return null;
};

const getUnitId = (unit: ProductUnit): number | string | "" =>
  unit.unitId ?? unit.unit_id ?? unit.unit?.id ?? "";

const getProductUnitId = (unit: ProductUnit): number | string | undefined =>
  unit.productUnitId ?? unit.product_unit_id ?? unit.id;

const getUnitCode = (unit?: Unit | ProductUnit | null): string =>
  unit?.unitCode || unit?.unit_code || "";

const getUnitName = (unit?: Unit | null): string =>
  unit?.unitNameTh ||
  unit?.unit_name_th ||
  unit?.unitCode ||
  unit?.unit_code ||
  "";

const mapProductUnitToFormItem = (
  productUnit: ProductUnit,
  index: number,
  availableUnitList: Unit[] = [],
): ProductUnitFormItem => ({
  clientId: createClientId(),
  productUnitId: getProductUnitId(productUnit),
  unitId:
    getUnitId(productUnit) ||
    availableUnitList.find(
      (unit) =>
        getUnitCode(unit).trim() &&
        getUnitCode(unit).trim() ===
          (getUnitCode(productUnit) || getUnitCode(productUnit.unit)).trim(),
    )?.id ||
    "",
  barcode: productUnit.barcode ?? "",
  conversionToBase: String(
    productUnit.conversionToBase ?? productUnit.conversion_to_base ?? 1,
  ),
  salePrice: String(productUnit.salePrice ?? productUnit.sale_price ?? ""),
  costPrice: String(productUnit.costPrice ?? productUnit.cost_price ?? ""),
  isBase: Boolean(productUnit.isBase ?? productUnit.is_base),
  isActive: productUnit.isActive ?? productUnit.is_active ?? true,
  sortOrder: productUnit.sortOrder ?? productUnit.sort_order ?? index + 1,
  isNew: false,
  isDirty: false,
  isDeleted: false,
});

const normalizeDecimal = (value: string | number): string => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "";
};

const createProductUnitSnapshot = (
  item: ProductUnitFormItem,
): ProductUnitSnapshot => ({
  unitId: String(item.unitId),
  barcode: normalizeBarcode(item.barcode),
  conversionToBase: normalizeDecimal(item.conversionToBase),
  salePrice: normalizeDecimal(item.salePrice),
  costPrice: normalizeDecimal(item.costPrice),
  isBase: item.isBase,
  isActive: item.isActive,
  sortOrder: Number(item.sortOrder) || 1,
});

const hasProductUnitChanged = (
  item: ProductUnitFormItem,
  original?: ProductUnitSnapshot,
): boolean => {
  if (!original) return item.isDirty;

  const current = createProductUnitSnapshot(item);
  return (
    current.unitId !== original.unitId ||
    current.barcode !== original.barcode ||
    current.conversionToBase !== original.conversionToBase ||
    current.salePrice !== original.salePrice ||
    current.costPrice !== original.costPrice ||
    current.isBase !== original.isBase ||
    current.isActive !== original.isActive ||
    current.sortOrder !== original.sortOrder
  );
};

const toProductUnitPayload = (
  item: ProductUnitFormItem,
): CreateProductUnitPayload => ({
  unitId: item.unitId,
  barcode: normalizeBarcode(item.barcode),
  conversionToBase: item.isBase ? 1 : Number(item.conversionToBase) || 0,
  salePrice: Number(item.salePrice) || 0,
  costPrice: Number(item.costPrice) || 0,
  isBase: item.isBase,
  isActive: item.isActive,
  sortOrder: item.sortOrder,
});

const toUpdateProductUnitPayload = (
  item: ProductUnitFormItem,
): UpdateProductUnitPayload => ({
  unitId: item.unitId,
  barcode: normalizeBarcode(item.barcode),
  conversionToBase: item.isBase ? 1 : Number(item.conversionToBase) || 0,
  salePrice: Number(item.salePrice) || 0,
  costPrice: Number(item.costPrice) || 0,
  isActive: item.isActive,
  sortOrder: item.sortOrder,
});

const findMatchingProductUnit = (
  item: ProductUnitFormItem,
  productUnitsList: ProductUnit[],
): ProductUnit | null => {
  const barcode = normalizeBarcode(item.barcode);
  const unitId = String(item.unitId || "");

  return (
    productUnitsList.find(
      (productUnit) =>
        barcode &&
        normalizeBarcode(productUnit.barcode ?? "") === barcode,
    ) ??
    productUnitsList.find((productUnit) => String(getUnitId(productUnit)) === unitId) ??
    null
  );
};

// แปลง image_url ที่ได้จาก API (เช่น "/images/xxx.jpg") ให้เป็น URL เต็มสำหรับแสดงผล <img>
const resolveImageUrl = async (
  imageUrl?: string | null,
): Promise<string | null> => {
  if (!imageUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  try {
    const apiBaseUrl = await getApiBaseUrl();
    return `${apiBaseUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
  } catch {
    return imageUrl;
  }
};

// แยกชื่อไฟล์ออกจาก image_url เพื่อใช้เรียก DELETE /images/:filename
const getImageFilename = (imageUrl?: string | null): string | null => {
  if (!imageUrl) {
    return null;
  }
  const parts = imageUrl.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
};

// อัปโหลดรูปสินค้า -> POST /images/upload (multipart/form-data) คืนค่า url ของรูปที่อัปโหลดแล้ว
const uploadProductImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await authorizedFetch("/images/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await getApiErrorMessage(
      response,
      `อัปโหลดรูปไม่สำเร็จ (${response.status})`,
    );
    throw new Error(message);
  }

  const data: {
    url?: string;
    image_url?: string;
    imageUrl?: string;
    path?: string;
    filename?: string;
    data?:
      | string
      | {
          url?: string;
          image_url?: string;
          imageUrl?: string;
          path?: string;
          filename?: string;
        };
  } = await response.json().catch(() => ({}));

  const nestedData = typeof data.data === "object" ? data.data : undefined;
  const uploadedImageUrl =
    data.url ||
    data.image_url ||
    data.imageUrl ||
    data.path ||
    (typeof data.data === "string" ? data.data : undefined) ||
    nestedData?.url ||
    nestedData?.image_url ||
    nestedData?.imageUrl ||
    nestedData?.path ||
    (data.filename ? `/images/${data.filename}` : undefined) ||
    (nestedData?.filename ? `/images/${nestedData.filename}` : undefined) ||
    response.headers.get("Location");

  if (!uploadedImageUrl) {
    throw new Error("อัปโหลดรูปสำเร็จ แต่ไม่พบ URL ของรูปที่อัปโหลด");
  }

  return uploadedImageUrl;
};

// ลบรูปสินค้าเดิม -> DELETE /images/:filename (ไม่ทำให้ทั้ง flow ล้มเหลวถ้าลบรูปไม่สำเร็จ)
const deleteProductImage = async (imageUrl?: string | null): Promise<void> => {
  const filename = getImageFilename(imageUrl);

  if (!filename) {
    return;
  }

  try {
    await authorizedFetch(`/images/${filename}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.error("Error deleting image:", err);
  }
};

export default function ProductLandingpage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchInputTimingRef = useRef({
    lastInputAt: 0,
    rapidInputCount: 0,
  });
  const searchNormalizeTimerRef = useRef<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<
    Product["id"] | null
  >(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [unitGroups, setUnitGroups] = useState<UnitGroup[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [productUnits, setProductUnits] = useState<ProductUnitFormItem[]>([
    createEmptyProductUnit(1),
  ]);
  const [isUnitLinkingEnabled, setIsUnitLinkingEnabled] = useState(false);
  const [isUnitSectionOpen, setIsUnitSectionOpen] = useState(false);
  const [selectedUnitGroupId, setSelectedUnitGroupId] = useState("");
  const [isLoadingUnitGroups, setIsLoadingUnitGroups] = useState(false);
  const [unitGroupsError, setUnitGroupsError] = useState<string | null>(null);
  const [productUnitsError, setProductUnitsError] = useState<string | null>(null);
  const unitGroupsLoadingRef = useRef(false);
  const unitGroupsRequestRef = useRef<Promise<UnitGroup[]> | null>(null);
  const originalProductUnitsRef = useRef<Map<string, ProductUnitSnapshot>>(
    new Map(),
  );

  // รูปสินค้าที่เลือกใหม่ (ยังไม่อัปโหลด) + พรีวิวในฟอร์ม
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null);
  const [fullImagePreviewUrl, setFullImagePreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // แคช URL เต็มของรูปสินค้าแต่ละชิ้น (key = product id)
  const [resolvedImageUrls, setResolvedImageUrls] = useState<
    Record<string, string>
  >({});
  const [productStockById, setProductStockById] = useState<
    Record<string, ProductStockResponse | null>
  >({});

  // url รูปเดิมของสินค้าที่กำลังแก้ไข (ใช้เทียบเพื่อรู้ว่าต้องลบรูปเดิมออกจาก server หรือไม่)
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(
    null,
  );
  const [deletingProductId, setDeletingProductId] = useState<
    Product["id"] | null
  >(null);
  const [productPendingDelete, setProductPendingDelete] =
    useState<Product | null>(null);
  const loadingRef = useRef(false);

  const loadUnitGroups = useCallback(async (): Promise<UnitGroup[]> => {
    if (unitGroups.length > 0) {
      return unitGroups;
    }

    if (unitGroupsRequestRef.current) {
      return unitGroupsRequestRef.current;
    }

    unitGroupsLoadingRef.current = true;
    setIsLoadingUnitGroups(true);
    setUnitGroupsError(null);

    const request = (async () => {
      const groups = await fetchUnitGroupsWithUnits();
      setUnitGroups(groups);
      getUnits()
        .then(setUnits)
        .catch((err) => console.warn("GET /units failed, using grouped units", err));
      return groups;
    })();

    unitGroupsRequestRef.current = request;

    try {
      return await request;
    } catch (err) {
      console.error("Error fetching unit groups:", err);
      setUnitGroupsError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถโหลดข้อมูลหน่วยได้ กรุณาลองใหม่อีกครั้ง",
      );
      return [];
    } finally {
      unitGroupsRequestRef.current = null;
      unitGroupsLoadingRef.current = false;
      setIsLoadingUnitGroups(false);
    }
  }, [unitGroups]);

  const fetchCategories = async () => {
    try {
      const response = await authorizedFetch("/categories");
      if (!response.ok) {
        return;
      }
      const data: Category[] | { data?: Category[] } = await response.json();
      const list = Array.isArray(data) ? data : data.data ?? [];
      setCategories(list);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const loadProducts = useCallback(
    async ({
      pageToLoad,
      searchKeyword,
      categoryId,
      reset,
    }: {
      pageToLoad: number;
      searchKeyword: string;
      categoryId: string;
      reset: boolean;
    }) => {
    if (loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await authorizedFetch(
        buildProductsPath(pageToLoad, limit, searchKeyword, categoryId),
      );

      if (!response.ok) {
        throw new Error(`โหลดข้อมูลไม่สำเร็จ (${response.status})`);
      }

      const payload = (await response.json()) as PaginatedProductsResponse;
      const list = Array.isArray(payload.data) ? payload.data : [];
      setProducts((currentProducts) =>
        reset ? list : mergeUniqueProducts(currentProducts, list),
      );
      setPage(payload.pagination?.page ?? pageToLoad);
      setHasMore(Boolean(payload.pagination?.hasMore));
    } catch (err) {
      console.error("Error fetching products:", err);
      setError("ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
    },
    [limit],
  );

  const fetchProducts = useCallback(() => {
    setProducts([]);
    setPage(1);
    setHasMore(true);
    setProductStockById({});
    return loadProducts({
      pageToLoad: 1,
      searchKeyword: debouncedSearch,
      categoryId: selectedCategoryId,
      reset: true,
    });
  }, [debouncedSearch, loadProducts, selectedCategoryId]);

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value;
    const now = window.performance.now();
    const timing = searchInputTimingRef.current;
    const isRapidInput =
      timing.lastInputAt > 0 && now - timing.lastInputAt <= SCANNER_INPUT_INTERVAL_MS;

    timing.rapidInputCount = isRapidInput ? timing.rapidInputCount + 1 : 1;
    timing.lastInputAt = now;

    setSearchTerm(rawValue);

    if (searchNormalizeTimerRef.current !== null) {
      window.clearTimeout(searchNormalizeTimerRef.current);
    }

    searchNormalizeTimerRef.current = window.setTimeout(() => {
      const latestTiming = searchInputTimingRef.current;
      if (shouldNormalizeScannerSearch(rawValue, latestTiming.rapidInputCount)) {
        setSearchTerm(normalizeBarcode(rawValue));
      }
      latestTiming.rapidInputCount = 0;
      latestTiming.lastInputAt = 0;
      searchNormalizeTimerRef.current = null;
    }, SCANNER_NORMALIZE_DELAY_MS);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    return () => {
      if (searchNormalizeTimerRef.current !== null) {
        window.clearTimeout(searchNormalizeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    setProducts([]);
    setResolvedImageUrls({});
    setProductStockById({});
    setPage(1);
    setHasMore(true);
    void loadProducts({
      pageToLoad: 1,
      searchKeyword: debouncedSearch,
      categoryId: selectedCategoryId,
      reset: true,
    });
  }, [debouncedSearch, loadProducts, selectedCategoryId]);

  useEffect(() => {
    if (
      isModalOpen &&
      editingProductId === null &&
      !form.category_id &&
      categories.length > 0
    ) {
      setForm((current) => ({
        ...current,
        category_id: String(categories[0].id),
      }));
    }
  }, [categories, editingProductId, form.category_id, isModalOpen]);

  // เมื่อรายการสินค้าเปลี่ยน ให้แปลง image_url ของแต่ละสินค้าเป็น URL เต็มสำหรับแสดงผล
  useEffect(() => {
    let isCancelled = false;

    const loadVisibleStocks = async () => {
      const productsToLoad = products.filter(
        (product) =>
          product.track_stock &&
          productStockById[String(product.id)] === undefined,
      );

      if (productsToLoad.length === 0) return;

      const entries = await Promise.all(
        productsToLoad.map(async (product) => {
          try {
            const stock = await getProductStock(product.id);
            return [String(product.id), stock] as const;
          } catch (err) {
            console.error("Error fetching product stock:", err);
            return [String(product.id), null] as const;
          }
        }),
      );

      if (isCancelled) return;

      setProductStockById((current) => {
        const next = { ...current };
        entries.forEach(([id, stock]) => {
          next[id] = stock;
        });
        return next;
      });
    };

    void loadVisibleStocks();

    return () => {
      isCancelled = true;
    };
  }, [productStockById, products]);

  useEffect(() => {
    let isCancelled = false;

    const resolveAll = async () => {
      const entries = await Promise.all(
        products
          .filter((product) => product.image_url)
          .map(async (product) => {
            const fullUrl = await resolveImageUrl(product.image_url);
            return [String(product.id), fullUrl] as const;
          }),
      );

      if (isCancelled) {
        return;
      }

      const next: Record<string, string> = {};
      entries.forEach(([id, url]) => {
        if (url) {
          next[id] = url;
        }
      });
      setResolvedImageUrls(next);
    };

    resolveAll();

    return () => {
      isCancelled = true;
    };
  }, [products]);

  useEffect(() => {
    let isCancelled = false;

    const resolveFormImage = async () => {
      if (!form.image_url) {
        setFormImageUrl(null);
        return;
      }

      const resolvedUrl =
        resolvedImageUrls[String(editingProductId)] ??
        (await resolveImageUrl(form.image_url));
      if (!isCancelled) {
        setFormImageUrl(resolvedUrl);
      }
    };

    void resolveFormImage();

    return () => {
      isCancelled = true;
    };
  }, [editingProductId, form.image_url, resolvedImageUrls]);

  // จัดเรียงหมวดหมู่ โดยให้ "สินค้าทั่วไป" (General) ขึ้นก่อน
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const aName = a.category_name;
      const bName = b.category_name;
      
      // ให้ "General" อยู่ก่อน
      if (aName === "General") return -1;
      if (bName === "General") return 1;
      
      // เรียงตามชื่อตามปกติ
      return aName.localeCompare(bName);
    });
  }, [categories]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    sortedCategories.forEach((category) => {
      map.set(
        String(category.id),
        getDisplayCategoryName(category.category_name),
      );
    });
    return map;
  }, [sortedCategories]);

  const selectedUnitGroup = useMemo(
    () =>
      unitGroups.find(
        (unitGroup) => String(unitGroup.id) === selectedUnitGroupId,
      ) ?? null,
    [selectedUnitGroupId, unitGroups],
  );

  const availableUnits = selectedUnitGroup?.units ?? [];
  const allUnits = useMemo(() => {
    const byId = new Map<string, Unit>();
    unitGroups.forEach((unitGroup) => {
      unitGroup.units.forEach((unit) => byId.set(String(unit.id), unit));
    });
    units.forEach((unit) => byId.set(String(unit.id), unit));
    return Array.from(byId.values());
  }, [unitGroups, units]);

  const unitById = useMemo(() => {
    const map = new Map<string, Unit>();
    allUnits.forEach((unit) => map.set(String(unit.id), unit));
    return map;
  }, [allUnits]);

  useEffect(() => {
    if (isModalOpen) {
      void loadUnitGroups();
    }
  }, [isModalOpen, loadUnitGroups]);

  const selectedCategoryLabel =
    selectedCategoryId === ""
      ? "สินค้าทั้งหมด"
      : categoryNameById.get(selectedCategoryId) ?? "สินค้าทั้งหมด";

  const selectedCategoryProductCount = useMemo(() => {
    if (selectedCategoryId === "") {
      return sortedCategories.reduce(
        (total, category) => total + Number(category.product_count ?? 0),
        0,
      );
    }

    const selectedCategory = sortedCategories.find(
      (category) => String(category.id) === selectedCategoryId,
    );
    return Number(selectedCategory?.product_count ?? 0);
  }, [selectedCategoryId, sortedCategories]);

  const handleSelectCategory = (categoryId: string) => {
    setProducts([]);
    setResolvedImageUrls({});
    setPage(1);
    setHasMore(true);
    setSelectedCategoryId(categoryId);
    setIsCategoryMenuOpen(false);
  };

  const filteredProducts = products.filter(isActiveProduct);

  const resetImageSelection = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    setImagePreviewUrl(null);
    setFormImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openAddModal = () => {
    setEditingProductId(null);
    setEditingProduct(null);
    setForm({
      ...EMPTY_FORM,
      category_id: sortedCategories.length > 0 ? String(sortedCategories[0].id) : "",
    });
    setProductUnits([createEmptyProductUnit(1)]);
    originalProductUnitsRef.current = new Map();
    setIsUnitLinkingEnabled(false);
    setIsUnitSectionOpen(false);
    setSelectedUnitGroupId("");
    setSubmitError(null);
    setProductUnitsError(null);
    setOriginalImageUrl(null);
    setFullImagePreviewUrl(null);
    resetImageSelection();
    setIsModalOpen(true);
  };

  const openFullImagePreview = async () => {
    if (imagePreviewUrl) {
      setFullImagePreviewUrl(imagePreviewUrl);
      return;
    }

    const resolvedUrl =
      formImageUrl ??
      resolvedImageUrls[String(editingProductId)] ??
      (await resolveImageUrl(form.image_url));
    if (resolvedUrl) {
      setFullImagePreviewUrl(resolvedUrl);
    }
  };

  const openProductImagePreview = async (product: Product) => {
    const resolvedUrl =
      resolvedImageUrls[String(product.id)] ??
      (await resolveImageUrl(product.image_url));
    if (resolvedUrl) {
      setFullImagePreviewUrl(resolvedUrl);
    }
  };

  const closeFullImagePreview = () => {
    setFullImagePreviewUrl(null);
  };

  const openEditModal = async (product: Product) => {
    setSubmitError(null);
    const [productDetail, groups] = await Promise.all([
      fetchProductDetail(product.id).catch(() => null),
      loadUnitGroups(),
    ]);
    const loadedProductUnits = await getProductUnits(product.id).catch((err) => {
      console.warn("Error fetching product units:", err);
      setProductUnitsError(
        err instanceof Error ? err.message : "ไม่สามารถโหลดหน่วยสินค้าเดิมได้",
      );
      return [];
    });
    const sourceProduct = productDetail ?? product;
    const matchedUnit = findUnitByCode(groups, sourceProduct.unit_code);

    if (sourceProduct.unit_code && !matchedUnit) {
      console.warn(
        `Product unit_code "${sourceProduct.unit_code}" was not found in /unit-groups/with-units`,
      );
    }

    const loadedUnits = groups.flatMap((unitGroup) => unitGroup.units);
    const mappedProductUnits =
      loadedProductUnits.length > 0
        ? loadedProductUnits.map((item, index) =>
            mapProductUnitToFormItem(item, index, loadedUnits),
          )
        : [
            {
              ...createEmptyProductUnit(1),
              unitId: matchedUnit ? String(matchedUnit.unit.id) : "",
              barcode: sourceProduct.barcode ?? "",
              salePrice:
                sourceProduct.sale_price !== undefined &&
                sourceProduct.sale_price !== null
                  ? String(sourceProduct.sale_price)
                  : "",
              costPrice:
                sourceProduct.cost_price !== undefined &&
                sourceProduct.cost_price !== null
                  ? String(sourceProduct.cost_price)
                  : "",
              isNew: true,
            },
          ];

    originalProductUnitsRef.current = new Map(
      mappedProductUnits
        .filter((item) => item.productUnitId)
        .map((item) => [
          String(item.productUnitId),
          createProductUnitSnapshot(item),
        ]),
    );

    setEditingProductId(sourceProduct.id);
    setEditingProduct(sourceProduct);
    setIsUnitLinkingEnabled(loadedProductUnits.length > 1);
    setIsUnitSectionOpen(loadedProductUnits.length > 1);
    setProductUnits(mappedProductUnits);
    setForm({
      sku: sourceProduct.sku ?? "",
      barcode: sourceProduct.barcode ?? "",
      description: sourceProduct.description ?? "",
      product_name: sourceProduct.product_name ?? "",
      category_id: sourceProduct.category_id ? String(sourceProduct.category_id) : "",
      unit_code: matchedUnit?.unit.unit_code ?? "",
      unit_id: matchedUnit ? String(matchedUnit.unit.id) : "",
      price_mode: (sourceProduct.price_mode as PriceMode) ?? "FIXED_PRICE",
      cost_price:
        sourceProduct.cost_price !== undefined && sourceProduct.cost_price !== null
          ? String(sourceProduct.cost_price)
          : "",
      sale_price:
        sourceProduct.sale_price !== undefined && sourceProduct.sale_price !== null
          ? String(sourceProduct.sale_price)
          : "",
      stock_qty:
        sourceProduct.stock_qty !== undefined && sourceProduct.stock_qty !== null
          ? String(sourceProduct.stock_qty)
          : "",
      min_stock_qty:
        sourceProduct.min_stock_qty !== undefined &&
        sourceProduct.min_stock_qty !== null
          ? String(sourceProduct.min_stock_qty)
          : "",
      track_stock: Boolean(sourceProduct.track_stock),
      allow_discount: Boolean(sourceProduct.allow_discount),
      image_url: sourceProduct.image_url ?? "",
    });
    setSelectedUnitGroupId(matchedUnit ? String(matchedUnit.unitGroup.id) : "");
    setOriginalImageUrl(sourceProduct.image_url ?? null);
    resetImageSelection();
    setFullImagePreviewUrl(null);
    setIsModalOpen(true);
  };

  const fetchProductDetail = async (
    productId: number | string,
  ): Promise<Product | null> => {
    const response = await authorizedFetch(`/products/${productId}`);
    if (!response.ok) return null;
    return unwrapProductResponse(await response.json().catch(() => null));
  };

  const findProductByBarcode = async (barcode: string): Promise<Product | null> => {
    const response = await authorizedFetch(
      `/products?page=1&limit=20&search=${encodeURIComponent(barcode)}`,
    );
    if (!response.ok) return null;

    const productsList = unwrapProductsListResponse(
      await response.json().catch(() => null),
    );

    return (
      productsList.find((product) => normalizeBarcode(product.barcode ?? "") === barcode) ??
      productsList[0] ??
      null
    );
  };

  const openEditModalFromScannedProduct = async (scannedProduct: ScannedProduct) => {
    const existingProduct = products.find(
      (product) =>
        String(product.id) === String(scannedProduct.id) ||
        (scannedProduct.barcode &&
          product.barcode === scannedProduct.barcode),
    );

    if (existingProduct) {
      await openEditModal(existingProduct);
      return;
    }

    const productDetail = await fetchProductDetail(scannedProduct.id).catch(
      () => null,
    );
    if (productDetail) {
      await openEditModal(productDetail);
      return;
    }

    const scannedPriceMode: PriceMode =
      scannedProduct.product_type === "WEIGHT"
        ? "WEIGHT_PRICE"
        : scannedProduct.product_type;

    await openEditModal({
      id: scannedProduct.id,
      barcode: scannedProduct.barcode ?? form.barcode.trim(),
      product_name: scannedProduct.name,
      category_id:
        form.category_id ||
        (sortedCategories.length > 0 ? String(sortedCategories[0].id) : ""),
      unit_code: "",
      unit_id: "",
      price_mode: scannedPriceMode,
      cost_price: 0,
      sale_price: Number(scannedProduct.sale_price) || 0,
      stock_qty: Number(scannedProduct.stock_qty) || 0,
      min_stock_qty: 0,
      track_stock: scannedProduct.product_type !== "SERVICE_PRICE",
      allow_discount: true,
      status: "ACTIVE",
      image_url: null,
    });
  };

  const handleBarcodeEnter = async () => {
    const barcode = normalizeBarcode(form.barcode);

    if (!barcode || isScanningBarcode) {
      return;
    }

    if (barcode !== form.barcode) {
      updateForm("barcode", barcode);
    }

    setIsScanningBarcode(true);
    setSubmitError(null);

    try {
      const result = await scanProductByBarcode(barcode);

      if (result.code === "PRODUCT_NOT_FOUND" || !result.success) {
        const existingProduct = await findProductByBarcode(barcode).catch(() => null);

        if (existingProduct) {
          await openEditModal(existingProduct);
          return;
        }

        setEditingProductId(null);
        setEditingProduct(null);
        setSubmitError(PRODUCT_NOT_FOUND_ADDABLE_MESSAGE);
        return;
      }

      if (!result.product) {
        setSubmitError("ไม่พบข้อมูลสินค้า");
        return;
      }

      await openEditModalFromScannedProduct(result.product);
    } catch (err) {
      console.error("Error scanning product:", err);
      setSubmitError(
        err instanceof Error ? err.message : "ไม่สามารถสแกนสินค้าได้",
      );
    } finally {
      setIsScanningBarcode(false);
    }
  };

  const closeModal = () => {
    if (isSubmitting) {
      return;
    }
    resetImageSelection();
    setFullImagePreviewUrl(null);
    setEditingProductId(null);
    setEditingProduct(null);
    setOriginalImageUrl(null);
    setSelectedUnitGroupId("");
    setProductUnits([createEmptyProductUnit(1)]);
    originalProductUnitsRef.current = new Map();
    setIsUnitLinkingEnabled(false);
    setIsUnitSectionOpen(false);
    setProductUnitsError(null);
    setIsModalOpen(false);
  };

  const updateForm = <K extends keyof typeof EMPTY_FORM>(
    key: K,
    value: (typeof EMPTY_FORM)[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSelectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setFormImageUrl(null);
  };

  const handleRemoveSelectedImage = () => {
    resetImageSelection();
    updateForm("image_url", "");
  };

  const updateProductUnitItem = <K extends keyof ProductUnitFormItem>(
    clientId: string,
    key: K,
    value: ProductUnitFormItem[K],
  ) => {
    setProductUnits((current) =>
      current.map((item) =>
        item.clientId === clientId
          ? { ...item, [key]: value, isDirty: item.isNew ? item.isDirty : true }
          : item,
      ),
    );
    setProductUnitsError(null);
  };

  const handleSetBaseUnit = (clientId: string) => {
    setProductUnits((current) =>
      current.map((item) =>
        item.clientId === clientId
          ? {
              ...item,
              isBase: true,
              conversionToBase: "1",
              isDirty: item.isNew ? item.isDirty : true,
            }
          : {
              ...item,
              isBase: false,
              isDirty: item.isNew ? item.isDirty : true,
            },
      ),
    );
    setProductUnitsError("หน่วยฐานต้องมีค่าเท่ากับ 1");
  };

  const addProductUnitItem = () => {
    setProductUnits((current) => [
      ...current,
      createEmptyProductUnit(current.length + 1),
    ]);
    setProductUnitsError(null);
  };

  const removeProductUnitItem = (clientId: string) => {
    setProductUnits((current) => {
      const target = current.find((item) => item.clientId === clientId);
      if (!target) return current;
      if (target.isBase) {
        setProductUnitsError("ไม่สามารถลบหน่วยฐานได้ กรุณาเลือกหน่วยฐานใหม่ก่อน");
        return current;
      }
      if (target.isNew) {
        return current.filter((item) => item.clientId !== clientId);
      }
      return current.map((item) =>
        item.clientId === clientId
          ? { ...item, isDeleted: true, isDirty: true }
          : item,
      );
    });
  };

  const activeProductUnits = productUnits.filter((item) => !item.isDeleted);

  const openUnitSection = () => {
    setProductUnits((current) => {
      const activeUnits = current.filter((item) => !item.isDeleted);
      if (activeUnits.length > 0) {
        return current;
      }

      const matchedUnit = availableUnits.find(
        (unit) => unit.unit_code === form.unit_code,
      );
      return [
        {
          ...createEmptyProductUnit(1),
          unitId: matchedUnit ? String(matchedUnit.id) : "",
          barcode: form.barcode,
          salePrice: form.sale_price,
          costPrice: form.cost_price,
        },
      ];
    });
    setIsUnitLinkingEnabled(true);
    setIsUnitSectionOpen(true);
    setProductUnitsError(null);
  };

  const closeUnitSection = () => {
    setIsUnitSectionOpen(false);
    setProductUnitsError(null);
  };

  const validateProductUnits = (): string | null => {
    if (activeProductUnits.length === 0) {
      return "กรุณาเพิ่มหน่วยขายอย่างน้อย 1 รายการ";
    }

    if (!activeProductUnits.some((item) => item.isBase)) {
      return "กรุณาเลือกหน่วยฐานก่อน";
    }

    const unitIds = new Set<string>();
    const barcodes = new Set<string>();

    for (const [index, item] of activeProductUnits.entries()) {
      if (!item.unitId) {
        const rowLabel = item.barcode.trim()
          ? `แถวที่ ${index + 1} บาร์โค้ด ${item.barcode.trim()}`
          : `แถวที่ ${index + 1}`;
        return `กรุณาเลือกหน่วยขายให้ครบ (${rowLabel})`;
      }

      const unitId = String(item.unitId);
      if (unitIds.has(unitId)) return "ไม่สามารถเลือกหน่วยซ้ำได้";
      unitIds.add(unitId);

      const barcode = normalizeBarcode(item.barcode);
      if (!barcode) return "กรุณากรอกบาร์โค้ดของหน่วยขายให้ครบ";
      if (barcodes.has(barcode)) return "ไม่สามารถกรอกบาร์โค้ดซ้ำในฟอร์มได้";
      barcodes.add(barcode);

      if (item.isBase && Number(item.conversionToBase) !== 1) {
        return "หน่วยฐานต้องมีจำนวนเทียบหน่วยฐานเท่ากับ 1";
      }

      if (!item.isBase && Number(item.conversionToBase) <= 0) {
        return "จำนวนเทียบหน่วยฐานต้องมากกว่า 0";
      }
    }

    return null;
  };

  // ตรวจสอบว่าสามารถบันทึกได้หรือไม่
  const isFormValid = useMemo(() => {
    const trimmedProductName = form.product_name.trim();
    if (isUnitLinkingEnabled) {
      return activeProductUnits.length > 0 && trimmedProductName !== "";
    }
    return (
      trimmedProductName !== "" &&
      form.barcode.trim() !== "" &&
      form.unit_code !== ""
    );
  }, [
    activeProductUnits.length,
    form.barcode,
    form.product_name,
    form.unit_code,
    isUnitLinkingEnabled,
  ]);

  const handleSubmitProduct = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedName = form.product_name.trim();
    const trimmedBarcode = normalizeBarcode(form.barcode);
    const selectedUnit = availableUnits.find(
      (unit) => unit.unit_code === form.unit_code,
    );
    const productUnitsForSubmit: ProductUnitFormItem[] = isUnitLinkingEnabled
      ? activeProductUnits
      : [
          {
            ...createEmptyProductUnit(1),
            unitId: selectedUnit ? String(selectedUnit.id) : "",
            barcode: trimmedBarcode,
            conversionToBase: "1",
            salePrice: form.sale_price,
            costPrice: form.cost_price,
            isNew: editingProductId === null,
            isDirty: editingProductId !== null,
          },
        ];
    const productUnitsValidationError = isUnitLinkingEnabled
      ? validateProductUnits()
      : null;

    if (!trimmedName) {
      setSubmitError("กรุณากรอกชื่อสินค้า");
      return;
    }

    if (!form.category_id) {
      setSubmitError("กรุณาเลือกหมวดหมู่");
      return;
    }

    if (!isUnitLinkingEnabled) {
      if (!form.unit_code || !selectedUnit) {
        setSubmitError("กรุณาเลือกหน่วย");
        return;
      }

      if (!trimmedBarcode) {
        setSubmitError("กรุณากรอกบาร์โค้ด");
        return;
      }

      if (trimmedBarcode !== form.barcode) {
        updateForm("barcode", trimmedBarcode);
      }
    }

    if (productUnitsValidationError) {
      setProductUnitsError(productUnitsValidationError);
      setSubmitError(productUnitsValidationError);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setProductUnitsError(null);

    const isEditing = editingProductId !== null;

    try {
      if (!isEditing && isUnitLinkingEnabled) {
        for (const item of activeProductUnits) {
          const unitBarcode = normalizeBarcode(item.barcode);
          const existingProduct = unitBarcode
            ? await findProductByBarcode(unitBarcode).catch(() => null)
            : null;

          if (existingProduct) {
            const unitName =
              getUnitName(unitById.get(String(item.unitId))) || "หน่วยสินค้า";
            const message = `${unitName}: บาร์โค้ด ${unitBarcode} มีอยู่ในระบบแล้ว กรุณาแก้ไขสินค้าเดิมแทนการเพิ่มสินค้าใหม่`;
            setProductUnitsError(message);
            setSubmitError(message);
            return;
          }
        }
      }

      // ถ้ามีการเลือกรูปใหม่ ให้อัปโหลดก่อน แล้วค่อยเอา url ไปบันทึกกับสินค้า
      let imageUrl: string | null | "" = form.image_url;

      if (imageFile) {
        setIsUploadingImage(true);
        try {
          imageUrl = await uploadProductImage(imageFile);
        } finally {
          setIsUploadingImage(false);
        }
      }

      const trimmedSku = form.sku.trim();
      const trimmedDescription = form.description.trim();

      // ตอนเพิ่มสินค้าใหม่: ไม่ส่ง image_url ถ้าไม่มีรูป
      // ตอนแก้ไข: ถ้าผู้ใช้กดเอารูปออก ให้ส่ง null เพื่อล้างค่าใน database
      const imageUrlForPayload = imageUrl
        ? imageUrl
        : isEditing
          ? null
          : undefined;

      const isService = form.price_mode === "SERVICE_PRICE";
      const baseUnitItem =
        productUnitsForSubmit.find((item) => item.isBase) ?? productUnitsForSubmit[0];
      const baseUnit = unitById.get(String(baseUnitItem.unitId));
      const baseBarcode = normalizeBarcode(baseUnitItem.barcode);

      const basePayload = {
        sku: trimmedSku || undefined,
        barcode: baseBarcode,
        description: trimmedDescription || (isService ? "" : isEditing ? null : undefined),
        product_name: trimmedName,
        category_id: Number(form.category_id) || form.category_id,
        unit_code: baseUnit?.unit_code ?? baseUnit?.unitCode ?? form.unit_code,
        unit_id: Number(baseUnitItem.unitId) || baseUnitItem.unitId,
        price_mode: form.price_mode,
        cost_price: isService ? 0 : Number(baseUnitItem.costPrice) || 0,
        sale_price: isService ? 0 : Number(baseUnitItem.salePrice) || 0,
        track_stock: isService ? false : form.track_stock,
        allow_discount: isService ? false : form.allow_discount,
        status: "ACTIVE",
        ...(imageUrlForPayload !== undefined
          ? { image_url: imageUrlForPayload }
          : {}),
      };

      const payload = isService
        ? basePayload
        : {
            ...basePayload,
            stock_qty: Number(form.stock_qty) || 0,
            min_stock_qty: Number(form.min_stock_qty) || 0,
          };

      const response = await authorizedFetch(
        isEditing ? `/products/${editingProductId}` : "/products",
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const message = await getApiErrorMessage(
          response,
          isEditing
            ? `บันทึกการแก้ไขไม่สำเร็จ (${response.status})`
            : `เพิ่มสินค้าไม่สำเร็จ (${response.status})`,
        );
        throw new Error(message);
      }

      const savedProduct = unwrapProductResponse(await response.json().catch(() => null));
      const savedProductId = savedProduct?.id ?? editingProductId;

      if (!savedProductId) {
        throw new Error("บันทึกสินค้าแล้ว แต่ไม่พบรหัสสินค้าใน Response");
      }

      const failedUnitNames: string[] = [];
      const unitsToSave =
        isUnitLinkingEnabled || isEditing ? productUnits : productUnitsForSubmit;
      const activeUnitsToSave = unitsToSave.filter((item) => !item.isDeleted);
      const newUnits = activeUnitsToSave.filter(
        (item) => item.isNew || !item.productUnitId,
      );
      const updatedUnits = activeUnitsToSave.filter((item) => {
        if (item.isNew || !item.productUnitId) return false;
        return hasProductUnitChanged(
          item,
          originalProductUnitsRef.current.get(String(item.productUnitId)),
        );
      });
      const deletedUnits = unitsToSave.filter(
        (item) => item.isDeleted && !item.isNew && Boolean(item.productUnitId),
      );
      const createdProductUnitIds = new Map<string, string | number>();
      const originalBaseProductUnitId = Array.from(
        originalProductUnitsRef.current.entries(),
      ).find(([, snapshot]) => snapshot.isBase)?.[0];
      const currentBaseUnit = activeUnitsToSave.find((item) => item.isBase);

      for (const item of newUnits) {
        const unitName = getUnitName(unitById.get(String(item.unitId))) || "หน่วยสินค้า";
        try {
          const createdUnit = await createProductUnit(
            savedProductId,
            toProductUnitPayload(item),
          );
          const createdUnitId = getProductUnitId(createdUnit);
          if (createdUnitId) {
            createdProductUnitIds.set(item.clientId, createdUnitId);
          }
        } catch (err) {
          if (import.meta.env.DEV) {
            console.error("Product unit save failed", {
              mode: "CREATE",
              productId: savedProductId,
              productUnitId: item.productUnitId,
              barcode: item.barcode,
              error: err,
            });
          }
          failedUnitNames.push(
            `เพิ่มหน่วย “${unitName}” ไม่สำเร็จ: ${
              err instanceof Error ? err.message : "ไม่สำเร็จ"
            }`,
          );
        }
      }

      for (const item of updatedUnits) {
        const unitName = getUnitName(unitById.get(String(item.unitId))) || "หน่วยสินค้า";
        try {
          await updateProductUnit(
            savedProductId,
            item.productUnitId as string | number,
            toUpdateProductUnitPayload(item),
          );
        } catch (err) {
          if (import.meta.env.DEV) {
            console.error("Product unit save failed", {
              mode: "UPDATE",
              productId: savedProductId,
              productUnitId: item.productUnitId,
              barcode: item.barcode,
              error: err,
            });
          }
          failedUnitNames.push(
            `แก้ไขหน่วย “${unitName}” ไม่สำเร็จ: ${
              err instanceof Error ? err.message : "ไม่สำเร็จ"
            }`,
          );
        }
      }

      const currentBaseProductUnitId =
        currentBaseUnit?.productUnitId ??
        (currentBaseUnit
          ? createdProductUnitIds.get(currentBaseUnit.clientId)
          : undefined);

      if (
        currentBaseProductUnitId &&
        String(currentBaseProductUnitId) !== String(originalBaseProductUnitId ?? "")
      ) {
        try {
          await setBaseProductUnit(savedProductId, currentBaseProductUnitId);
        } catch (err) {
          failedUnitNames.push(
            `ตั้งหน่วยฐานไม่สำเร็จ: ${
              err instanceof Error ? err.message : "ไม่สำเร็จ"
            }`,
          );
        }
      }

      for (const item of deletedUnits) {
        const unitName = getUnitName(unitById.get(String(item.unitId))) || "หน่วยสินค้า";
        try {
          await deleteProductUnit(
            savedProductId,
            item.productUnitId as string | number,
          );
        } catch (err) {
          if (import.meta.env.DEV) {
            console.error("Product unit save failed", {
              mode: "DELETE",
              productId: savedProductId,
              productUnitId: item.productUnitId,
              barcode: item.barcode,
              error: err,
            });
          }
          failedUnitNames.push(
            `ลบหน่วย “${unitName}” ไม่สำเร็จ: ${
              err instanceof Error ? err.message : "ไม่สำเร็จ"
            }`,
          );
        }
      }

      if (failedUnitNames.length > 0) {
        if (!isEditing) {
          await authorizedFetch(`/products/${savedProductId}`, {
            method: "DELETE",
          }).catch((err) => {
            console.warn("Rollback created product failed:", err);
          });
        }

        throw new Error(
          isEditing
            ? `บันทึกสินค้าแล้ว แต่บันทึกหน่วยสินค้าไม่ครบ\n${failedUnitNames.join("\n")}`
            : `เพิ่มสินค้าไม่สำเร็จ เพราะบันทึกหน่วยสินค้าไม่ครบ\n${failedUnitNames.join("\n")}`,
        );
      }

      if (!isService && form.track_stock) {
        const storeId = await getCurrentStoreId();
        const deviceId = await getDeviceId();
        const openingStockPayload: OpeningStockPayload = {
          productId: savedProductId,
          unitId: Number(baseUnitItem.unitId) || baseUnitItem.unitId,
          storeId,
          stockBaseQty: Number(form.stock_qty) || 0,
          deviceId,
          referenceType: "MANUAL",
          referenceId: createStockReferenceId(),
          reasonCode: "OPENING",
          note: "\u0e15\u0e31\u0e49\u0e07\u0e22\u0e2d\u0e14\u0e40\u0e23\u0e34\u0e48\u0e21\u0e15\u0e49\u0e19",
        };

        await updateMinStock(
          savedProductId,
          Number(form.min_stock_qty) || 0,
          storeId,
          openingStockPayload,
        );
      }
      if (isUnitLinkingEnabled) {
        const refreshedUnits = await getProductUnits(savedProductId).catch(() => []);
        const refreshedFormUnits = refreshedUnits.map((item, index) =>
          mapProductUnitToFormItem(item, index, allUnits),
        );
        originalProductUnitsRef.current = new Map(
          refreshedFormUnits
            .filter((item) => item.productUnitId)
            .map((item) => [
              String(item.productUnitId),
              createProductUnitSnapshot(item),
            ]),
        );
      }

      setIsModalOpen(false);
      setEditingProductId(null);
      setEditingProduct(null);
      setForm(EMPTY_FORM);
      setProductUnits([createEmptyProductUnit(1)]);
      originalProductUnitsRef.current = new Map();
      setIsUnitLinkingEnabled(false);
      setIsUnitSectionOpen(false);
      setSelectedUnitGroupId("");
      resetImageSelection();

      // ถ้ามีการเปลี่ยน/ลบรูประหว่างแก้ไข ให้ลบรูปเดิมออกจาก server ทิ้ง
      if (
        isEditing &&
        originalImageUrl &&
        originalImageUrl !== imageUrlForPayload
      ) {
        await deleteProductImage(originalImageUrl);
      }

      await fetchProducts();
    } catch (err) {
      console.error("Error saving product:", err);
      setSubmitError(
        err instanceof Error
          ? err.message
          : isEditing
            ? "ไม่สามารถบันทึกการแก้ไขได้ กรุณาลองใหม่อีกครั้ง"
            : "ไม่สามารถเพิ่มสินค้าได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestDeleteProduct = (product: Product) => {
    setProductPendingDelete(product);
  };

  const requestDeleteEditingProduct = () => {
    if (!editingProduct || isSubmitting) {
      return;
    }
    setIsModalOpen(false);
    setProductPendingDelete(editingProduct);
  };

  const cancelDeleteProduct = () => {
    if (deletingProductId !== null) {
      return;
    }
    setProductPendingDelete(null);
  };

  const confirmDeleteProduct = async () => {
    if (!productPendingDelete) {
      return;
    }

    const product = productPendingDelete;
    setDeletingProductId(product.id);

    try {
      await deactivateProduct(product);
      setProducts((currentProducts) =>
        currentProducts.filter((item) => String(item.id) !== String(product.id)),
      );
      setProductPendingDelete(null);
      await fetchProducts();
    } catch (err) {
      console.error("Error deleting product:", err);
      setError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถลบสินค้าได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleProductsScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom > 240 || loading || !hasMore) return;
    void loadProducts({
      pageToLoad: page + 1,
      searchKeyword: debouncedSearch,
      categoryId: selectedCategoryId,
      reset: false,
    });
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">สินค้าทั้งหมด</h1>
          <p className="mt-1 text-sm text-slate-500">
            ดูและจัดการรายการสินค้าทั้งหมดในร้านของคุณ
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center gap-2 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1a5fc0]"
        >
          <IconPlus size={18} />
          เพิ่มสินค้า
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <IconSearch
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="ค้นหาสินค้าด้วยชื่อ, SKU หรือบาร์โค้ด"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {selectedCategoryLabel}
            <IconChevronDown size={16} className="text-slate-400" />
          </button>
          <p className="mt-1 text-right text-xs font-medium text-slate-500">
            {selectedCategoryProductCount.toLocaleString("th-TH")} รายการ
          </p>

          {isCategoryMenuOpen ? (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsCategoryMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    handleSelectCategory("");
                  }}
                  className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                    selectedCategoryId === ""
                      ? "font-medium text-[#1d6fd8]"
                      : "text-slate-600"
                  }`}
                >
                  สินค้าทั้งหมด
                </button>
                {sortedCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      handleSelectCategory(String(category.id));
                    }}
                    className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${
                      selectedCategoryId === String(category.id)
                        ? "font-medium text-[#1d6fd8]"
                        : "text-slate-600"
                    }`}
                  >
                    {getDisplayCategoryName(category.category_name)}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto rounded-2xl bg-white p-4 shadow-sm"
        onScroll={handleProductsScroll}
      >
        {loading && products.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400">
            กำลังโหลดสินค้า...
          </div>
        ) : error ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <button
              type="button"
              onClick={() => void fetchProducts()}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              ลองอีกครั้ง
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-slate-400">
            <IconBox size={32} className="text-slate-300" />
            <p className="text-sm">
              {searchTerm || selectedCategoryId !== ""
                ? "ไม่พบสินค้า"
                : "ยังไม่มีสินค้า กดปุ่ม \"เพิ่มสินค้า\" เพื่อเริ่มต้น"}
            </p>
          </div>
        ) : (
          <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => {
              const priceModeInfo = PRICE_MODE_OPTIONS.find(
                (option) => option.value === product.price_mode,
              );
              const imageSrc = resolvedImageUrls[String(product.id)];
              const productStock = productStockById[String(product.id)];
              const stockBaseQty =
                productStock?.stockBaseQty !== undefined &&
                productStock.stockBaseQty !== null
                  ? Number(productStock.stockBaseQty)
                  : null;
              const stockDisplay =
                stockBaseQty !== null && Number.isFinite(stockBaseQty)
                  ? stockBaseQty.toLocaleString(undefined, {
                      maximumFractionDigits: 3,
                    })
                  : productStock === undefined
                    ? "..."
                    : "-";
              const isDeletingThis = deletingProductId === product.id;

              return (
                <li
                  key={product.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white">
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={product.product_name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <IconBox size={20} className="text-[#1d6fd8]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">
                        {product.product_name}
                      </p>
                      {product.sku ? (
                        <p className="text-sm text-slate-500">
                          SKU: {product.sku}
                        </p>
                      ) : null}
                      {product.barcode ? (
                        <p className="text-sm text-slate-500">
                          บาร์โค้ด: {product.barcode}
                        </p>
                      ) : null}
                      {product.description ? (
                        <p className="mt-1 line-clamp-2 whitespace-pre-line break-words text-sm text-slate-500">
                          {product.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void openProductImagePreview(product)}
                        disabled={!product.image_url}
                        title="ดูตัวอย่างรูป"
                        aria-label="ดูตัวอย่างรูป"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-[#1d6fd8] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <IconEye size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void openEditModal(product)}
                        title="แก้ไขสินค้า"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-[#1d6fd8]"
                      >
                        <IconPencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDeleteProduct(product)}
                        disabled={isDeletingThis}
                        title="ลบสินค้า"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-500 disabled:opacity-50"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-white px-2.5 py-1 text-slate-500">
                      {categoryNameById.get(String(product.category_id)) ??
                        "ไม่ระบุหมวดหมู่"}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-slate-500">
                      {priceModeInfo?.label ?? product.price_mode}
                    </span>
                    {product.track_stock ? (
                      <span className="rounded-full bg-white px-2.5 py-1 text-slate-500">
                        คงเหลือ {stockDisplay}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-semibold text-[#1d6fd8]">
                      {product.price_mode === "SERVICE_PRICE"
                        ? "กรอกราคาตอนขาย"
                        : `฿${Number(product.sale_price).toLocaleString()}`}
                    </span>
                    {product.price_mode === "OPEN_PRICE" ? (
                      <span className="font-medium text-slate-500">
                        สามารถเปลี่ยนแปลงราคาตอนขายได้
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {loading ? (
            <p className="py-4 text-center text-sm text-slate-400">
              กำลังโหลดสินค้า...
            </p>
          ) : null}
          {!loading && products.length > 0 && !hasMore ? (
            <p className="py-4 text-center text-sm text-slate-400">
              แสดงสินค้าทั้งหมดแล้ว
            </p>
          ) : null}
          </>
        )}
      </div>

      {isModalOpen ? (
        // 🔴 แก้ตรงนี้: ลบ onClick={closeModal} ออกจาก div คลุมดำ เพื่อไม่ให้คลิกปิด
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-3xl max-h-[95vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingProductId !== null ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
              </h2>
              <div className="flex items-center gap-2">
                {editingProductId !== null ? (
                  <button
                    type="button"
                    onClick={requestDeleteEditingProduct}
                    disabled={isSubmitting || !editingProduct}
                    title="ลบสินค้า"
                    aria-label="ลบสินค้า"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <IconTrash size={17} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <IconX size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitProduct} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">
                  รูปสินค้า
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-200 bg-slate-50">
                    {imagePreviewUrl ? (
                      <img
                        src={imagePreviewUrl}
                        alt="พรีวิวรูปสินค้า"
                        className="h-full w-full object-cover"
                      />
                    ) : formImageUrl ? (
                      <img
                        src={formImageUrl}
                        alt="รูปสินค้าปัจจุบัน"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <IconPhoto size={24} className="text-slate-300" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleSelectImage}
                      className="hidden"
                      id="product-image-input"
                    />
                    <div className="flex gap-2">
                      <label
                        htmlFor="product-image-input"
                        className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <IconUpload size={16} />
                        เลือกรูป
                      </label>
                      {imagePreviewUrl || form.image_url ? (
                        <button
                          type="button"
                          onClick={() => void openFullImagePreview()}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
                        >
                          ดูตัวอย่างรูป
                        </button>
                      ) : null}
                      {imagePreviewUrl || form.image_url ? (
                        <button
                          type="button"
                          onClick={handleRemoveSelectedImage}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
                        >
                          เอารูปออก
                        </button>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-400">
                      รองรับไฟล์ JPG, PNG
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    บาร์โค้ด <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(event) =>
                      updateForm("barcode", event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleBarcodeEnter();
                      }
                    }}
                    placeholder="8850000000001"
                    autoFocus
                    disabled={isScanningBarcode}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                  />
                  {isScanningBarcode ? (
                    <p className="mt-1 text-xs text-slate-400">
                      กำลังตรวจสอบบาร์โค้ด...
                    </p>
                  ) : null}
                  {submitError === PRODUCT_NOT_FOUND_ADDABLE_MESSAGE ? (
                    <p className="mt-1.5 text-sm text-emerald-600">
                      {submitError}
                    </p>
                  ) : null}
                </div>

                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    SKU <span className="text-slate-400">(ไม่บังคับ)</span>
                  </label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(event) => updateForm("sku", event.target.value)}
                    placeholder="COFFEE-001"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    ชื่อสินค้า <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.product_name}
                    onChange={(event) =>
                      updateForm("product_name", event.target.value)
                    }
                    placeholder="เช่น กาแฟเย็น"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    กลุ่มหน่วย <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedUnitGroupId}
                    onChange={(event) => {
                      setSelectedUnitGroupId(event.target.value);
                      updateForm("unit_id", "");
                      updateForm("unit_code", "");
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20 disabled:bg-slate-50 disabled:text-slate-400"
                    disabled={isLoadingUnitGroups}
                  >
                    <option value="">
                      {isLoadingUnitGroups ? "กำลังโหลด..." : "เลือกกลุ่มหน่วย"}
                    </option>
                    {unitGroups.map((unitGroup) => (
                      <option key={unitGroup.id} value={String(unitGroup.id)}>
                        {unitGroup.group_name_th}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    หน่วย <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.unit_code}
                    onChange={(event) => {
                      const unit = availableUnits.find(
                        (item) => item.unit_code === event.target.value,
                      );
                      updateForm("unit_code", unit?.unit_code ?? "");
                      updateForm("unit_id", unit ? String(unit.id) : "");
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20 disabled:bg-slate-50 disabled:text-slate-400"
                    disabled={!selectedUnitGroupId || isLoadingUnitGroups}
                  >
                    <option value="">
                      {!selectedUnitGroupId ? "เลือกกลุ่มก่อน" : "เลือกหน่วย"}
                    </option>
                    {availableUnits.map((unit) => (
                      <option key={unit.id} value={unit.unit_code}>
                        {unit.unit_name_th}
                      </option>
                    ))}
                  </select>
                </div>

                {unitGroupsError ? (
                  <p className="col-span-4 text-xs text-red-500">
                    {unitGroupsError}
                  </p>
                ) : null}

                <div className="col-span-4">
                  {!isUnitSectionOpen ? (
                    <button
                      type="button"
                      onClick={openUnitSection}
                      className="flex w-full items-center justify-between rounded-xl border border-dashed border-[#1d6fd8]/40 bg-[#1d6fd8]/5 px-4 py-3 text-left transition-colors hover:bg-[#1d6fd8]/10"
                    >
                      <span className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#1d6fd8] shadow-sm">
                          <IconBox size={20} />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-700">
                            เชื่อมโยงราคา แพ็ค / ลัง
                          </span>
                          <span className="block text-xs text-slate-500">
                            ใช้เมื่อสินค้าตัวเดียวมีหลายหน่วยขาย เช่น กล่อง แพ็ค ลัง
                          </span>
                        </span>
                      </span>
                      <span className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#1d6fd8] shadow-sm">
                        เปิดเมนู
                      </span>
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-800">
                            เชื่อมโยงหน่วยขายเป็นสินค้าตัวเดียว
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            กำหนดราคาขายและบาร์โค้ดแยกตามหน่วย โดยสต๊อกอ้างอิงจากหน่วยฐาน
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={addProductUnitItem}
                            className="flex items-center gap-1.5 rounded-xl bg-[#1d6fd8] px-3 py-2 text-xs font-medium text-white hover:bg-[#1a5fc0]"
                          >
                            <IconPlus size={15} />
                            เพิ่มแพ็ค/ลัง
                          </button>
                          <button
                            type="button"
                            onClick={closeUnitSection}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                          >
                            ปิดเมนู
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {activeProductUnits.map((item, index) => {
                          const selectedUnitName =
                            getUnitName(unitById.get(String(item.unitId))) ||
                            (item.isBase ? "หน่วยฐาน" : `หน่วยที่ ${index + 1}`);

                          return (
                            <div
                              key={item.clientId}
                              className={`rounded-xl border p-3 ${
                                item.isBase
                                  ? "border-[#1d6fd8]/30 bg-[#1d6fd8]/5"
                                  : "border-slate-200 bg-slate-50"
                              }`}
                            >
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-semibold text-slate-600 shadow-sm">
                                    {index + 1}
                                  </span>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-700">
                                      {selectedUnitName}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {item.isBase
                                        ? "หน่วยฐานสำหรับคิดสต๊อก"
                                        : "หน่วยขายที่แปลงจากหน่วยฐาน"}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {item.isBase ? (
                                    <span className="rounded-full bg-[#1d6fd8] px-2.5 py-1 text-xs font-medium text-white">
                                      หน่วยฐาน
                                    </span>
                                  ) : null}
                                  {!item.isActive ? (
                                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                                      ปิดใช้งาน
                                    </span>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => removeProductUnitItem(item.clientId)}
                                    className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                                    aria-label="ลบหน่วยขาย"
                                  >
                                    <IconTrash size={16} />
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-slate-500">
                                    หน่วยขาย
                                  </label>
                                  <select
                                    value={String(item.unitId)}
                                    onChange={(event) =>
                                      updateProductUnitItem(
                                        item.clientId,
                                        "unitId",
                                        event.target.value,
                                      )
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                                  >
                                    <option value="">เลือกหน่วย</option>
                                    {allUnits.map((unit) => (
                                      <option key={unit.id} value={String(unit.id)}>
                                        {getUnitName(unit)}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-medium text-slate-500">
                                    บาร์โค้ดหน่วยนี้
                                  </label>
                                  <input
                                    type="text"
                                    value={item.barcode}
                                    onChange={(event) =>
                                      updateProductUnitItem(
                                        item.clientId,
                                        "barcode",
                                        event.target.value,
                                      )
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-medium text-slate-500">
                                    1 หน่วยนี้เท่ากับ
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min={1}
                                      value={item.conversionToBase}
                                      disabled={item.isBase}
                                      onChange={(event) =>
                                        updateProductUnitItem(
                                          item.clientId,
                                          "conversionToBase",
                                          event.target.value,
                                        )
                                      }
                                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20 disabled:bg-slate-100 disabled:text-slate-400"
                                    />
                                    <span className="whitespace-nowrap text-xs text-slate-500">
                                      หน่วยฐาน
                                    </span>
                                  </div>
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-medium text-slate-500">
                                    ลำดับ
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.sortOrder}
                                    onChange={(event) =>
                                      updateProductUnitItem(
                                        item.clientId,
                                        "sortOrder",
                                        Number(event.target.value) || 1,
                                      )
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-medium text-slate-500">
                                    ราคาขาย
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={item.salePrice}
                                    onChange={(event) =>
                                      updateProductUnitItem(
                                        item.clientId,
                                        "salePrice",
                                        event.target.value,
                                      )
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-medium text-slate-500">
                                    ราคาทุน
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={item.costPrice}
                                    onChange={(event) =>
                                      updateProductUnitItem(
                                        item.clientId,
                                        "costPrice",
                                        event.target.value,
                                      )
                                    }
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                                  />
                                </div>

                                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
                                  <input
                                    type="checkbox"
                                    checked={item.isBase}
                                    onChange={(event) => {
                                      if (event.target.checked) {
                                        handleSetBaseUnit(item.clientId);
                                      } else {
                                        setProductUnitsError(
                                          "ห้ามยกเลิกหน่วยฐาน กรุณาเลือกหน่วยอื่นเป็นฐานก่อน",
                                        );
                                      }
                                    }}
                                    className="h-4 w-4 accent-[#1d6fd8]"
                                  />
                                  ตั้งเป็นหน่วยฐาน
                                </label>

                                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
                                  <input
                                    type="checkbox"
                                    checked={item.isActive}
                                    onChange={(event) =>
                                      updateProductUnitItem(
                                        item.clientId,
                                        "isActive",
                                        event.target.checked,
                                      )
                                    }
                                    className="h-4 w-4 accent-[#1d6fd8]"
                                  />
                                  เปิดขายหน่วยนี้
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {productUnitsError ? (
                        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                          {productUnitsError}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="col-span-4">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    รายละเอียดสินค้า
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      updateForm("description", event.target.value)
                    }
                    placeholder="เช่น รายละเอียด รสชาติ ขนาด หรือหมายเหตุของสินค้า"
                    rows={2}
                    className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                  />
                </div>

                <div className="col-span-4">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    หมวดหมู่
                  </label>
                  <select
                    value={form.category_id}
                    onChange={(event) =>
                      updateForm("category_id", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                  >
                    {sortedCategories.map((category) => (
                      <option key={category.id} value={String(category.id)}>
                        {getDisplayCategoryName(category.category_name)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-4">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    รูปแบบการคิดราคา
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRICE_MODE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50"
                      >
                        <input
                          type="radio"
                          name="price_mode"
                          value={option.value}
                          checked={form.price_mode === option.value}
                          onChange={() => {
                            updateForm("price_mode", option.value);
                            // บริการไม่มีต้นทุน/ไม่ตัดสต๊อก/ไม่มีส่วนลด/ไม่กรอกราคาที่นี่ ล้างค่าที่เกี่ยวข้องเมื่อเปลี่ยนมาโหมดนี้
                            if (option.value === "SERVICE_PRICE") {
                              updateForm("cost_price", "");
                              updateForm("sale_price", "");
                              updateForm("track_stock", false);
                              updateForm("allow_discount", false);
                            }
                          }}
                          className="mt-0.5 h-4 w-4 accent-[#1d6fd8]"
                        />
                        <span>
                          <span className="block text-sm font-medium text-slate-700">
                            {option.label}
                          </span>
                          <span className="block text-sm text-slate-500">
                            {option.hint}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    ราคาทุน
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.cost_price}
                    onChange={(event) =>
                      updateForm("cost_price", event.target.value)
                    }
                    disabled={form.price_mode === "SERVICE_PRICE"}
                    placeholder={
                      form.price_mode === "SERVICE_PRICE"
                        ? "บริการไม่มีต้นทุน"
                        : "0.00"
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    {form.price_mode === "WEIGHT_PRICE"
                      ? "ราคาขาย / กก."
                      : form.price_mode === "SERVICE_PRICE"
                        ? "ราคาบริการ"
                        : "ราคาขาย"}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.sale_price}
                    onChange={(event) =>
                      updateForm("sale_price", event.target.value)
                    }
                    disabled={form.price_mode === "SERVICE_PRICE"}
                    placeholder={
                      form.price_mode === "OPEN_PRICE"
                        ? "ราคาเริ่มต้น (แก้ไขได้ตอนขาย)"
                        : form.price_mode === "SERVICE_PRICE"
                          ? "กรอกราคาตอนขาย"
                          : "0.00"
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>

                {form.price_mode !== "SERVICE_PRICE" ? (
                  <>
                    <div className="col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.track_stock}
                        onClick={() =>
                          updateForm("track_stock", !form.track_stock)
                        }
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          form.track_stock
                            ? "border-[#1d6fd8] bg-[#1d6fd8]"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {form.track_stock ? (
                          <span className="h-2 w-2 rounded-full bg-white" />
                        ) : null}
                      </button>
                      <span
                        className="cursor-pointer text-sm text-slate-600"
                        onClick={() => updateForm("track_stock", !form.track_stock)}
                      >
                        ตัดสต๊อกสินค้านี้ (Track stock)
                      </span>
                    </div>

                    <div className="col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.allow_discount}
                        onClick={() =>
                          updateForm("allow_discount", !form.allow_discount)
                        }
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          form.allow_discount
                            ? "border-[#1d6fd8] bg-[#1d6fd8]"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {form.allow_discount ? (
                          <span className="h-2 w-2 rounded-full bg-white" />
                        ) : null}
                      </button>
                      <span
                        className="cursor-pointer text-sm text-slate-600"
                        onClick={() =>
                          updateForm("allow_discount", !form.allow_discount)
                        }
                      >
                        อนุญาตให้ส่วนลดสินค้านี้
                      </span>
                    </div>

                    {form.track_stock ? (
                      <>
                        <div className="col-span-2">
                          <label className="mb-1.5 block text-sm font-medium text-slate-600">
                            จำนวนสต๊อก
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={form.stock_qty}
                            onChange={(event) =>
                              updateForm("stock_qty", event.target.value)
                            }
                            placeholder="0"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="mb-1.5 block text-sm font-medium text-slate-600">
                            สต๊อกขั้นต่ำ
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={form.min_stock_qty}
                            onChange={(event) =>
                              updateForm("min_stock_qty", event.target.value)
                            }
                            placeholder="0"
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                          />
                        </div>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>

              {submitError && submitError !== PRODUCT_NOT_FOUND_ADDABLE_MESSAGE ? (
                // 🔴 แก้ตรงนี้: เปลี่ยนจาก text-red-500 เป็น text-emerald-600 (หรือสีเขียวอื่นตามต้องการ)
                <p className="text-sm text-emerald-600">{submitError}</p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isFormValid}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors ${
                    isSubmitting || !isFormValid
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-[#1d6fd8] hover:bg-[#1a5fc0]"
                  }`}
                >
                  {isSubmitting
                    ? isUploadingImage
                      ? "กำลังอัปโหลดรูป..."
                      : "กำลังบันทึก..."
                    : editingProductId !== null
                      ? "บันทึกการแก้ไข"
                      : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {fullImagePreviewUrl ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={closeFullImagePreview}
        >
          <div
            className="relative max-h-[92vh] max-w-[92vw]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeFullImagePreview}
              className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-lg hover:text-slate-800"
              aria-label="ปิดตัวอย่างรูป"
              title="ปิดตัวอย่างรูป"
            >
              <IconX size={20} />
            </button>
            <img
              src={fullImagePreviewUrl}
              alt="ตัวอย่างรูปสินค้า"
              className="max-h-[92vh] max-w-[92vw] rounded-xl bg-white object-contain shadow-2xl"
            />
          </div>
        </div>
      ) : null}

      {productPendingDelete ? (
        // 🔴 แก้ตรงนี้: ลบ onClick={cancelDeleteProduct} ออกจาก div คลุมดำ เพื่อไม่ให้คลิกปิด
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-800">
              ลบสินค้านี้?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              คุณต้องการลบ "{productPendingDelete.product_name}" ใช่หรือไม่
              การลบไม่สามารถย้อนกลับได้
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={cancelDeleteProduct}
                disabled={deletingProductId !== null}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                disabled={deletingProductId !== null}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deletingProductId !== null ? "กำลังลบ..." : "ลบสินค้า"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
