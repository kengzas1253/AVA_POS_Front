import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import {
  IconBuildingStore as StoreIcon,
  IconDownload,
  IconFileTypePdf,
  IconMinus as Minus,
  IconPlus as Plus,
  IconPrinter as Printer,
  IconRefresh,
  IconSearch as Search,
  IconTrash as Trash2,
  IconUserSearch as UserSearch,
  IconX as X,
  IconBarcode as BarcodeIcon,
  IconLoader as Loader,
} from "@tabler/icons-react";
import { ensureValidAccessToken, refreshAccessToken } from "./auth";
import { normalizeBarcode, isLikelyBarcode } from "./BarcodeNormalizer";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface StoreInfo {
  id: number;
  store_name: string;
  owner_name: string;
  tax_id: string;
  branch_name: string;
  branch_no: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo_url: string | null;
  receipt_image_url: string | null;
  receipt_header: string;
  receipt_footer: string;
  receipt_paper_size: string;
  show_logo: boolean;
  show_receipt_image: boolean;
  show_promptpay_qr: boolean;
  auto_print_receipt: boolean;
  vat_enabled: boolean;
  vat_rate: number;
  language: string;
  currency: string;
  timezone: string;
  allow_negative_stock: boolean;
  default_customer_name: string;
}

interface PaymentAccount {
  id: number;
  account_name: string;
  bank_name: string;
  account_no: string;
  account_holder: string;
  promptpay_type: string | null;
  promptpay_id: string | null;
  is_default: boolean;
}

interface StoreSettingsData {
  store: StoreInfo;
  payment_account: PaymentAccount | null;
}

interface Customer {
  id: string;
  customer_code: string;
  customer_name: string;
  phone_number: string | null;
  email: string | null;
  address: string | null;
  total_purchase_amount: string;
  points_balance: number;
  first_purchase_at: string | null;
  last_purchase_at: string | null;
  created_at: string;
  updated_at: string;
}

interface QuotationItem {
  id: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
}

interface Product {
  id: string | number;
  product_name: string;
  sku: string | null;
  barcode: string | null;
  sale_price: string;
  unit_code: string;
  price_mode: string;
  stock_qty: string;
  track_stock: boolean;
  image_url: string | null;
  status: string;
  has_promotion: boolean;
  category_id: string;
}

interface ProductsResponse {
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const API_PATH_KEY = "apiPath";
const ACCESS_TOKEN_KEY = "access_token";

const THAI_DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const THAI_UNITS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const normalizeApiBase = (value: string): string => value.trim().replace(/\/+$/, "");

const genId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const toNumber = (value: unknown, fallback = 0): number => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatNumber = (value: number): string =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatThaiDate = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const addDaysIso = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const chunkToThaiWords = (chunk: string): string => {
  let result = "";
  const len = chunk.length;
  for (let i = 0; i < len; i++) {
    const digit = Number(chunk[i]);
    const position = len - i - 1;
    if (digit === 0) continue;
    if (position === 0) {
      if (digit === 1 && len > 1) {
        result += "เอ็ด";
      } else {
        result += THAI_DIGITS[digit];
      }
    } else if (position === 1) {
      if (digit === 1) result += "สิบ";
      else if (digit === 2) result += "ยี่สิบ";
      else result += THAI_DIGITS[digit] + "สิบ";
    } else {
      result += THAI_DIGITS[digit] + THAI_UNITS[position % 6];
    }
  }
  return result;
};

const numberToThaiText = (integerValue: number): string => {
  if (integerValue === 0) return "ศูนย์";
  const digits = String(Math.trunc(integerValue));
  const groups: string[] = [];
  for (let i = digits.length; i > 0; i -= 6) {
    groups.unshift(digits.slice(Math.max(0, i - 6), i));
  }
  return groups
    .map((group, index) => {
      const words = chunkToThaiWords(group.replace(/^0+(?=\d)/, ""));
      const isLastGroup = index === groups.length - 1;
      return words ? words + (isLastGroup ? "" : "ล้าน") : "";
    })
    .join("");
};

const bahtText = (amount: number): string => {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  const baht = Math.trunc(rounded);
  const satang = Math.round((rounded - baht) * 100);
  const bahtWords = numberToThaiText(baht) || "ศูนย์";
  if (satang === 0) return `${bahtWords}บาทถ้วน`;
  const satangWords = numberToThaiText(satang);
  return `${bahtWords}บาท${satangWords}สตางค์`;
};

const crc16 = (data: string): string => {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};

const tlv = (id: string, value: string): string => `${id}${String(value.length).padStart(2, "0")}${value}`;

const buildPromptPayPayload = (rawTarget: string, amount?: number): string | null => {
  const digitsOnly = rawTarget.replace(/[^0-9]/g, "");
  if (!digitsOnly) return null;

  let targetTag: string;
  if (digitsOnly.length === 13) {
    targetTag = tlv("02", digitsOnly);
  } else if (digitsOnly.length === 15) {
    targetTag = tlv("03", digitsOnly);
  } else {
    const localPhone = digitsOnly.replace(/^0/, "");
    const intlPhone = `0066${localPhone}`.slice(-13);
    targetTag = tlv("01", intlPhone);
  }

  const merchantInfo = tlv("00", "A000000677010111") + targetTag;

  let payload =
    tlv("00", "01") +
    tlv("01", amount ? "12" : "11") +
    tlv("29", merchantInfo) +
    tlv("53", "764") +
    (amount ? tlv("54", amount.toFixed(2)) : "") +
    tlv("58", "TH");

  payload += "6304";
  return payload + crc16(payload);
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

const resolveAssetUrl = (apiBaseUrl: string, path?: string | null): string => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  try {
    const origin = new URL(apiBaseUrl);
    return `${origin.protocol}//${origin.host}${path.startsWith("/") ? path : `/${path}`}`;
  } catch {
    return path;
  }
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

const generateQuotationNo = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const seq = String(now.getHours() * 60 + now.getMinutes()).padStart(4, "0");
  return `QT-${y}${m}${d}-${seq}`;
};

const sanitizeFileName = (value: string, fallback: string): string => {
  const fileName = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
  return fileName || fallback;
};

const emptyItem = (): QuotationItem => ({
  id: genId(),
  description: "",
  qty: 1,
  unit: "ชิ้น",
  unitPrice: 0,
});

/* ------------------------------------------------------------------ */
/* Sub components                                                      */
/* ------------------------------------------------------------------ */

function QuotationDocument({
  storeData,
  apiBaseUrl,
  customer,
  walkInName,
  quotationNo,
  issueDate,
  validUntil,
  salesperson,
  items,
  subtotal,
  discountPercent,
  discountAmount,
  vatAmount,
  grandTotal,
  notes,
  promptPayQrDataUrl,
}: {
  storeData: StoreSettingsData;
  apiBaseUrl: string;
  customer: Customer | null;
  walkInName: string;
  quotationNo: string;
  issueDate: string;
  validUntil: string;
  salesperson: string;
  items: QuotationItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  vatAmount: number;
  grandTotal: number;
  notes: string;
  promptPayQrDataUrl: string | null;
}) {
  const { store, payment_account: paymentAccount } = storeData;
  const logoUrl = resolveAssetUrl(apiBaseUrl, store.logo_url);
  const customerName = customer?.customer_name || walkInName || store.default_customer_name;

  return (
    <div className="quotation-doc w-[794px] bg-white p-10 text-slate-900">
      <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-5">
        <div className="flex items-start gap-4">
          {store.show_logo && logoUrl ? (
            <img src={logoUrl} alt={store.store_name} className="h-16 w-16 rounded-lg object-cover" />
          ) : null}
          <div>
            <p className="text-lg font-bold">{store.store_name}</p>
            {store.owner_name ? <p className="text-xs text-slate-500">{store.owner_name}</p> : null}
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-600">{store.address}</p>
            <p className="text-xs text-slate-600">
              โทร. {store.phone}
              {store.email ? ` · ${store.email}` : ""}
            </p>
            {store.tax_id ? (
              <p className="text-xs text-slate-600">
                เลขผู้เสียภาษี {store.tax_id}
                {store.branch_name ? ` (${store.branch_name})` : ""}
              </p>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tracking-wide text-[#1d6fd8]">ใบเสนอราคา</p>
          <p className="text-xs uppercase tracking-widest text-slate-400">Quotation</p>
          <div className="mt-3 space-y-1 text-xs text-slate-600">
            <p>
              <span className="text-slate-400">เลขที่: </span>
              <span className="font-semibold text-slate-800">{quotationNo}</span>
            </p>
            <p>
              <span className="text-slate-400">วันที่: </span>
              {formatThaiDate(issueDate)}
            </p>
            <p>
              <span className="text-slate-400">ยืนราคาถึง: </span>
              {formatThaiDate(validUntil)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-6 text-xs">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">เสนอราคาแก่</p>
          <p className="text-sm font-semibold text-slate-800">{customerName}</p>
          {customer?.customer_code ? <p className="text-slate-500">รหัสลูกค้า: {customer.customer_code}</p> : null}
          {customer?.address ? <p className="mt-1 text-slate-600">{customer.address}</p> : null}
          {customer?.phone_number ? <p className="text-slate-600">โทร. {customer.phone_number}</p> : null}
          {customer?.email ? <p className="text-slate-600">{customer.email}</p> : null}
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">รายละเอียด</p>
          <p className="text-slate-600">ผู้เสนอราคา: {salesperson || "-"}</p>
          <p className="text-slate-600">สกุลเงิน: {store.currency}</p>
          <p className="text-slate-600">
            ภาษีมูลค่าเพิ่ม: {store.vat_enabled ? `${store.vat_rate}%` : "ไม่มี"}
          </p>
        </div>
      </div>

      <table className="mt-5 w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50 text-slate-500">
            <th className="w-10 border border-slate-200 py-2 text-center font-semibold">#</th>
            <th className="border border-slate-200 py-2 text-left font-semibold">รายการ</th>
            <th className="w-16 border border-slate-200 py-2 text-center font-semibold">จำนวน</th>
            <th className="w-16 border border-slate-200 py-2 text-center font-semibold">หน่วย</th>
            <th className="w-24 border border-slate-200 py-2 text-right font-semibold">ราคา/หน่วย</th>
            <th className="w-28 border border-slate-200 py-2 text-right font-semibold">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} className="border border-slate-200 py-6 text-center text-slate-400">
                ยังไม่มีรายการสินค้า/บริการ
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr key={item.id}>
                <td className="border border-slate-200 py-1.5 text-center text-slate-500">{index + 1}</td>
                <td className="border border-slate-200 px-2 py-1.5">{item.description || "-"}</td>
                <td className="border border-slate-200 text-center">{formatNumber(item.qty).replace(/\.00$/, "")}</td>
                <td className="border border-slate-200 text-center">{item.unit}</td>
                <td className="border border-slate-200 px-2 text-right">{formatNumber(item.unitPrice)}</td>
                <td className="border border-slate-200 px-2 text-right font-medium">
                  {formatNumber(item.qty * item.unitPrice)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-4 flex justify-between gap-6">
        <div className="max-w-[60%] flex-1 text-xs text-slate-600">
          {notes ? (
            <>
              <p className="mb-1 font-semibold text-slate-500">หมายเหตุ</p>
              <p className="whitespace-pre-line leading-relaxed">{notes}</p>
            </>
          ) : null}

          {paymentAccount ? (
            <div className="mt-4 rounded-lg border border-slate-200 p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">ช่องทางชำระเงิน</p>
              <p className="text-slate-700">{paymentAccount.bank_name}</p>
              <p className="text-slate-700">
                เลขที่บัญชี {paymentAccount.account_no} ({paymentAccount.account_holder})
              </p>
              {store.show_promptpay_qr && promptPayQrDataUrl ? (
                <div className="mt-2 flex items-center gap-3">
                  <img src={promptPayQrDataUrl} alt="PromptPay QR" className="h-24 w-24" />
                  <p className="text-slate-500">
                    สแกนเพื่อชำระผ่าน PromptPay
                    <br />
                    {paymentAccount.promptpay_id}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="w-64 shrink-0 text-xs">
          <div className="flex justify-between border-b border-slate-100 py-1.5">
            <span className="text-slate-500">รวมเป็นเงิน</span>
            <span>{formatNumber(subtotal)}</span>
          </div>
          {discountPercent > 0 ? (
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">ส่วนลด ({formatNumber(discountPercent).replace(/\.00$/, "")}%)</span>
              <span>-{formatNumber(discountAmount)}</span>
            </div>
          ) : null}
          {store.vat_enabled ? (
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">ภาษีมูลค่าเพิ่ม ({store.vat_rate}%)</span>
              <span>{formatNumber(vatAmount)}</span>
            </div>
          ) : null}
          <div className="mt-1 flex justify-between rounded-lg bg-[#1d6fd8]/5 px-2 py-2 text-sm font-bold text-[#1d6fd8]">
            <span>รวมทั้งสิ้น</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
          <p className="mt-1.5 text-right text-[11px] italic text-slate-500">({bahtText(grandTotal)})</p>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-10 text-center text-xs text-slate-600">
        <div>
          <div className="h-16" />
          <p className="border-t border-slate-300 pt-2">ผู้เสนอราคา</p>
          <p className="mt-1 text-slate-400">วันที่ ....../....../......</p>
        </div>
        <div>
          <div className="h-16" />
          <p className="border-t border-slate-300 pt-2">ผู้อนุมัติ / ลูกค้า</p>
          <p className="mt-1 text-slate-400">วันที่ ....../....../......</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

export default function QuotationPage() {
  const previewRef = useRef<HTMLDivElement | null>(null);

  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [storeData, setStoreData] = useState<StoreSettingsData | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);

  // Customer states - เปลี่ยนจากค้นหาด้วย ID เป็นค้นหาและเลือกจาก list
  const [customerSearchInput, setCustomerSearchInput] = useState("");
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [customerListLoading, setCustomerListLoading] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [walkInName, setWalkInName] = useState("");
  const [customerSearchTimer, setCustomerSearchTimer] = useState<NodeJS.Timeout | null>(null);

  const [items, setItems] = useState<QuotationItem[]>([emptyItem()]);
  const [quotationNo, setQuotationNo] = useState(generateQuotationNo());
  const [issueDate, setIssueDate] = useState(todayIso());
  const [validUntil, setValidUntil] = useState(addDaysIso(todayIso(), 7));
  const [salesperson, setSalesperson] = useState("");
  const [notes, setNotes] = useState("ราคานี้ยังไม่รวมค่าจัดส่ง (ถ้ามี)\nกรุณาชำระเงินตามช่องทางที่ระบุด้านล่าง");
  const [discountPercent, setDiscountPercent] = useState(0);

  const [promptPayQrDataUrl, setPromptPayQrDataUrl] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  /* --- product search --------------------------------------------------- */

  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearchInput, setProductSearchInput] = useState("");
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productSearchError, setProductSearchError] = useState<string | null>(null);
  const productSearchInputRef = useRef<HTMLInputElement | null>(null);

  /* --- computed totals ------------------------------------------------ */

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0),
    [items],
  );
  const discountAmount = useMemo(
    () => (subtotal * Math.max(0, discountPercent)) / 100,
    [subtotal, discountPercent],
  );
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const vatAmount = useMemo(
    () => (storeData?.store.vat_enabled ? (afterDiscount * storeData.store.vat_rate) / 100 : 0),
    [afterDiscount, storeData],
  );
  const grandTotal = afterDiscount + vatAmount;

  /* --- data loading ----------------------------------------------------- */

  const loadStoreSettings = useCallback(async () => {
    setStoreLoading(true);
    setError(null);
    try {
      const baseUrl = await getApiBaseUrl();
      setApiBaseUrl(baseUrl);

      const response = await authorizedFetch("/store/settings", {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, `โหลดข้อมูลร้านไม่สำเร็จ (${response.status})`));
      }
      const payload = (await response.json()) as { data?: StoreSettingsData };
      if (!payload.data?.store) throw new Error("ไม่พบข้อมูลร้านค้าจากเซิร์ฟเวอร์");
      setStoreData(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถโหลดข้อมูลร้านได้");
    } finally {
      setStoreLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStoreSettings();
  }, [loadStoreSettings]);

  // ฟังก์ชันค้นหาลูกค้า - ดึงข้อมูลจาก API /customers
  const searchCustomers = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setCustomerList([]);
      setShowCustomerDropdown(false);
      return;
    }

    setCustomerListLoading(true);
    setError(null);

    try {
      const response = await authorizedFetch(
        `/customers?search=${encodeURIComponent(searchTerm.trim())}`,
        {
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, `ค้นหาลูกค้าไม่สำเร็จ (${response.status})`));
      }

      // API /customers ตอบกลับเป็น array โดยตรง
      const customers = (await response.json()) as Customer[];
      
      if (Array.isArray(customers) && customers.length > 0) {
        setCustomerList(customers);
        setShowCustomerDropdown(true);
        setError(null);
      } else {
        setCustomerList([]);
        setShowCustomerDropdown(true);
        setError("ไม่พบลูกค้าที่ค้นหา");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "ไม่สามารถค้นหาลูกค้าได้";
      setError(errorMsg);
      setCustomerList([]);
      setShowCustomerDropdown(false);
    } finally {
      setCustomerListLoading(false);
    }
  }, []);

  // ฟังก์ชันเลือกลูกค้า
  const selectCustomer = (selectedCustomer: Customer) => {
    setCustomer(selectedCustomer);
    setWalkInName("");
    setCustomerSearchInput(selectedCustomer.customer_name);
    setShowCustomerDropdown(false);
    setCustomerList([]);
    setMessage(`เลือกลูกค้า "${selectedCustomer.customer_name}" สำเร็จ`);
  };

  // ฟังก์ชันล้างลูกค้า
  const clearCustomer = () => {
    setCustomer(null);
    setCustomerSearchInput("");
    setWalkInName("");
    setShowCustomerDropdown(false);
    setCustomerList([]);
  };

  // จัดการการพิมพ์ค้นหาลูกค้า (debounce)
  const handleCustomerSearch = (value: string) => {
    setCustomerSearchInput(value);
    
    // ถ้าล้างค่า ให้ล้างผลลัพธ์
    if (!value.trim()) {
      setCustomerList([]);
      setShowCustomerDropdown(false);
      setError(null);
      return;
    }

    // ถ้ามีการเลือกลูกค้าไว้แล้ว และพิมพ์ข้อความใหม่ ให้ล้างการเลือก
    if (customer && customer.customer_name !== value) {
      setCustomer(null);
    }

    // Debounce การค้นหา
    if (customerSearchTimer) {
      clearTimeout(customerSearchTimer);
    }

    const timer = setTimeout(() => {
      searchCustomers(value);
    }, 500);

    setCustomerSearchTimer(timer);
  };

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (customerSearchTimer) {
        clearTimeout(customerSearchTimer);
      }
    };
  }, [customerSearchTimer]);

  // โหลดลูกค้าทั้งหมดเมื่อ focus ที่ input
  const loadAllCustomers = useCallback(async () => {
    if (customerList.length > 0) {
      setShowCustomerDropdown(true);
      return;
    }

    setCustomerListLoading(true);
    setError(null);

    try {
      const response = await authorizedFetch(
        "/customers?limit=100",
        {
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, `โหลดรายชื่อลูกค้าไม่สำเร็จ (${response.status})`));
      }

      const customers = (await response.json()) as Customer[];
      
      if (Array.isArray(customers) && customers.length > 0) {
        setCustomerList(customers);
        setShowCustomerDropdown(true);
      } else {
        setCustomerList([]);
        setShowCustomerDropdown(false);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "ไม่สามารถโหลดรายชื่อลูกค้าได้";
      setError(errorMsg);
      setCustomerList([]);
      setShowCustomerDropdown(false);
    } finally {
      setCustomerListLoading(false);
    }
  }, [customerList.length]);

  /* --- PromptPay QR ------------------------------------------------- */

  useEffect(() => {
    const paymentAccount = storeData?.payment_account;
    if (!storeData?.store.show_promptpay_qr || !paymentAccount?.promptpay_id) {
      setPromptPayQrDataUrl(null);
      return;
    }
    const payload = buildPromptPayPayload(paymentAccount.promptpay_id, grandTotal > 0 ? grandTotal : undefined);
    if (!payload) {
      setPromptPayQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(payload, { margin: 1, width: 200, errorCorrectionLevel: "M" }).then((dataUrl) => {
      if (!cancelled) setPromptPayQrDataUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [storeData, grandTotal]);

  /* --- item editing --------------------------------------------------- */

  const updateItem = (id: string, patch: Partial<QuotationItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addItem = () => setItems((current) => [...current, emptyItem()]);

  const removeItem = (id: string) => setItems((current) => current.filter((item) => item.id !== id));

  const handleQtyChange = (event: ChangeEvent<HTMLInputElement>, id: string) => {
    updateItem(id, { qty: Math.max(0, Number(event.target.value) || 0) });
  };

  const handlePriceChange = (event: ChangeEvent<HTMLInputElement>, id: string) => {
    updateItem(id, { unitPrice: Math.max(0, Number(event.target.value) || 0) });
  };

  /* --- product search --------------------------------------------------- */

  const searchProducts = useCallback(
    async (searchTerm: string) => {
      if (!searchTerm.trim() || searchTerm.trim().length < 3) {
        setProductSearchResults([]);
        return;
      }

      setProductSearchLoading(true);
      setProductSearchError(null);

      try {
        const normalizedSearch = isLikelyBarcode(searchTerm)
          ? normalizeBarcode(searchTerm)
          : searchTerm;

        const response = await authorizedFetch(
          `/products?page=1&limit=50&search=${encodeURIComponent(normalizedSearch)}`,
          {
            signal: AbortSignal.timeout(10000),
          },
        );

        if (!response.ok) {
          throw new Error(
            await getApiErrorMessage(response, `ค้นหาสินค้าไม่สำเร็จ (${response.status})`),
          );
        }

        const payload = (await response.json()) as ProductsResponse;
        
        if (payload && Array.isArray(payload.data)) {
          setProductSearchResults(payload.data);
          if (payload.data.length === 0) {
            setProductSearchError("ไม่พบสินค้าที่ค้นหา");
          }
        } else {
          setProductSearchResults([]);
          setProductSearchError("ข้อมูลสินค้าอยู่ในรูปแบบที่ไม่ถูกต้อง");
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "ไม่สามารถค้นหาสินค้าได้";
        setProductSearchError(errorMsg);
        setProductSearchResults([]);
      } finally {
        setProductSearchLoading(false);
      }
    },
    [],
  );

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleProductSearch = (value: string) => {
    setProductSearchInput(value);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      searchProducts(value);
    }, 300);
  };

  const addProductToItems = (product: Product) => {
    const newItem: QuotationItem = {
      id: genId(),
      description: product.product_name,
      qty: 1,
      unit: product.unit_code || "ชิ้น",
      unitPrice: toNumber(product.sale_price, 0),
    };
    setItems((current) => [...current, newItem]);
    setMessage(`เพิ่มสินค้า "${product.product_name}" เรียบร้อย`);
    setShowProductSearch(false);
    setProductSearchInput("");
    setProductSearchResults([]);
  };

  const openProductSearch = () => {
    setShowProductSearch(true);
    setProductSearchInput("");
    setProductSearchResults([]);
    setProductSearchError(null);
    setTimeout(() => {
      productSearchInputRef.current?.focus();
    }, 0);
  };

  const closeProductSearch = () => {
    setShowProductSearch(false);
    setProductSearchInput("");
    setProductSearchResults([]);
    setProductSearchError(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  /* --- export / print --------------------------------------------------- */

  const requireReady = () => {
    if (!storeData) {
      setError("กำลังโหลดข้อมูลร้าน กรุณารอสักครู่");
      return false;
    }
    if (items.every((item) => !item.description.trim())) {
      setError("กรุณาเพิ่มรายการสินค้า/บริการอย่างน้อย 1 รายการ");
      return false;
    }
    setError(null);
    return true;
  };

  // สร้าง CSS สำหรับ print/export
  const getPrintStyles = (): string => {
    return `
      <style>
        @page { 
          size: A4; 
          margin: 0; 
        }
        * { 
          box-sizing: border-box; 
          margin: 0;
          padding: 0;
        }
        body { 
          margin: 0; 
          padding: 0;
          font-family: "Sarabun", "Tahoma", Arial, sans-serif; 
          background: white; 
          color: #0f172a;
        }
        .quotation-doc {
          width: 794px !important;
          margin: 0 auto !important;
          background: white !important;
          padding: 40px !important;
          min-height: 1123px !important;
        }
        /* Flex utilities */
        .flex { display: flex !important; }
        .flex-col { flex-direction: column !important; }
        .items-start { align-items: flex-start !important; }
        .items-center { align-items: center !important; }
        .justify-between { justify-content: space-between !important; }
        .justify-end { justify-content: flex-end !important; }
        .gap-2 { gap: 8px !important; }
        .gap-3 { gap: 12px !important; }
        .gap-4 { gap: 16px !important; }
        .gap-6 { gap: 24px !important; }
        .gap-10 { gap: 40px !important; }
        .shrink-0 { flex-shrink: 0 !important; }
        .w-full { width: 100% !important; }
        .w-64 { width: 256px !important; }
        .w-16 { width: 64px !important; }
        .w-24 { width: 96px !important; }
        .w-28 { width: 112px !important; }
        .w-10 { width: 40px !important; }
        .max-w-xs { max-width: 320px !important; }
        .max-w-\\[60\\%\\] { max-width: 60% !important; }
        .flex-1 { flex: 1 !important; }
        .w-\\[794px\\] { width: 794px !important; }
        .h-16 { height: 64px !important; }
        .h-24 { height: 96px !important; }
        .object-cover { object-fit: cover !important; }
        /* Grid utilities */
        .grid { display: grid !important; }
        .grid-cols-2 { grid-template-columns: repeat(2, 1fr) !important; }
        /* Text utilities */
        .text-xs { font-size: 12px !important; }
        .text-sm { font-size: 14px !important; }
        .text-lg { font-size: 18px !important; }
        .text-2xl { font-size: 24px !important; }
        .text-\\[11px\\] { font-size: 11px !important; }
        .text-center { text-align: center !important; }
        .text-right { text-align: right !important; }
        .text-left { text-align: left !important; }
        .font-medium { font-weight: 500 !important; }
        .font-semibold { font-weight: 600 !important; }
        .font-bold { font-weight: 700 !important; }
        .italic { font-style: italic !important; }
        .tracking-wide { letter-spacing: 0.025em !important; }
        .tracking-widest { letter-spacing: 0.1em !important; }
        .uppercase { text-transform: uppercase !important; }
        .whitespace-pre-line { white-space: pre-line !important; }
        .leading-relaxed { line-height: 1.625 !important; }
        /* Colors */
        .text-slate-400 { color: #94a3b8 !important; }
        .text-slate-500 { color: #64748b !important; }
        .text-slate-600 { color: #475569 !important; }
        .text-slate-700 { color: #334155 !important; }
        .text-slate-800 { color: #1e293b !important; }
        .text-slate-900 { color: #0f172a !important; }
        .text-\\[\\#1d6fd8\\] { color: #1d6fd8 !important; }
        .bg-white { background: white !important; }
        .bg-slate-50 { background: #f8fafc !important; }
        .bg-\\[\\#1d6fd8\\]\\/5 { background: rgba(29, 111, 216, 0.05) !important; }
        /* Borders */
        .border { border: 1px solid #e2e8f0 !important; }
        .border-b { border-bottom: 1px solid #e2e8f0 !important; }
        .border-t { border-top: 1px solid #e2e8f0 !important; }
        .border-slate-200 { border-color: #e2e8f0 !important; }
        .border-slate-300 { border-color: #cbd5e1 !important; }
        .border-slate-100 { border-color: #f1f5f9 !important; }
        .border-collapse { border-collapse: collapse !important; }
        /* Table */
        table { 
          border-collapse: collapse !important; 
          width: 100% !important;
        }
        td, th {
          border: 1px solid #e2e8f0 !important;
          padding: 4px 8px !important;
          text-align: left !important;
        }
        th {
          background: #f8fafc !important;
          font-weight: 600 !important;
        }
        /* Padding & Margin */
        .p-2 { padding: 8px !important; }
        .p-3 { padding: 12px !important; }
        .p-4 { padding: 16px !important; }
        .p-10 { padding: 40px !important; }
        .px-2 { padding-left: 8px !important; padding-right: 8px !important; }
        .px-3 { padding-left: 12px !important; padding-right: 12px !important; }
        .px-4 { padding-left: 16px !important; padding-right: 16px !important; }
        .py-1 { padding-top: 4px !important; padding-bottom: 4px !important; }
        .py-1\\.5 { padding-top: 6px !important; padding-bottom: 6px !important; }
        .py-2 { padding-top: 8px !important; padding-bottom: 8px !important; }
        .py-4 { padding-top: 16px !important; padding-bottom: 16px !important; }
        .py-6 { padding-top: 24px !important; padding-bottom: 24px !important; }
        .pt-2 { padding-top: 8px !important; }
        .pb-5 { padding-bottom: 20px !important; }
        .mt-1 { margin-top: 4px !important; }
        .mt-1\\.5 { margin-top: 6px !important; }
        .mt-2 { margin-top: 8px !important; }
        .mt-3 { margin-top: 12px !important; }
        .mt-4 { margin-top: 16px !important; }
        .mt-5 { margin-top: 20px !important; }
        .mt-10 { margin-top: 40px !important; }
        .mb-1 { margin-bottom: 4px !important; }
        .mb-1\\.5 { margin-bottom: 6px !important; }
        .mr-2 { margin-right: 8px !important; }
        .ml-2 { margin-left: 8px !important; }
        .mx-auto { margin-left: auto !important; margin-right: auto !important; }
        /* Rounded */
        .rounded-lg { border-radius: 8px !important; }
        .rounded-xl { border-radius: 12px !important; }
        .rounded-2xl { border-radius: 16px !important; }
        /* Image */
        img { max-width: 100%; height: auto; }
      </style>
    `;
  };

  // สร้าง HTML สำหรับพิมพ์/PDF
  const buildPrintHtml = useCallback((): string => {
    if (!previewRef.current) return "";
    
    // Clone element
    const clone = previewRef.current.cloneNode(true) as HTMLElement;
    
    // แทนที่ input ด้วย text content
    const inputs = clone.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      const parent = input.parentElement;
      if (parent) {
        const value = (input as HTMLInputElement).value || '';
        const span = document.createElement('span');
        span.textContent = value;
        span.className = input.className;
        parent.replaceChild(span, input);
      }
    });
    
    // ลบปุ่มทั้งหมด
    const buttons = clone.querySelectorAll('button');
    buttons.forEach(btn => btn.remove());
    
    // ลบ elements ที่ไม่ต้องการ
    const elementsToRemove = clone.querySelectorAll('.no-print');
    elementsToRemove.forEach(el => el.remove());
    
    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=794">
          ${getPrintStyles()}
        </head>
        <body>
          ${clone.outerHTML}
        </body>
      </html>`;
  }, [previewRef.current]);

  // Export PNG
  const handleExportPng = async () => {
    if (!requireReady() || !previewRef.current) return;
    setIsWorking(true);
    try {
      const fileName = sanitizeFileName(quotationNo, generateQuotationNo());
      const dataUrl = await toPng(previewRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width: 794,
        height: 1123,
      });
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = dataUrl;
      link.click();
      setMessage('Export PNG สำเร็จ');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export PNG ไม่สำเร็จ');
    } finally {
      setIsWorking(false);
    }
  };

  // Export PDF
  const handleExportPdf = async () => {
    if (!requireReady() || !previewRef.current) return;
    
    if (!window.electronPrinter?.exportPdf) {
      setError('ไม่พบระบบ Export PDF ของ Electron');
      return;
    }
    
    setIsWorking(true);
    try {
      const html = buildPrintHtml();
      if (!html) {
        throw new Error('ไม่สามารถสร้าง HTML สำหรับ PDF ได้');
      }
      const fileName = sanitizeFileName(quotationNo, generateQuotationNo());
      
      const filePath = await window.electronPrinter.exportPdf({
        html,
        defaultPath: `${fileName}.pdf`,
      });
      
      if (filePath) {
        setMessage(`Export PDF สำเร็จ: ${filePath}`);
      } else {
        setMessage('Export PDF สำเร็จ');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export PDF ไม่สำเร็จ');
    } finally {
      setIsWorking(false);
    }
  };

  // Print - ส่ง HTML ที่สมบูรณ์ไปพิมพ์
  const handlePrint = async () => {
    if (!requireReady()) return;
    
    if (!window.electronPrinter?.printHtml) {
      setError('ไม่พบระบบสั่งพิมพ์ของ Electron');
      return;
    }
    
    setIsWorking(true);
    try {
      const html = buildPrintHtml();
      if (!html) {
        throw new Error('ไม่สามารถสร้าง HTML สำหรับพิมพ์ได้');
      }
      
      await window.electronPrinter.printHtml({ html });
      setMessage('ส่งพิมพ์ใบเสนอราคาแล้ว');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'พิมพ์ใบเสนอราคาไม่สำเร็จ');
    } finally {
      setIsWorking(false);
    }
  };

  /* --- render ----------------------------------------------------------- */

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">สร้างใบเสนอราคา</h1>
          <p className="mt-1 text-sm text-slate-500">
            ดึงข้อมูลร้านและลูกค้าจากระบบ พร้อมพิมพ์ / ส่งออกเป็น PDF ได้ทันที
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadStoreSettings()}
          disabled={storeLoading}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <IconRefresh size={18} className={storeLoading ? "animate-spin" : ""} />
          โหลดข้อมูลร้านใหม่
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {message ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-hidden lg:grid-cols-[420px_minmax(0,1fr)]">
        {/* --- Editor panel --- */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <StoreIcon size={18} className="text-[#1d6fd8]" />
              ข้อมูลร้าน
            </div>
            {storeLoading ? (
              <p className="text-sm text-slate-400">กำลังโหลด...</p>
            ) : storeData ? (
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-800">{storeData.store.store_name}</p>
                <p className="text-xs text-slate-500">{storeData.store.address}</p>
                <p className="text-xs text-slate-500">
                  ภาษีมูลค่าเพิ่ม: {storeData.store.vat_enabled ? `${storeData.store.vat_rate}%` : "ไม่เปิดใช้"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-red-500">โหลดข้อมูลร้านไม่สำเร็จ</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <UserSearch size={18} className="text-[#1d6fd8]" />
              ข้อมูลลูกค้า
            </div>
            
            {/* Input สำหรับค้นหาลูกค้า */}
            <div className="relative">
              <input
                type="text"
                value={customerSearchInput}
                onChange={(event) => handleCustomerSearch(event.target.value)}
                onFocus={() => {
                  if (!customerSearchInput.trim()) {
                    loadAllCustomers();
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setShowCustomerDropdown(false);
                  }
                }}
                placeholder="ค้นหาลูกค้าด้วยชื่อ หรือรหัส..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
              />
              {customerListLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader size={18} className="animate-spin text-[#1d6fd8]" />
                </div>
              )}
              
              {/* Dropdown รายการลูกค้า */}
              {showCustomerDropdown && customerList.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {customerList.map((cust) => (
                    <button
                      key={cust.id}
                      type="button"
                      onClick={() => selectCustomer(cust)}
                      className="w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-700">{cust.customer_name}</div>
                          <div className="text-xs text-slate-500">
                            รหัส: {cust.customer_code}
                            {cust.phone_number && ` · โทร: ${cust.phone_number}`}
                          </div>
                        </div>
                        {cust.total_purchase_amount && parseFloat(cust.total_purchase_amount) > 0 && (
                          <div className="text-xs text-slate-400">
                            ยอดซื้อ: {formatCurrency(parseFloat(cust.total_purchase_amount))}
                          </div>
                        )}
                      </div>
                      {cust.address && (
                        <div className="mt-1 text-xs text-slate-400">{cust.address}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* แสดงลูกค้าที่เลือก */}
            {customer ? (
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{customer.customer_name}</p>
                    <p>รหัส: {customer.customer_code}</p>
                    {customer.phone_number && <p>โทร. {customer.phone_number}</p>}
                    {customer.email && <p>อีเมล: {customer.email}</p>}
                    {customer.address && <p>{customer.address}</p>}
                    {customer.total_purchase_amount && parseFloat(customer.total_purchase_amount) > 0 && (
                      <p className="text-xs text-slate-400">
                        ยอดซื้อสะสม: {formatCurrency(parseFloat(customer.total_purchase_amount))}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={clearCustomer}
                    className="text-xs font-medium text-red-500 hover:underline"
                  >
                    เปลี่ยน
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <label className="text-xs text-slate-500">หรือระบุชื่อลูกค้า walk-in</label>
                <input
                  type="text"
                  value={walkInName}
                  onChange={(event) => setWalkInName(event.target.value)}
                  placeholder={storeData?.store.default_customer_name || "ลูกค้าทั่วไป"}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-2 text-sm font-semibold text-slate-700">รายละเอียดใบเสนอราคา</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="col-span-2 text-xs text-slate-500">
                เลขที่ใบเสนอราคา
                <input
                  type="text"
                  value={quotationNo}
                  onChange={(event) => setQuotationNo(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
              </label>
              <label className="text-xs text-slate-500">
                วันที่ออก
                <input
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
              </label>
              <label className="text-xs text-slate-500">
                ยืนราคาถึง
                <input
                  type="date"
                  value={validUntil}
                  onChange={(event) => setValidUntil(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
              </label>
              <label className="col-span-2 text-xs text-slate-500">
                ผู้เสนอราคา
                <input
                  type="text"
                  value={salesperson}
                  onChange={(event) => setSalesperson(event.target.value)}
                  placeholder="ชื่อพนักงานขาย"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
              </label>
              <label className="col-span-2 text-xs text-slate-500">
                ส่วนลด (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discountPercent}
                  onChange={(event) => setDiscountPercent(Math.min(100, Math.max(0, Number(event.target.value) || 0)))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
              </label>
              <label className="col-span-2 text-xs text-slate-500">
                หมายเหตุ
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">รายการสินค้า / บริการ</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openProductSearch}
                  className="flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                  title="ค้นหาสินค้าจากบาร์โค้ด"
                >
                  <BarcodeIcon size={14} />
                  สแกนบาร์โค้ด
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1 rounded-lg bg-[#1d6fd8]/10 px-2.5 py-1.5 text-xs font-medium text-[#1d6fd8] hover:bg-[#1d6fd8]/20"
                >
                  <Plus size={14} />
                  เพิ่มรายการ
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                  <div className="flex items-start gap-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(event) => updateItem(item.id, { description: event.target.value })}
                      placeholder="รายละเอียดสินค้า/บริการ"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-500"
                      aria-label="ลบรายการ"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, { qty: Math.max(0, item.qty - 1) })}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-[#1d6fd8]"
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={item.qty}
                        onChange={(event) => handleQtyChange(event, item.id)}
                        className="w-full rounded-lg border border-slate-200 bg-white py-1 text-center text-sm text-slate-700 outline-none focus:border-[#1d6fd8]"
                      />
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, { qty: item.qty + 1 })}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-[#1d6fd8]"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(event) => updateItem(item.id, { unit: event.target.value })}
                      placeholder="หน่วย"
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-sm text-slate-700 outline-none focus:border-[#1d6fd8]"
                    />
                    <input
                      type="number"
                      min={0}
                      value={item.unitPrice}
                      onChange={(event) => handlePriceChange(event, item.id)}
                      placeholder="ราคา/หน่วย"
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm text-slate-700 outline-none focus:border-[#1d6fd8]"
                    />
                  </div>
                  <p className="mt-1.5 text-right text-xs text-slate-500">
                    รวม {formatCurrency(item.qty * item.unitPrice)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>รวมเป็นเงิน</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountPercent > 0 ? (
                <div className="flex justify-between text-slate-500">
                  <span>ส่วนลด ({discountPercent}%)</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              ) : null}
              {storeData?.store.vat_enabled ? (
                <div className="flex justify-between text-slate-500">
                  <span>VAT ({storeData.store.vat_rate}%)</span>
                  <span>{formatCurrency(vatAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-base font-bold text-[#1d6fd8]">
                <span>รวมทั้งสิ้น</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pb-2">
            <button
              type="button"
              onClick={() => void handleExportPng()}
              disabled={isWorking}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <IconDownload size={18} />
              PNG
            </button>
            <button
              type="button"
              onClick={() => void handleExportPdf()}
              disabled={isWorking}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <IconFileTypePdf size={18} />
              PDF
            </button>
            <button
              type="button"
              onClick={() => void handlePrint()}
              disabled={isWorking}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#1d6fd8] px-3 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#1a5fc0] disabled:opacity-50"
            >
              <Printer size={18} />
              พิมพ์
            </button>
          </div>
        </div>

        {/* --- Preview panel --- */}
        <div className="min-h-0 overflow-auto rounded-2xl bg-slate-100 p-6">
          {storeData ? (
            <div className="mx-auto w-fit shadow-lg">
              <div ref={previewRef}>
                <QuotationDocument
                  storeData={storeData}
                  apiBaseUrl={apiBaseUrl}
                  customer={customer}
                  walkInName={walkInName}
                  quotationNo={quotationNo}
                  issueDate={issueDate}
                  validUntil={validUntil}
                  salesperson={salesperson}
                  items={items}
                  subtotal={subtotal}
                  discountPercent={discountPercent}
                  discountAmount={discountAmount}
                  vatAmount={vatAmount}
                  grandTotal={grandTotal}
                  notes={notes}
                  promptPayQrDataUrl={promptPayQrDataUrl}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[400px] items-center justify-center text-sm text-slate-400">
              {storeLoading ? "กำลังโหลดข้อมูลร้าน..." : "ไม่สามารถแสดงตัวอย่างใบเสนอราคาได้"}
            </div>
          )}
        </div>

        {/* --- Product Search Modal --- */}
        {showProductSearch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
              {/* Header */}
              <div className="border-b border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-800">ค้นหาสินค้า / บริการ</h2>
                  <button
                    type="button"
                    onClick={closeProductSearch}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="max-h-[70vh] overflow-y-auto p-4">
                {/* Search Input */}
                <div className="mb-4">
                  <label className="text-xs text-slate-500">
                    ค้นหาด้วยชื่อ SKU หรือบาร์โค้ด
                    <div className="relative mt-2">
                      <input
                        ref={productSearchInputRef}
                        type="text"
                        value={productSearchInput}
                        onChange={(e) => handleProductSearch(e.target.value)}
                        placeholder="พิมพ์เพื่อค้นหา... หรือสแกนบาร์โค้ด"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            searchProducts(productSearchInput);
                          }
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                      />
                      {productSearchLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader size={18} className="animate-spin text-[#1d6fd8]" />
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                {/* Error Message */}
                {productSearchError && (
                  <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                    {productSearchError}
                  </div>
                )}

                {/* Search Results */}
                {productSearchResults.length > 0 ? (
                  <div className="space-y-2">
                    {productSearchResults.map((product) => (
                      <button
                        key={`${product.id}`}
                        type="button"
                        onClick={() => addProductToItems(product)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left hover:bg-slate-100 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-slate-700">{product.product_name}</div>
                            {product.sku && (
                              <div className="text-xs text-slate-500">SKU: {product.sku}</div>
                            )}
                            {product.barcode && (
                              <div className="text-xs text-slate-500">บาร์โค้ด: {product.barcode}</div>
                            )}
                            <div className="mt-1 text-xs text-slate-500">
                              สถานะ: {product.status === "ACTIVE" ? "พร้อมขาย" : "ไม่พร้อมขาย"}
                            </div>
                          </div>
                          <div className="ml-4 flex-shrink-0 text-right">
                            <div className="text-sm font-semibold text-[#1d6fd8]">
                              {formatCurrency(toNumber(product.sale_price, 0))}
                            </div>
                            {product.unit_code && (
                              <div className="text-xs text-slate-500">/{product.unit_code}</div>
                            )}
                            {product.has_promotion && (
                              <div className="mt-1 text-xs font-medium text-red-500">ลดราคา!</div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : productSearchLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="text-center">
                      <Loader size={24} className="mx-auto mb-2 animate-spin text-[#1d6fd8]" />
                      <p className="text-sm text-slate-500">กำลังค้นหา...</p>
                    </div>
                  </div>
                ) : productSearchInput.trim() && productSearchInput.trim().length >= 3 ? (
                  <div className="flex justify-center py-8">
                    <p className="text-sm text-slate-500">ไม่พบสินค้าที่ค้นหา</p>
                  </div>
                ) : productSearchInput.trim() ? (
                  <div className="flex justify-center py-8">
                    <p className="text-sm text-slate-500">กรุณาพิมพ์อย่างน้อย 3 ตัวอักษรเพื่อค้นหา</p>
                  </div>
                ) : (
                  <div className="flex justify-center py-8">
                    <p className="text-center text-sm text-slate-500">
                      พิมพ์เพื่อค้นหาสินค้า<br />
                      หรือสแกนบาร์โค้ด
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 bg-slate-50 p-4">
                <button
                  type="button"
                  onClick={closeProductSearch}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}