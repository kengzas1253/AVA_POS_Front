import React, { useCallback, useEffect, useState, useRef } from "react";
import { authorizedFetch, getApiErrorMessage, type StoreData } from "./StoreSetting";
import QRCode from "qrcode";
import generatePayload from "promptpay-qr";
import { toJpeg } from "html-to-image";
import ReceiptDocument, { type ReceiptPaperSize, type SaleReceipt } from "./ReceiptDocument";
import CustomerPickerPopup, {
  getCustomerName,
  type PosCustomer,
} from "./CustomerPickerPopup";
import { SELECTED_POS_CUSTOMER_KEY } from "./autoPackPricingService";

interface POSPaymentCartItem {
  id?: number | string;
  product_id?: number | string | null;
  productId?: number | string | null;
  product_unit_id?: number | string | null;
  productUnitId?: number | string | null;
  name: string;
  product_name?: string;
  barcode?: string | null;
  barcode_snapshot?: string | null;
  unit_code?: string | null;
  unit_name?: string | null;
  unit_name_snapshot?: string | null;
  price_mode?: string | null;
  price: number;
  qty: number;
  discount?: number;
  discount_amount?: number | string | null;
  final_price?: number | string | null;
  total_amount?: number | string | null;
}

interface POSPaymentProps {
  onBack?: () => void;
  onPaymentComplete?: () => void;
  cartItems?: POSPaymentCartItem[];
  subtotal?: number;
  discount?: number;
  total?: number;
  heldBillId?: number | string | null;
}

// ✅ Mixed Payment Method Types
export type PaymentMethodType = string;

type PaymentTabId = "cash" | "transfer" | "gov";

interface PaymentTabOption {
  id: PaymentTabId;
  label: string;
  icon: string;
}

interface PaymentType {
  id: string;
  paymentCode: string;
  paymentName: string;
  paymentNameEn?: string;
  icon: string | null;
  description: string | null;
  isGovernmentScheme: boolean;
  isActive: boolean;
  sortOrder: number;
}

const paymentTabs: PaymentTabOption[] = [
  {
    id: "cash",
    label: "เงินสด",
    icon: "💵",
  },
  {
    id: "transfer",
    label: "โอน / พร้อมเพย์",
    icon: "📱",
  },
  {
    id: "gov",
    label: "โครงการรัฐ",
    icon: "🇹🇭",
  },
];

const unwrapPaymentTypes = (payload: unknown): PaymentType[] => {
  if (Array.isArray(payload)) return payload as PaymentType[];
  if (!payload || typeof payload !== "object") return [];

  const value = payload as {
    data?: unknown;
    paymentTypes?: unknown;
    rows?: unknown;
  };

  if (Array.isArray(value.data)) return value.data as PaymentType[];
  if (Array.isArray(value.paymentTypes)) return value.paymentTypes as PaymentType[];
  if (Array.isArray(value.rows)) return value.rows as PaymentType[];
  return [];
};

const getOrderedActivePaymentTypes = (items: PaymentType[]) =>
  items
    .filter((item) => item.isActive)
    .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));

const getPaymentTypeIcon = (paymentType: PaymentType): string => {
  if (paymentType.icon === "CashBanknote" || paymentType.paymentCode === "CASH") return "💵";
  if (
    paymentType.icon === "DeviceMobile" ||
    paymentType.paymentCode.includes("PROMPTPAY") ||
    paymentType.paymentCode.includes("TRANSFER")
  ) {
    return "📱";
  }
  if (paymentType.icon === "BuildingBank" || paymentType.paymentCode.includes("WELFARE")) return "🏛️";
  return paymentType.isGovernmentScheme ? "🇹🇭" : "💳";
};

const isTransferPaymentCode = (paymentCode: string): boolean =>
  paymentCode.includes("TRANSFER") || paymentCode.includes("PROMPTPAY");

const renderPaymentTabIcon = (tab: PaymentTabOption) => {
  if (tab.id !== "gov") {
    return <span>{tab.icon}</span>;
  }

  return (
    <span
      aria-label="ธงชาติไทย"
      role="img"
      style={{
        display: "inline-flex",
        width: 22,
        height: 14,
        overflow: "hidden",
        borderRadius: 2,
        boxShadow: "0 0 0 1px rgba(15, 23, 42, 0.18)",
        background:
          "linear-gradient(to bottom, #da291c 0 16.66%, #fff 16.66% 33.33%, #2d2a4a 33.33% 66.66%, #fff 66.66% 83.33%, #da291c 83.33% 100%)",
      }}
    />
  );
};

interface MixedPaymentLine {
  id: string;
  type: PaymentMethodType;
  amount: string;
  reference?: string;
}

interface StoredPosDevice {
  machine_id?: unknown;
  machineId?: unknown;
  device_name?: unknown;
  deviceName?: unknown;
  pos_device?: {
    machine_id?: unknown;
    machineId?: unknown;
    device_name?: unknown;
    deviceName?: unknown;
  };
}

interface StoredUser {
  full_name?: unknown;
  username?: unknown;
}

interface StoredSelectedCustomer {
  id?: unknown;
  customer_id?: unknown;
}

interface SaleRequestItem {
  product_unit_id?: number | string;
  product_id?: number | string;
  barcode?: string;
  quantity: string;
  discount_amount?: string;
  entered_unit_price?: string;
}

interface SaleRequestPayment {
  payment_type_id: number | string;
  amount: string;
  reference_no?: string;
}

interface SaleRequestPayload {
  idempotency_key: string;
  machine_id: string;
  store_id: number;
  customer_id?: number | string;
  items: SaleRequestItem[];
  payments: SaleRequestPayment[];
  bill_discount_amount: string;
  note: string;
}

interface SaleApiResponse {
  id?: number | string;
  sale_no?: string;
  data?: {
    id?: number | string;
    sale_no?: string;
    receipt?: SaleReceipt;
  };
  receipt?: SaleReceipt;
  message?: string | string[];
}

interface ReceiptApiResponse {
  data?: {
    receipt?: SaleReceipt | null;
  };
  receipt?: SaleReceipt | null;
  message?: string | string[];
}

const formatBaht = (value: number): string => `฿${value.toFixed(2)}`;

const getCartItemName = (item: POSPaymentCartItem): string =>
  item.product_name || item.name || "-";

const getCartItemTotal = (item: POSPaymentCartItem): number => {
  const fallback = Number(item.price || 0) * Number(item.qty || 0);
  return Number(item.final_price ?? item.total_amount ?? fallback) || fallback;
};

const toDecimalString = (value: number | string | null | undefined, fallback = 0): string => {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : fallback.toFixed(2);
};

const toQuantityString = (value: number | string | null | undefined): string => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? String(numeric) : "0";
};

const getStoredMachineId = (storedDevice: unknown): string | null => {
  if (!storedDevice || typeof storedDevice !== "object") return null;
  const device = storedDevice as StoredPosDevice;
  const machineId =
    device.machine_id ??
    device.machineId ??
    device.pos_device?.machine_id ??
    device.pos_device?.machineId;
  return typeof machineId === "string" && machineId.trim() ? machineId.trim() : null;
};

const getStoredDeviceName = (storedDevice: unknown): string | null => {
  if (!storedDevice || typeof storedDevice !== "object") return null;
  const device = storedDevice as StoredPosDevice;
  const deviceName =
    device.device_name ??
    device.deviceName ??
    device.pos_device?.device_name ??
    device.pos_device?.deviceName;
  return typeof deviceName === "string" && deviceName.trim() ? deviceName.trim() : null;
};

const getStoredCashierName = (storedUser: unknown): string | null => {
  if (!storedUser || typeof storedUser !== "object") return null;
  const user = storedUser as StoredUser;
  const cashierName = user.full_name ?? user.username;
  return typeof cashierName === "string" && cashierName.trim() ? cashierName.trim() : null;
};

const getStoredCustomerId = (storedCustomer: unknown): number | string | null => {
  if (!storedCustomer || typeof storedCustomer !== "object") return null;
  const customer = storedCustomer as StoredSelectedCustomer;
  const customerId = customer.customer_id ?? customer.id;
  if (typeof customerId === "number" && Number.isFinite(customerId) && customerId > 0) {
    return customerId;
  }
  if (typeof customerId !== "string" || !customerId.trim()) return null;

  const trimmedCustomerId = customerId.trim();
  const numericCustomerId = Number(trimmedCustomerId);
  return Number.isFinite(numericCustomerId) && numericCustomerId > 0
    ? numericCustomerId
    : trimmedCustomerId;
};

const makeIdempotencyKey = (storeId?: number): string => {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `POS-${storeId ?? 1}-${randomPart}`;
};

const getQuickCashAmounts = (total: number): number[] => {
  if (total <= 0) {
    return [0, 0, 0, 0];
  }

  const wholeTotal = Math.ceil(total);
  const nextTen = Math.ceil(wholeTotal / 10) * 10;
  const nextTwenty = Math.ceil(wholeTotal / 20) * 20;
  const nextFifty = Math.ceil(wholeTotal / 50) * 50;
  const nextHundred = Math.ceil(wholeTotal / 100) * 100;
  const nextFiveHundred = Math.ceil(wholeTotal / 500) * 500;
  const nextThousand = Math.ceil(wholeTotal / 1000) * 1000;
  const candidates =
    wholeTotal < 10
      ? [5, 10, 20, 50, 100, 500, 1000]
      : [
          nextTen,
          nextTwenty,
          nextFifty,
          nextHundred,
          nextFiveHundred,
          nextThousand,
        ];

  return candidates
    .filter((amount) => amount > total)
    .filter((amount, index, amounts) => amounts.indexOf(amount) === index)
    .sort((a, b) => a - b)
    .slice(0, 7);
};

// ✅ à¸ªà¸£à¹‰à¸²à¸‡ PromptPay QR code à¸”à¹‰วย promptpay-qr library (à¸¡à¸²à¸•à¸£à¸าน EMV)
const generatePromptPayQr = async (
  promptpayId?: string | null,
  amount?: number,
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
): Promise<string | null> => {
  if (!promptpayId || !canvasRef?.current) return null;

  const cleanId = promptpayId.replace(/[^0-9]/g, "");
  if (!cleanId) return null;

  try {
    let payload: string;

    if (cleanId.length === 10 && cleanId.startsWith("0")) {
      payload = generatePayload(cleanId, { amount: amount });
    } else if (cleanId.length === 13) {
      payload = generatePayload(cleanId, { amount: amount });
    } else {
      payload = generatePayload(cleanId, { amount: amount });
    }

    console.log("✅ PromptPay Payload:", payload);

    await QRCode.toCanvas(canvasRef.current, payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 200,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    const dataUrl = canvasRef.current?.toDataURL("image/png");
    return dataUrl || null;
  } catch (error) {
    console.error("âŒ Generate PromptPay QR error:", error);
    return null;
  }
};

// ✅ Get payment method display name
const getPaymentMethodLabel = (type: PaymentMethodType): string => {
  switch (type) {
    case "cash":
      return "💵 เงินสด";
    case "transfer":
      return "📱 โอน/พร้อมเพย์";
    case "gov_welfare":
      return "🏛️ บัตรสวัสดิการแห่งรัฐ";
    case "khon_la_krueng":
      return "🤝 คนละครึ่ง";
    case "digital_money":
      return "💳 เงินดิจิตอล";
    case "other":
      return "📌 อื่นๆ";
    default:
      return "วิธีชำระเงิน";
  }
};

const POSPayment: React.FC<POSPaymentProps> = ({
  onBack,
  onPaymentComplete,
  cartItems = [],
  subtotal = 0,
  discount = 0,
  total = 0,
  heldBillId = null,
}) => {
  // ---------- state ----------
  const [activeTab, setActiveTab] = useState<PaymentTabId>("cash");
  const [cashInput, setCashInput] = useState<string>(total.toFixed(2));
  const [popupChange, setPopupChange] = useState<number | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [paymentTypesError, setPaymentTypesError] = useState<string | null>(null);
  const [showSplitPopup, setShowSplitPopup] = useState(false);
  const [receiptPaperSize] = useState<ReceiptPaperSize>("A4");
  const [showReceiptExportOptions, setShowReceiptExportOptions] = useState(false);
  const [receiptActionMessage, setReceiptActionMessage] = useState<string | null>(null);
  const [isReceiptActionWorking, setIsReceiptActionWorking] = useState(false);
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);
  const [saleResult, setSaleResult] = useState<{ id?: number | string; saleNo?: string; receipt?: SaleReceipt } | null>(null);
  const [currentMachineId, setCurrentMachineId] = useState<string | null>(null);
  const [currentMachineName, setCurrentMachineName] = useState<string | null>(null);
  const [currentCashierName, setCurrentCashierName] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<PosCustomer | null>(null);
  const [showCustomerPopup, setShowCustomerPopup] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  
  // ✅ Mixed payment state
  const [mixedPayments, setMixedPayments] = useState<MixedPaymentLine[]>([
    { id: "1", type: "CASH", amount: total.toFixed(2) }
  ]);

  // ✅ Ref à¸ªà¸³à¸«à¸£à¸±à¸šà¸Šà¹ˆà¸­à¸‡ Input à¹€à¸‡ินสด
  const cashInputRef = useRef<HTMLInputElement>(null);
  
  // ✅ Ref สำหรับ popup container
  const popupContainerRef = useRef<HTMLDivElement>(null);
  const paymentErrorButtonRef = useRef<HTMLButtonElement>(null);
  const receiptDocumentRef = useRef<HTMLDivElement | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const customerSearchRef = useRef<HTMLInputElement | null>(null);

  // ✅ QR code state
  const [splitQrDataUrl, setSplitQrDataUrl] = useState<string | null>(null);
  const [splitQrLoading, setSplitQrLoading] = useState(false);
  const splitQrCanvasRef = useRef<HTMLCanvasElement>(null);

  // ✅ Transfer tab QR code state
  const [transferQrDataUrl, setTransferQrDataUrl] = useState<string | null>(null);
  const transferQrCanvasRef = useRef<HTMLCanvasElement>(null);

  const itemCount = cartItems.length;
  const totalQty = cartItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const activePaymentTypes = getOrderedActivePaymentTypes(paymentTypes);
  const cashPaymentType = activePaymentTypes.find((item) => item.paymentCode === "CASH");
  const transferPaymentType = activePaymentTypes.find(
    (item) =>
      !item.isGovernmentScheme &&
      (item.paymentCode.includes("TRANSFER") || item.paymentCode.includes("PROMPTPAY")),
  );
  const governmentPaymentTypes = activePaymentTypes.filter((item) => item.isGovernmentScheme);
  const defaultMixedPaymentType = cashPaymentType?.paymentCode || activePaymentTypes[0]?.paymentCode || "CASH";
  const mixedPaymentOptions = activePaymentTypes;
  const displayPaymentTabs = paymentTabs
    .map((tab) => {
      if (tab.id === "cash") {
        return cashPaymentType ? { ...tab, label: cashPaymentType.paymentName, icon: getPaymentTypeIcon(cashPaymentType) } : tab;
      }

      if (tab.id === "transfer") {
        return transferPaymentType
          ? { ...tab, label: transferPaymentType.paymentName.trim(), icon: getPaymentTypeIcon(transferPaymentType) }
          : tab;
      }

      return tab;
    })
    .filter((tab) => {
      if (paymentTypes.length === 0) return true;
      if (tab.id === "cash") return Boolean(cashPaymentType);
      if (tab.id === "transfer") return Boolean(transferPaymentType);
      if (tab.id === "gov") return governmentPaymentTypes.length > 0;
      return true;
    });

  const focusCashInput = useCallback((delay = 50) => {
    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        const input = cashInputRef.current;
        if (!input) {
          return;
        }

        input.focus({ preventScroll: true });
        input.select();
      });
    }, delay);
  }, []);

  // ---------- tab switch ----------
  const switchTab = (tab: PaymentTabId) => {
    setActiveTab(tab);
    if (tab === "cash") {
      focusCashInput();
    }
  };

  // ---------- popup ----------
  const showPopup = (change: number) => {
    setShowReceiptExportOptions(false);
    setReceiptActionMessage(null);
    setPopupChange(change);
  };

  const closePopup = () => {
    setPopupChange(null);
    focusCashInput(100);
  };

  const showPaymentError = useCallback((message: string) => {
    setPaymentError(message);
  }, []);

  const closePaymentError = useCallback(() => {
    setPaymentError(null);
    focusCashInput(100);
  }, [focusCashInput]);

  const openCustomerPopup = () => {
    setCustomerSearchQuery("");
    setShowCustomerPopup(true);
  };

  const closeCustomerPopup = () => {
    setShowCustomerPopup(false);
    setCustomerSearchQuery("");
    focusCashInput(100);
  };

  const selectCustomer = (customer: PosCustomer) => {
    setSelectedCustomer(customer);
    void window.electronStore
      .set(SELECTED_POS_CUSTOMER_KEY, customer)
      .catch((error) => {
        console.error("Select payment customer error:", error);
        showPaymentError("ไม่สามารถบันทึกลูกค้าที่เลือกได้");
      });
    closeCustomerPopup();
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);
    void window.electronStore
      .set(SELECTED_POS_CUSTOMER_KEY, null)
      .catch((error) => {
        console.error("Clear payment customer error:", error);
        showPaymentError("ไม่สามารถล้างลูกค้าที่เลือกได้");
      });
    focusCashInput(100);
  };

  const confirmSuccessfulPayment = () => {
    idempotencyKeyRef.current = null;
    closePopup();
    onPaymentComplete?.();
  };

  const buildSaleItems = (): SaleRequestItem[] =>
    cartItems.map((item) => {
      const payloadItem: SaleRequestItem = {
        quantity: toQuantityString(item.qty),
      };
      const productUnitId = item.productUnitId ?? item.product_unit_id;
      const productId = item.product_id ?? item.productId;
      const barcode = item.barcode ?? item.barcode_snapshot;
      const discountAmount = Number(item.discount_amount ?? item.discount ?? 0);

      if (productUnitId != null && String(productUnitId).trim()) {
        payloadItem.product_unit_id = productUnitId;
      }
      if (productId != null && String(productId).trim()) {
        payloadItem.product_id = productId;
      }
      if (barcode?.trim()) {
        payloadItem.barcode = barcode.trim();
      }
      if (discountAmount > 0) {
        payloadItem.discount_amount = toDecimalString(discountAmount);
      }
      if (item.price_mode === "OPEN_PRICE") {
        payloadItem.entered_unit_price = toDecimalString(item.price);
      }

      return payloadItem;
    });

  const getPaymentTypeId = (paymentCode: string): number | string | null => {
    const paymentType = activePaymentTypes.find((item) => item.paymentCode === paymentCode);
    return paymentType?.id ?? null;
  };

  const buildSinglePayment = (paymentType: PaymentType | undefined, amount: number, reference: string): SaleRequestPayment => {
    if (!paymentType?.id) {
      throw new Error("ไม่พบประเภทการชำระเงิน กรุณาตรวจสอบการตั้งค่าวิธีชำระเงิน");
    }

    return {
      payment_type_id: paymentType.id,
      amount: toDecimalString(amount),
      reference_no: reference,
    };
  };

  const buildSalePayload = async (payments: SaleRequestPayment[]): Promise<SaleRequestPayload> => {
    if (!cartItems.length) {
      throw new Error("ไม่มีสินค้าในตะกร้า");
    }
    if (!storeData?.store.id) {
      throw new Error("ไม่พบข้อมูลร้านค้า");
    }

    const [storedDevice, storedCustomer] = await Promise.all([
      window.electronStore.get("pos_device"),
      window.electronStore.get("pos_selected_customer"),
    ]);
    const machineId = getStoredMachineId(storedDevice);
    const customerId = getStoredCustomerId(storedCustomer);
    if (!machineId) {
      throw new Error("ไม่พบ machine_id กรุณาลงทะเบียนเครื่อง POS ก่อน");
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = makeIdempotencyKey(storeData.store.id);
    }

    const payload: SaleRequestPayload = {
      idempotency_key: idempotencyKeyRef.current,
      machine_id: machineId,
      store_id: storeData.store.id,
      items: buildSaleItems(),
      payments,
      bill_discount_amount: toDecimalString(discount),
      note: "",
    };

    if (customerId != null) {
      payload.customer_id = customerId;
    }

    return payload;
  };

  const loadSaleReceipt = async (saleIdOrNo?: number | string | null): Promise<SaleReceipt | undefined> => {
    if (saleIdOrNo == null || !String(saleIdOrNo).trim()) return undefined;

    const response = await authorizedFetch(`/sales/${encodeURIComponent(String(saleIdOrNo))}/receipt`);
    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, `โหลดใบเสร็จไม่สำเร็จ (${response.status})`));
    }

    const payload = (await response.json().catch(() => ({}))) as ReceiptApiResponse;
    return payload.data?.receipt ?? payload.receipt ?? undefined;
  };

  const deleteHeldBillAfterSale = async (): Promise<void> => {
    if (heldBillId == null || !String(heldBillId).trim()) return;

    const response = await authorizedFetch(`/held-bills/${encodeURIComponent(String(heldBillId))}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, `ลบบิลที่พักหลังขายสำเร็จไม่สำเร็จ (${response.status})`));
    }
  };

  const withReceiptFallbacks = (
    receipt: SaleReceipt,
    saleNo?: string,
    saleId?: number | string,
  ): SaleReceipt => ({
    ...receipt,
    sale_no: receipt.sale_no || saleNo || String(saleId ?? ""),
    cashier_name: receipt.cashier_name ?? currentCashierName,
    machine_id: receipt.machine_id ?? currentMachineId,
    machine_name: receipt.machine_name ?? currentMachineName ?? currentMachineId,
  });

  const refreshSaleReceiptForDocument = async (): Promise<void> => {
    const saleIdOrNo = saleResult?.saleNo ?? saleResult?.id;
    if (saleIdOrNo == null || !String(saleIdOrNo).trim()) {
      throw new Error("ไม่พบเลขที่ใบเสร็จสำหรับโหลดข้อมูลล่าสุด");
    }

    const latestReceipt = await loadSaleReceipt(saleIdOrNo);
    if (!latestReceipt) {
      throw new Error("ไม่พบข้อมูลใบเสร็จล่าสุด");
    }

    const receiptWithFallbacks = withReceiptFallbacks(latestReceipt, saleResult?.saleNo, saleResult?.id);
    setSaleResult((current) => ({
      id: current?.id ?? receiptWithFallbacks.id,
      saleNo: receiptWithFallbacks.sale_no,
      receipt: receiptWithFallbacks,
    }));
    await waitForReceiptRender();
  };

  const submitSale = async (payments: SaleRequestPayment[], change: number) => {
    if (isSubmittingSale) return;
    setIsSubmittingSale(true);
    setPaymentError(null);

    try {
      const payload = await buildSalePayload(payments);
      const response = await authorizedFetch("/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, `บันทึกการขายไม่สำเร็จ (${response.status})`));
      }

      const data = (await response.json().catch(() => ({}))) as SaleApiResponse;
      const receipt = data.receipt ?? data.data?.receipt;
      const saleNo = data.sale_no ?? data.data?.sale_no ?? receipt?.sale_no;
      const saleId = data.id ?? data.data?.id ?? receipt?.id;
      let fullReceipt = receipt;
      try {
        fullReceipt = (await loadSaleReceipt(saleNo ?? saleId)) ?? receipt;
      } catch (receiptError) {
        console.warn("Load sale receipt after payment failed:", receiptError);
      }
      if (fullReceipt) {
        fullReceipt = withReceiptFallbacks(fullReceipt, saleNo, saleId);
      }
      await deleteHeldBillAfterSale();
      await window.electronStore.set("pos_selected_customer", null);
      setSelectedCustomer(null);
      setSaleResult({ id: saleId, saleNo: fullReceipt?.sale_no ?? saleNo, receipt: fullReceipt });
      showPopup(change);
    } catch (error) {
      showPaymentError(error instanceof Error ? error.message : "บันทึกการขายไม่สำเร็จ");
    } finally {
      setIsSubmittingSale(false);
    }
  };

  const buildCurrentReceipt = (): SaleReceipt => {
    if (saleResult?.receipt) return saleResult.receipt;
    const paidTotal = popupChange === null ? total : total + popupChange;
    const selectedPaymentName =
      activeTab === "cash"
        ? cashPaymentType?.paymentName || "เงินสด"
        : activeTab === "transfer"
          ? transferPaymentType?.paymentName || "โอนเงิน / พร้อมเพย์"
          : "โครงการรัฐ";

    return {
      id: "current-sale",
      sale_no: saleResult?.saleNo || String(saleResult?.id ?? "กำลังบันทึก"),
      sale_at: new Date().toISOString(),
      customer_name: storeData?.store.default_customer_name || "ลูกค้าทั่วไป",
      cashier_name: currentCashierName,
      machine_id: currentMachineId,
      machine_name: currentMachineName ?? currentMachineId,
      subtotal: subtotal.toFixed(2),
      item_discount_total: discount.toFixed(2),
      bill_discount_total: "0.00",
      promotion_discount_total: "0.00",
      tax_total: "0.00",
      total_amount: total.toFixed(2),
      paid_total: paidTotal.toFixed(2),
      change_amount: Math.max(popupChange ?? 0, 0).toFixed(2),
      status: "COMPLETED",
      items: cartItems.map((item) => {
        const quantity = Number(item.qty) || 0;
        const netAmount = getCartItemTotal(item);
        return {
          barcode_snapshot: item.barcode_snapshot || item.barcode || null,
          product_name_snapshot: getCartItemName(item),
          quantity: quantity.toFixed(2),
          unit_code_snapshot: item.unit_code || null,
          unit_name_snapshot: item.unit_name_snapshot || item.unit_name || "ชิ้น",
          unit_price: (Number(item.price) || 0).toFixed(2),
          discount_amount: String(item.discount_amount ?? item.discount ?? "0.00"),
          net_amount: netAmount.toFixed(2),
        };
      }),
      payments: [
        {
          payment_type_id: activeTab,
          payment_name: selectedPaymentName,
          amount: total.toFixed(2),
        },
      ],
    };
  };

  const getReceiptHtml = () => {
    const receiptElement = receiptDocumentRef.current;
    if (!receiptElement) {
      throw new Error("Receipt document is not ready");
    }

    return `<!doctype html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${saleResult?.saleNo || saleResult?.id || "Receipt"}</title>
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
    ${receiptElement.outerHTML}
  </body>
</html>`;
  };

  const getReceiptFilename = (extension: "pdf" | "jpg") => {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    return `receipt-${stamp}.${extension}`;
  };

  const waitForReceiptRender = () =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });

  const printReceiptAgain = async () => {
    setIsReceiptActionWorking(true);
    setReceiptActionMessage(null);
    try {
      await refreshSaleReceiptForDocument();
      await waitForReceiptRender();
      const html = getReceiptHtml();
      if (window.electronPrinter?.printHtml) {
        await window.electronPrinter.printHtml({ html });
      } else {
        window.print();
      }
      setReceiptActionMessage("ส่งพิมพ์ใบเสร็จแล้ว");
    } catch (error) {
      setReceiptActionMessage(error instanceof Error ? error.message : "พิมพ์ใบเสร็จไม่สำเร็จ");
    } finally {
      setIsReceiptActionWorking(false);
    }
  };

  const exportReceiptPdf = async () => {
    setIsReceiptActionWorking(true);
    setReceiptActionMessage(null);
    try {
      if (!window.electronPrinter?.exportPdf) {
        throw new Error("เครื่องนี้ยังไม่รองรับ Export PDF");
      }
      await refreshSaleReceiptForDocument();
      await waitForReceiptRender();
      const filePath = await window.electronPrinter.exportPdf({
        html: getReceiptHtml(),
        defaultPath: getReceiptFilename("pdf"),
      });
      setReceiptActionMessage(filePath ? `บันทึก PDF สำเร็จ: ${filePath}` : "ยกเลิกการบันทึก PDF");
    } catch (error) {
      setReceiptActionMessage(error instanceof Error ? error.message : "Export PDF ไม่สำเร็จ");
    } finally {
      setIsReceiptActionWorking(false);
    }
  };

  const exportReceiptJpeg = async () => {
    setIsReceiptActionWorking(true);
    setReceiptActionMessage(null);
    try {
      await refreshSaleReceiptForDocument();
      await waitForReceiptRender();
      if (!receiptDocumentRef.current) {
        throw new Error("Receipt document is not ready");
      }
      const dataUrl = await toJpeg(receiptDocumentRef.current, {
        quality: 0.95,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = getReceiptFilename("jpg");
      link.click();
      setReceiptActionMessage("Export JPEG สำเร็จ");
    } catch (error) {
      setReceiptActionMessage(error instanceof Error ? error.message : "Export JPEG ไม่สำเร็จ");
    } finally {
      setIsReceiptActionWorking(false);
    }
  };

  // ---------- cash payment ----------
  const processCashPayment = () => {
    if (isSubmittingSale) return;
    const received = parseFloat(cashInput);
    if (isNaN(received) || received < 0) {
      showPaymentError("กรุณากรอกจำนวนเงินที่ถูกต้อง");
      return;
    }
    if (received < total) {
      showPaymentError("จำนวนเงินไม่พอชำระ (ยอดรวม " + total.toFixed(2) + " บาท)");
      return;
    }
    const change = received - total;
    try {
      void submitSale([buildSinglePayment(cashPaymentType, received, "CASH")], change);
    } catch (error) {
      showPaymentError(error instanceof Error ? error.message : "บันทึกการขายไม่สำเร็จ");
    }
  };

  // ---------- transfer / gov payment ----------
  const processExactPayment = () => {
    if (isSubmittingSale) return;
    const paymentType =
      activeTab === "transfer" ? transferPaymentType : governmentPaymentTypes[0];
    const reference = paymentType?.paymentCode ?? activeTab.toUpperCase();
    try {
      void submitSale([buildSinglePayment(paymentType, total, reference)], 0);
    } catch (error) {
      showPaymentError(error instanceof Error ? error.message : "บันทึกการขายไม่สำเร็จ");
    }
  };

  // ---------- quick amount buttons ----------
  const handleQuickAmount = (amount: string) => {
    if (isSubmittingSale) return;
    setCashInput(amount);
    focusCashInput();
    
    // ✅ à¸„à¸³à¸™à¸§à¸“à¹à¸¥à¸°à¹à¸ªà¸”à¸‡ popup à¸—à¸±à¸™à¸—à¸µà¹€à¸¡à¸·à¹ˆà¸­à¸„à¸¥à¸´à¸à¸›ุ่ม quick cash
    const received = parseFloat(amount);
    if (!isNaN(received) && received >= total) {
      const change = received - total;
      try {
        void submitSale([buildSinglePayment(cashPaymentType, received, "CASH")], change);
      } catch (error) {
        showPaymentError(error instanceof Error ? error.message : "บันทึกการขายไม่สำเร็จ");
      }
    } else if (!isNaN(received) && received < total) {
      showPaymentError("จำนวนเงินไม่พอชำระ (ยอดรวม " + total.toFixed(2) + " บาท)");
    }
  };

  // ✅ Mixed payment functions
  const openSplitPopup = () => {
    setMixedPayments([{ id: "1", type: defaultMixedPaymentType, amount: total.toFixed(2) }]);
    setShowSplitPopup(true);
  };

  const closeSplitPopup = () => {
    setShowSplitPopup(false);
    focusCashInput(100);
  };

  // ✅ Add new payment line
  const addPaymentLine = () => {
    const newId = (Math.max(...mixedPayments.map(p => parseInt(p.id) || 0)) + 1).toString();
    setMixedPayments([...mixedPayments, { id: newId, type: defaultMixedPaymentType, amount: "0.00" }]);
  };

  // ✅ Remove payment line
  const removePaymentLine = (id: string) => {
    if (mixedPayments.length > 1) {
      setMixedPayments(mixedPayments.filter(p => p.id !== id));
    }
  };

  // ✅ Update payment line
  const updatePaymentLine = (id: string, field: keyof MixedPaymentLine, value: string) => {
    setMixedPayments(mixedPayments.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  // ✅ Calculate total from mixed payments
  const calculateMixedTotal = (): number => {
    return mixedPayments.reduce((sum, payment) => {
      const amount = parseFloat(payment.amount) || 0;
      return sum + amount;
    }, 0);
  };

  // ✅ Check if mixed payment is valid
  const isMixedPaymentValid = (): boolean => {
    const combined = calculateMixedTotal();
    return Math.abs(combined - total) < 0.01 && mixedPayments.every(p => parseFloat(p.amount) >= 0);
  };

  // ✅ Confirm mixed payment
  const confirmMixedPayment = () => {
    if (isSubmittingSale) return;
    if (!isMixedPaymentValid()) {
      alert("กรุณากรอกจำนวนเงินให้ครบถ้วน");
      return;
    }
    
    const change = calculateMixedTotal() - total;
    console.log("✅ Mixed Payment Confirmed:", {
      payments: mixedPayments,
      total: calculateMixedTotal(),
      change
    });
    
    try {
      const payments = mixedPayments.map((payment) => {
        const paymentTypeId = getPaymentTypeId(payment.type);
        if (!paymentTypeId) {
          throw new Error("ไม่พบประเภทการชำระเงิน กรุณาตรวจสอบการตั้งค่าวิธีชำระเงิน");
        }
        return {
          payment_type_id: paymentTypeId,
          amount: toDecimalString(payment.amount),
          reference_no: payment.reference?.trim() || payment.type,
        };
      });

      closeSplitPopup();
      void submitSale(payments, Math.abs(change) < 0.01 ? 0 : change);
    } catch (error) {
      showPaymentError(error instanceof Error ? error.message : "บันทึกการขายไม่สำเร็จ");
    }
  };

  // ✅ Generate QR for split bill transfer amount
  useEffect(() => {
    const generateSplitQr = async () => {
      const transferLine = mixedPayments.find((p) => isTransferPaymentCode(p.type));
      const transferAmt = parseFloat(transferLine?.amount || "0");
      
      if (!storeData?.payment_account?.promptpay_id || transferAmt <= 0) {
        setSplitQrDataUrl(null);
        return;
      }

      setSplitQrLoading(true);
      try {
        const dataUrl = await generatePromptPayQr(
          storeData.payment_account.promptpay_id,
          transferAmt,
          splitQrCanvasRef
        );
        setSplitQrDataUrl(dataUrl);
      } catch (error) {
        console.error("âŒ Split QR generation failed:", error);
        setSplitQrDataUrl(null);
      } finally {
        setSplitQrLoading(false);
      }
    };

    void generateSplitQr();
  }, [mixedPayments, storeData?.payment_account?.promptpay_id]);

  // ✅ Generate QR for transfer tab (full amount)
  useEffect(() => {
    const generateTransferQr = async () => {
      if (!storeData?.payment_account?.promptpay_id) {
        setTransferQrDataUrl(null);
        return;
      }

      try {
        const dataUrl = await generatePromptPayQr(
          storeData.payment_account.promptpay_id,
          total,
          transferQrCanvasRef
        );
        setTransferQrDataUrl(dataUrl);
      } catch (error) {
        console.error("âŒ Transfer QR generation failed:", error);
        setTransferQrDataUrl(null);
      }
    };

    if (activeTab === "transfer") {
      void generateTransferQr();
    }
  }, [activeTab, storeData?.payment_account?.promptpay_id, total]);

  // ✅ Load store settings - à¹ƒà¸Šà¹‰ /store/settings เหมือนเดิม
  useEffect(() => {
    let isMounted = true;

    const loadStoreSettings = async () => {
      try {
        const [savedApiPath, storedDevice, storedUser] = await Promise.all([
          window.electronStore?.get?.("apiPath"),
          window.electronStore?.get?.("pos_device"),
          window.electronStore?.get?.("user"),
        ]);
        if (isMounted && typeof savedApiPath === "string") {
          setApiBaseUrl(savedApiPath.trim().replace(/\/+$/, ""));
        }
        if (isMounted) {
          setCurrentMachineId(getStoredMachineId(storedDevice));
          setCurrentMachineName(getStoredDeviceName(storedDevice));
          setCurrentCashierName(getStoredCashierName(storedUser));
        }

        const response = await authorizedFetch("/store/settings");
        const payload = (await response.json().catch(() => ({}))) as {
          data?: StoreData;
          message?: string;
        };

        if (!response.ok) {
          throw new Error(payload.message || `Load store settings failed (${response.status})`);
        }

        if (isMounted) {
          setStoreData(payload.data ?? null);
          setStoreError(null);
        }
      } catch (error) {
        if (isMounted) {
          setStoreError(error instanceof Error ? error.message : "Load store settings failed");
        }
      }
    };

    void loadStoreSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadPaymentTypes = async () => {
      try {
        const response = await authorizedFetch("/payment-types");
        const payload = (await response.json().catch(() => ({}))) as unknown;

        if (!response.ok) {
          throw new Error(`Load payment types failed (${response.status})`);
        }

        if (isMounted) {
          setPaymentTypes(unwrapPaymentTypes(payload));
          setPaymentTypesError(null);
        }
      } catch (error) {
        if (isMounted) {
          setPaymentTypesError(error instanceof Error ? error.message : "Load payment types failed");
        }
      }
    };

    void loadPaymentTypes();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (displayPaymentTabs.length === 0 || displayPaymentTabs.some((tab) => tab.id === activeTab)) {
      return;
    }

    switchTab(displayPaymentTabs[0].id);
  }, [activeTab, displayPaymentTabs]);

  useEffect(() => {
    if (mixedPaymentOptions.length === 0) {
      return;
    }

    const activeCodes = new Set(mixedPaymentOptions.map((item) => item.paymentCode));
    setMixedPayments((current) => {
      let hasInvalidPaymentType = false;
      const nextPayments = current.map((payment) => {
        if (activeCodes.has(payment.type)) {
          return payment;
        }

        hasInvalidPaymentType = true;
        return { ...payment, type: defaultMixedPaymentType };
      });

      return hasInvalidPaymentType ? nextPayments : current;
    });
  }, [defaultMixedPaymentType, mixedPaymentOptions]);

  // ✅ Update cash input when total changes
  useEffect(() => {
    setCashInput(total.toFixed(2));
  }, [total]);

  // ✅ à¹‚à¸Ÿà¸à¸±à¸ªà¸—ี่ Input à¹€à¸‡à¸´à¸™à¸ªà¸”à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•ิเมื่อ component à¸–à¸¹à¸ mount
  useEffect(() => {
    focusCashInput(150);
  }, [focusCashInput]);

  useEffect(() => {
    let isCancelled = false;

    const restoreSelectedCustomer = async () => {
      const storedCustomer = await window.electronStore.get(SELECTED_POS_CUSTOMER_KEY);
      if (
        !isCancelled &&
        storedCustomer &&
        typeof storedCustomer === "object" &&
        "id" in storedCustomer
      ) {
        setSelectedCustomer(storedCustomer as PosCustomer);
      }
    };

    void restoreSelectedCustomer();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showCustomerPopup) {
      return;
    }

    const timer = window.setTimeout(() => {
      customerSearchRef.current?.focus();
      customerSearchRef.current?.select();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [showCustomerPopup]);

  // ✅ เมื่อ popup à¹€à¸›ิด à¹ƒà¸«à¹‰à¹‚à¸Ÿà¸à¸±à¸ªà¸—ี่ container เพื่อรับ event keyboard
  useEffect(() => {
    if (popupChange !== null) {
      setTimeout(() => {
        popupContainerRef.current?.focus();
      }, 50);
    }
  }, [popupChange]);

  useEffect(() => {
    if (paymentError !== null) {
      window.setTimeout(() => {
        paymentErrorButtonRef.current?.focus();
      }, 50);
    }
  }, [paymentError]);

  // ✅ Escape key handler
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      if (paymentError !== null) {
        closePaymentError();
        return;
      }
      if (showCustomerPopup) {
        closeCustomerPopup();
        return;
      }

      onBack?.();
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closePaymentError, onBack, paymentError, showCustomerPopup]);

  const mixedCombined = calculateMixedTotal();
  const mixedRemaining = total - mixedCombined;
  const quickCashAmounts = getQuickCashAmounts(total);
  const currentReceipt = buildCurrentReceipt();

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Sarabun', sans-serif" }}>
      {/* ---------- LEFT ORDER PANEL ---------- */}
      <div
        style={{
          width: 340,
          background: "var(--white, #fff)",
          borderRight: "1px solid var(--gray-300, #d7dee8)",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: selectedCustomer ? "24px 24px 30px" : "24px 24px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--gray-300, #d7dee8)",
            position: "relative",
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>ตั๋วออเดอร์</h1>
          {selectedCustomer ? (
            <div
              style={{
                position: "absolute",
                left: 24,
                bottom: 8,
                maxWidth: 210,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 700,
                color: "var(--blue-600, #1b4b8f)",
              }}
            >
              <span
                style={{
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {getCustomerName(selectedCustomer)}
              </span>
              <button
                type="button"
                onClick={clearSelectedCustomer}
                title="ล้างลูกค้า"
                aria-label="ล้างลูกค้า"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  border: "none",
                  background: "transparent",
                  color: "var(--blue-600, #1b4b8f)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={openCustomerPopup}
            title="เลือกลูกค้า"
            aria-label="เลือกลูกค้า"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "var(--blue-100, #e8f0fe)",
              color: "var(--blue-600, #1b4b8f)",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            +
          </button>
        </div>

        <div style={{ display: "none" }}>
          <div style={{ borderBottom: "1px dashed var(--gray-300, #d7dee8)", paddingBottom: 12, textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--ink, #0b1726)" }}>
              {storeData?.store.store_name || "ร้านค้า"}
            </div>
            {storeData?.store.receipt_header ? (
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--gray-500, #6b7785)" }}>
                {storeData.store.receipt_header}
              </div>
            ) : null}
            {storeData?.store.branch_name ? (
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--gray-500, #6b7785)" }}>
                {storeData.store.branch_name}
                {storeData.store.branch_no ? ` (${storeData.store.branch_no})` : ""}
              </div>
            ) : null}
            {storeData?.store.address ? (
              <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.45, color: "var(--gray-500, #6b7785)" }}>
                {storeData.store.address}
              </div>
            ) : null}
            {storeData?.store.phone ? (
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--gray-500, #6b7785)" }}>
                โทร. {storeData.store.phone}
              </div>
            ) : null}
            {storeData?.store.tax_id ? (
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--gray-500, #6b7785)" }}>
                เลขประจำตัวผู้เสียภาษี {storeData.store.tax_id}
              </div>
            ) : null}
            {storeError ? (
              <div style={{ marginTop: 8, fontSize: 11, color: "#dc2626" }}>
                {storeError}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "8px 24px 12px" }}>
          {cartItems.length ? (
            cartItems.map((item) => (
              <div
                key={`${item.id ?? getCartItemName(item)}-${getCartItemName(item)}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px dashed var(--gray-300, #d7dee8)",
                  fontSize: 14,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {getCartItemName(item)}
                  </span>
                  <span style={{ color: "var(--gray-500, #6b7785)", fontSize: 12 }}>
                    {formatBaht(Number(item.price) || 0)} x {Number(item.qty) || 0}
                  </span>
                </span>
                <span style={{ flexShrink: 0, fontFamily: "'Sarabun', sans-serif", fontWeight: 700 }}>
                  {formatBaht(getCartItemTotal(item))}
                </span>
              </div>
            ))
          ) : (
            <div style={{ padding: "24px 0", textAlign: "center", fontSize: 13, color: "var(--gray-500, #6b7785)" }}>
              ไม่มีรายการสินค้า
            </div>
          )}
        </div>

        <div style={{ flex: "0 0 auto", padding: "16px 24px 20px", borderTop: "1px solid var(--gray-300, #d7dee8)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--gray-500, #6b7785)", padding: "4px 0" }}>
            <span>ยอดรวมสินค้า</span>
            <span>{formatBaht(subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--gray-500, #6b7785)", padding: "4px 0" }}>
            <span>ส่วนลด</span>
            <span>{formatBaht(discount)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--gray-500, #6b7785)", padding: "4px 0" }}>
            <span>รายการ / จำนวนสินค้า</span>
            <span>{itemCount} รายการ / {totalQty} ชิ้น</span>
          </div>
          <div
            style={{
              marginTop: 10,
              paddingTop: 14,
              borderTop: "1px solid var(--gray-300, #d7dee8)",
              display: "flex",
              justifyContent: "space-between",
              fontSize: 16,
              fontWeight: 700,
              color: "var(--ink, #0b1726)",
            }}
          >
            <span>รวมทั้งหมด</span>
            <span style={{ fontFamily: "'Sarabun', sans-serif", fontSize: 18, color: "var(--blue-600, #1b4b8f)" }}>{formatBaht(total)}</span>
          </div>
        </div>
      </div>

      {/* ---------- RIGHT PAYMENT PANEL ---------- */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* top bar */}
        <div
          style={{
            background: "linear-gradient(135deg, var(--blue-700, #13315c), var(--blue-500, #2563eb))",
            color: "#fff",
            padding: "22px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "rgba(255,255,255,0.14)",
              border: "none",
              color: "#fff",
              fontSize: 18,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ←
          </button>
          <button
            type="button"
            onClick={openSplitPopup}
            style={{
              background: "rgba(255,255,255,0.14)",
              color: "#fff",
              border: "none",
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            แยกบิล
          </button>
        </div>

        {/* amount hero */}
        <div style={{ textAlign: "center", padding: "48px 0 28px" }}>
          <div style={{ fontSize: 16, letterSpacing: "0.04em", color: "var(--gray-500, #6b7785)", marginBottom: 6 }}>
            จำนวนเงินที่ต้องชำระ
          </div>
          <div style={{ fontFamily: "'Sarabun', sans-serif", fontSize: 76, fontWeight: 700, color: "var(--blue-700, #13315c)", lineHeight: 1 }}>
            {formatBaht(total)}
          </div>
        </div>

        {/* pay body */}
        <div style={{ flex: 1, maxWidth: 760, width: "100%", margin: "0 auto", padding: "0 32px 32px" }}>
          {/* tabs */}
          <div
            style={{
              display: "flex",
              gap: 10,
              background: "var(--blue-100, #e8f0fe)",
              padding: 6,
              borderRadius: 14,
              marginBottom: 28,
            }}
          >
            {displayPaymentTabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => switchTab(tab.id)}
                  style={{
                    flex: 1,
                    background: isActive ? "var(--white, #fff)" : "transparent",
                    color: isActive ? "var(--blue-700, #13315c)" : "var(--gray-500, #6b7785)",
                    border: "none",
                    borderRadius: 10,
                    padding: "12px 18px",
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  {renderPaymentTabIcon(tab)}
                  <span>{tab.label}</span>
              </button>
              );
            })}
          </div>
          {paymentTypesError ? (
            <div style={{ marginBottom: 16, color: "#b45309", fontSize: 12, textAlign: "center" }}>
              โหลดประเภทการชำระเงินไม่สำเร็จ แสดงค่าเริ่มต้นชั่วคราว
            </div>
          ) : null}

          {/* ---------- CASH TAB ---------- */}
          {activeTab === "cash" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--blue-600, #1b4b8f)", marginBottom: 14 }}>
                รับเงินสด
              </div>
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "var(--white, #fff)",
                    border: "1.5px solid var(--gray-300, #d7dee8)",
                    borderRadius: 14,
                    padding: "14px 16px",
                  }}
                >
                  <span style={{ color: "var(--gray-500, #6b7785)", fontSize: 18 }}>฿</span>
                  <input
                    ref={cashInputRef}
                    type="text"
                    value={cashInput}
                    onChange={(e) => setCashInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (isSubmittingSale) return;
                        processCashPayment();
                      }
                    }}
                    placeholder="0.00"
                    style={{
                      border: "none",
                      outline: "none",
                      fontFamily: "'Sarabun', sans-serif",
                      fontSize: 36,
                      fontWeight: 700,
                      width: "100%",
                      color: "var(--ink, #0b1726)",
                      background: "transparent",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: `repeat(${quickCashAmounts.length}, minmax(0, 1fr))`, gap: 8, marginBottom: 26 }}>
                {quickCashAmounts.map((amount) => (
                  <button
                    key={amount}
                    disabled={isSubmittingSale}
                    onClick={() => handleQuickAmount(amount.toFixed(2))}
                    style={{
                      background: "var(--blue-100, #e8f0fe)",
                      color: "var(--blue-600, #1b4b8f)",
                      border: "none",
                      borderRadius: 10,
                      padding: "12px 8px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: isSubmittingSale ? "not-allowed" : "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {formatBaht(amount)}
                  </button>
                ))}
              </div>

              <button
                onClick={processCashPayment}
                disabled={isSubmittingSale}
                style={{
                  width: "100%",
                  background: "var(--blue-600, #1b4b8f)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 16,
                  padding: 18,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                รับเงินสดและคำนวณเงินทอน
              </button>
            </div>
          )}

          {/* ---------- TRANSFER TAB ---------- */}
          {activeTab === "transfer" && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--blue-600, #1b4b8f)", marginBottom: 14 }}>
                {transferPaymentType?.paymentName.trim() || "โอนเงิน / PromptPay"}
              </div>

              {transferQrDataUrl ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 20,
                    padding: 16,
                    border: "1px solid var(--gray-300, #d7dee8)",
                    borderRadius: 14,
                    background: "var(--blue-50, #f0f5ff)",
                  }}
                >
                  <div
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 10,
                      overflow: "hidden",
                      flexShrink: 0,
                      background: "#fff",
                      border: "2px solid var(--gray-300, #d7dee8)",
                    }}
                  >
                    <img
                      src={transferQrDataUrl}
                      alt="PromptPay QR"
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                      {storeData?.payment_account.account_holder || storeData?.store.store_name || "ร้านค้า"}
                    </div>
                    <div style={{ fontSize: 16, color: "var(--gray-500, #6b7785)", marginBottom: 8 }}>
                      PromptPay: {storeData?.payment_account.promptpay_id || "-"}
                    </div>
                    <div style={{ fontFamily: "'Sarabun', sans-serif", fontSize: 18, fontWeight: 700, color: "var(--blue-700, #13315c)" }}>
                      {formatBaht(total)}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "32px 16px",
                    color: "var(--gray-500, #6b7785)",
                    fontSize: 16,
                  }}
                >
                  ⏳ กำลังสร้าง QR Code...
                </div>
              )}

              <div
                style={{
                  background: "var(--blue-50, #f0f5ff)",
                  borderRadius: 12,
                  padding: "12px 16px",
                  marginBottom: 18,
                  fontSize: 13,
                  color: "var(--blue-700, #13315c)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--blue-500, #2563eb)",
                    animation: "pulse 1.4s infinite",
                  }}
                />
                กำลังรอการชำระเงิน...
              </div>

              <button
                onClick={processExactPayment}
                disabled={isSubmittingSale}
                style={{
                  width: "100%",
                  background: "var(--blue-600, #1b4b8f)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 16,
                  padding: 18,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: isSubmittingSale ? "not-allowed" : "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                ยืนยันว่าได้รับเงินแล้ว
              </button>
            </div>
          )}

          {/* ---------- GOV TAB ---------- */}
          {activeTab === "gov" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--blue-600, #1b4b8f)", marginBottom: 10 }}>
                เลือกโครงการของรัฐ
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {governmentPaymentTypes.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      background: "var(--white, #fff)",
                      border: "1.5px solid var(--gray-300, #d7dee8)",
                      borderRadius: 14,
                      padding: "16px 20px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 11,
                        background: "var(--blue-100, #e8f0fe)",
                        color: "var(--blue-600, #1b4b8f)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 19,
                        flexShrink: 0,
                      }}
                    >
                      {getPaymentTypeIcon(item)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{item.paymentName}</div>
                      <div style={{ fontSize: 12, color: "var(--gray-500, #6b7785)", marginTop: 2 }}>
                        {item.description || item.paymentNameEn || "ชำระผ่านโครงการรัฐ"}
                      </div>
                    </div>
                    <div style={{ color: "var(--gray-300, #d7dee8)", fontSize: 18 }}>{">"}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 24 }}>
                <button
                  onClick={processExactPayment}
                  disabled={isSubmittingSale}
                  style={{
                    width: "100%",
                    background: "var(--blue-600, #1b4b8f)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 16,
                    padding: 18,
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: isSubmittingSale ? "not-allowed" : "pointer",
                    transition: "background 0.15s ease",
                  }}
                >
                  ดำเนินการต่อ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ✅ MIXED PAYMENT POPUP - Click outside does NOT close */}
      {showSplitPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              background: "var(--white, #fff)",
              borderRadius: 24,
              padding: "32px 36px",
              width: "100%",
              maxWidth: 500,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              animation: "popFade 0.25s ease",
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--gray-200, #e5e7eb)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink, #0b1726)", margin: 0 }}>
                  แยกบิล / ชำระแบบผสม
                </h3>
                <button
                  onClick={closeSplitPopup}
                  style={{
                    background: "var(--blue-100, #e8f0fe)",
                    border: "none",
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    fontSize: 16,
                    cursor: "pointer",
                    color: "var(--blue-700, #13315c)",
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ fontSize: 13, color: "var(--gray-500, #6b7785)" }}>
                เลือกวิธีชำระเงินและจำนวนสำหรับแต่ละวิธี
              </div>
            </div>

            {/* Total Amount */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "var(--gray-500, #6b7785)" }}>ยอดที่ต้องชำระทั้งหมด</div>
              <div style={{ fontFamily: "'Sarabun', sans-serif", fontSize: 32, fontWeight: 700, color: "var(--blue-700, #13315c)" }}>
                {formatBaht(total)}
              </div>
            </div>

            {/* Payment Lines */}
            <div style={{ marginBottom: 20 }}>
              {mixedPayments.map((payment) => (
                <div
                  key={payment.id}
                  style={{
                    background: "var(--gray-50, #f9fafb)",
                    border: "1px solid var(--gray-200, #e5e7eb)",
                    borderRadius: 12,
                    padding: "14px",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                    <select
                      value={payment.type}
                      onChange={(e) => updatePaymentLine(payment.id, "type", e.target.value as PaymentMethodType)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        border: "1px solid var(--gray-300, #d7dee8)",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--ink, #0b1726)",
                        background: "var(--white, #fff)",
                        cursor: "pointer",
                      }}
                    >
                      {mixedPaymentOptions.map((paymentType) => (
                        <option key={paymentType.id} value={paymentType.paymentCode}>
                          {getPaymentTypeIcon(paymentType)} {paymentType.paymentName.trim()}
                        </option>
                      ))}
                    </select>

                    {mixedPayments.length > 1 && (
                      <button
                        onClick={() => removePaymentLine(payment.id)}
                        style={{
                          background: "#fee2e2",
                          border: "1px solid #fca5a5",
                          borderRadius: 8,
                          padding: "6px 8px",
                          fontSize: 16,
                          cursor: "pointer",
                          color: "#dc2626",
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: "var(--white, #fff)",
                      border: "1.5px solid var(--gray-300, #d7dee8)",
                      borderRadius: 8,
                      padding: "8px 12px",
                    }}
                  >
                    <span style={{ color: "var(--gray-500, #6b7785)", fontWeight: 600 }}>฿</span>
                    <input
                      type="text"
                      value={payment.amount}
                      onChange={(e) => updatePaymentLine(payment.id, "amount", e.target.value)}
                      placeholder="0.00"
                      style={{
                        border: "none",
                        outline: "none",
                        fontFamily: "'Sarabun', sans-serif",
                        fontSize: 16,
                        fontWeight: 700,
                        width: "100%",
                        color: "var(--ink, #0b1726)",
                        background: "transparent",
                      }}
                    />
                  </div>

                  {/* ✅ Show QR Code for transfer method */}
                  {isTransferPaymentCode(payment.type) && parseFloat(payment.amount) > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        marginTop: 10,
                        padding: 12,
                        border: "1px solid var(--gray-300, #d7dee8)",
                        borderRadius: 10,
                        background: "var(--blue-50, #f0f5ff)",
                      }}
                    >
                      <div
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 8,
                          overflow: "hidden",
                          flexShrink: 0,
                          background: "#fff",
                          border: "1px solid var(--gray-300, #d7dee8)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {splitQrLoading ? (
                          <span style={{ fontSize: 12, color: "var(--gray-500, #6b7785)" }}>⏳</span>
                        ) : splitQrDataUrl ? (
                          <img
                            src={splitQrDataUrl}
                            alt="PromptPay QR"
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        ) : null}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>
                          {storeData?.payment_account.account_holder || storeData?.store.store_name || "ร้านค้า"}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--gray-500, #6b7785)" }}>
                          PromptPay: {storeData?.payment_account.promptpay_id || "-"}
                        </div>
                        <div style={{ fontFamily: "'Sarabun', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--blue-700, #13315c)", marginTop: 2 }}>
                          {formatBaht(parseFloat(payment.amount) || 0)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add Payment Line Button */}
            <button
              onClick={addPaymentLine}
              style={{
                width: "100%",
                background: "var(--gray-100, #f3f4f6)",
                border: "2px dashed var(--blue-600, #1b4b8f)",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--blue-600, #1b4b8f)",
                cursor: "pointer",
                marginBottom: 20,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.background = "var(--blue-50, #f0f5ff)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.background = "var(--gray-100, #f3f4f6)";
              }}
            >
              ＋ เพิ่มวิธีชำระเงิน
            </button>

            {/* Summary */}
            <div
              style={{
                background: "var(--blue-100, #e8f0fe)",
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 20,
                fontSize: 13,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "var(--blue-700, #13315c)" }}>
                <span>ยอดรวมที่กรอก</span>
                <span style={{ fontWeight: 700 }}>{formatBaht(mixedCombined)}</span>
              </div>
              {Math.abs(mixedRemaining) > 0.004 ? (
                mixedRemaining > 0 ? (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#dc2626" }}>
                    <span>ยังขาดอีก</span>
                    <span style={{ fontWeight: 700 }}>{formatBaht(mixedRemaining)}</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#16a34a" }}>
                    <span>เงินทอน</span>
                    <span style={{ fontWeight: 700 }}>{formatBaht(-mixedRemaining)}</span>
                  </div>
                )
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#16a34a" }}>
                  <span>✓ จำนวนเงินถูกต้อง</span>
                </div>
              )}
            </div>

            {/* Confirm Button */}
            <button
              onClick={confirmMixedPayment}
              disabled={!isMixedPaymentValid() || isSubmittingSale}
              style={{
                width: "100%",
                background: isMixedPaymentValid() ? "var(--blue-600, #1b4b8f)" : "var(--gray-300, #d7dee8)",
                color: "#fff",
                border: "none",
                borderRadius: 14,
                padding: 16,
                fontSize: 15,
                fontWeight: 700,
                cursor: isMixedPaymentValid() && !isSubmittingSale ? "pointer" : "not-allowed",
                transition: "background 0.15s ease",
              }}
            >
              ✓ ยืนยันการชำระเงินแบบผสม
            </button>
          </div>
        </div>
      )}

      {showCustomerPopup ? (
        <CustomerPickerPopup
          searchInputRef={customerSearchRef}
          searchQuery={customerSearchQuery}
          onSearchQueryChange={setCustomerSearchQuery}
          customers={[]}
          selectedCustomer={selectedCustomer}
          isLoading={false}
          error={null}
          onClose={closeCustomerPopup}
          onRefresh={() => undefined}
          onSelectCustomer={selectCustomer}
        />
      ) : null}

      {paymentError !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") {
              e.preventDefault();
              closePaymentError();
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="payment-error-title"
            aria-describedby="payment-error-message"
            style={{
              background: "var(--white, #fff)",
              border: "1px solid var(--gray-300, #d7dee8)",
              borderRadius: 12,
              boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
              width: "min(360px, calc(100vw - 32px))",
              overflow: "hidden",
            }}
          >
            <div
              id="payment-error-title"
              style={{
                padding: "10px 14px",
                fontSize: 13,
                color: "var(--ink, #0b1726)",
                background: "var(--gray-100, #f3f4f6)",
                borderBottom: "1px solid var(--gray-300, #d7dee8)",
              }}
            >
              AVAPOS
            </div>
            <div
              id="payment-error-message"
              style={{
                padding: "28px 16px",
                fontSize: 13,
                color: "var(--ink, #0b1726)",
                lineHeight: 1.55,
              }}
            >
              {paymentError}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "10px 12px",
                background: "var(--gray-50, #f9fafb)",
                borderTop: "1px solid var(--gray-200, #e5e7eb)",
              }}
            >
              <button
                ref={paymentErrorButtonRef}
                type="button"
                onClick={closePaymentError}
                style={{
                  minWidth: 72,
                  border: "1px solid var(--blue-600, #1b4b8f)",
                  borderRadius: 6,
                  background: "var(--white, #fff)",
                  color: "var(--ink, #0b1726)",
                  padding: "5px 16px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- PAYMENT SUCCESS POPUP - Click outside does NOT close, press Enter to close ---------- */}
      {popupChange !== null && (
        <div
          ref={popupContainerRef}
          tabIndex={-1}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (isSubmittingSale) return;
              confirmSuccessfulPayment();
            }
          }}
        >
          <div
            style={{
              background: "var(--white, #fff)",
              padding: "40px 48px 36px",
              borderRadius: 28,
              maxWidth: 460,
              width: "90%",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              animation: "popFade 0.25s ease",
            }}
          >
            <div style={{ fontSize: 54, marginBottom: 8 }}>🧾</div>
            <h2 style={{ fontSize: 22, color: "var(--ink, #0b1726)", marginBottom: 12 }}>ชำระเงินสำเร็จ</h2>
            {popupChange > 0 ? (
              <>
                <div style={{ color: "var(--gray-500, #6b7785)", fontSize: 16, marginBottom: 22 }}>เงินทอน</div>
                <div
                  style={{
                    fontFamily: "'Sarabun', sans-serif",
                    fontSize: 62,
                    fontWeight: 700,
                    color: "#16a34a",
                    margin: "12px 0 18px",
                  }}
                >
                  ฿{popupChange.toFixed(2)}
                </div>
              </>
            ) : (
              <div
                style={{
                  fontFamily: "'Sarabun', sans-serif",
                  fontSize: 62,
                  fontWeight: 700,
                  color: "#16a34a",
                  margin: "12px 0 18px",
                }}
              >
                ✓
              </div>
            )}
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--gray-500, #6b7785)" }}>ยอดรวม {formatBaht(total)}</div>
            {saleResult?.saleNo || saleResult?.id ? (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: "var(--gray-500, #6b7785)",
                  fontFamily: "'Sarabun', sans-serif",
                }}
              >
                เลขที่บิล:{" "}
                <span style={{ color: "var(--blue-700, #174ea6)", fontWeight: 700 }}>
                  {saleResult.saleNo || saleResult.id}
                </span>
              </div>
            ) : null}

            {receiptActionMessage ? (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  color: "#1d4ed8",
                  fontSize: 12,
                  lineHeight: 1.45,
                  wordBreak: "break-word",
                }}
              >
                {receiptActionMessage}
              </div>
            ) : null}

            {showReceiptExportOptions ? (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  border: "1px solid var(--gray-300, #d7dee8)",
                  borderRadius: 14,
                  background: "var(--gray-50, #f8fafc)",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    type="button"
                    disabled={isReceiptActionWorking}
                    onClick={() => void exportReceiptPdf()}
                    style={{
                      border: "1px solid #cfe0f7",
                      borderRadius: 10,
                      padding: "10px 12px",
                      background: "#fff",
                      color: "var(--blue-700, #174ea6)",
                      fontWeight: 700,
                      cursor: isReceiptActionWorking ? "not-allowed" : "pointer",
                    }}
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    disabled={isReceiptActionWorking}
                    onClick={() => void exportReceiptJpeg()}
                    style={{
                      border: "1px solid #cfe0f7",
                      borderRadius: 10,
                      padding: "10px 12px",
                      background: "#fff",
                      color: "var(--blue-700, #174ea6)",
                      fontWeight: 700,
                      cursor: isReceiptActionWorking ? "not-allowed" : "pointer",
                    }}
                  >
                    JPEG
                  </button>
                </div>
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
              <button
                type="button"
                disabled={isReceiptActionWorking}
                onClick={() => void printReceiptAgain()}
                style={{
                  background: "#fff",
                  color: "var(--blue-700, #174ea6)",
                  border: "1px solid #cfe0f7",
                  borderRadius: 14,
                  padding: "12px 14px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: isReceiptActionWorking ? "not-allowed" : "pointer",
                }}
              >
                พิมพ์ใบเสร็จอีกครั้ง
              </button>
              <button
                type="button"
                onClick={() => setShowReceiptExportOptions((visible) => !visible)}
                style={{
                  background: "#fff",
                  color: "var(--blue-700, #174ea6)",
                  border: "1px solid #cfe0f7",
                  borderRadius: 14,
                  padding: "12px 14px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: isSubmittingSale ? "not-allowed" : "pointer",
                }}
              >
                Export
              </button>
            </div>

            <br />
            <button
              type="button"
              onClick={confirmSuccessfulPayment}
              style={{
                background: "var(--blue-600, #1b4b8f)",
                color: "#fff",
                border: "none",
                borderRadius: 14,
                padding: "14px 38px",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
            >
              บันทึก
            </button>
          </div>
        </div>
      )}

      {popupChange !== null ? (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: -10000,
            top: 0,
            width: 1,
            height: 1,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <ReceiptDocument
            ref={receiptDocumentRef}
            receipt={currentReceipt}
            storeSettings={storeData?.store ?? null}
            paymentAccount={storeData?.payment_account ?? null}
            paperSize={receiptPaperSize}
            mode="export"
            apiBaseUrl={apiBaseUrl}
          />
        </div>
      ) : null}

      {/* ✅ Hidden Canvas Elements for QR Generation */}
      <canvas ref={splitQrCanvasRef} style={{ display: "none" }} />
      <canvas ref={transferQrCanvasRef} style={{ display: "none" }} />

      {/* inject keyframes for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes popFade {
          0% { transform: scale(0.94); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default POSPayment;
