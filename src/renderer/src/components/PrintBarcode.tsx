import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import {
  IconBarcode as BarcodeIcon,
  IconChevronDown as ChevronDown,
  IconDownload,
  IconFileTypePdf,
  IconMinus as Minus,
  IconPackage as Package,
  IconPlus as Plus,
  IconPrinter as Printer,
  IconQrcode as QrCode,
  IconRefresh,
  IconSearch as Search,
  IconSettings as Settings,
  IconTrash as Trash2,
  IconX as X,
} from "@tabler/icons-react";
import { ensureValidAccessToken, refreshAccessToken } from "./auth";

type BarcodeType = "barcode" | "qrcode";
type PaperSize = "30x20mm" | "40x30mm" | "50x30mm" | "60x40mm" | "a4";

interface ApiProduct {
  id?: string | number;
  product_id?: string | number;
  product_name?: string;
  name?: string;
  sku?: string | null;
  barcode?: string | null;
  sale_price?: number | string | null;
  price?: number | string | null;
  stock_qty?: number | string | null;
  stock?: number | string | null;
  category_name?: string | null;
  price_mode?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

interface ProductsResponse {
  data: ApiProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode: string;
  tags: string[];
  price: number | null;
  stock?: number;
}

interface PrintItem extends Product {
  qty: number;
}

interface PrintSettings {
  printerName: string;
  barcodeType: BarcodeType;
  paperSize: PaperSize;
  showName: boolean;
  showPrice: boolean;
  copiesPerRow: number;
}

interface PrinterDriver {
  name: string;
  displayName: string;
  description: string;
  options: Record<string, unknown>;
}

interface PosDevice {
  machine_id?: string;
  pos_device?: PosDevice;
  [key: string]: unknown;
}

interface BarcodePrintSetting {
  printer_name?: string;
  paper_size?: string;
  barcode_format?: string;
  code_type?: string;
  barcode_type?: string;
  items_per_row?: number;
  labels_per_row?: number;
  label_count?: number;
  show_name?: boolean;
  show_product_name?: boolean;
  show_price?: boolean;
  [key: string]: unknown;
}

const API_PATH_KEY = "apiPath";
const ACCESS_TOKEN_KEY = "access_token";
const POS_DEVICE_KEY = "pos_device";
const DEFAULT_PRINTER = "__default__";
const QR_MAX_COPIES_PER_ROW = 4;

const PAPER_SIZES: { value: PaperSize; label: string; widthMm: number; heightMm: number }[] = [
  { value: "30x20mm", label: "30 x 20 มม.", widthMm: 30, heightMm: 20 },
  { value: "40x30mm", label: "40 x 30 มม.", widthMm: 40, heightMm: 30 },
  { value: "50x30mm", label: "50 x 30 มม.", widthMm: 50, heightMm: 30 },
  { value: "60x40mm", label: "60 x 40 มม.", widthMm: 60, heightMm: 40 },
  { value: "a4", label: "A4", widthMm: 210, heightMm: 297 },
];

const normalizeApiBase = (value: string): string => value.trim().replace(/\/+$/, "");

const getStoredDevice = (value: unknown): PosDevice | null => {
  if (!value || typeof value !== "object") return null;
  const device = value as PosDevice;
  return device.machine_id ? device : device.pos_device ?? null;
};

const unwrapArray = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];
  const value = payload as {
    data?: unknown;
    products?: unknown;
    items?: unknown;
    rows?: unknown;
  };
  if (Array.isArray(value.data)) return value.data as T[];
  if (Array.isArray(value.products)) return value.products as T[];
  if (Array.isArray(value.items)) return value.items as T[];
  if (Array.isArray(value.rows)) return value.rows as T[];
  return [];
};

const unwrapObject = <T,>(payload: unknown): T | null => {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as { data?: unknown; setting?: unknown; barcode_print_setting?: unknown };
  return (value.data || value.setting || value.barcode_print_setting || value) as T;
};

const unwrapProductsResponse = (payload: unknown): ProductsResponse => {
  if (!payload || typeof payload !== "object") {
    return {
      data: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0, hasMore: false },
    };
  }

  const value = payload as Partial<ProductsResponse>;
  return {
    data: Array.isArray(value.data) ? value.data : [],
    pagination: {
      page: Number(value.pagination?.page ?? 1),
      limit: Number(value.pagination?.limit ?? 50),
      total: Number(value.pagination?.total ?? 0),
      totalPages: Number(value.pagination?.totalPages ?? 0),
      hasMore: Boolean(value.pagination?.hasMore),
    },
  };
};

const getApiErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const data = (await response.json()) as { message?: string | string[]; error?: string };
    if (Array.isArray(data.message)) return data.message.join(", ");
    return data.message || data.error || fallback;
  } catch {
    return fallback;
  }
};

const getApiBaseUrl = async (): Promise<string> => {
  const apiPath = await window.electronStore.get(API_PATH_KEY);
  if (typeof apiPath !== "string" || !apiPath.trim()) {
    throw new Error("ไม่พบ API endpoint ใน store");
  }
  return normalizeApiBase(apiPath);
};

const authorizedFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
  if (!(await ensureValidAccessToken())) {
    throw new Error("ไม่สามารถยืนยันตัวตนได้ กรุณาเข้าสู่ระบบใหม่");
  }

  const apiBaseUrl = await getApiBaseUrl();
  let accessToken = await window.electronStore.get(ACCESS_TOKEN_KEY);
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

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const mapProduct = (product: ApiProduct, index: number): Product | null => {
  const id = String(product.id ?? product.product_id ?? index);
  const name = String(product.product_name ?? product.name ?? "").trim();
  const sku = typeof product.sku === "string" ? product.sku.trim() : "";
  const barcode = String(product.barcode ?? sku ?? id).trim();

  if (!name || !barcode) return null;

  const tags = [
    product.category_name ? String(product.category_name) : "",
    product.price_mode ? String(product.price_mode).replace(/_/g, " ") : "",
    product.status ? String(product.status) : "",
  ].filter(Boolean);

  return {
    id,
    name,
    sku: sku || undefined,
    barcode,
    tags,
    price: toNumber(product.sale_price ?? product.price),
    stock: toNumber(product.stock_qty ?? product.stock) ?? undefined,
  };
};

const buildProductsPath = (page: number, limit: number, search: string) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const keyword = search.trim();
  if (keyword) params.set("search", keyword);
  return `/products?${params.toString()}`;
};

const mergeUniqueProducts = (currentProducts: Product[], nextProducts: Product[]) => {
  const byId = new Map<string, Product>();
  currentProducts.forEach((product) => byId.set(product.id, product));
  nextProducts.forEach((product) => byId.set(product.id, product));
  return Array.from(byId.values());
};

const normalizePaperSize = (value?: string): PaperSize => {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("30x20")) return "30x20mm";
  if (normalized.includes("50x30")) return "50x30mm";
  if (normalized.includes("60x40")) return "60x40mm";
  if (normalized.includes("a4")) return "a4";
  return "40x30mm";
};

const getPaper = (paperSize: PaperSize) =>
  PAPER_SIZES.find((paper) => paper.value === paperSize) || PAPER_SIZES[1];

const getMaxCopiesPerRow = (barcodeType: BarcodeType) =>
  barcodeType === "qrcode" ? QR_MAX_COPIES_PER_ROW : 6;

const normalizeCopiesPerRow = (barcodeType: BarcodeType, value: number) =>
  Math.min(getMaxCopiesPerRow(barcodeType), Math.max(1, Math.floor(value) || 1));

const formatPrice = (price: number | null) =>
  price === null ? "ระบุราคาตอนขาย" : new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(price);

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const expandItems = (items: PrintItem[]): PrintItem[] =>
  items.flatMap((item) => Array.from({ length: item.qty }, () => item));

const buildBarcodeSvg = (value: string): string => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, value, {
    format: "CODE128",
    displayValue: false,
    margin: 0,
    width: 1.6,
    height: 48,
  });
  return svg.outerHTML;
};

const buildQrDataUrl = async (value: string): Promise<string> =>
  QRCode.toDataURL(value, { margin: 1, width: 120, errorCorrectionLevel: "M" });

function BarcodeGraphic({ value, type }: { value: string; type: BarcodeType }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (type !== "barcode" || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        width: 1.5,
        height: 44,
      });
    } catch {
      svgRef.current.innerHTML = "";
    }
  }, [type, value]);

  useEffect(() => {
    if (type !== "qrcode" || !canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, value, {
      margin: 1,
      width: 96,
      errorCorrectionLevel: "M",
    });
  }, [type, value]);

  return type === "barcode" ? (
    <svg ref={svgRef} className="h-12 w-full" />
  ) : (
    <canvas ref={canvasRef} className="h-20 w-20" />
  );
}

function LabelPreview({
  item,
  settings,
}: {
  item: PrintItem;
  settings: PrintSettings;
}) {
  return (
    <div className="barcode-label flex h-full w-full flex-col items-center justify-center gap-1 bg-white p-2 text-center text-slate-950">
      {settings.showName ? (
        <div className="line-clamp-1 w-full text-[10px] font-semibold leading-tight">
          {item.name}
        </div>
      ) : null}
      <BarcodeGraphic value={item.barcode} type={settings.barcodeType} />
      <div className="w-full truncate font-mono text-[10px] leading-tight tracking-wide">
        {item.barcode}
      </div>
      {settings.showPrice ? (
        <div className="text-[10px] font-bold leading-tight">{formatPrice(item.price)}</div>
      ) : null}
    </div>
  );
}

function PrintPreviewGrid({
  items,
  settings,
  paper,
  copiesPerRow,
  limit,
}: {
  items: PrintItem[];
  settings: PrintSettings;
  paper: { widthMm: number; heightMm: number };
  copiesPerRow: number;
  limit?: number;
}) {
  const visibleItems = typeof limit === "number" ? items.slice(0, limit) : items;

  return (
    <div
      className="grid gap-2 rounded-xl border border-dashed border-slate-200 bg-white p-3"
      style={{ gridTemplateColumns: `repeat(${copiesPerRow}, minmax(0, 1fr))` }}
    >
      {visibleItems.length === 0 ? (
        <div className="col-span-full flex h-28 items-center justify-center text-sm text-slate-400">
          เลือกสินค้าเพื่อดูตัวอย่าง
        </div>
      ) : (
        visibleItems.map((item, index) => (
          <div
            key={`${item.id}-${index}`}
            className="overflow-hidden rounded-lg border border-slate-200"
            style={{
              aspectRatio: `${paper.widthMm} / ${paper.heightMm}`,
              minHeight: settings.paperSize === "30x20mm" ? 74 : 96,
            }}
          >
            <LabelPreview item={item} settings={settings} />
          </div>
        ))
      )}
    </div>
  );
}

function PrintPreviewModal({
  open,
  onClose,
  items,
  settings,
  paper,
  copiesPerRow,
  totalLabels,
  onExportPng,
  onExportPdf,
  onPrint,
  isWorking,
}: {
  open: boolean;
  onClose: () => void;
  items: PrintItem[];
  settings: PrintSettings;
  paper: { label: string; widthMm: number; heightMm: number };
  copiesPerRow: number;
  totalLabels: number;
  onExportPng: () => void;
  onExportPdf: () => void;
  onPrint: () => void;
  isWorking: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">ตัวอย่างก่อนพิมพ์</h2>
            <p className="mt-1 text-sm text-slate-500">
              {paper.label} · {settings.barcodeType === "barcode" ? "CODE128" : "QR Code"} · {copiesPerRow} ดวงต่อแถว · รวม {totalLabels} ดวง
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
          <PrintPreviewGrid
            items={items}
            settings={settings}
            paper={paper}
            copiesPerRow={copiesPerRow}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={onExportPng}
            disabled={isWorking || totalLabels === 0}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <IconDownload size={18} />
            PNG
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            disabled={isWorking || totalLabels === 0}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <IconFileTypePdf size={18} />
            PDF
          </button>
          <button
            type="button"
            onClick={onPrint}
            disabled={isWorking || totalLabels === 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#1d6fd8] px-3 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#1a5fc0] disabled:opacity-50"
          >
            <Printer size={18} />
            พิมพ์
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({
  open,
  onClose,
  settings,
  printers,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  settings: PrintSettings;
  printers: PrinterDriver[];
  onChange: (settings: PrintSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  if (!open) return null;

  const save = () => {
    onChange({
      ...draft,
      copiesPerRow: normalizeCopiesPerRow(draft.barcodeType, draft.copiesPerRow),
    });
    onClose();
  };

  const maxCopiesPerRow = getMaxCopiesPerRow(draft.barcodeType);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">ตั้งค่าการพิมพ์บาร์โค้ด</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600">เครื่องพิมพ์</span>
            <div className="relative">
              <select
                value={draft.printerName}
                onChange={(event) => setDraft({ ...draft, printerName: event.target.value })}
                className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2.5 pr-9 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
              >
                <option value={DEFAULT_PRINTER}>เครื่องพิมพ์เริ่มต้น</option>
                {printers.map((printer) => (
                  <option key={printer.name} value={printer.name}>
                    {printer.displayName || printer.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600">
              ขนาดสติกเกอร์ / กระดาษ
            </span>
            <select
              value={draft.paperSize}
              onChange={(event) => setDraft({ ...draft, paperSize: event.target.value as PaperSize })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
            >
              {PAPER_SIZES.map((paper) => (
                <option key={paper.value} value={paper.value}>
                  {paper.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-600">ชนิดโค้ด</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { value: "barcode" as BarcodeType, label: "CODE128", icon: BarcodeIcon },
                { value: "qrcode" as BarcodeType, label: "QR Code", icon: QrCode },
              ].map((option) => {
                const Icon = option.icon;
                const selected = draft.barcodeType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        barcodeType: option.value,
                        copiesPerRow: normalizeCopiesPerRow(option.value, draft.copiesPerRow),
                      })
                    }
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${
                      selected
                        ? "border-[#1d6fd8] bg-[#1d6fd8]/5 text-[#1d6fd8]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={18} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600">
              จำนวนดวงต่อแถว
            </span>
            <input
              type="range"
              min={1}
              max={maxCopiesPerRow}
              value={draft.copiesPerRow}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  copiesPerRow: normalizeCopiesPerRow(draft.barcodeType, Number(event.target.value)),
                })
              }
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#1d6fd8]"
            />
            <div className="mt-1 text-right text-sm font-semibold text-slate-700">
              {draft.copiesPerRow} ดวง
            </div>
          </label>

          <div className="space-y-2.5 rounded-xl border border-slate-200 px-3 py-2.5">
            <label className="flex items-center justify-between text-sm text-slate-700">
              แสดงชื่อสินค้า
              <input
                type="checkbox"
                checked={draft.showName}
                onChange={(event) => setDraft({ ...draft, showName: event.target.checked })}
                className="h-4 w-4 accent-[#1d6fd8]"
              />
            </label>
            <label className="flex items-center justify-between text-sm text-slate-700">
              แสดงราคา
              <input
                type="checkbox"
                checked={draft.showPrice}
                onChange={(event) => setDraft({ ...draft, showPrice: event.target.checked })}
                className="h-4 w-4 accent-[#1d6fd8]"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a5fc0]"
          >
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PrintBarcode() {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const productListRef = useRef<HTMLDivElement | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [printers, setPrinters] = useState<PrinterDriver[]>([]);
  const [machineId, setMachineId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartProducts, setCartProducts] = useState<Record<string, Product>>({});
  const [settings, setSettings] = useState<PrintSettings>({
    printerName: DEFAULT_PRINTER,
    barcodeType: "barcode",
    paperSize: "40x30mm",
    showName: true,
    showPrice: true,
    copiesPerRow: 3,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const productsLoadingRef = useRef(false);

  const printList = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const product = cartProducts[id] ?? products.find((item) => item.id === id);
          return product ? { ...product, qty } : null;
        })
        .filter((item): item is PrintItem => Boolean(item)),
    [cart, cartProducts, products],
  );

  const expandedPrintItems = useMemo(() => expandItems(printList), [printList]);
  const totalLabels = expandedPrintItems.length;

  const selectedPaper = getPaper(settings.paperSize);
  const effectiveCopiesPerRow = normalizeCopiesPerRow(settings.barcodeType, settings.copiesPerRow);

  const loadBarcodeSetting = useCallback(async (currentMachineId: string) => {
    const response = await authorizedFetch(
      `/barcode-print-settings/machine/${encodeURIComponent(currentMachineId)}`,
      { signal: AbortSignal.timeout(10000) },
    );

    if (response.status === 404) return;
    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, `โหลดค่าปริ้นบาร์โค้ดไม่สำเร็จ (${response.status})`));
    }

    const setting = unwrapObject<BarcodePrintSetting>(await response.json().catch(() => null));
    if (!setting) return;

    setSettings((current) => {
      const barcodeType =
        String(setting.barcode_format || setting.code_type || setting.barcode_type).toUpperCase() === "QRCODE"
          ? "qrcode"
          : "barcode";

      return {
        ...current,
        printerName: setting.printer_name || current.printerName,
        barcodeType,
        paperSize: normalizePaperSize(setting.paper_size),
        showName: Boolean(setting.show_name ?? setting.show_product_name ?? current.showName),
        showPrice: Boolean(setting.show_price ?? current.showPrice),
        copiesPerRow: normalizeCopiesPerRow(
          barcodeType,
          Number(setting.items_per_row || setting.labels_per_row || setting.label_count || current.copiesPerRow),
        ),
      };
    });
  }, []);

  const loadProducts = useCallback(
    async ({
      pageToLoad,
      searchKeyword,
      reset,
    }: {
      pageToLoad: number;
      searchKeyword: string;
      reset: boolean;
    }) => {
      if (productsLoadingRef.current) return;

      productsLoadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const productsResponse = await authorizedFetch(
          buildProductsPath(pageToLoad, limit, searchKeyword),
          { signal: AbortSignal.timeout(15000) },
        );
        if (!productsResponse.ok) {
          throw new Error(
            await getApiErrorMessage(
              productsResponse,
              `โหลดสินค้าไม่สำเร็จ (${productsResponse.status})`,
            ),
          );
        }

        const payload = unwrapProductsResponse(
          await productsResponse.json().catch(() => null),
        );
        const mappedProducts = payload.data
          .map((product, index) => mapProduct(product, (pageToLoad - 1) * limit + index))
          .filter((product): product is Product => Boolean(product));

        setProducts((currentProducts) =>
          reset ? mappedProducts : mergeUniqueProducts(currentProducts, mappedProducts),
        );
        setPage(payload.pagination.page || pageToLoad);
        setHasMore(payload.pagination.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : "ไม่สามารถโหลดสินค้าได้");
      } finally {
        productsLoadingRef.current = false;
        setLoading(false);
        setIsLoading(false);
      }
    },
    [limit],
  );

  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setMessage(null);
    setProducts([]);
    setPage(1);
    setHasMore(true);
    setSearch("");
    setDebouncedSearch("");

    try {
      const [storedDevice, loadedPrinters] = await Promise.all([
        window.electronStore.get(POS_DEVICE_KEY),
        window.electronPrinter?.getPrinters?.() ?? Promise.resolve([]),
      ]);

      setPrinters(loadedPrinters);

      const device = getStoredDevice(storedDevice);
      if (!device?.machine_id) {
        throw new Error("Missing machine_id. Please register this POS device first.");
      }
      setMachineId(device.machine_id);

      await loadBarcodeSetting(device.machine_id);
      await loadProducts({ pageToLoad: 1, searchKeyword: "", reset: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load barcode page data.");
      setIsLoading(false);
    } finally {
      if (!productsLoadingRef.current) setIsLoading(false);
    }
  }, [loadBarcodeSetting, loadProducts]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    if (isLoading) return;

    setProducts([]);
    setPage(1);
    setHasMore(true);
    void loadProducts({
      pageToLoad: 1,
      searchKeyword: debouncedSearch,
      reset: true,
    });
  }, [debouncedSearch, loadProducts]);

  const handleProductsScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom > 240 || loading || !hasMore) return;
    void loadProducts({
      pageToLoad: page + 1,
      searchKeyword: debouncedSearch,
      reset: false,
    });
  };

  const addToCart = useCallback((product: Product) => {
    setCartProducts((current) => ({ ...current, [product.id]: product }));
    setCart((current) => ({
      ...current,
      [product.id]: (current[product.id] ?? 0) + 1,
    }));
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setCart((current) => {
      const next = { ...current };
      const normalizedQty = Math.max(0, Math.floor(qty));
      if (normalizedQty === 0) delete next[id];
      else next[id] = normalizedQty;
      return next;
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const requireLabels = () => {
    if (totalLabels === 0) {
      setError("กรุณาเลือกสินค้าและจำนวนที่ต้องการพิมพ์ก่อน");
      return false;
    }
    setError(null);
    return true;
  };

  const buildPrintHtml = async () => {
    const labels = await Promise.all(
      expandedPrintItems.map(async (item) => {
        const codeMarkup =
          settings.barcodeType === "barcode"
            ? buildBarcodeSvg(item.barcode)
            : `<img class="qr" src="${await buildQrDataUrl(item.barcode)}" alt="">`;

        return `
          <div class="label">
            ${settings.showName ? `<div class="name">${escapeHtml(item.name)}</div>` : ""}
            <div class="code">${codeMarkup}</div>
            <div class="value">${escapeHtml(item.barcode)}</div>
            ${settings.showPrice ? `<div class="price">${escapeHtml(formatPrice(item.price))}</div>` : ""}
          </div>
        `;
      }),
    );

    const isA4 = settings.paperSize === "a4";
    const rows = effectiveCopiesPerRow;
    const labelWidth = isA4 ? `${100 / rows}%` : `${selectedPaper.widthMm}mm`;
    const pageSize = isA4 ? "A4" : `${selectedPaper.widthMm}mm ${selectedPaper.heightMm}mm`;

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { size: ${pageSize}; margin: ${isA4 ? "8mm" : "0"}; }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: Arial, Tahoma, sans-serif; color: #020617; background: white; }
            .sheet { display: flex; flex-wrap: wrap; align-content: flex-start; width: 100%; }
            .label {
              width: ${labelWidth};
              ${isA4 ? `height: ${selectedPaper.heightMm / 10}mm;` : `height: ${selectedPaper.heightMm}mm;`}
              padding: 1.8mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .name, .value, .price { width: 100%; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .name { font-size: 9px; font-weight: 700; line-height: 1.1; }
            .value { font-family: Consolas, monospace; font-size: 9px; letter-spacing: .6px; line-height: 1.1; }
            .price { font-size: 9px; font-weight: 700; line-height: 1.1; }
            .code { width: 100%; display: flex; justify-content: center; align-items: center; min-height: 12mm; }
            svg { width: 100%; max-height: 14mm; }
            .qr { width: 18mm; height: 18mm; object-fit: contain; }
          </style>
        </head>
        <body><main class="sheet">${labels.join("")}</main></body>
      </html>`;
  };

  const handleExportPng = async () => {
    if (!requireLabels() || !previewRef.current) return;
    setIsWorking(true);
    try {
      const dataUrl = await toPng(previewRef.current, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `barcodes-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      setMessage("Export PNG สำเร็จ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export PNG ไม่สำเร็จ");
    } finally {
      setIsWorking(false);
    }
  };

  const handleExportPdf = async () => {
    if (!requireLabels()) return;
    if (!window.electronPrinter?.exportPdf) {
      setError("ไม่พบระบบ Export PDF ของ Electron");
      return;
    }

    setIsWorking(true);
    try {
      const filePath = await window.electronPrinter.exportPdf({
        html: await buildPrintHtml(),
        defaultPath: `barcodes-${Date.now()}.pdf`,
      });
      if (filePath) setMessage(`Export PDF สำเร็จ: ${filePath}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export PDF ไม่สำเร็จ");
    } finally {
      setIsWorking(false);
    }
  };

  const handlePrint = async () => {
    if (!requireLabels()) return;
    if (!window.electronPrinter?.printHtml) {
      setError("ไม่พบระบบสั่งพิมพ์ของ Electron");
      return;
    }

    setIsWorking(true);
    try {
      const printerName = settings.printerName === DEFAULT_PRINTER ? undefined : settings.printerName;
      await window.electronPrinter.printHtml({
        html: await buildPrintHtml(),
        printerName,
      });
      setMessage(`ส่งพิมพ์ ${totalLabels} ดวง${printerName ? ` ไปยัง ${printerName}` : ""} แล้ว`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "พิมพ์บาร์โค้ดไม่สำเร็จ");
    } finally {
      setIsWorking(false);
    }
  };

  const handleSettingsChange = (nextSettings: PrintSettings) => {
    const normalizedSettings = {
      ...nextSettings,
      copiesPerRow: normalizeCopiesPerRow(nextSettings.barcodeType, nextSettings.copiesPerRow),
    };
    setSettings(normalizedSettings);
    if (normalizedSettings.printerName === DEFAULT_PRINTER && machineId) {
      void loadBarcodeSetting(machineId);
    }
  };

  const handleQtyInput = (event: ChangeEvent<HTMLInputElement>, id: string) => {
    setQty(id, Number(event.target.value) || 1);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">พิมพ์บาร์โค้ดสินค้า</h1>
          <p className="mt-1 text-sm text-slate-500">
            ดึงสินค้าจากระบบ สร้าง CODE128/QR Code และพิมพ์ฉลากได้ทันที
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadPageData()}
            disabled={isLoading || isWorking}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <IconRefresh size={18} className={isLoading ? "animate-spin" : ""} />
            โหลดใหม่
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#1a5fc0]"
          >
            <Settings size={18} />
            ตั้งค่า
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400">Machine ID</p>
          <p className="mt-1 truncate font-mono text-sm text-slate-800">{machineId || "-"}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400">Printer</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-800">
            {settings.printerName === DEFAULT_PRINTER ? "เครื่องพิมพ์เริ่มต้น" : settings.printerName}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400">Labels</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{totalLabels} ดวง</p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหาสินค้าด้วยชื่อ, SKU หรือบาร์โค้ด"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
          />
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          {selectedPaper.label} · {settings.barcodeType === "barcode" ? "CODE128" : "QR"}
          <ChevronDown size={16} className="text-slate-400" />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1fr)_420px]">
        <div
          ref={productListRef}
          className="min-h-0 overflow-y-auto rounded-2xl bg-white p-4 shadow-sm"
          onScroll={handleProductsScroll}
        >
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500">
              กำลังโหลดสินค้า...
            </div>
          ) : products.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-slate-400">
              <Search size={32} className="text-slate-300" />
              <p className="text-sm">ไม่พบสินค้า</p>
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => {
                const inCart = cart[product.id] ?? 0;
                return (
                  <li
                    key={product.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#1d6fd8]/10">
                        <Package size={20} className="text-[#1d6fd8]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-700">{product.name}</p>
                        {product.sku ? <p className="text-sm text-slate-500">SKU: {product.sku}</p> : null}
                        <p className="truncate text-sm text-slate-500">บาร์โค้ด: {product.barcode}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {product.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-slate-500">
                          {tag}
                        </span>
                      ))}
                      {product.stock !== undefined ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-slate-500">
                          คงเหลือ {product.stock}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#1d6fd8]">{formatPrice(product.price)}</p>
                      {inCart === 0 ? (
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          className="flex items-center gap-1.5 rounded-xl bg-[#1d6fd8] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1a5fc0]"
                        >
                          <Plus size={16} />
                          เพิ่ม
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-1">
                          <button
                            type="button"
                            onClick={() => setQty(product.id, inCart - 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-[#1d6fd8]"
                          >
                            <Minus size={15} />
                          </button>
                          <span className="w-7 text-center text-sm font-medium text-slate-700">{inCart}</span>
                          <button
                            type="button"
                            onClick={() => setQty(product.id, inCart + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-[#1d6fd8]"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
              </ul>
              {loading ? (
                <p className="py-4 text-center text-sm text-slate-400">
                  &#3585;&#3635;&#3621;&#3633;&#3591;&#3650;&#3627;&#3621;&#3604;&#3626;&#3636;&#3609;&#3588;&#3657;&#3634;...
                </p>
              ) : null}
              {!loading && products.length > 0 && !hasMore ? (
                <p className="py-4 text-center text-sm text-slate-400">
                  &#3649;&#3626;&#3604;&#3591;&#3626;&#3636;&#3609;&#3588;&#3657;&#3634;&#3607;&#3633;&#3657;&#3591;&#3627;&#3617;&#3604;&#3649;&#3621;&#3657;&#3623;
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
            <h2 className="text-sm font-semibold text-slate-700">รายการที่จะพิมพ์</h2>
            <span className="rounded-full bg-slate-50 px-2.5 py-1 text-sm text-slate-500">
              {totalLabels} ดวง
            </span>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {printList.length === 0 ? (
              <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center text-slate-400">
                <BarcodeIcon size={32} className="text-slate-300" />
                <p className="text-sm">ยังไม่มีสินค้าในรายการพิมพ์</p>
              </div>
            ) : (
              printList.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">{item.name}</p>
                    <p className="truncate text-sm text-slate-500">บาร์โค้ด: {item.barcode}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQty(item.id, item.qty - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-[#1d6fd8]"
                    >
                      <Minus size={15} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(event) => handleQtyInput(event, item.id)}
                      className="w-12 rounded-xl border border-slate-200 bg-white py-1 text-center text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setQty(item.id, item.qty + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-[#1d6fd8]"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-500"
                    aria-label="ลบออกจากรายการ"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 p-3">
            <button
              type="button"
              onClick={() => {
                if (requireLabels()) setPreviewOpen(true);
              }}
              disabled={totalLabels === 0}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[#1d6fd8]/30 bg-[#1d6fd8]/5 px-4 py-2.5 text-sm font-medium text-[#1d6fd8] hover:bg-[#1d6fd8]/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <BarcodeIcon size={18} />
              ตัวอย่างก่อนพิมพ์
            </button>
            <div
              ref={previewRef}
              aria-hidden="true"
              className="pointer-events-none fixed -left-[10000px] top-0 grid w-[900px] gap-2 rounded-xl border border-dashed border-slate-200 bg-white p-3"
              style={{ gridTemplateColumns: `repeat(${effectiveCopiesPerRow}, minmax(0, 1fr))` }}
            >
              {expandedPrintItems.length === 0 ? (
                <div className="col-span-full flex h-28 items-center justify-center text-sm text-slate-400">
                  เลือกสินค้าเพื่อดูตัวอย่าง
                </div>
              ) : (
                expandedPrintItems.map((item, index) => (
                  <div
                    key={`${item.id}-${index}`}
                    className="overflow-hidden rounded-lg border border-slate-200"
                    style={{
                      aspectRatio: `${selectedPaper.widthMm} / ${selectedPaper.heightMm}`,
                      minHeight: settings.paperSize === "30x20mm" ? 74 : 96,
                    }}
                  >
                    <LabelPreview item={item} settings={settings} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 p-3">
            <button
              type="button"
              onClick={() => void handleExportPng()}
              disabled={isWorking || totalLabels === 0}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <IconDownload size={18} />
              PNG
            </button>
            <button
              type="button"
              onClick={() => void handleExportPdf()}
              disabled={isWorking || totalLabels === 0}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <IconFileTypePdf size={18} />
              PDF
            </button>
            <button
              type="button"
              onClick={() => void handlePrint()}
              disabled={isWorking || totalLabels === 0}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#1d6fd8] px-3 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#1a5fc0] disabled:opacity-50"
            >
              <Printer size={18} />
              พิมพ์
            </button>
          </div>
        </div>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        printers={printers}
        onChange={handleSettingsChange}
      />

      <PrintPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        items={expandedPrintItems}
        settings={settings}
        paper={selectedPaper}
        copiesPerRow={effectiveCopiesPerRow}
        totalLabels={totalLabels}
        onExportPng={() => void handleExportPng()}
        onExportPdf={() => void handleExportPdf()}
        onPrint={() => void handlePrint()}
        isWorking={isWorking}
      />
    </div>
  );
}
