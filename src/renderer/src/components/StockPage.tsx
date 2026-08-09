import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  IconAdjustments,
  IconHistory,
  IconPackage,
  IconRefresh,
  IconSearch,
  IconX,
  type Icon,
} from "@tabler/icons-react";
import { ensureValidAccessToken, refreshAccessToken } from "./auth";

interface GetStocksParams {
  page: number;
  limit: number;
  query?: string;
  storeId?: number;
  lowStock?: boolean;
}

interface StockItem {
  productId: number;
  productName: string;
  stockBaseQty: number;
  minStockBaseQty: number;
  baseUnit?: StockBaseUnit | null;
  isLowStock: boolean;
  hasStockRecord: boolean;
  source: "stocks" | "products";
  sku?: string | null;
  barcode?: string | null;
  productSku?: string | null;
  productBarcode?: string | null;
  product?: StockProductSummary | null;
  productUnits?: StockBarcodeSummary[];
  units?: StockBarcodeSummary[];
  barcodes?: StockBarcodeSummary[];
  imageUrl?: string | null;
  baseUnitId?: number;
  status?: string | null;
  lastUpdate?: string;
  updatedAt?: string;
}

interface StockBaseUnit {
  unitId?: number | null;
  productUnitId?: number | null;
  unitCode?: string | null;
  unitNameTh?: string | null;
  unitNameEn?: string | null;
}

interface ProductSearchItem {
  id: string | number;
  sku: string | null;
  barcode: string | null;
  product_name: string;
  unitId?: number | null;
  unit_code: string | null;
  stock_qty: string | number | null;
  track_stock: boolean;
  status: string;
  baseUnit?: StockBaseUnit | null;
  stockBaseQty?: number | string | null;
  unitCount?: number;
}

interface StockProductSummary {
  sku?: string | null;
  barcode?: string | null;
  baseUnit?: StockUnitSummary | null;
  base_unit?: StockUnitSummary | null;
  productUnits?: StockBarcodeSummary[];
  product_units?: StockBarcodeSummary[];
  units?: StockBarcodeSummary[];
}

interface StockUnitSummary {
  id?: number;
  unitId?: number;
  unit_id?: number;
  unitCode?: string | null;
  unit_code?: string | null;
  unitName?: string | null;
  unit_name?: string | null;
  unitNameTh?: string | null;
  unit_name_th?: string | null;
}

interface StockBarcodeSummary {
  productUnitId?: number;
  unitId?: number;
  unitCode?: string | null;
  unitName?: string | null;
  barcode: string;
  isBase?: boolean;
  sortOrder?: number;
}

interface StockUnit {
  productUnitId: number;
  unitId?: number;
  unitCode?: string;
  unitName?: string;
  conversionToBase: number;
  isBase?: boolean;
}

interface StockMovement {
  id: number;
  movementType: string;
  qtyChangeBase: number;
  beforeQtyBase: number;
  afterQtyBase: number;
  referenceId?: string | null;
  reasonCode?: string | null;
  note?: string | null;
  createdAt?: string;
  createdByName?: string | null;
  createdById?: string | null;
  deviceId?: string | null;
  isReversed: boolean;
  canReverse: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
  summary?: {
    lowStockProducts?: number;
    outOfStockProducts?: number;
    lastUpdatedAt?: string;
  };
}

interface StoreOption {
  id: number;
  name: string;
}

interface UserSummary {
  userId: string;
  fullName: string;
}

interface PosDeviceSummary {
  id: string;
  machineId: string | null;
  deviceName: string;
}

type CountedUnitQuantity = Record<number, number>;
type DialogMode = "count" | "adjust" | "history" | null;
type StockCountReasonCode =
  | "PHYSICAL_COUNT"
  | "MISSING"
  | "OVERAGE"
  | "DAMAGED"
  | "CORRECTION"
  | "OTHER";
type ManualStockAdjustmentReasonCode =
  | "MANUAL_ADJUSTMENT"
  | "DAMAGED"
  | "CORRECTION"
  | "MISSING"
  | "OVERAGE"
  | "OTHER";
type StockReasonCode = StockCountReasonCode | ManualStockAdjustmentReasonCode;

interface ReasonOption<T extends string> {
  value: T;
  label: string;
}

const PAGE_SIZE = 20;
const STOCK_ERROR_FALLBACK = "ไม่สามารถโหลดข้อมูลสต๊อกได้ กรุณาลองใหม่อีกครั้ง";

const stockCountReasonOptions: ReasonOption<StockCountReasonCode>[] = [
  { value: "PHYSICAL_COUNT", label: "ตรวจนับสต๊อก" },
  { value: "MISSING", label: "พบสินค้าสูญหาย" },
  { value: "OVERAGE", label: "พบสินค้าเกินจากระบบ" },
  { value: "DAMAGED", label: "สินค้าชำรุด" },
  { value: "CORRECTION", label: "แก้ไขยอดผิดพลาด" },
  { value: "OTHER", label: "อื่น ๆ" },
];

const manualAdjustmentReasonOptions: ReasonOption<ManualStockAdjustmentReasonCode>[] = [
  { value: "MANUAL_ADJUSTMENT", label: "ปรับยอดด้วยตนเอง" },
  { value: "DAMAGED", label: "สินค้าชำรุด" },
  { value: "CORRECTION", label: "แก้ไขยอดผิดพลาด" },
  { value: "MISSING", label: "พบสินค้าสูญหาย" },
  { value: "OVERAGE", label: "พบสินค้าเกินจากระบบ" },
  { value: "OTHER", label: "อื่น ๆ" },
];

const movementTypeLabels: Record<string, string> = {
  OPENING_STOCK: "ตั้งยอดเริ่มต้น",
  PURCHASE_IN: "รับสินค้าเข้า",
  SALE_OUT: "ขายสินค้า",
  ADJUSTMENT_IN: "ปรับเพิ่มสต๊อก",
  ADJUSTMENT_OUT: "ปรับลดสต๊อก",
  DAMAGED_OUT: "สินค้าเสียหาย",
  TRANSFER_IN: "รับโอนสินค้า",
  TRANSFER_OUT: "โอนสินค้าออก",
  REVERSAL: "กลับรายการ",
};

const stockReasonCodeLabels: Record<string, string> = {
  OPENING: "\u0e15\u0e31\u0e49\u0e07\u0e22\u0e2d\u0e14\u0e40\u0e23\u0e34\u0e48\u0e21\u0e15\u0e49\u0e19",
  PHYSICAL_COUNT: "\u0e15\u0e23\u0e27\u0e08\u0e19\u0e31\u0e1a\u0e2a\u0e15\u0e4a\u0e2d\u0e01",
  STOCK_COUNT: "\u0e15\u0e23\u0e27\u0e08\u0e19\u0e31\u0e1a\u0e2a\u0e15\u0e4a\u0e2d\u0e01",
  MANUAL_ADJUSTMENT: "\u0e1b\u0e23\u0e31\u0e1a\u0e22\u0e2d\u0e14\u0e14\u0e49\u0e27\u0e22\u0e15\u0e19\u0e40\u0e2d\u0e07",
  DAMAGED: "\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e0a\u0e33\u0e23\u0e38\u0e14",
  CORRECTION: "\u0e41\u0e01\u0e49\u0e44\u0e02\u0e22\u0e2d\u0e14\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14",
  MISSING: "\u0e1e\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e2a\u0e39\u0e0d\u0e2b\u0e32\u0e22",
  OVERAGE: "\u0e1e\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e40\u0e01\u0e34\u0e19\u0e08\u0e32\u0e01\u0e23\u0e30\u0e1a\u0e1a",
  OTHER: "\u0e2d\u0e37\u0e48\u0e19 \u0e46",
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
  if (!isAuthenticated) throw new Error("ไม่สามารถยืนยันตัวตนได้");

  const apiBaseUrl = await getApiBaseUrl();
  let accessToken = await window.electronStore.get("access_token");
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw new Error("ไม่พบ access token");
  }

  const request = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  };

  let response = await request(accessToken);
  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    response = await request(accessToken);
  }
  return response;
};

const readErrorMessage = async (response: Response): Promise<string> => {
  const data = (await response.json().catch(() => ({}))) as {
    message?: unknown;
    error?: unknown;
  };
  const message =
    typeof data.message === "string"
      ? data.message
      : typeof data.error === "string"
        ? data.error
        : "";
  if (message) return message;
  if (response.status === 403) return "ไม่มีสิทธิ์ใช้งานรายการนี้";
  if (response.status === 404) return "ไม่พบข้อมูลสต๊อกสินค้า";
  if (response.status === 409) return "ข้อมูลขัดแย้ง กรุณาโหลดใหม่แล้วลองอีกครั้ง";
  if (response.status === 400 || response.status === 422) {
    return "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
  }
  return STOCK_ERROR_FALLBACK;
};

const unwrapArray = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const value = payload as { data?: unknown; items?: unknown; rows?: unknown };
    if (Array.isArray(value.data)) return value.data as T[];
    if (Array.isArray(value.items)) return value.items as T[];
    if (Array.isArray(value.rows)) return value.rows as T[];
  }
  return [];
};

const numberValue = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

const stringOrNumberValue = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
};

const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const getActorLabel = (value: unknown): string | null => {
  const actor = objectValue(value);
  return (
    stringValue(
      actor.name ??
        actor.fullName ??
        actor.full_name ??
        actor.displayName ??
        actor.display_name ??
        actor.username ??
        actor.email,
    ) ?? null
  );
};

const getMovementActor = (item: Record<string, unknown>): { name: string | null; id: string | null } => {
  const createdBy = objectValue(item.createdBy ?? item.created_by);
  const user = objectValue(item.user);
  const employee = objectValue(item.employee);
  const actorName =
    stringValue(item.createdByName ?? item.created_by_name ?? item.userName ?? item.user_name) ??
    getActorLabel(item.createdBy ?? item.created_by) ??
    getActorLabel(item.user) ??
    getActorLabel(item.employee);
  const actorId =
    stringOrNumberValue(
      item.createdById ??
        item.created_by_id ??
        item.created_by ??
        item.createdBy ??
        item.userId ??
        item.user_id ??
        createdBy.id ??
        createdBy.user_id ??
        user.id ??
        user.user_id ??
        employee.id,
    ) ?? null;

  return { name: actorName ?? null, id: actorId };
};

const normalizeBaseUnit = (raw: unknown): StockBaseUnit | null => {
  const unit = objectValue(raw);
  if (Object.keys(unit).length === 0) return null;

  return {
    unitId: numberValue(unit.unitId ?? unit.unit_id) || null,
    productUnitId: numberValue(unit.productUnitId ?? unit.product_unit_id) || null,
    unitCode: stringValue(unit.unitCode) ?? null,
    unitNameTh: stringValue(unit.unitNameTh) ?? null,
    unitNameEn: stringValue(unit.unitNameEn) ?? null,
  };
};

const normalizeBarcodeSummary = (raw: unknown): StockBarcodeSummary | null => {
  if (typeof raw === "string") {
    const barcode = raw.trim();
    return barcode ? { barcode } : null;
  }

  const item = objectValue(raw);
  const unit = objectValue(item.unit);
  const barcode = stringValue(item.barcode);
  if (!barcode) return null;

  return {
    productUnitId: numberValue(item.productUnitId ?? item.product_unit_id ?? item.id) || undefined,
    unitId: numberValue(item.unitId ?? item.unit_id ?? unit.id ?? unit.unitId ?? unit.unit_id) || undefined,
    unitCode: stringValue(item.unitCode ?? item.unit_code ?? unit.unitCode ?? unit.unit_code) ?? null,
    unitName:
      stringValue(
        item.unitName ??
          item.unit_name ??
          item.unitNameTh ??
          item.unit_name_th ??
          unit.unitName ??
          unit.unit_name ??
          unit.unitNameTh ??
          unit.unit_name_th,
      ) ?? null,
    barcode,
    isBase: Boolean(item.isBase ?? item.is_base),
    sortOrder: numberValue(item.sortOrder ?? item.sort_order) || undefined,
  };
};

const normalizeBarcodeSummaries = (...values: unknown[]): StockBarcodeSummary[] =>
  values.flatMap((value) => unwrapArray<unknown>(value).map(normalizeBarcodeSummary)).filter(
    (barcode): barcode is StockBarcodeSummary => barcode !== null,
  );

const sortBarcodes = (barcodes: StockBarcodeSummary[]): StockBarcodeSummary[] =>
  [...barcodes].sort((a, b) => {
    if (Boolean(a.isBase) !== Boolean(b.isBase)) return a.isBase ? -1 : 1;
    const sortDiff = (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
    if (sortDiff !== 0) return sortDiff;
    return (a.productUnitId ?? Number.MAX_SAFE_INTEGER) - (b.productUnitId ?? Number.MAX_SAFE_INTEGER);
  });

const getUniqueBarcodes = (barcodes: StockBarcodeSummary[]): StockBarcodeSummary[] => {
  const seen = new Set<string>();
  return sortBarcodes(barcodes).filter((item) => {
    const barcode = item.barcode.trim();
    if (!barcode || seen.has(barcode)) return false;
    seen.add(barcode);
    return true;
  });
};

const getProductSku = (item: StockItem): string | null =>
  stringValue(item.sku ?? item.productSku ?? item.product?.sku) ?? null;

const getBaseUnitLabel = (item: StockItem): string => {
  return item.baseUnit?.unitNameTh?.trim() || item.baseUnit?.unitCode?.trim() || "-";
};

const getProductBarcodes = (item: StockItem): StockBarcodeSummary[] => {
  const directBarcode =
    stringValue(item.barcode ?? item.productBarcode ?? item.product?.barcode) ?? null;
  const directBarcodeItem: StockBarcodeSummary[] = directBarcode
    ? [
        {
          barcode: directBarcode,
          isBase: true,
          unitCode: item.baseUnit?.unitCode,
          unitName: item.baseUnit?.unitNameTh,
        },
      ]
    : [];

  return getUniqueBarcodes([
    ...directBarcodeItem,
    ...(item.barcodes ?? []),
    ...(item.productUnits ?? []),
    ...(item.units ?? []),
    ...(item.product?.productUnits ?? []),
    ...(item.product?.product_units ?? []),
    ...(item.product?.units ?? []),
  ]);
};

const normalizeStock = (raw: unknown): StockItem => {
  const item = objectValue(raw);
  const product = objectValue(item.product);
  const productSummary: StockProductSummary = {
    sku: stringValue(product.sku) ?? null,
    barcode: stringValue(product.barcode) ?? null,
    baseUnit: objectValue(product.baseUnit),
    base_unit: objectValue(product.base_unit),
    productUnits: normalizeBarcodeSummaries(product.productUnits),
    product_units: normalizeBarcodeSummaries(product.product_units),
    units: normalizeBarcodeSummaries(product.units),
  };
  const barcodes = normalizeBarcodeSummaries(item.barcodes);
  const productUnits = normalizeBarcodeSummaries(item.productUnits ?? item.product_units);
  const units = normalizeBarcodeSummaries(item.units);

  const mappedItem: StockItem = {
    productId: numberValue(item.productId ?? item.product_id ?? product.id),
    productName:
      stringValue(item.productName ?? item.product_name ?? product.product_name ?? product.name) ??
      "-",
    stockBaseQty: numberValue(item.stockBaseQty ?? item.stock_base_qty ?? item.stock_qty),
    minStockBaseQty: numberValue(item.minStockBaseQty ?? item.min_stock_base_qty ?? item.min_stock_qty),
    baseUnit: normalizeBaseUnit(item.baseUnit),
    isLowStock: Boolean(item.isLowStock ?? item.is_low_stock),
    hasStockRecord: true,
    source: "stocks",
    sku: stringValue(item.sku) ?? null,
    barcode: stringValue(item.barcode) ?? null,
    productSku: stringValue(item.productSku ?? item.product_sku) ?? null,
    productBarcode: stringValue(item.productBarcode ?? item.product_barcode) ?? null,
    product: productSummary,
    productUnits,
    units,
    barcodes,
    imageUrl: stringValue(item.imageUrl ?? item.image_url ?? product.image_url) ?? null,
    baseUnitId:
      numberValue(item.baseUnitId ?? item.base_unit_id ?? item.unitId ?? item.unit_id) ||
      undefined,
    status: stringValue(item.status ?? item.stockStatus ?? item.stock_status) ?? null,
    lastUpdate: stringValue(item.lastUpdate ?? item.last_update),
    updatedAt: stringValue(item.updatedAt ?? item.updated_at ?? item.lastUpdate ?? item.last_update),
  };

  return mappedItem;
};

const normalizeProductSearchItem = (raw: unknown): ProductSearchItem => {
  const item = objectValue(raw);
  return {
    id: String(item.id ?? item.productId ?? item.product_id ?? ""),
    sku: stringValue(item.sku) ?? null,
    barcode: stringValue(item.barcode) ?? null,
    product_name: stringValue(item.product_name ?? item.productName) ?? "-",
    unitId: numberValue(item.unitId ?? item.unit_id) || null,
    unit_code: stringValue(item.unit_code ?? item.unitCode) ?? null,
    stock_qty:
      typeof item.stock_qty === "string" || typeof item.stock_qty === "number"
        ? item.stock_qty
        : null,
    track_stock: Boolean(item.track_stock ?? item.trackStock),
    status: stringValue(item.status) ?? "",
    baseUnit: normalizeBaseUnit(item.baseUnit),
    stockBaseQty:
      typeof item.stockBaseQty === "string" || typeof item.stockBaseQty === "number"
        ? item.stockBaseQty
        : null,
    unitCount: numberValue(item.unitCount),
  };
};

const mapProductToStockItem = (product: ProductSearchItem): StockItem => ({
  productId: numberValue(product.id),
  productName: product.product_name,
  stockBaseQty: numberValue(product.stockBaseQty),
  minStockBaseQty: 0,
  baseUnit:
    product.baseUnit ??
    (product.unit_code
      ? {
          unitId: product.unitId ?? null,
          unitCode: product.unit_code,
        }
      : null),
  isLowStock: false,
  hasStockRecord: false,
  source: "products",
  sku: product.sku,
  barcode: product.barcode,
  productSku: null,
  productBarcode: null,
  product: null,
  productUnits: [],
  units: [],
  barcodes: product.barcode ? [{ barcode: product.barcode, isBase: true }] : [],
  imageUrl: null,
  baseUnitId: product.baseUnit?.unitId ?? product.unitId ?? undefined,
  status: null,
  lastUpdate: undefined,
  updatedAt: undefined,
});

const normalizePagination = (payload: unknown, page: number, limit: number): Pagination => {
  const source = (payload && typeof payload === "object" ? payload : {}) as Record<
    string,
    unknown
  >;
  const pagination =
    source.pagination && typeof source.pagination === "object"
      ? (source.pagination as Record<string, unknown>)
      : source;
  const total = numberValue(pagination.total ?? pagination.totalItems ?? source.total);
  return {
    page: numberValue(pagination.page, page),
    limit: numberValue(pagination.limit, limit),
    total,
    totalPages: numberValue(
      pagination.totalPages ?? pagination.total_pages,
      Math.max(1, Math.ceil(total / limit)),
    ),
  };
};

const fetchStocks = async (
  params: GetStocksParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<StockItem>> => {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.query?.trim()) searchParams.set("query", params.query.trim());
  if (params.storeId) searchParams.set("storeId", String(params.storeId));
  if (params.lowStock) searchParams.set("lowStock", "true");

  const response = await authorizedFetch(`/stocks?${searchParams.toString()}`, { signal });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const payload = (await response.json()) as Record<string, unknown>;
  const stockResult: PaginatedResponse<StockItem> = {
    data: unwrapArray<unknown>(payload).map(normalizeStock),
    pagination: normalizePagination(payload, params.page, params.limit),
    summary: payload.summary as PaginatedResponse<StockItem>["summary"],
  };

  if (stockResult.data.length > 0 || !params.query?.trim()) {
    return stockResult;
  }

  const productResult = await fetchFallbackProducts(params.query.trim(), signal);
  const fallbackItems = productResult
    .filter((product) => product.track_stock === true && product.status === "ACTIVE")
    .map(mapProductToStockItem)
    .filter((item) => item.productId > 0);

  return {
    data: fallbackItems,
    pagination: {
      page: 1,
      limit: 50,
      total: fallbackItems.length,
      totalPages: 1,
    },
    summary: stockResult.summary,
  };
};

const fetchFallbackProducts = async (
  search: string,
  signal?: AbortSignal,
): Promise<ProductSearchItem[]> => {
  const searchParams = new URLSearchParams({
    page: "1",
    limit: "50",
    search,
  });
  const response = await authorizedFetch(`/products?${searchParams.toString()}`, { signal });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const payload = await response.json();
  return unwrapArray<unknown>(payload).map(normalizeProductSearchItem);
};

const fetchStockDetail = async (productId: number, storeId?: number): Promise<StockItem> => {
  const params = new URLSearchParams();
  if (storeId) params.set("storeId", String(storeId));
  const response = await authorizedFetch(
    `/stocks/${productId}${params.toString() ? `?${params}` : ""}`,
  );
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const payload = await response.json();
  return normalizeStock((payload as { data?: unknown }).data ?? payload);
};

const fetchStockUnits = async (productId: number, storeId?: number): Promise<StockUnit[]> => {
  const params = new URLSearchParams();
  if (storeId) params.set("storeId", String(storeId));
  const response = await authorizedFetch(
    `/stocks/${productId}/units${params.toString() ? `?${params}` : ""}`,
  );
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return unwrapArray<Record<string, unknown>>(await response.json()).map((unit) => ({
    productUnitId: numberValue(unit.productUnitId ?? unit.product_unit_id ?? unit.id),
    unitId: numberValue(unit.unitId ?? unit.unit_id),
    unitCode: stringValue(unit.unitCode ?? unit.unit_code),
    unitName: stringValue(unit.unitName ?? unit.unit_name_th ?? unit.unit_name),
    conversionToBase: numberValue(unit.conversionToBase ?? unit.conversion_to_base, 1),
    isBase: Boolean(unit.isBase ?? unit.is_base),
  }));
};

const fetchMovements = async (
  productId: number,
  params: {
    page: number;
    limit: number;
    storeId?: number;
    movementType?: string;
    dateFrom?: string;
    dateTo?: string;
  },
): Promise<PaginatedResponse<StockMovement>> => {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.storeId) searchParams.set("storeId", String(params.storeId));
  if (params.movementType) searchParams.set("movementType", params.movementType);
  if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) searchParams.set("dateTo", params.dateTo);

  const response = await authorizedFetch(`/stocks/${productId}/movements?${searchParams}`);
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const payload = (await response.json()) as Record<string, unknown>;
  return {
    data: unwrapArray<Record<string, unknown>>(payload).map((item) => {
      const actor = getMovementActor(item);
      return {
        id: numberValue(item.id ?? item.movementId ?? item.movement_id),
        movementType: stringValue(item.movementType ?? item.movement_type) ?? "-",
        qtyChangeBase: numberValue(item.qtyChangeBase ?? item.qty_change_base),
        beforeQtyBase: numberValue(item.beforeQtyBase ?? item.before_qty_base),
        afterQtyBase: numberValue(item.afterQtyBase ?? item.after_qty_base),
        referenceId: stringValue(item.referenceId ?? item.reference_id) ?? null,
        reasonCode: stringValue(item.reasonCode ?? item.reason_code) ?? null,
        note: stringValue(item.note) ?? null,
        createdAt: stringValue(item.createdAt ?? item.created_at),
        createdByName: actor.name,
        createdById: actor.id,
        deviceId:
          stringOrNumberValue(
            item.deviceId ??
              item.device_id ??
              item.posDeviceId ??
              item.pos_device_id ??
              item.machineId ??
              item.machine_id,
          ) ?? null,
        isReversed: Boolean(item.isReversed ?? item.is_reversed),
        canReverse:
          item.canReverse === undefined && item.can_reverse === undefined
            ? true
            : Boolean(item.canReverse ?? item.can_reverse),
      };
    }),
    pagination: normalizePagination(payload, params.page, params.limit),
  };
};

const fetchUsers = async (): Promise<UserSummary[]> => {
  const response = await authorizedFetch("/users");
  if (!response.ok) throw new Error(await readErrorMessage(response));

  return unwrapArray<Record<string, unknown>>(await response.json())
    .map((user) => {
      const userId = stringValue(user.user_id ?? user.userId ?? user.id);
      const fullName =
        stringValue(user.full_name ?? user.fullName ?? user.name) ??
        stringValue(user.username);

      if (!userId || !fullName) return null;
      return { userId, fullName };
    })
    .filter((user): user is UserSummary => Boolean(user));
};

const fetchPosDevices = async (): Promise<PosDeviceSummary[]> => {
  const response = await authorizedFetch("/pos-devices");
  if (!response.ok) throw new Error(await readErrorMessage(response));

  return unwrapArray<Record<string, unknown>>(await response.json())
    .map((device) => {
      const id = stringOrNumberValue(device.id);
      const machineId = stringValue(device.machine_id ?? device.machineId) ?? null;
      const deviceName =
        stringValue(device.device_name ?? device.deviceName) ??
        stringValue(device.hostname) ??
        machineId ??
        id;

      if (!id || !deviceName) return null;
      return { id, machineId, deviceName };
    })
    .filter((device): device is PosDeviceSummary => Boolean(device));
};

const formatQty = (value: number): string =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 4 }).format(value);

const formatDate = (value?: string): string =>
  value ? new Date(value).toLocaleString("th-TH") : "-";

const createReferenceId = (prefix: "COUNT" | "ADJ" | "OPEN"): string => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const getStockStatus = (stock: StockItem): "normal" | "low" | "out" | "uninitialized" => {
  if (!stock.hasStockRecord) return "uninitialized";
  const status = stock.status?.toUpperCase();
  if (status === "OUT_OF_STOCK" || status === "OUT") return "out";
  if (status === "LOW_STOCK" || status === "LOW") return "low";
  if (stock.stockBaseQty <= 0) return "out";
  if (stock.minStockBaseQty !== undefined && stock.stockBaseQty <= stock.minStockBaseQty) {
    return "low";
  }
  return "normal";
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

const getCountableUnits = (detail: StockItem | null, units: StockUnit[]): StockUnit[] => {
  if (units.length > 0) return units;
  if (!detail) return [];

  return [
    {
      productUnitId: detail.baseUnit?.productUnitId ?? detail.baseUnit?.unitId ?? detail.baseUnitId ?? 0,
      unitId: detail.baseUnit?.unitId ?? detail.baseUnitId,
      unitCode: detail.baseUnit?.unitCode ?? undefined,
      unitName: getBaseUnitLabel(detail),
      conversionToBase: 1,
      isBase: true,
    },
  ];
};

const resolveBaseUnitId = (detail: StockItem, units: StockUnit[]): number | null => {
  const baseUnitId = detail.baseUnit?.unitId ?? detail.baseUnitId;
  if (baseUnitId) return baseUnitId;

  const baseUnit = units.find((unit) => unit.isBase && unit.unitId);
  if (baseUnit?.unitId) return baseUnit.unitId;

  const baseUnitCode = detail.baseUnit?.unitCode?.trim();
  const matchedUnit = baseUnitCode
    ? units.find((unit) => unit.unitCode?.trim() === baseUnitCode && unit.unitId)
    : undefined;
  if (matchedUnit?.unitId) return matchedUnit.unitId;

  const firstUnit = units.find((unit) => unit.unitId);
  return firstUnit?.unitId ?? null;
};

export default function StockPage() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState<PaginatedResponse<StockItem>["summary"]>();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [storeId, setStoreId] = useState("");
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [userNameById, setUserNameById] = useState<Record<string, string>>({});
  const [deviceNameById, setDeviceNameById] = useState<Record<string, string>>({});
  const [lowStock, setLowStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [detail, setDetail] = useState<StockItem | null>(null);
  const [units, setUnits] = useState<StockUnit[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [countedQuantities, setCountedQuantities] = useState<CountedUnitQuantity>({});
  const [newStockQty, setNewStockQty] = useState("");
  const [reasonCode, setReasonCode] = useState<StockReasonCode>("PHYSICAL_COUNT");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementPage, setMovementPage] = useState(1);
  const [movementTotalPages, setMovementTotalPages] = useState(1);
  const [movementType, setMovementType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [movementLoading, setMovementLoading] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<StockMovement | null>(null);
  const [reverseNote, setReverseNote] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  const selectedStoreId = storeId ? Number(storeId) : undefined;

  const loadStocks = useCallback(
    async (page = pagination.page, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchStocks(
          {
            page,
            limit: PAGE_SIZE,
            query: debouncedSearch,
            storeId: selectedStoreId,
            lowStock,
          },
          signal,
        );
        setStocks(result.data);
        setPagination(result.pagination);
        setSummary(result.summary);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : STOCK_ERROR_FALLBACK);
        }
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, lowStock, pagination.page, selectedStoreId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadStocks(1, controller.signal);
    return () => controller.abort();
  }, [debouncedSearch, lowStock, selectedStoreId, loadStocks]);

  useEffect(() => {
    const loadStores = async () => {
      try {
        const response = await authorizedFetch("/stores");
        if (!response.ok) return;
        const data = unwrapArray<Record<string, unknown>>(await response.json()).map((store) => ({
          id: numberValue(store.id ?? store.storeId ?? store.store_id),
          name: stringValue(store.name ?? store.storeName ?? store.store_name) ?? "-",
        }));
        setStores(data.filter((store) => store.id));
      } catch {
        setStores([]);
      }
    };
    void loadStores();
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await fetchUsers();
        setUserNameById(
          users.reduce<Record<string, string>>((current, user) => {
            current[user.userId] = user.fullName;
            return current;
          }, {}),
        );
      } catch (err) {
        console.error("Error fetching users:", err);
        setUserNameById({});
      }
    };

    void loadUsers();
  }, []);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const devices = await fetchPosDevices();
        setDeviceNameById(
          devices.reduce<Record<string, string>>((current, device) => {
            current[device.id] = device.deviceName;
            if (device.machineId) {
              current[device.machineId] = device.deviceName;
            }
            return current;
          }, {}),
        );
      } catch (err) {
        console.error("Error fetching POS devices:", err);
        setDeviceNameById({});
      }
    };

    void loadDevices();
  }, []);

  const openDialog = async (mode: Exclude<DialogMode, null>, stock: StockItem) => {
    setSelectedStock(stock);
    setDialogMode(mode);
    setDetail(null);
    setUnits([]);
    setDialogError(null);
    setReasonCode(mode === "count" ? "PHYSICAL_COUNT" : "MANUAL_ADJUSTMENT");
    setNote("");
    setCountedQuantities({});
    setNewStockQty("");
    setDetailLoading(true);
    try {
      const [stockDetail, stockUnits] = await Promise.all([
        stock.hasStockRecord ? fetchStockDetail(stock.productId, selectedStoreId) : Promise.resolve(stock),
        mode === "count" || !stock.hasStockRecord
          ? fetchStockUnits(stock.productId, selectedStoreId).catch(() => [])
          : Promise.resolve([]),
      ]);
      setDetail(stockDetail);
      setUnits(stockUnits);
      setNewStockQty(String(stockDetail.stockBaseQty));
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : STOCK_ERROR_FALLBACK);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadMovements = useCallback(
    async (page = movementPage) => {
      if (!selectedStock) return;
      setMovementLoading(true);
      setDialogError(null);
      try {
        const result = await fetchMovements(selectedStock.productId, {
          page,
          limit: PAGE_SIZE,
          storeId: selectedStoreId,
          movementType,
          dateFrom,
          dateTo,
        });
        setMovements(result.data);
        setMovementPage(result.pagination.page);
        setMovementTotalPages(result.pagination.totalPages);
      } catch (err) {
        setDialogError(err instanceof Error ? err.message : STOCK_ERROR_FALLBACK);
      } finally {
        setMovementLoading(false);
      }
    },
    [dateFrom, dateTo, movementPage, movementType, selectedStock, selectedStoreId],
  );

  useEffect(() => {
    if (dialogMode === "history") void loadMovements(1);
  }, [dialogMode, loadMovements]);

  const countableUnits = useMemo(() => getCountableUnits(detail, units), [detail, units]);

  const totalBaseQty = useMemo(
    () =>
      countableUnits.reduce((total, unit) => {
        const inputQty = countedQuantities[unit.productUnitId] ?? 0;
        return total + inputQty * Number(unit.conversionToBase);
      }, 0),
    [countableUnits, countedQuantities],
  );
  const currentStockBaseQty = detail?.stockBaseQty ?? selectedStock?.stockBaseQty ?? 0;
  const difference = totalBaseQty - currentStockBaseQty;

  const resetStockForm = () => {
    setReasonCode("PHYSICAL_COUNT");
    setNote("");
    setCountedQuantities({});
    setNewStockQty("");
    setDialogError(null);
  };

  const closeDialog = () => {
    setDialogMode(null);
    setSelectedStock(null);
    setDetail(null);
    setUnits([]);
    resetStockForm();
  };

  const submitAdjustment = async (
    finalQty: number,
    referenceType: "STOCK_COUNT" | "MANUAL",
    prefix: "COUNT" | "ADJ",
  ) => {
    if (!selectedStock || !detail || submitting) return;
    if (!reasonCode) {
      setDialogError("กรุณาเลือกเหตุผล");
      return;
    }
    if (reasonCode === "OTHER" && !note.trim()) {
      setDialogError("กรุณาระบุรายละเอียดในหมายเหตุ");
      return;
    }
    if (!Number.isFinite(finalQty) || finalQty < 0) {
      setDialogError("จำนวนสต๊อกไม่ถูกต้อง");
      return;
    }
    setSubmitting(true);
    setDialogError(null);
    try {
      const deviceId = await getDeviceId();
      const isOpeningStock = !selectedStock.hasStockRecord && referenceType === "STOCK_COUNT";
      const unitId = resolveBaseUnitId(detail, units);
      if (!unitId) {
        throw new Error("สินค้านี้ยังไม่ได้กำหนดหน่วยฐาน กรุณาตั้งค่าหน่วยสินค้าก่อน");
      }

      const response = await authorizedFetch(isOpeningStock ? "/stocks/opening" : "/stocks/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedStock.productId,
          unitId,
          storeId: selectedStoreId,
          stockBaseQty: finalQty,
          deviceId,
          referenceType: isOpeningStock ? "MANUAL" : referenceType,
          referenceId: createReferenceId(isOpeningStock ? "OPEN" : prefix),
          reasonCode: isOpeningStock ? "OPENING" : reasonCode,
          note: note.trim() || undefined,
        }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      setMessage("ปรับยอดสต๊อกเรียบร้อยแล้ว");
      closeDialog();
      await loadStocks(pagination.page);
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : STOCK_ERROR_FALLBACK);
    } finally {
      setSubmitting(false);
    }
  };

  const reverseMovement = async (event: FormEvent) => {
    event.preventDefault();
    if (!reverseTarget || !reverseNote.trim() || submitting) return;
    setSubmitting(true);
    try {
      const response = await authorizedFetch(`/stocks/movements/${reverseTarget.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: reverseNote.trim() }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      setMessage("กลับรายการเรียบร้อยแล้ว");
      setReverseTarget(null);
      setReverseNote("");
      await Promise.all([loadMovements(movementPage), loadStocks(pagination.page)]);
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : STOCK_ERROR_FALLBACK);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-0 flex-1 overflow-auto bg-slate-50 p-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">สต๊อกสินค้า</h1>
              <p className="mt-1 text-sm text-slate-500">
                ดูและจัดการสต๊อกสินค้าทั้งหมดในร้านของคุณ
              </p>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <label className="relative min-w-[280px]">
                <IconSearch
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ค้นหาชื่อสินค้า SKU หรือบาร์โค้ด"
                  className="h-10 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-blue-500"
                />
              </label>
              <select
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
                className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
              >
                <option value="">ทุกสาขา</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
              <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={lowStock}
                  onChange={(event) => setLowStock(event.target.checked)}
                />
                แสดงเฉพาะสินค้าใกล้หมด
              </label>
              <button
                type="button"
                onClick={() => void loadStocks(pagination.page)}
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <IconRefresh size={17} /> รีเฟรช
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-4">
          <SummaryCard
            label="สินค้าทั้งหมด"
            value={debouncedSearch.trim() ? formatQty(stocks.length) : formatQty(pagination.total)}
          />
          {summary?.lowStockProducts !== undefined ? (
            <SummaryCard label="สินค้าใกล้หมด" value={formatQty(summary.lowStockProducts)} />
          ) : null}
          {summary?.outOfStockProducts !== undefined ? (
            <SummaryCard label="สินค้าหมด" value={formatQty(summary.outOfStockProducts)} />
          ) : null}
          {summary?.lastUpdatedAt ? (
            <SummaryCard label="อัปเดตล่าสุด" value={formatDate(summary.lastUpdatedAt)} />
          ) : null}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-600">
                <tr>
                  {[
                    "สินค้า",
                    "SKU / Barcode",
                    "สต๊อกปัจจุบัน",
                    "หน่วยฐาน",
                    "สต๊อกขั้นต่ำ",
                    "สถานะ",
                    "อัปเดตล่าสุด",
                    "จัดการ",
                  ].map((header) => (
                    <th key={header} className="px-4 py-3">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : stocks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      ไม่พบข้อมูลสต๊อกสินค้า
                    </td>
                  </tr>
                ) : (
                  stocks.map((stock) => (
                    <tr key={stock.productId} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {stock.imageUrl ? (
                            <img
                              src={stock.imageUrl}
                              className="h-10 w-10 rounded-lg object-cover"
                              alt=""
                            />
                          ) : (
                            <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-400">
                              <IconPackage size={20} />
                            </div>
                          )}
                          <span className="font-semibold text-slate-900">{stock.productName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <SkuBarcodeCell stock={stock} />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {formatQty(stock.stockBaseQty)}
                      </td>
                      <td className="px-4 py-3">{getBaseUnitLabel(stock)}</td>
                      <td className="px-4 py-3">
                        {stock.minStockBaseQty !== undefined ? formatQty(stock.minStockBaseQty) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <StockStatusBadge status={getStockStatus(stock)} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(stock.lastUpdate ?? stock.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <ActionButton
                            onClick={() => void openDialog("count", stock)}
                            icon={IconPackage}
                            label={stock.hasStockRecord ? "นับสต๊อก" : "ตั้งยอดเริ่มต้น"}
                          />
                          {stock.hasStockRecord ? (
                            <>
                              <ActionButton
                                onClick={() => void openDialog("adjust", stock)}
                                icon={IconAdjustments}
                                label="ปรับยอด"
                              />
                              <ActionButton
                                onClick={() => void openDialog("history", stock)}
                                icon={IconHistory}
                                label="ประวัติ"
                              />
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => void loadStocks(page)}
          />
        </section>
      </div>

      {dialogMode && selectedStock ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4">
          <div className="max-h-[90dvh] w-full max-w-[min(96vw,1280px)] overflow-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-xl font-bold text-slate-900">
                {dialogMode === "count"
                  ? "นับสต๊อก"
                  : dialogMode === "adjust"
                    ? "ปรับยอดสต๊อก"
                    : "ประวัติสต๊อก"}
              </h2>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <IconX size={20} />
              </button>
            </div>
            <div className="p-5">
              {detailLoading ? (
                <p className="py-8 text-center text-slate-500">กำลังโหลดข้อมูล...</p>
              ) : dialogError ? (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {dialogError}
                </p>
              ) : null}

              {dialogMode === "count" && detail ? (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitAdjustment(totalBaseQty, "STOCK_COUNT", "COUNT");
                  }}
                >
                  <StockDetailBlock detail={detail} />
                  <div className="grid gap-3 md:grid-cols-2">
                    {countableUnits.map((unit) => (
                      <label key={unit.productUnitId} className="rounded-lg border border-slate-200 p-3">
                        <span className="text-sm font-semibold text-slate-700">
                          {unit.unitName || unit.unitCode || unit.unitId}
                        </span>
                        <span className="ml-2 text-xs text-slate-500">
                          1 = {formatQty(unit.conversionToBase)} ฐาน
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={countedQuantities[unit.productUnitId] ?? ""}
                          onChange={(event) =>
                            setCountedQuantities((current) => ({
                              ...current,
                              [unit.productUnitId]: numberValue(event.target.value),
                            }))
                          }
                          className="mt-2 h-10 w-full rounded-lg border border-slate-300 px-3"
                        />
                      </label>
                    ))}
                  </div>
                  <DifferenceBlock
                    current={currentStockBaseQty}
                    counted={totalBaseQty}
                    difference={difference}
                  />
                  <ReasonFields
                    reasonCode={reasonCode}
                    setReasonCode={(value) => setReasonCode(value as StockCountReasonCode)}
                    options={stockCountReasonOptions}
                    note={note}
                    setNote={setNote}
                  />
                  <SubmitRow submitting={submitting} />
                </form>
              ) : null}

              {dialogMode === "adjust" && detail ? (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitAdjustment(numberValue(newStockQty, -1), "MANUAL", "ADJ");
                  }}
                >
                  <StockDetailBlock detail={detail} />
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">ยอดสต๊อกใหม่</span>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={newStockQty}
                      onChange={(event) => setNewStockQty(event.target.value)}
                      className="mt-2 h-10 w-full rounded-lg border border-slate-300 px-3"
                    />
                  </label>
                  <ReasonFields
                    reasonCode={reasonCode}
                    setReasonCode={(value) => setReasonCode(value as ManualStockAdjustmentReasonCode)}
                    options={manualAdjustmentReasonOptions}
                    note={note}
                    setNote={setNote}
                  />
                  <SubmitRow submitting={submitting} />
                </form>
              ) : null}

              {dialogMode === "history" ? (
                <StockHistory
                  movements={movements}
                  movementLoading={movementLoading}
                  movementPage={movementPage}
                  movementTotalPages={movementTotalPages}
                  movementType={movementType}
                  setMovementType={setMovementType}
                  userNameById={userNameById}
                  deviceNameById={deviceNameById}
                  dateFrom={dateFrom}
                  setDateFrom={setDateFrom}
                  dateTo={dateTo}
                  setDateTo={setDateTo}
                  loadMovements={loadMovements}
                  setReverseTarget={setReverseTarget}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {reverseTarget ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4">
          <form onSubmit={reverseMovement} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">กลับรายการ</h3>
            <p className="mt-2 text-sm text-slate-600">
              {movementTypeLabels[reverseTarget.movementType] ?? reverseTarget.movementType} /{" "}
              {reverseTarget.referenceId || "-"} / {formatQty(reverseTarget.qtyChangeBase)}
            </p>
            <textarea
              value={reverseNote}
              onChange={(event) => setReverseNote(event.target.value)}
              required
              placeholder="ระบุหมายเหตุการกลับรายการ"
              className="mt-4 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReverseTarget(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={submitting || !reverseNote.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                ยืนยัน
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function StockStatusBadge({ status }: { status: "normal" | "low" | "out" | "uninitialized" }) {
  const className = {
    normal: "bg-emerald-50 text-emerald-700 border-emerald-200",
    low: "bg-amber-50 text-amber-700 border-amber-200",
    out: "bg-red-50 text-red-700 border-red-200",
    uninitialized: "bg-slate-50 text-slate-700 border-slate-200",
  }[status];
  const label =
    status === "normal"
      ? "ปกติ"
      : status === "low"
        ? "ใกล้หมด"
        : status === "out"
          ? "หมด"
          : "ยังไม่ตั้งสต๊อก";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function SkuBarcodeCell({ stock }: { stock: StockItem }) {
  const sku = getProductSku(stock);
  const barcodes = getProductBarcodes(stock);
  const visibleBarcodes = barcodes.slice(0, 2);
  const hiddenCount = Math.max(barcodes.length - visibleBarcodes.length, 0);

  if (!sku && barcodes.length === 0) {
    return <span>-</span>;
  }

  return (
    <div className="space-y-1">
      {sku ? <div className="font-medium text-slate-700">SKU: {sku}</div> : null}
      {visibleBarcodes.map((item) => (
        <div key={item.barcode} className="font-mono text-xs text-slate-600">
          {item.barcode}
        </div>
      ))}
      {hiddenCount > 0 ? (
        <details className="group">
          <summary className="cursor-pointer list-none text-xs font-semibold text-blue-600 hover:text-blue-700">
            +{hiddenCount} บาร์โค้ด
          </summary>
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 shadow-sm">
            {barcodes.map((item) => (
              <div key={item.barcode} className="whitespace-nowrap py-0.5 font-mono">
                {item.unitName || item.unitCode ? `${item.unitName || item.unitCode}: ` : ""}
                {item.barcode}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ActionButton({
  onClick,
  icon: IconComponent,
  label,
}: {
  onClick: () => void;
  icon: Icon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
    >
      <IconComponent size={15} />
      {label}
    </button>
  );
}

function PaginationBar({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
      >
        ก่อนหน้า
      </button>
      <span>
        หน้า {page} / {Math.max(totalPages, 1)}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
      >
        ถัดไป
      </button>
    </div>
  );
}

function StockDetailBlock({ detail }: { detail: StockItem }) {
  return (
    <div className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm md:grid-cols-4">
      <div>
        <p className="text-slate-500">สินค้า</p>
        <p className="font-semibold">{detail.productName}</p>
      </div>
      <div>
        <p className="text-slate-500">สต๊อกในระบบ</p>
        <p className="font-semibold">{formatQty(detail.stockBaseQty)}</p>
      </div>
      <div>
        <p className="text-slate-500">หน่วยฐาน</p>
        <p className="font-semibold">{getBaseUnitLabel(detail)}</p>
      </div>
      <div>
        <p className="text-slate-500">อัปเดตล่าสุด</p>
        <p className="font-semibold">{formatDate(detail.updatedAt)}</p>
      </div>
    </div>
  );
}

function DifferenceBlock({
  current,
  counted,
  difference,
}: {
  current: number;
  counted: number;
  difference: number;
}) {
  const text =
    difference > 0
      ? `เพิ่มสต๊อก ${formatQty(difference)} หน่วย`
      : difference < 0
        ? `ลดสต๊อก ${formatQty(Math.abs(difference))} หน่วย`
        : "จำนวนตรงกับระบบ";
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 p-4 text-sm md:grid-cols-3">
      <div>
        <p className="text-slate-500">สต๊อกในระบบ</p>
        <p className="font-bold">{formatQty(current)}</p>
      </div>
      <div>
        <p className="text-slate-500">จำนวนที่นับได้</p>
        <p className="font-bold">{formatQty(counted)}</p>
      </div>
      <div>
        <p className="text-slate-500">ส่วนต่าง</p>
        <p className="font-bold">{text}</p>
      </div>
    </div>
  );
}

function ReasonFields<T extends string>({
  reasonCode,
  setReasonCode,
  options,
  note,
  setNote,
}: {
  reasonCode: T;
  setReasonCode: (value: T) => void;
  options: ReasonOption<T>[];
  note: string;
  setNote: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label>
        <span className="text-sm font-semibold text-slate-700">เหตุผล</span>
        <select
          value={reasonCode}
          onChange={(event) => setReasonCode(event.target.value as T)}
          required
          className="mt-2 h-10 w-full rounded-lg border border-slate-300 px-3"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="text-sm font-semibold text-slate-700">หมายเหตุ</span>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="mt-2 h-10 w-full rounded-lg border border-slate-300 px-3"
        />
      </label>
    </div>
  );
}

function SubmitRow({ submitting }: { submitting: boolean }) {
  return (
    <div className="flex justify-end">
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "กำลังบันทึก..." : "ยืนยัน"}
      </button>
    </div>
  );
}

function StockHistory({
  movements,
  movementLoading,
  movementPage,
  movementTotalPages,
  movementType,
  setMovementType,
  userNameById,
  deviceNameById,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  loadMovements,
  setReverseTarget,
}: {
  movements: StockMovement[];
  movementLoading: boolean;
  movementPage: number;
  movementTotalPages: number;
  movementType: string;
  setMovementType: (value: string) => void;
  userNameById: Record<string, string>;
  deviceNameById: Record<string, string>;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
  loadMovements: (page?: number) => Promise<void>;
  setReverseTarget: (movement: StockMovement) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          value={movementType}
          onChange={(event) => setMovementType(event.target.value)}
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
        >
          <option value="">ทุกประเภท</option>
          {Object.entries(movementTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
        />
        <button
          type="button"
          onClick={() => void loadMovements(movementPage)}
          className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
        >
          <IconRefresh size={16} /> รีเฟรช
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-slate-100 text-xs text-slate-600">
            <tr>
              {[
                "วันที่และเวลา",
                "ประเภทรายการ",
                "จำนวนเปลี่ยนแปลง",
                "ยอดก่อน",
                "ยอดหลัง",
                "เลขอ้างอิง",
                "เหตุผล",
                "หมายเหตุ",
                "\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07",
                "ผู้ทำรายการ",
                "จัดการ",
              ].map((header) => (
                <th key={header} className="px-2 py-2">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movementLoading ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                  กำลังโหลดข้อมูล...
                </td>
              </tr>
            ) : movements.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                  ยังไม่มีประวัติการเคลื่อนไหวของสต๊อก
                </td>
              </tr>
            ) : (
              movements.map((movement) => {
                const actorName =
                  (movement.createdById ? userNameById[movement.createdById] : undefined) ??
                  movement.createdByName ??
                  (movement.createdById ? `ID: ${movement.createdById}` : "-");
                const deviceName =
                  (movement.deviceId ? deviceNameById[movement.deviceId] : undefined) ??
                  movement.deviceId ??
                  "-";

                return (
                <tr key={movement.id}>
                  <td className="px-2 py-2 align-top">{formatDate(movement.createdAt)}</td>
                  <td className="px-2 py-2 align-top">
                    {movementTypeLabels[movement.movementType] ?? movement.movementType}
                  </td>
                  <td className="px-2 py-2 align-top font-semibold">
                    {movement.qtyChangeBase > 0
                      ? `+${formatQty(movement.qtyChangeBase)}`
                      : formatQty(movement.qtyChangeBase)}
                  </td>
                  <td className="px-2 py-2 align-top">{formatQty(movement.beforeQtyBase)}</td>
                  <td className="px-2 py-2 align-top">{formatQty(movement.afterQtyBase)}</td>
                  <td className="break-words px-2 py-2 align-top">{movement.referenceId || "-"}</td>
                  <td className="px-2 py-2 align-top">
                    {movement.reasonCode
                      ? stockReasonCodeLabels[movement.reasonCode] ?? movement.reasonCode
                      : "-"}
                  </td>
                  <td className="break-words px-2 py-2 align-top">{movement.note || "-"}</td>
                  <td className="break-words px-2 py-2 align-top">
                    {deviceName}
                  </td>
                  <td className="break-words px-2 py-2 align-top">
                    {actorName}
                  </td>
                  <td className="px-2 py-2 align-top">
                    {movement.canReverse &&
                    !movement.isReversed &&
                    movement.movementType !== "REVERSAL" ? (
                      <button
                        type="button"
                        onClick={() => setReverseTarget(movement)}
                        className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600"
                      >
                        กลับรายการ
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <PaginationBar
        page={movementPage}
        totalPages={movementTotalPages}
        onPageChange={(page) => void loadMovements(page)}
      />
    </div>
  );
}
