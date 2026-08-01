import { ensureValidAccessToken, refreshAccessToken } from "./auth";

export type AutoPackPricingScope =
  | "DISABLED"
  | "ALL_CUSTOMERS"
  | "MEMBERS_ONLY";

export interface AutoPackStoreSettings {
  store_name?: string;
  vat_enabled?: boolean;
  vat_rate?: number | string | null;
  auto_pack_pricing_scope?: AutoPackPricingScope;
}

export interface AutoPackCartItem {
  id?: number | string;
  productId?: number | string | null;
  product_id?: number | string | null;
  productUnitId?: number | string | null;
  product_unit_id?: number | string | null;
  barcode?: string | null;
  name: string;
  product_name?: string;
  unit?: string;
  unit_code?: string | null;
  unitNameTh?: string | null;
  unit_name_th?: string | null;
  unitName?: string | null;
  unit_name?: string | null;
  qty: number;
  price: number;
  unit_price?: number | string | null;
  sale_price?: number | string | null;
  discount?: number;
  discount_amount?: number | string | null;
  final_price?: number | string | null;
  total_amount?: number | string | null;
  totalBaseQty?: number | string | null;
  regularAmount?: number | string | null;
  calculatedAmount?: number | string | null;
  savingAmount?: number | string | null;
  pricingBreakdown?: AutoPackPricingBreakdown[];
  allow_discount?: boolean | number | string | null;
}

export interface AutoPackPricingBreakdown {
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
  pricingBreakdown?: AutoPackPricingBreakdown[];
  pricing_breakdown?: AutoPackPricingBreakdown[];
}

interface CalculateCartResponse {
  items?: CalculateCartItem[];
  data?: { items?: CalculateCartItem[] };
  message?: string;
}

type StoreSettingsResponse =
  | AutoPackStoreSettings[]
  | {
      data?:
        | AutoPackStoreSettings
        | AutoPackStoreSettings[]
        | { store?: AutoPackStoreSettings };
      store?: AutoPackStoreSettings;
      message?: string;
    };

export const SELECTED_POS_CUSTOMER_KEY = "pos_selected_customer";
export const AUTO_PACK_PRICING_MIN_QTY = 6;

export const normalizeAutoPackPricingScope = (
  value: unknown,
): AutoPackPricingScope =>
  value === "ALL_CUSTOMERS" || value === "MEMBERS_ONLY" || value === "DISABLED"
    ? value
    : "DISABLED";

export const hasStoredSelectedCustomer = (value: unknown): boolean =>
  Boolean(
    value &&
      typeof value === "object" &&
      ("id" in value || "customer_code" in value || "customer_name" in value),
  );

export const getAutoPackProductUnitId = (
  item: AutoPackCartItem,
): number | null => {
  const productUnitId = Number(item.productUnitId ?? item.product_unit_id);
  return Number.isFinite(productUnitId) && productUnitId > 0
    ? productUnitId
    : null;
};

export const hasAutoPackPricingQty = (items: AutoPackCartItem[]): boolean =>
  items.some(
    (item) =>
      getAutoPackProductUnitId(item) != null &&
      (Number(item.qty) || 0) >= AUTO_PACK_PRICING_MIN_QTY,
  );

export const getBreakdownProductUnitId = (
  line: AutoPackPricingBreakdown,
): number | string | null => line.productUnitId ?? line.product_unit_id ?? null;

export const getBreakdownUnitCode = (
  line: AutoPackPricingBreakdown,
): string | undefined => line.unitCode ?? line.unit_code ?? undefined;

export const getBreakdownUnitName = (
  line: AutoPackPricingBreakdown,
): string | null =>
  line.unitNameTh ??
  line.unit_name_th ??
  line.unitName ??
  line.unit_name ??
  null;

export const getBreakdownUnitPrice = (
  line: AutoPackPricingBreakdown,
): number => Number(line.unitPrice ?? line.unit_price ?? 0) || 0;

export const getBreakdownQty = (line: AutoPackPricingBreakdown): number =>
  Number(line.qty ?? 0) || 0;

export const getBreakdownConversionToBase = (
  line: AutoPackPricingBreakdown,
): number => Number(line.conversionToBase ?? line.conversion_to_base ?? 1) || 1;

export const getBreakdownTotalAmount = (
  line: AutoPackPricingBreakdown,
): number =>
  Number(
    line.totalAmount ??
      line.total_amount ??
      getBreakdownQty(line) * getBreakdownUnitPrice(line),
  ) || 0;

const getApiBaseUrl = async (): Promise<string> => {
  const apiPath = await window.electronStore.get("apiPath");
  if (typeof apiPath !== "string" || !apiPath.trim()) {
    throw new Error("ไม่พบ API endpoint ใน store");
  }
  return apiPath.trim().replace(/\/+$/, "");
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

const isStoreSettings = (value: unknown): value is AutoPackStoreSettings =>
  Boolean(
    value &&
      typeof value === "object" &&
      ("store_name" in value || "auto_pack_pricing_scope" in value),
  );

const unwrapStoreSettings = (data: StoreSettingsResponse): AutoPackStoreSettings => {
  if (Array.isArray(data)) return data[0] ?? {};
  if (Array.isArray(data.data)) return data.data[0] ?? {};
  if (isStoreSettings(data.data)) return data.data;
  return data.data?.store ?? data.store ?? {};
};

export const loadAutoPackStoreSettings =
  async (): Promise<AutoPackStoreSettings> => {
    const response = await authorizedApiFetch("/store-settings");
    const data = (await response.json().catch(() => ({}))) as StoreSettingsResponse;

    if (!response.ok) {
      const message = !Array.isArray(data) ? data.message : "";
      throw new Error(message || `โหลดการตั้งค่าร้านไม่สำเร็จ (${response.status})`);
    }

    const settings = unwrapStoreSettings(data);
    return {
      ...settings,
      auto_pack_pricing_scope: normalizeAutoPackPricingScope(
        settings.auto_pack_pricing_scope,
      ),
    };
  };

export const shouldUseAutoPackPricing = async (
  items: AutoPackCartItem[],
): Promise<{ enabled: boolean; settings: AutoPackStoreSettings }> => {
  const [settings, storedSelectedCustomer] = await Promise.all([
    loadAutoPackStoreSettings(),
    window.electronStore.get(SELECTED_POS_CUSTOMER_KEY),
  ]);
  const scope = normalizeAutoPackPricingScope(settings.auto_pack_pricing_scope);
  const allowed =
    scope === "ALL_CUSTOMERS" ||
    (scope === "MEMBERS_ONLY" && hasStoredSelectedCustomer(storedSelectedCustomer));

  return {
    enabled: allowed && hasAutoPackPricingQty(items),
    settings: { ...settings, auto_pack_pricing_scope: scope },
  };
};

const getMachineId = (storedDevice: unknown): string | null => {
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

const getCalculateCartItems = (
  result: CalculateCartResponse,
): CalculateCartItem[] => result.data?.items ?? result.items ?? [];

const getProductId = (item: AutoPackCartItem): number | null => {
  const productId = Number(item.product_id ?? item.productId ?? item.id);
  return Number.isFinite(productId) && productId > 0 ? productId : null;
};

const calculateCartUnitPrices = async (
  items: AutoPackCartItem[],
): Promise<CalculateCartResponse> => {
  const storedDevice = await window.electronStore.get("pos_device");
  const machineId = getMachineId(storedDevice);
  if (!machineId) {
    throw new Error("ไม่พบ machine_id กรุณาลงทะเบียนเครื่อง POS ก่อน");
  }

  const requestItemsByUnit = new Map<
    string,
    { productId: number; productUnitId: number; qty: number }
  >();

  items.forEach((item) => {
    const productId = getProductId(item);
    const productUnitId = getAutoPackProductUnitId(item);
    if (productId == null || productUnitId == null) return;

    const key = `${productId}:${productUnitId}`;
    const existing = requestItemsByUnit.get(key);
    requestItemsByUnit.set(key, {
      productId,
      productUnitId,
      qty: (existing?.qty ?? 0) + (Number(item.qty) || 0),
    });
  });

  const requestItems = Array.from(requestItemsByUnit.values());
  const response = await authorizedApiFetch("/pos/calculate-cart", {
    method: "POST",
    body: JSON.stringify({ machineId, items: requestItems }),
  });
  const data = (await response.json().catch(() => ({}))) as CalculateCartResponse;

  if (!response.ok) {
    throw new Error(data.message || `คำนวณราคาแพ็คไม่สำเร็จ (${response.status})`);
  }

  return data;
};

export const mapAutoPackCalculatedItems = <T extends AutoPackCartItem>(
  currentItems: T[],
  calculatedItems: CalculateCartItem[],
): T[] =>
  calculatedItems.flatMap((calculated, index) => {
    const productId = calculated.productId ?? calculated.product_id;
    const breakdown =
      calculated.pricingBreakdown ?? calculated.pricing_breakdown ?? [];
    const source =
      currentItems.find(
        (item) =>
          productId != null &&
          String(item.product_id ?? item.productId ?? item.id) === String(productId),
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

    if (breakdown.length === 0) return source ? [source] : [];

    return breakdown.map((line, lineIndex) => {
      const productUnitId = getBreakdownProductUnitId(line);
      const qty = getBreakdownQty(line);
      const unitPrice = getBreakdownUnitPrice(line);
      const totalAmount = getBreakdownTotalAmount(line);
      const unitName = getBreakdownUnitName(line);
      return {
        ...(source as T),
        id: `${productId ?? source?.productId ?? source?.id}-${productUnitId ?? lineIndex}`,
        product_id: productId ?? source?.product_id ?? source?.productId ?? null,
        productId: productId ?? source?.productId ?? source?.product_id ?? null,
        productUnitId,
        product_unit_id: productUnitId,
        barcode: calculated.barcode ?? source?.barcode ?? null,
        name: productName,
        product_name: productName,
        unit: getBreakdownUnitCode(line) ?? source?.unit,
        unit_code: getBreakdownUnitCode(line) ?? source?.unit_code ?? null,
        unitNameTh: unitName,
        unit_name_th: unitName,
        unitName,
        unit_name: unitName,
        qty,
        price: unitPrice,
        unit_price: unitPrice,
        sale_price: unitPrice,
        final_price: totalAmount,
        total_amount: totalAmount,
        regularAmount: totalAmount,
        calculatedAmount: totalAmount,
        pricingBreakdown: [line],
        discount: 0,
        discount_amount: 0,
      } as T;
    });
  });

export const calculateAutoPackCart = async <T extends AutoPackCartItem>(
  items: T[],
): Promise<{ items: T[]; settings: AutoPackStoreSettings; enabled: boolean }> => {
  const { enabled, settings } = await shouldUseAutoPackPricing(items);
  if (!enabled) return { items, settings, enabled };

  const calculableItems = items.filter(
    (item) => getAutoPackProductUnitId(item) != null && getProductId(item) != null,
  );
  const uncalculableItems = items.filter(
    (item) => getAutoPackProductUnitId(item) == null || getProductId(item) == null,
  );
  if (calculableItems.length === 0) return { items, settings, enabled: false };

  const result = await calculateCartUnitPrices(calculableItems);
  return {
    items: [
      ...mapAutoPackCalculatedItems(calculableItems, getCalculateCartItems(result)),
      ...uncalculableItems,
    ],
    settings,
    enabled,
  };
};
