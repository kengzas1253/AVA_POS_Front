import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toJpeg, toPng } from "html-to-image";
import { authorizedFetch, type PaymentAccount, type StoreSettings } from "./StoreSetting";
import ReceiptDocument, { type ReceiptPaperSize, type SaleReceipt } from "./ReceiptDocument";

const LIMIT = 50;
const FALLBACK_STORE_NAME = "AVA MY POS";
const FALLBACK_CUSTOMER_NAME = "ลูกค้าทั่วไป";
const BANGKOK_TIME_ZONE = "Asia/Bangkok";

interface SalesResponse {
  success?: boolean;
  data?: SaleSummary[];
  pagination?: {
    limit?: number;
    hasNextPage?: boolean;
    nextCursor?: string | null;
  };
  message?: string;
}

interface ReceiptResponse {
  success?: boolean;
  data?: {
    receipt?: SaleReceipt;
  };
  message?: string;
}

interface StoreSettingsResponse {
  status?: string;
  message?: string;
  data?: {
    store?: StoreSettings;
    payment_account?: PaymentAccount | null;
  };
}

interface PaymentSummary {
  payment_type_id: string;
  payment_name: string;
  amount: string;
}

interface SaleSummary {
  id: string;
  sale_no: string;
  sale_at: string;
  machine_id?: string | null;
  machine_name?: string | null;
  cashier_id?: string | null;
  cashier_name?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  item_count?: number | null;
  total_amount: string;
  payment_summary?: PaymentSummary[] | null;
  status?: string | null;
}

const CashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="3" />
    <path d="M6 6v0M18 6v0M6 18v0M18 18v0" />
  </svg>
);

const PrintIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-slate-400">
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const formatMoney = (value?: string | number | null) => {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return numeric.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BANGKOK_TIME_ZONE,
  }).format(date);
};

const formatDateGroup = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: BANGKOK_TIME_ZONE,
  }).format(date);
};

const getCustomerName = (name: string | null | undefined, store?: StoreSettings | null) =>
  name?.trim() || store?.default_customer_name?.trim() || FALLBACK_CUSTOMER_NAME;

const getPaymentText = (payments?: PaymentSummary[] | null) => {
  if (!payments?.length) return "-";
  return payments.map((payment) => `${payment.payment_name} ${formatMoney(payment.amount)}`).join(", ");
};

const shouldShowDateGroup = (sales: SaleSummary[], index: number) => {
  const currentDate = formatDateGroup(sales[index]?.sale_at);
  const previousDate = index > 0 ? formatDateGroup(sales[index - 1]?.sale_at) : null;
  return currentDate !== previousDate;
};

const getApiError = async (response: Response, fallback: string) => {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message || fallback;
  } catch {
    return fallback;
  }
};

const buildQuery = (search: string, cursor?: string | null) => {
  const query = new URLSearchParams({ limit: String(LIMIT) });
  const trimmedSearch = search.trim();
  if (trimmedSearch) query.set("search", trimmedSearch);
  if (cursor) query.set("cursor", cursor);
  return query.toString();
};

const fallbackStore = (): StoreSettings =>
  ({
    store_name: FALLBACK_STORE_NAME,
    branch_name: "",
    branch_no: "",
    tax_id: "",
    address: "",
    phone: "",
    receipt_header: "",
    receipt_footer: "",
    receipt_paper_size: "80MM",
    show_logo: false,
    logo_url: "",
    show_receipt_image: false,
    receipt_image_url: "",
    default_customer_name: FALLBACK_CUSTOMER_NAME,
    timezone: BANGKOK_TIME_ZONE,
  }) as StoreSettings;

const getSafeFilename = (saleNo: string | null | undefined, extension: "pdf" | "png" | "jpg") =>
  `receipt_${(saleNo || "unknown").replace(/[\\/:*?"<>|]/g, "_")}.${extension}`;

export default function ReceiptPage() {
  const receiptDocumentRef = useRef<HTMLDivElement | null>(null);
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [selectedSaleNo, setSelectedSaleNo] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [store, setStore] = useState<StoreSettings>(() => fallbackStore());
  const [paymentAccount, setPaymentAccount] = useState<PaymentAccount | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>("80MM");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [salesError, setSalesError] = useState("");
  const [receiptError, setReceiptError] = useState("");
  const [storeError, setStoreError] = useState("");
  const [exportMessage, setExportMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadStore = useCallback(async () => {
    try {
      const base = await window.electronStore.get("apiPath");
      if (typeof base === "string") setApiBaseUrl(base.trim().replace(/\/+$/, ""));

      const response = await authorizedFetch("/store/settings");
      if (!response.ok) throw new Error(await getApiError(response, "โหลดข้อมูลร้านไม่สำเร็จ"));

      const payload = (await response.json()) as StoreSettingsResponse;
      const nextStore = payload.data?.store ?? fallbackStore();
      setStore(nextStore);
      setPaymentAccount(payload.data?.payment_account ?? null);
      setPaperSize(nextStore.receipt_paper_size === "58MM" ? "58MM" : "80MM");
      setStoreError("");
    } catch {
      setStore(fallbackStore());
      setPaymentAccount(null);
      setStoreError("โหลดข้อมูลร้านไม่สำเร็จ ใช้ชื่อร้าน AVA MY POS แทน");
    }
  }, []);

  const loadSales = useCallback(
    async (mode: "replace" | "append", cursor?: string | null) => {
      if (mode === "append") {
        setIsLoadingMore(true);
      } else {
        setIsLoadingSales(true);
      }
      setSalesError("");

      try {
        const response = await authorizedFetch(`/sales?${buildQuery(debouncedSearch, cursor)}`);
        if (!response.ok) throw new Error(await getApiError(response, "โหลดรายการใบเสร็จไม่สำเร็จ"));

        const payload = (await response.json()) as SalesResponse;
        const rows = Array.isArray(payload.data) ? payload.data : [];

        setSales((current) => (mode === "append" ? [...current, ...rows] : rows));
        setHasNextPage(Boolean(payload.pagination?.hasNextPage));
        setNextCursor(payload.pagination?.nextCursor ?? null);

        if (mode === "replace") {
          setSelectedSaleNo(rows[0]?.sale_no ?? null);
          setReceipt(null);
          setReceiptError("");
        }
      } catch (error) {
        setSalesError(error instanceof Error ? error.message : "โหลดรายการใบเสร็จไม่สำเร็จ");
        if (mode === "replace") {
          setSales([]);
          setSelectedSaleNo(null);
          setReceipt(null);
        }
      } finally {
        setIsLoadingSales(false);
        setIsLoadingMore(false);
      }
    },
    [debouncedSearch],
  );

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.sale_no === selectedSaleNo) ?? null,
    [sales, selectedSaleNo],
  );

  const loadReceipt = useCallback(
    async (saleIdOrNo: string) => {
      setIsLoadingReceipt(true);
      setReceiptError("");
      setExportMessage("");

      try {
        const response = await authorizedFetch(`/sales/${encodeURIComponent(saleIdOrNo)}/receipt`);
        if (!response.ok) throw new Error(await getApiError(response, "โหลดใบเสร็จไม่สำเร็จ"));

        const payload = (await response.json()) as ReceiptResponse;
        const receiptData = payload.data?.receipt ?? null;
        setReceipt(
          receiptData
            ? {
                ...receiptData,
                machine_id: receiptData.machine_id ?? selectedSale?.machine_id ?? null,
                machine_name: receiptData.machine_name ?? selectedSale?.machine_name ?? null,
              }
            : null,
        );
      } catch (error) {
        setReceipt(null);
        setReceiptError(error instanceof Error ? error.message : "โหลดใบเสร็จไม่สำเร็จ");
      } finally {
        setIsLoadingReceipt(false);
      }
    },
    [selectedSale?.machine_id, selectedSale?.machine_name],
  );

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  useEffect(() => {
    void loadSales("replace");
  }, [loadSales]);

  useEffect(() => {
    if (selectedSaleNo) void loadReceipt(selectedSaleNo);
  }, [loadReceipt, selectedSaleNo]);

  const documentFrameWidth = paperSize === "A4" ? "max-w-[900px]" : paperSize === "58MM" ? "max-w-[300px]" : "max-w-[390px]";

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.click();
  };

  const getReceiptHtml = () => {
    if (!receiptDocumentRef.current) {
      throw new Error("ไม่พบเอกสารใบเสร็จสำหรับ export");
    }

    return `<!doctype html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${receipt?.sale_no || "Receipt"}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap" rel="stylesheet" />
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap");
      * {
        font-family: "Sarabun", "TH Sarabun New", "TH SarabunPSK", Tahoma, Arial, sans-serif !important;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #020617;
        font-family: "Sarabun", "TH Sarabun New", "TH SarabunPSK", Tahoma, Arial, sans-serif;
      }
      body {
        display: flex;
        justify-content: center;
        align-items: flex-start;
      }
    </style>
  </head>
  <body>
    ${receiptDocumentRef.current.outerHTML}
  </body>
</html>`;
  };

  const handleExportImage = async (format: "png" | "jpeg") => {
    if (!receiptDocumentRef.current) return;

    setIsExporting(true);
    setExportMessage("");
    try {
      const options = {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      };
      const dataUrl =
        format === "png"
          ? await toPng(receiptDocumentRef.current, options)
          : await toJpeg(receiptDocumentRef.current, { ...options, quality: 0.95 });
      downloadDataUrl(dataUrl, getSafeFilename(receipt?.sale_no, format === "png" ? "png" : "jpg"));
      setExportMessage(`Export ${format.toUpperCase()} สำเร็จ`);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Export รูปภาพไม่สำเร็จ");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    try {
      if (window.electronPrinter?.printHtml) {
        void window.electronPrinter.printHtml({ html: getReceiptHtml() });
        return;
      }
    } catch {
      // Fall back to browser print below.
    }

    window.print();
  };

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    setExportMessage("");
    try {
      if (!window.electronPrinter?.exportPdf) {
        throw new Error("ไม่พบระบบ Export PDF ของ Electron");
      }

      const filePath = await window.electronPrinter.exportPdf({
        html: getReceiptHtml(),
        defaultPath: getSafeFilename(receipt?.sale_no, "pdf"),
      });

      setExportMessage(filePath ? `บันทึก PDF แล้ว: ${filePath}` : "ยกเลิกการบันทึก PDF");
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Export PDF ไม่สำเร็จ");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50 text-slate-900 antialiased" style={{ fontFamily: '"Sarabun", ui-sans-serif, system-ui, sans-serif' }}>
      <header className="z-10 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5 text-slate-900 shadow-sm print:hidden">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#1d6fd8]">
          <MenuIcon />
        </div>
        <h1 className="m-0 shrink-0 text-base font-bold">ใบเสร็จรับเงิน</h1>
        <div className="ml-auto flex items-center gap-3">
          {receipt && !isLoadingReceipt && (
            <ReceiptToolbar
              paperSize={paperSize}
              setPaperSize={setPaperSize}
              isExporting={isExporting}
              handleDownloadPdf={() => void handleDownloadPdf()}
              handleExportImage={handleExportImage}
              handlePrint={handlePrint}
            />
          )}
          <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-[0.9rem] font-semibold text-[#1d6fd8]">
            {selectedSaleNo ?? "-"}
          </span>
          <button
            type="button"
            onClick={() => void loadSales("replace")}
            disabled={isLoadingSales}
            className="rounded-lg bg-[#1d6fd8] px-4 py-2 text-[0.85rem] font-semibold text-white transition hover:bg-[#1557ad] disabled:cursor-not-allowed disabled:opacity-60"
          >
            รีเฟรช
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 max-md:flex-col">
        <aside className="flex min-h-0 w-[430px] flex-col border-r border-slate-200 bg-white max-md:max-h-[48vh] max-md:w-full max-md:border-b print:hidden">
          <div className="shrink-0 p-4 pb-2.5">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหาเลขที่ใบเสร็จหรือลูกค้า"
                className="w-full rounded-lg border border-[#dfe7fb] bg-[#f4f8ff] py-3 pl-9 pr-3 text-base outline-none transition-colors focus:border-[#3d78f0] focus:bg-white"
              />
            </div>
          </div>

          <div className="shrink-0 px-4 pb-2 text-sm font-bold text-[#1d5ce0]">
            รายการใบเสร็จ {isLoadingSales ? "กำลังโหลด..." : `${sales.length} รายการ`}
          </div>

          {salesError && <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{salesError}</div>}

          <div className="flex-1 overflow-y-auto">
            {!isLoadingSales && sales.length === 0 && !salesError && (
              <div className="px-4 py-8 text-center text-sm text-slate-500">ไม่พบรายการใบเสร็จ</div>
            )}

            {sales.map((sale, index) => (
              <React.Fragment key={sale.id}>
                {shouldShowDateGroup(sales, index) && (
                  <div className="sticky top-0 z-[1] border-y border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-[#1d5ce0]">
                    {formatDateGroup(sale.sale_at)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedSaleNo(sale.sale_no || sale.id)}
                  className={`group flex w-full items-stretch gap-4 px-4 text-left transition-colors ${
                    sale.sale_no === selectedSaleNo ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className={`flex w-10 shrink-0 items-center justify-center py-4 ${sale.sale_no === selectedSaleNo ? "text-[#1d6fd8]" : "text-slate-500"}`}>
                    <CashIcon />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-4 border-b border-slate-200 py-3.5">
                    <div className="min-w-0">
                      <div className="text-xl font-bold leading-6 text-slate-900">฿{formatMoney(sale.total_amount)}</div>
                      <div className="mt-1 text-sm font-medium leading-5 text-slate-500">{formatDateTime(sale.sale_at)}</div>
                      <div className="mt-1 max-w-[220px] truncate text-sm font-semibold leading-5 text-[#1d6fd8]">
                        {getCustomerName(sale.customer_name, store)}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500">
                        {sale.cashier_name || "-"} · {sale.machine_name || sale.machine_id || "-"} · {sale.item_count ?? 0} รายการ
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500">{getPaymentText(sale.payment_summary)}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-sm font-bold ${sale.sale_no === selectedSaleNo ? "text-[#1d6fd8]" : "text-slate-600"}`}>
                        {sale.sale_no}
                      </div>
                      <div className="mt-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{sale.status || "-"}</div>
                    </div>
                  </div>
                </button>
              </React.Fragment>
            ))}
          </div>

          {hasNextPage && (
            <div className="shrink-0 border-t border-slate-200 p-3">
              <button
                type="button"
                onClick={() => void loadSales("append", nextCursor)}
                disabled={isLoadingMore || !nextCursor}
                className="w-full rounded-lg border border-[#dfe7fb] bg-white py-2.5 text-sm font-bold text-[#1547a8] transition hover:bg-[#f4f8ff] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingMore ? "กำลังโหลด..." : "โหลดเพิ่ม"}
              </button>
            </div>
          )}
        </aside>

        <main className="flex flex-1 items-start justify-center overflow-y-auto p-6 max-md:p-4 print:block print:overflow-visible print:p-0">
          <div className={`relative w-full ${documentFrameWidth} self-start rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:w-auto print:max-w-none print:border-0 print:p-0 print:shadow-none`}>
            {storeError && <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 print:hidden">{storeError}</div>}
            {receiptError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden">{receiptError}</div>}
            {exportMessage && <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 print:hidden">{exportMessage}</div>}

            {!selectedSale && !isLoadingSales && <div className="py-12 text-center text-sm text-slate-500 print:hidden">เลือกใบเสร็จเพื่อดูรายละเอียด</div>}
            {isLoadingReceipt && <div className="py-12 text-center text-sm text-slate-500 print:hidden">กำลังโหลดใบเสร็จ...</div>}

            {receipt && !isLoadingReceipt && (
              <>
                <div className="flex justify-center overflow-x-auto rounded-lg bg-slate-100 p-4 print:block print:overflow-visible print:bg-white print:p-0">
                  <ReceiptDocument
                    ref={receiptDocumentRef}
                    receipt={receipt}
                    storeSettings={store}
                    paymentAccount={paymentAccount}
                    paperSize={paperSize}
                    mode="preview"
                    apiBaseUrl={apiBaseUrl}
                  />
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

interface ActionButtonProps {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

interface ReceiptToolbarProps {
  paperSize: ReceiptPaperSize;
  setPaperSize: (paperSize: ReceiptPaperSize) => void;
  isExporting: boolean;
  handleDownloadPdf: () => void;
  handleExportImage: (format: "png" | "jpeg") => Promise<void>;
  handlePrint: () => void;
}

function ReceiptToolbar({
  paperSize,
  setPaperSize,
  isExporting,
  handleDownloadPdf,
  handleExportImage,
  handlePrint,
}: ReceiptToolbarProps) {
  return (
    <div className="flex items-center gap-2 max-xl:hidden">
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
        {(["58MM", "80MM", "A4"] as ReceiptPaperSize[]).map((size) => (
          <button
            type="button"
            key={size}
            onClick={() => setPaperSize(size)}
            className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
              paperSize === size ? "bg-[#1d6fd8] text-white shadow-sm" : "text-slate-600 hover:bg-white"
            }`}
          >
            {size}
          </button>
        ))}
      </div>
      <ActionButton onClick={handleDownloadPdf} disabled={isExporting}>
        Download PDF
      </ActionButton>
      <ActionButton onClick={() => void handleExportImage("png")} disabled={isExporting}>
        Export PNG
      </ActionButton>
      <ActionButton onClick={() => void handleExportImage("jpeg")} disabled={isExporting}>
        Export JPEG
      </ActionButton>
      <ActionButton onClick={handlePrint} disabled={isExporting}>
        <PrintIcon /> Print
      </ActionButton>
    </div>
  );
}

function ActionButton({ children, disabled, onClick }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#dfe7fb] bg-white px-3 py-2 text-xs font-bold text-[#1547a8] transition hover:bg-[#f4f8ff] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}
