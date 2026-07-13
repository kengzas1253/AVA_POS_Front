import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  IconBarcode,
  IconBox,
  IconCalendar,
  IconChevronRight,
  IconDiscount,
  IconInfoCircle,
  IconPackage,
  IconPencil,
  IconPlus,
  IconSearch,
  IconStairsUp,
  IconTag,
  IconTrash,
  IconX,
  IconCheck,
  IconClock,
} from "@tabler/icons-react";
import { ensureValidAccessToken, refreshAccessToken } from "./auth";
import { normalizeBarcode } from "./BarcodeNormalizer";

// ─── Types ────────────────────────────────────────────────────────────────────

type PromoType = "FIXED_BUNDLE_PRICE" | "TIER_UNIT_PRICE" | "PERCENT_DISCOUNT";

interface Product {
  id: number | string;
  product_name: string;
  name?: string;
  sku?: string;
  barcode?: string;
  sale_price: number;
  category_name?: string;
  [key: string]: unknown;
}

interface TierRow {
  id: number;
  qty: string;
  price: string;
}

interface Promotion {
  id: number;
  code: string;
  name: string;
  type: PromoType;
  detail: string;
  products: Product[];
  dateStart?: string;
  dateEnd?: string;
  status?: string;
  allowMix?: boolean;
  rules?: PromotionRule[];
  priority?: number;
  canCombine?: boolean;
}

interface PromotionRule {
  min_qty: number;
  bundle_price?: number;
  unit_price?: number;
  discount_percent?: number;
}

interface PromotionApiItem {
  id: number;
  promotion_code?: string;
  promotion_name?: string;
  promotion_type?: PromoType;
  allow_mix?: boolean;
  mix_type?: "NONE" | "PRODUCT";
  start_date?: string | null;
  end_date?: string | null;
  priority?: number;
  can_combine?: boolean;
  status?: string;
  rules?: PromotionRule[];
  products?: Product[];
  product_ids?: Array<number | string>;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const getApiBaseUrl = async (): Promise<string> => {
  const apiPath = await window.electronStore.get("apiPath");
  if (typeof apiPath !== "string" || !apiPath.trim()) throw new Error("ไม่พบ API endpoint ใน store");
  return apiPath.trim().replace(/\/+$/, "");
};

const authorizedFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const isAuthenticated = await ensureValidAccessToken();
  if (!isAuthenticated) throw new Error("ไม่สามารถยืนยันตัวตนได้");
  const apiBaseUrl = await getApiBaseUrl();
  let accessToken = await window.electronStore.get("access_token");
  if (typeof accessToken !== "string" || !accessToken.trim()) throw new Error("ไม่พบ access token");
  const request = (token: string) =>
    fetch(`${apiBaseUrl}${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  let response = await request(accessToken);
  if (response.status === 401) { accessToken = await refreshAccessToken(); response = await request(accessToken); }
  return response;
};

const getApiErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const data: { message?: string | string[]; error?: string } = await response.json();
    if (Array.isArray(data.message)) return data.message.join(", ");
    return data.message || data.error || fallback;
  } catch {
    return fallback;
  }
};

const unwrapList = <T,>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const record = data as { data?: unknown; products?: unknown; promotions?: unknown; items?: unknown };
    if (Array.isArray(record.data)) return record.data as T[];
    if (Array.isArray(record.promotions)) return record.promotions as T[];
    if (Array.isArray(record.products)) return record.products as T[];
    if (Array.isArray(record.items)) return record.items as T[];
    if (record.data && typeof record.data === "object") {
      const nested = record.data as { data?: unknown; products?: unknown; promotions?: unknown; items?: unknown };
      if (Array.isArray(nested.data)) return nested.data as T[];
      if (Array.isArray(nested.promotions)) return nested.promotions as T[];
      if (Array.isArray(nested.products)) return nested.products as T[];
      if (Array.isArray(nested.items)) return nested.items as T[];
    }
  }
  return [];
};

const getProductName = (product: Product) => product.product_name || product.name || `สินค้า #${product.id}`;

const normalizeProduct = (product: Product): Product => ({
  ...product,
  product_name: getProductName(product),
  sale_price: Number(product.sale_price ?? 0),
});

const formatDateForInput = (value?: string | null) => value ? value.slice(0, 10) : "";
const toDateTime = (value: string, endOfDay = false) =>
  value ? `${value}T${endOfDay ? "23:59:59" : "00:00:00"}.000Z` : undefined;

const describePromotion = (promo: PromotionApiItem): string => {
  const rules = promo.rules ?? [];
  if (promo.promotion_type === "FIXED_BUNDLE_PRICE") {
    const rule = rules[0];
    return rule ? `ซื้อครบ ${rule.min_qty} ชิ้น${promo.allow_mix ? " (คละได้)" : ""} ฿${Number(rule.bundle_price ?? 0).toLocaleString()}` : "Bundle";
  }
  if (promo.promotion_type === "TIER_UNIT_PRICE") {
    return rules.map((rule) => `${rule.min_qty}+ ชิ้น: ฿${Number(rule.unit_price ?? 0).toLocaleString()}/ชิ้น`).join(" · ") || "ขั้นบันได";
  }
  if (promo.promotion_type === "PERCENT_DISCOUNT") {
    const rule = rules[0];
    return rule ? `ซื้อครบ ${rule.min_qty} ชิ้น ลด ${Number(rule.discount_percent ?? 0).toLocaleString()}%` : "ส่วนลด";
  }
  return "";
};

const mapPromotion = (promo: PromotionApiItem): Promotion => ({
  id: promo.id,
  code: promo.promotion_code ?? "",
  name: promo.promotion_name ?? "",
  type: promo.promotion_type ?? "FIXED_BUNDLE_PRICE",
  detail: describePromotion(promo),
  products: promo.products ?? (promo.product_ids ?? []).map((id) => ({
    id,
    product_name: `สินค้า #${id}`,
    sku: "",
    sale_price: 0,
  })),
  dateStart: formatDateForInput(promo.start_date),
  dateEnd: formatDateForInput(promo.end_date),
  status: promo.status,
  allowMix: promo.allow_mix,
  rules: promo.rules ?? [],
  priority: promo.priority,
  canCombine: promo.can_combine,
});

// ─── Config ───────────────────────────────────────────────────────────────────

const PROMO_CONFIG: Record<
  PromoType,
  { label: string; desc: string; example: string; icon: React.ReactNode; color: string; badge: string; iconBg: string; iconText: string }
> = {
  FIXED_BUNDLE_PRICE: {
    label: "Bundle ราคาพิเศษ",
    desc: "ซื้อครบ X ชิ้น ราคา Y บาท คละสินค้าได้",
    example: "เช่น น้ำ 3 แพ็ค 100 บาท",
    icon: <IconPackage size={20} />,
    color: "border-blue-500 bg-blue-50",
    badge: "bg-blue-50 text-blue-700",
    iconBg: "bg-blue-100",
    iconText: "text-blue-700",
  },
  TIER_UNIT_PRICE: {
    label: "ราคาขั้นบันได",
    desc: "ซื้อครบ X ชิ้น ราคาต่อชิ้นถูกลง",
    example: "เช่น ซื้อ 10 ห่อ เหลือห่อละ 23 บาท",
    icon: <IconStairsUp size={20} />,
    color: "border-emerald-500 bg-emerald-50",
    badge: "bg-emerald-50 text-emerald-700",
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-700",
  },
  PERCENT_DISCOUNT: {
    label: "ส่วนลด %",
    desc: "ซื้อครบ X ชิ้น ลดเป็น % จากราคาขาย",
    example: "เช่น ซื้อ 10 ห่อ ลด 5%",
    icon: <IconDiscount size={20} />,
    color: "border-amber-500 bg-amber-50",
    badge: "bg-amber-50 text-amber-700",
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 block text-xs font-medium text-slate-500">{children}</p>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20 disabled:bg-slate-50 disabled:text-slate-400 ${props.className ?? ""}`}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PromotionPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0=list, 1=picker, 2=form
  const [selectedType, setSelectedType] = useState<PromoType | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState<number | null>(null);

  // form state
  const [promoCode, setPromoCode] = useState("");
  const [promoName, setPromoName] = useState("");
  const [bundleQty, setBundleQty] = useState("");
  const [bundlePrice, setBundlePrice] = useState("");
  const [allowMix, setAllowMix] = useState(true);
  const [tiers, setTiers] = useState<TierRow[]>([{ id: 1, qty: "", price: "" }, { id: 2, qty: "", price: "" }]);
  const [tierCounter, setTierCounter] = useState(3);
  const [pctQty, setPctQty] = useState("");
  const [pctDiscount, setPctDiscount] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  // product search
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchPromotions = async () => {
    setIsLoadingPromotions(true);
    setErrorMessage(null);
    try {
      const res = await authorizedFetch("/promotions");
      if (!res.ok) throw new Error(await getApiErrorMessage(res, "โหลดรายการโปรโมชั่นไม่สำเร็จ"));
      const data = await res.json();
      setPromotions(
        unwrapList<PromotionApiItem>(data)
          .map(mapPromotion),
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "โหลดรายการโปรโมชั่นไม่สำเร็จ");
    } finally {
      setIsLoadingPromotions(false);
    }
  };

  useEffect(() => {
    void fetchPromotions();
  }, []);

  const fetchProducts = async (search = "") => {
    setIsLoadingProducts(true);
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      const trimmedSearch = search.trim();
      if (trimmedSearch) params.set("search", trimmedSearch);
      const res = await authorizedFetch(`/products?${params.toString()}`);
      if (!res.ok) throw new Error(await getApiErrorMessage(res, "โหลดสินค้าไม่สำเร็จ"));
      const data = await res.json();
      const list = unwrapList<Product>(data).map(normalizeProduct);
      setAllProducts(list);
      return list;
    } catch (err) {
      console.error("Error fetching products:", err);
      setErrorMessage(err instanceof Error ? err.message : "โหลดสินค้าไม่สำเร็จ");
      return [];
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const openStep1 = () => {
    setSelectedType(null);
    setEditingId(null);
    setErrorMessage(null);
    setStep(1);
    void fetchProducts();
  };

  const resetForm = () => {
    setPromoCode("");
    setPromoName("");
    setBundleQty(""); setBundlePrice(""); setAllowMix(true);
    setTiers([{ id: 1, qty: "", price: "" }]); setTierCounter(2);
    setPctQty(""); setPctDiscount("");
    setDateStart(""); setDateEnd("");
    setSearchTerm(""); setSearchResults([]); setSelectedProducts([]);
    setShowDropdown(false); setShowBarcodeInput(false); setBarcodeValue(""); setBarcodeError(null);
  };

  const openStep2 = () => {
    if (!selectedType) return;
    resetForm();
    setStep(2);
  };

  const closeAll = () => { setStep(0); setSelectedType(null); setEditingId(null); };

  // ── Product search ──
  const handleSearch = async (q: string) => {
    setSearchTerm(q);
    setBarcodeError(null);
    if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    const products = await fetchProducts(q);
    const hits = products.filter((p) => !selectedProducts.find((s) => String(s.id) === String(p.id)));
    setSearchResults(hits);
    setShowDropdown(true);
  };

  const addProduct = (p: Product) => {
    if (selectedProducts.find((s) => s.id === p.id)) return;
    setSelectedProducts((prev) => [...prev, p]);
    setSearchTerm(""); setShowDropdown(false);
  };

  const removeProduct = (id: number | string) => setSelectedProducts((prev) => prev.filter((p) => p.id !== id));

  const normalizeProductCode = (value?: string | null) => normalizeBarcode(String(value ?? ""));

  const handleBarcodeConfirm = async () => {
    const val = normalizeBarcode(barcodeValue);
    if (!val) return;
    const products = await fetchProducts(val);
    const p = products.find((x) => normalizeProductCode(x.barcode) === val || normalizeProductCode(x.sku) === val) ?? products[0];
    if (!p) { setBarcodeError(`ไม่พบสินค้าบาร์โค้ด: ${val}`); return; }
    if (!selectedProducts.find((s) => s.id === p.id)) setSelectedProducts((prev) => [...prev, p]);
    setBarcodeValue(""); setBarcodeError(null);
  };

  const onBarcodeKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); void handleBarcodeConfirm(); } };

  // ── Tiers ──
  const addTier = () => {
    setTiers((prev) => [...prev, { id: tierCounter, qty: "", price: "" }]);
    setTierCounter((n) => n + 1);
  };
  const removeTier = (id: number) => setTiers((prev) => prev.filter((t) => t.id !== id));
  const updateTier = (id: number, field: "qty" | "price", val: string) =>
    setTiers((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: val } : t)));

  // ── Preview ──
  const buildPreview = (): string => {
    if (!selectedType) return "";
    const cfg = PROMO_CONFIG[selectedType];
    const prodStr =
      selectedProducts.length === 0 ? "" :
      selectedProducts.length <= 2 ? selectedProducts.map(getProductName).join(", ") :
      `${getProductName(selectedProducts[0])} +${selectedProducts.length - 1} รายการ`;

    if (selectedType === "FIXED_BUNDLE_PRICE") {
      if (!bundleQty || !bundlePrice) return "";
      return [prodStr, `ซื้อครบ ${bundleQty} ชิ้น${allowMix ? " (คละได้)" : ""}`, `ราคา ฿${Number(bundlePrice).toLocaleString()}`, promoName ? `"${promoName}"` : ""].filter(Boolean).join("\n");
    }
    if (selectedType === "TIER_UNIT_PRICE") {
      const validTiers = tiers.filter((t) => t.qty && t.price);
      if (!validTiers.length) return "";
      return [prodStr, ...validTiers.map((t) => `${t.qty}+ ชิ้น → ฿${Number(t.price).toLocaleString()}/ชิ้น`), promoName ? `"${promoName}"` : ""].filter(Boolean).join("\n");
    }
    if (selectedType === "PERCENT_DISCOUNT") {
      if (!pctQty || !pctDiscount) return "";
      return [prodStr, `ซื้อครบ ${pctQty} ชิ้น ลด ${Number(pctDiscount).toFixed(1)}%`, promoName ? `"${promoName}"` : ""].filter(Boolean).join("\n");
    }
    return "";
  };

  // ── Save ──
  const buildRules = (): PromotionRule[] => {
    if (selectedType === "FIXED_BUNDLE_PRICE") return [{ min_qty: Number(bundleQty), bundle_price: Number(bundlePrice) }];
    if (selectedType === "TIER_UNIT_PRICE") return tiers.map((tier) => ({ min_qty: Number(tier.qty), unit_price: Number(tier.price) }));
    if (selectedType === "PERCENT_DISCOUNT") return [{ min_qty: Number(pctQty), discount_percent: Number(pctDiscount) }];
    return [];
  };

  const validateForm = () => {
    if (!promoCode.trim()) return "กรุณากรอกรหัสโปรโมชั่น";
    if (!promoName.trim()) return "กรุณากรอกชื่อโปรโมชั่น";
    if (selectedProducts.length === 0) return "กรุณาเลือกสินค้าอย่างน้อย 1 รายการ";
    const rules = buildRules();
    if (rules.length === 0) return "กรุณาเพิ่มเงื่อนไขโปรโมชั่นอย่างน้อย 1 รายการ";
    for (const rule of rules) {
      if (!Number.isFinite(rule.min_qty) || rule.min_qty <= 0) return "จำนวนขั้นต่ำต้องมากกว่า 0";
      if (selectedType === "FIXED_BUNDLE_PRICE" && (!Number.isFinite(rule.bundle_price) || Number(rule.bundle_price) <= 0)) return "กรุณากรอกราคา bundle";
      if (selectedType === "TIER_UNIT_PRICE" && (!Number.isFinite(rule.unit_price) || Number(rule.unit_price) <= 0)) return "กรุณากรอกราคาต่อชิ้น";
      if (selectedType === "PERCENT_DISCOUNT" && (!Number.isFinite(rule.discount_percent) || Number(rule.discount_percent) <= 0 || Number(rule.discount_percent) > 100)) return "ส่วนลดต้องมากกว่า 0 และไม่เกิน 100";
    }
    return null;
  };

  const buildPayload = () => {
    const payload: {
      promotion_code: string;
      promotion_name: string;
      promotion_type: PromoType | null;
      allow_mix: boolean;
      mix_type: "PRODUCT" | "NONE";
      start_date?: string;
      end_date?: string;
      priority: number;
      can_combine: boolean;
      status: "ACTIVE" | "INACTIVE";
      rules: PromotionRule[];
      product_ids: number[];
    } = {
      promotion_code: promoCode.trim(),
      promotion_name: promoName.trim(),
      promotion_type: selectedType,
      allow_mix: allowMix,
      mix_type: allowMix ? "PRODUCT" : "NONE",
      priority: 1,
      can_combine: false,
      status: "ACTIVE",
      rules: buildRules(),
      product_ids: selectedProducts.map((product) => Number(product.id)).filter((id) => Number.isFinite(id)),
    };

    if (dateStart) payload.start_date = toDateTime(dateStart);
    if (dateEnd) payload.end_date = toDateTime(dateEnd, true);

    return payload;
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedType) return;
    const validationError = validateForm();
    if (validationError) { setErrorMessage(validationError); return; }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const res = await authorizedFetch(editingId ? `/promotions/${editingId}` : "/promotions", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) throw new Error(await getApiErrorMessage(res, "บันทึกโปรโมชั่นไม่สำเร็จ"));
      closeAll();
      await fetchPromotions();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "บันทึกโปรโมชั่นไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = async (id: number) => {
    setErrorMessage(null);
    try {
      const res = await authorizedFetch(`/promotions/${id}`);
      if (!res.ok) throw new Error(await getApiErrorMessage(res, "โหลดข้อมูลโปรโมชั่นไม่สำเร็จ"));
      const data = await res.json();
      const source = (data?.data ?? data?.promotion ?? data) as PromotionApiItem;
      setEditingId(id);
      setSelectedType(source.promotion_type ?? "FIXED_BUNDLE_PRICE");
      setPromoCode(source.promotion_code ?? "");
      setPromoName(source.promotion_name ?? "");
      setAllowMix(Boolean(source.allow_mix));
      setDateStart(formatDateForInput(source.start_date));
      setDateEnd(formatDateForInput(source.end_date));
      const rules = source.rules ?? [];
      const firstRule = rules[0];
      setBundleQty(firstRule?.min_qty ? String(firstRule.min_qty) : "");
      setBundlePrice(firstRule?.bundle_price ? String(firstRule.bundle_price) : "");
      setTiers(rules.length ? rules.map((rule, index) => ({ id: index + 1, qty: String(rule.min_qty ?? ""), price: String(rule.unit_price ?? "") })) : [{ id: 1, qty: "", price: "" }]);
      setTierCounter(Math.max(rules.length + 1, 2));
      setPctQty(firstRule?.min_qty ? String(firstRule.min_qty) : "");
      setPctDiscount(firstRule?.discount_percent ? String(firstRule.discount_percent) : "");
      setSelectedProducts(source.products ?? (source.product_ids ?? []).map((productId) => ({
        id: productId,
        product_name: `สินค้า #${productId}`,
        sku: "",
        sale_price: 0,
      })));
      setSearchTerm(""); setSearchResults([]); setShowDropdown(false); setShowBarcodeInput(false); setBarcodeValue(""); setBarcodeError(null);
      setStep(2);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "โหลดข้อมูลโปรโมชั่นไม่สำเร็จ");
    }
  };

  const togglePromotionStatus = async (id: number, currentStatus?: string) => {
    const newStatus = currentStatus?.toUpperCase() === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const actionText = newStatus === "ACTIVE" ? "เปิดใช้งาน" : "ปิดใช้งาน";
    if (!window.confirm(`ยืนยัน${actionText}โปรโมชั่นนี้?`)) return;
    
    setIsTogglingStatus(id);
    setErrorMessage(null);
    try {
      const res = await authorizedFetch(`/promotions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(await getApiErrorMessage(res, `เปลี่ยนสถานะไม่สำเร็จ`));
      await fetchPromotions();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : `เปลี่ยนสถานะไม่สำเร็จ`);
    } finally {
      setIsTogglingStatus(null);
    }
  };

  const removePromo = async (id: number) => {
    if (!window.confirm("ยืนยันลบโปรโมชั่นนี้? (การลบจะไม่สามารถกู้คืนได้)")) return;
    setErrorMessage(null);
    try {
      const res = await authorizedFetch(`/promotions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await getApiErrorMessage(res, "ลบโปรโมชั่นไม่สำเร็จ"));
      setPromotions((prev) => prev.filter((promo) => promo.id !== id));
      await fetchPromotions();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "ลบโปรโมชั่นไม่สำเร็จ");
    }
  };

  const preview = buildPreview();

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-slate-50 px-6 py-6">

      {/* ── Page Header ── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">โปรโมชั่น</h1>
          <p className="mt-1 text-sm text-slate-500">ตั้งค่าส่วนลดและโปรโมชั่นสำหรับสินค้าในร้าน</p>
        </div>
        <button
          type="button"
          onClick={openStep1}
          className="flex items-center gap-2 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1a5fc0]"
        >
          <IconPlus size={18} /> เพิ่มโปรโมชั่น
        </button>
      </div>

      {/* ── Promotion List ── */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-white p-4 shadow-sm">
        {errorMessage && (
          <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {errorMessage}
          </div>
        )}
        {isLoadingPromotions ? (
          <div className="flex h-52 flex-col items-center justify-center gap-3 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1d6fd8] border-t-transparent" />
            <p className="text-sm text-slate-400">กำลังโหลดโปรโมชั่น...</p>
          </div>
        ) : promotions.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <IconTag size={28} className="text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">ยังไม่มีโปรโมชั่น</p>
              <p className="mt-0.5 text-sm text-slate-400">กดปุ่ม "เพิ่มโปรโมชั่น" เพื่อเริ่มต้น</p>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {promotions.map((promo) => {
              const cfg = PROMO_CONFIG[promo.type];
              const isActive = promo.status?.toUpperCase() === "ACTIVE";
              
              return (
                <li 
                  key={promo.id} 
                  className={`group flex flex-col gap-3 rounded-xl border p-4 transition-all ${
                    isActive 
                      ? "border-slate-100 bg-slate-50" 
                      : "border-red-100 bg-red-50/50 opacity-75"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cfg.iconBg} ${cfg.iconText}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex gap-1">
                      {/* Toggle Status Button */}
                      <button
                        type="button"
                        onClick={() => void togglePromotionStatus(promo.id, promo.status)}
                        disabled={isTogglingStatus === promo.id}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                          isActive
                            ? "text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600"
                            : "text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                        }`}
                        aria-label={isActive ? "ปิดใช้งานโปรโมชั่น" : "เปิดใช้งานโปรโมชั่น"}
                        title={isActive ? "ปิดใช้งานโปรโมชั่น" : "เปิดใช้งานโปรโมชั่น"}
                      >
                        {isTogglingStatus === promo.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : isActive ? (
                          <IconCheck size={16} />
                        ) : (
                          <IconClock size={16} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void openEdit(promo.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-blue-50 hover:text-[#1d6fd8]"
                        aria-label="แก้ไขโปรโมชั่น"
                        title="แก้ไขโปรโมชั่น"
                      >
                        <IconPencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void removePromo(promo.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400"
                        aria-label="ลบโปรโมชั่น"
                        title="ลบโปรโมชั่น"
                      >
                        <IconTrash size={15} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{promo.name}</p>
                    {promo.code && <p className="mt-0.5 text-xs text-slate-400">{promo.code}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      {/* Status Badge */}
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {isActive ? (
                          <IconCheck size={10} />
                        ) : (
                          <IconClock size={10} />
                        )}
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <p className={`text-sm ${isActive ? "text-slate-500" : "text-slate-400"}`}>
                    {promo.detail}
                  </p>
                  {promo.products.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {promo.products.slice(0, 2).map((p) => (
                        <span key={p.id} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                          isActive
                            ? "border-slate-200 bg-white text-slate-500"
                            : "border-slate-200 bg-slate-50 text-slate-400"
                        }`}>
                          <IconBox size={11} /> {getProductName(p)}
                        </span>
                      ))}
                      {promo.products.length > 2 && (
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${
                          isActive
                            ? "border-slate-200 bg-white text-slate-400"
                            : "border-slate-200 bg-slate-50 text-slate-400"
                        }`}>
                          +{promo.products.length - 2} รายการ
                        </span>
                      )}
                    </div>
                  )}
                  {(promo.dateStart || promo.dateEnd) && (
                    <div className={`flex items-center gap-1.5 text-xs ${
                      isActive ? "text-slate-400" : "text-slate-400/60"
                    }`}>
                      <IconCalendar size={12} />
                      {promo.dateStart && promo.dateEnd ? `${promo.dateStart} – ${promo.dateEnd}` : promo.dateStart ? `เริ่ม ${promo.dateStart}` : `ถึง ${promo.dateEnd}`}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-emerald-500" : "bg-amber-500"
                    }`} />
                    <span className={`text-xs ${
                      isActive ? "text-emerald-600" : "text-amber-600"
                    }`}>
                      {isActive ? "กำลังใช้งานอยู่" : "ปิดใช้งานแล้ว"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ════════════════════════════════════════════
          STEP 1 — TYPE PICKER
      ════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-base font-semibold text-slate-800">เลือกประเภทโปรโมชั่น</h2>
                <p className="mt-0.5 text-xs text-slate-400">ขั้นตอน 1 จาก 2</p>
              </div>
              <button type="button" onClick={closeAll} className="text-slate-400 hover:text-slate-600"><IconX size={20} /></button>
            </div>

            <div className="flex gap-1.5 px-6 pt-4">
              <span className="h-1.5 w-8 rounded-full bg-[#1d6fd8]" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
            </div>

            <div className="space-y-3 p-6">
              {(Object.entries(PROMO_CONFIG) as [PromoType, typeof PROMO_CONFIG[PromoType]][]).map(([type, cfg]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`flex w-full items-center gap-4 rounded-xl border-2 px-4 py-4 text-left transition-all ${
                    selectedType === type ? cfg.color : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selectedType === type ? "" : cfg.iconBg} ${cfg.iconText}`}>
                    {cfg.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{cfg.label}</p>
                    <p className="text-xs text-slate-500">{cfg.desc}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{cfg.example}</p>
                  </div>
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${selectedType === type ? "border-[#1d6fd8] bg-[#1d6fd8]" : "border-slate-300"}`}>
                    {selectedType === type && <span className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={closeAll} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">ยกเลิก</button>
              <button
                type="button"
                onClick={openStep2}
                disabled={!selectedType}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1a5fc0] disabled:opacity-40"
              >
                ถัดไป <IconChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          STEP 2 — FORM
      ════════════════════════════════════════════ */}
      {step === 2 && selectedType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${PROMO_CONFIG[selectedType].iconBg} ${PROMO_CONFIG[selectedType].iconText}`}>
                  {PROMO_CONFIG[selectedType].icon}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800">{PROMO_CONFIG[selectedType].label}</h2>
                  <p className="mt-0.5 text-xs text-slate-400">ขั้นตอน 2 จาก 2</p>
                </div>
              </div>
              <button type="button" onClick={closeAll} className="text-slate-400 hover:text-slate-600"><IconX size={20} /></button>
            </div>

            <div className="flex gap-1.5 px-6 pt-3 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
              <span className="h-1.5 w-8 rounded-full bg-[#1d6fd8]" />
            </div>

            {/* Scrollable body */}
            <form onSubmit={(event) => void handleSave(event)} className="flex flex-col overflow-hidden">
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                {errorMessage && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {errorMessage}
                  </div>
                )}

                {/* ── ชื่อโปรโมชั่น ── */}
                <div>
                  <Label>รหัสโปรโมชั่น</Label>
                  <Input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="เช่น PRO001"
                    autoFocus
                  />
                </div>

                <div>
                  <Label>ชื่อโปรโมชั่น</Label>
                  <Input
                    type="text"
                    value={promoName}
                    onChange={(e) => setPromoName(e.target.value)}
                    placeholder="เช่น น้ำดื่ม 3 แพ็ค 100 บาท"
                  />
                </div>

                {/* ── สินค้าที่ร่วมโปรโมชั่น ── */}
                <div>
                  <Label>สินค้าที่ร่วมโปรโมชั่น</Label>

                  {/* Search + Barcode toggle */}
                  <div className="flex gap-2">
                    <div ref={searchRef} className="relative flex-1">
                      <IconSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => void handleSearch(e.target.value)}
                        onFocus={() => { if (searchTerm) setShowDropdown(true); }}
                        placeholder="ค้นหาชื่อสินค้า..."
                        className="pl-9"
                      />
                      {/* Dropdown */}
                      {showDropdown && (
                        <div className="absolute left-0 right-0 top-full z-10 mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                          {isLoadingProducts ? (
                            <p className="px-4 py-3 text-center text-sm text-slate-400">กำลังโหลด...</p>
                          ) : searchResults.length === 0 ? (
                            <p className="px-4 py-3 text-center text-sm text-slate-400">ไม่พบสินค้า</p>
                          ) : (
                            searchResults.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => addProduct(p)}
                                className="flex w-full items-center gap-3 border-b border-slate-50 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50"
                              >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1d6fd8]/10">
                                  <IconBox size={14} className="text-[#1d6fd8]" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-slate-700">{getProductName(p)}</p>
                                  <p className="text-xs text-slate-400">{p.sku}</p>
                                </div>
                                <span className="shrink-0 text-sm font-medium text-[#1d6fd8]">฿{Number(p.sale_price ?? 0).toLocaleString()}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowBarcodeInput((v) => !v); setBarcodeError(null); }}
                      title="สแกนบาร์โค้ด"
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${showBarcodeInput ? "border-[#1d6fd8] bg-[#1d6fd8]/10 text-[#1d6fd8]" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
                    >
                      <IconBarcode size={18} />
                    </button>
                  </div>

                  {/* Barcode input */}
                  {showBarcodeInput && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={barcodeValue}
                          onChange={(e) => { setBarcodeValue(normalizeBarcode(e.target.value)); setBarcodeError(null); }}
                          onKeyDown={onBarcodeKey}
                          placeholder="พิมพ์หรือสแกนบาร์โค้ด แล้วกด Enter"
                        />
                        <button
                          type="button"
                          onClick={handleBarcodeConfirm}
                          className="shrink-0 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
                        >
                          ยืนยัน
                        </button>
                      </div>
                      {barcodeError && <p className="text-xs text-red-500">{barcodeError}</p>}
                    </div>
                  )}

                  {/* Selected product chips */}
                  <div className="mt-2.5 min-h-[28px]">
                    {selectedProducts.length === 0 ? (
                      <p className="text-xs text-slate-400">ยังไม่มีสินค้า — ค้นหาหรือสแกนบาร์โค้ดเพื่อเพิ่ม</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedProducts.map((p) => (
                          <span key={p.id} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1.5 text-xs font-medium text-slate-600">
                            <IconBox size={11} className="text-slate-400" />
                            {getProductName(p)}
                            <button
                              type="button"
                              onClick={() => removeProduct(p.id)}
                              className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-red-100 hover:text-red-500"
                              aria-label={`ลบ ${getProductName(p)}`}
                            >
                              <IconX size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mix note */}
                  {selectedType === "FIXED_BUNDLE_PRICE" && allowMix && selectedProducts.length > 0 && (
                    <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5">
                      <IconInfoCircle size={15} className="mt-0.5 shrink-0 text-blue-500" />
                      <p className="text-xs text-blue-600">Bundle นี้อนุญาตคละสินค้า — สินค้าทั้งหมดนับรวมกันได้</p>
                    </div>
                  )}
                </div>

                <div className="h-px bg-slate-100" />

                <button
                  type="button"
                  onClick={() => setAllowMix((v) => !v)}
                  className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-left"
                >
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${allowMix ? "border-[#1d6fd8] bg-[#1d6fd8]" : "border-slate-300 bg-white"}`}>
                    {allowMix && <span className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm text-slate-600">อนุญาตคละสินค้า</span>
                </button>

                {/* ── FIXED_BUNDLE_PRICE fields ── */}
                {selectedType === "FIXED_BUNDLE_PRICE" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>จำนวนขั้นต่ำ (ชิ้น)</Label>
                        <Input type="number" min={1} value={bundleQty} onChange={(e) => setBundleQty(e.target.value)} placeholder="3" />
                      </div>
                      <div>
                        <Label>ราคา bundle (บาท)</Label>
                        <Input type="number" min={0} value={bundlePrice} onChange={(e) => setBundlePrice(e.target.value)} placeholder="100" />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TIER_UNIT_PRICE fields ── */}
                {selectedType === "TIER_UNIT_PRICE" && (
                  <div>
                    <Label>ขั้นบันไดราคา</Label>
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_1fr_28px] gap-2 px-1">
                        <p className="text-xs text-slate-400">ซื้อตั้งแต่ (ชิ้น)</p>
                        <p className="text-xs text-slate-400">ราคา/ชิ้น (บาท)</p>
                        <span />
                      </div>
                      {tiers.map((tier) => (
                        <div key={tier.id} className="grid grid-cols-[1fr_1fr_28px] items-center gap-2">
                          <Input type="number" min={1} value={tier.qty} onChange={(e) => updateTier(tier.id, "qty", e.target.value)} placeholder="1" className="py-2" />
                          <Input type="number" min={0} value={tier.price} onChange={(e) => updateTier(tier.id, "price", e.target.value)} placeholder="30" className="py-2" />
                          <button type="button" onClick={() => removeTier(tier.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-400" aria-label="ลบ">
                            <IconX size={14} />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={addTier} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs text-slate-500 hover:bg-slate-50">
                        <IconPlus size={14} /> เพิ่มขั้น
                      </button>
                    </div>
                  </div>
                )}

                {/* ── PERCENT_DISCOUNT fields ── */}
                {selectedType === "PERCENT_DISCOUNT" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>จำนวนขั้นต่ำ (ชิ้น)</Label>
                      <Input type="number" min={1} value={pctQty} onChange={(e) => setPctQty(e.target.value)} placeholder="10" />
                    </div>
                    <div>
                      <Label>ส่วนลด (%)</Label>
                      <Input type="number" min={0.1} max={100} step={0.1} value={pctDiscount} onChange={(e) => setPctDiscount(e.target.value)} placeholder="5" />
                      <p className="mt-1 text-xs text-slate-400">ระบุ 1–100</p>
                    </div>
                  </div>
                )}

                <div className="h-px bg-slate-100" />

                {/* ── วันที่ ── */}
                <div>
                  <Label>ช่วงเวลาโปรโมชั่น</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1 text-xs text-slate-400">วันเริ่มต้น</p>
                      <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-slate-400">วันสิ้นสุด</p>
                      <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">เว้นว่างหากไม่มีวันหมดอายุ</p>
                </div>

                {/* ── Preview ── */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">ตัวอย่างที่ลูกค้าเห็น</p>
                  {preview ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{preview}</p>
                  ) : (
                    <p className="text-sm text-slate-400">— กรอกข้อมูลเพื่อดูตัวอย่าง</p>
                  )}
                </div>

              </div>

              {/* Footer */}
              <div className="flex shrink-0 gap-2 border-t border-slate-100 px-6 py-4">
                <button type="button" onClick={() => setStep(1)} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  ← ย้อนกลับ
                </button>
                <button type="submit" disabled={isSaving} className="flex-1 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a5fc0] disabled:opacity-50">
                  {isSaving ? "กำลังบันทึก..." : "บันทึกโปรโมชั่น"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}