import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  IconBarcode,
  IconChevronDown,
  IconDeviceFloppy,
  IconPrinter,
  IconRefresh,
  IconReceipt,
} from "@tabler/icons-react";
import { ensureValidAccessToken, refreshAccessToken } from "./auth";

const API_PATH_KEY = "apiPath";
const POS_DEVICE_KEY = "pos_device";
const ACCESS_TOKEN_KEY = "access_token";

interface PrinterDriver {
  name: string;
  displayName: string;
  description: string;
  options: Record<string, unknown>;
}

interface PosDevice {
  id?: number;
  device_id?: number;
  machine_id?: string;
  device_name?: string;
  printer_name?: string;
  printer_type?: string;
  printer_a4_name?: string;
  printer_slip?: string;
  printer_slip_name?: string;
  paper_slip_size?: string;
  printer_slip_paper_size?: string;
  pos_device?: PosDevice;
  [key: string]: unknown;
}

type BarcodeCodeType = "CODE128" | "QRCODE";

interface BarcodePrintSetting {
  machine_id?: string;
  printer_name?: string;
  paper_size?: string;
  barcode_format?: BarcodeCodeType;
  code_type?: BarcodeCodeType;
  barcode_type?: BarcodeCodeType;
  items_per_row?: number;
  labels_per_row?: number;
  label_count?: number;
  show_name?: boolean;
  show_product_name?: boolean;
  show_price?: boolean;
  [key: string]: unknown;
}

interface PosMachineSetting {
  id?: number;
  machineId?: string;
  machine_id?: string;
  a4PrinterName?: string | null;
  a4_printer_name?: string | null;
  a4Copies?: number;
  a4_copies?: number;
  receiptPrinterName?: string | null;
  receipt_printer_name?: string | null;
  receiptPaperSize?: string | null;
  receipt_paper_size?: string | null;
  receiptFontSize?: number;
  receipt_font_size?: number;
  receiptFontFamily?: string | null;
  receipt_font_family?: string | null;
  receiptCopies?: number;
  receipt_copies?: number;
  autoPrintReceipt?: boolean;
  auto_print_receipt?: boolean;
  autoOpenCashDrawer?: boolean;
  auto_open_cash_drawer?: boolean;
  labelPrinterName?: string | null;
  label_printer_name?: string | null;
  labelWidthMm?: number;
  label_width_mm?: number;
  labelHeightMm?: number;
  label_height_mm?: number;
  customerDisplayEnabled?: boolean;
  customer_display_enabled?: boolean;
  customerDisplayMonitor?: string | null;
  customer_display_monitor?: string | null;
  barcodeScannerEnabled?: boolean;
  barcode_scanner_enabled?: boolean;
  allowBelowCost?: boolean;
  allow_below_cost?: boolean;
  minProfitAmount?: string | number;
  min_profit_amount?: string | number;
  requireManagerApproval?: boolean;
  require_manager_approval?: boolean;
  managerPinRequired?: boolean;
  manager_pin_required?: boolean;
  language?: string;
  theme?: string;
  [key: string]: unknown;
}

interface PosMachineSettingPayload {
  receipt_printer_name: string;
  receipt_paper_size: string;
  receipt_font_size: number;
  receipt_font_family: string;
  receipt_copies: number;
  auto_print_receipt: boolean;
  auto_open_cash_drawer: boolean;
  a4_printer_name: string;
  a4_copies: number;
  label_printer_name: string | null;
  label_width_mm: number;
  label_height_mm: number;
  customer_display_enabled: boolean;
  customer_display_monitor: string | null;
  barcode_scanner_enabled: boolean;
  allow_below_cost: boolean;
  min_profit_amount: number;
  require_manager_approval: boolean;
  manager_pin_required: boolean;
  language: string;
  theme: string;
}

type SaveTarget = "a4" | "slip" | "barcode";

const slipPaperSizes = [
  { value: "55mm", label: "55 mm" },
  { value: "80x80mm", label: "80 mm (80 x 80 มม.)" },
  { value: "58x50mm", label: "58 mm (57 x 50 มม.)" },
];

const barcodePaperSizes = [
  { value: "30x20mm", label: "30 x 20 มม." },
  { value: "40x30mm", label: "40 x 30 มม." },
  { value: "50x30mm", label: "50 x 30 มม." },
  { value: "60x40mm", label: "60 x 40 มม." },
  { value: "a4", label: "A4" },
];

const barcodeCodeTypes: { value: BarcodeCodeType; label: string; hint: string }[] = [
  {
    value: "CODE128",
    label: "Code 128",
    hint: "เหมาะสำหรับฉลากสินค้าและเครื่องอ่านบาร์โค้ด",
  },
  {
    value: "QRCODE",
    label: "QR Code",
    hint: "เหมาะสำหรับข้อมูลที่ต้องการพื้นที่เก็บมากขึ้น",
  },
];

const barcodeLabelCounts = [1, 2, 3, 4, 5, 6];

const normalizeApiBase = (value: string): string => value.trim().replace(/\/+$/, "");

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const getStoredDevice = (value: unknown): PosDevice | null => {
  if (!value || typeof value !== "object") return null;
  const device = value as PosDevice;
  return device.machine_id ? device : device.pos_device ?? null;
};

const updateStoredA4PrinterName = (
  value: unknown,
  currentMachineId: string,
  printerName: string,
): PosDevice => {
  if (value && typeof value === "object") {
    const storedDevice = value as PosDevice;
    if (storedDevice.pos_device) {
      return {
        ...storedDevice,
        pos_device: {
          ...storedDevice.pos_device,
          printer_name: printerName,
        },
      };
    }

    return {
      ...storedDevice,
      printer_name: printerName,
    };
  }

  return {
    machine_id: currentMachineId,
    printer_name: printerName,
  };
};

const updateStoredSlipPrinter = (
  value: unknown,
  currentMachineId: string,
  printerName: string,
  paperSize: string,
): PosDevice => {
  const slipFields = {
    printer_slip: printerName,
    printer_slip_name: printerName,
    paper_slip_size: paperSize,
    printer_slip_paper_size: paperSize,
  };

  if (value && typeof value === "object") {
    const storedDevice = value as PosDevice;
    if (storedDevice.pos_device) {
      return {
        ...storedDevice,
        pos_device: {
          ...storedDevice.pos_device,
          ...slipFields,
        },
      };
    }

    return {
      ...storedDevice,
      ...slipFields,
    };
  }

  return {
    machine_id: currentMachineId,
    ...slipFields,
  };
};

const unwrapObject = <T,>(payload: unknown): T | null => {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as { data?: unknown; setting?: unknown; barcode_print_setting?: unknown };
  return ((value.data || value.setting || value.barcode_print_setting || value) as T) ?? null;
};

const getSlipPrinterName = (posDevice?: PosDevice | null): string =>
  String(posDevice?.printer_slip || posDevice?.printer_slip_name || "");

const getSlipPaperSize = (posDevice?: PosDevice | null): string =>
  String(posDevice?.paper_slip_size || posDevice?.printer_slip_paper_size || "");

const getBarcodePaperSizeLabel = (value: string): string =>
  barcodePaperSizes.find((size) => size.value === value)?.label || value;

const getBarcodeCodeTypeLabel = (value: string): string =>
  barcodeCodeTypes.find((type) => type.value === value)?.label || value;

const getStringValue = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim() ? value : fallback;

const getNumberValue = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const getBooleanValue = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const getNullableStringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

const buildPosMachineSettingPayload = ({
  setting,
  selectedA4Printer,
  selectedSlipPrinter,
  selectedSlipPaperSize,
}: {
  setting: PosMachineSetting | null;
  selectedA4Printer: string;
  selectedSlipPrinter: string;
  selectedSlipPaperSize: string;
}): PosMachineSettingPayload => ({
  receipt_printer_name: selectedSlipPrinter,
  receipt_paper_size: selectedSlipPaperSize,
  receipt_font_size: getNumberValue(
    setting?.receipt_font_size ?? setting?.receiptFontSize,
    14,
  ),
  receipt_font_family: getStringValue(
    setting?.receipt_font_family ?? setting?.receiptFontFamily,
    "TH Sarabun New",
  ),
  receipt_copies: getNumberValue(setting?.receipt_copies ?? setting?.receiptCopies, 1),
  auto_print_receipt: getBooleanValue(
    setting?.auto_print_receipt ?? setting?.autoPrintReceipt,
    true,
  ),
  auto_open_cash_drawer: getBooleanValue(
    setting?.auto_open_cash_drawer ?? setting?.autoOpenCashDrawer,
    true,
  ),
  a4_printer_name: selectedA4Printer,
  a4_copies: getNumberValue(setting?.a4_copies ?? setting?.a4Copies, 1),
  label_printer_name: getNullableStringValue(
    setting?.label_printer_name ?? setting?.labelPrinterName,
  ),
  label_width_mm: getNumberValue(setting?.label_width_mm ?? setting?.labelWidthMm, 50),
  label_height_mm: getNumberValue(setting?.label_height_mm ?? setting?.labelHeightMm, 30),
  customer_display_enabled: getBooleanValue(
    setting?.customer_display_enabled ?? setting?.customerDisplayEnabled,
    false,
  ),
  customer_display_monitor: getNullableStringValue(
    setting?.customer_display_monitor ?? setting?.customerDisplayMonitor,
  ),
  barcode_scanner_enabled: getBooleanValue(
    setting?.barcode_scanner_enabled ?? setting?.barcodeScannerEnabled,
    true,
  ),
  allow_below_cost: getBooleanValue(setting?.allow_below_cost ?? setting?.allowBelowCost, true),
  min_profit_amount: getNumberValue(setting?.min_profit_amount ?? setting?.minProfitAmount, 1),
  require_manager_approval: getBooleanValue(
    setting?.require_manager_approval ?? setting?.requireManagerApproval,
    true,
  ),
  manager_pin_required: getBooleanValue(
    setting?.manager_pin_required ?? setting?.managerPinRequired,
    true,
  ),
  language: getStringValue(setting?.language, "th"),
  theme: getStringValue(setting?.theme, "light"),
});

const hasA4MachineSettingData = (payload: unknown): payload is PosMachineSetting => {
  if (!payload || typeof payload !== "object") return false;

  const value = payload as PosMachineSetting & {
    status?: string;
    success?: boolean;
  };

  if (value.success === false) return false;
  if (typeof value.status === "string" && ["not_found", "error", "fail"].includes(value.status.toLowerCase())) {
    return false;
  }

  return Boolean(
    value.id ||
      value.machineId ||
      value.machine_id ||
      value.a4PrinterName ||
      value.a4_printer_name ||
      value.receiptPrinterName ||
      value.receipt_printer_name ||
      value.receiptPaperSize ||
      value.receipt_paper_size,
  );
};

const readA4MachineSettingResponse = async (
  response: Response,
): Promise<PosMachineSetting | null> => {
  const payload = await response.json().catch(() => null);
  const setting = unwrapObject<PosMachineSetting>(payload);
  return hasA4MachineSettingData(setting) ? setting : null;
};

const hasBarcodeSettingData = (payload: unknown): payload is BarcodePrintSetting => {
  if (!payload || typeof payload !== "object") return false;

  const value = payload as BarcodePrintSetting & {
    status?: string;
    success?: boolean;
    message?: string;
  };

  if (value.success === false) return false;
  if (typeof value.status === "string" && ["not_found", "error", "fail"].includes(value.status.toLowerCase())) {
    return false;
  }

  return Boolean(
    value.machine_id ||
      value.printer_name ||
      value.paper_size ||
      value.barcode_format ||
      value.code_type ||
      value.barcode_type ||
      value.items_per_row ||
      value.labels_per_row ||
      value.label_count ||
      "show_name" in value ||
      "show_product_name" in value ||
      "show_price" in value,
  );
};

const readBarcodeSettingResponse = async (
  response: Response,
): Promise<BarcodePrintSetting | null> => {
  const payload = await response.json().catch(() => null);
  const setting = unwrapObject<BarcodePrintSetting>(payload);
  return hasBarcodeSettingData(setting) ? setting : null;
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

export default function PrinterSetting() {
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [machineId, setMachineId] = useState("");
  const [device, setDevice] = useState<PosDevice | null>(null);
  const [printers, setPrinters] = useState<PrinterDriver[]>([]);
  const [a4Printer, setA4Printer] = useState("");
  const [currentA4Printer, setCurrentA4Printer] = useState("");
  const [a4SettingExists, setA4SettingExists] = useState(false);
  const [a4MachineSetting, setA4MachineSetting] = useState<PosMachineSetting | null>(null);
  const [slipPrinter, setSlipPrinter] = useState("");
  const [slipPaperSize, setSlipPaperSize] = useState(slipPaperSizes[1].value);
  const [currentSlipPrinter, setCurrentSlipPrinter] = useState("");
  const [currentSlipPaperSize, setCurrentSlipPaperSize] = useState("");
  const [barcodePrinter, setBarcodePrinter] = useState("");
  const [currentBarcodePrinter, setCurrentBarcodePrinter] = useState("");
  const [currentBarcodePaperSize, setCurrentBarcodePaperSize] = useState("");
  const [currentBarcodeCodeType, setCurrentBarcodeCodeType] = useState("");
  const [currentBarcodeLabelCount, setCurrentBarcodeLabelCount] = useState<number | null>(null);
  const [barcodePaperSize, setBarcodePaperSize] = useState(barcodePaperSizes[1].value);
  const [barcodeCodeType, setBarcodeCodeType] = useState<BarcodeCodeType>("CODE128");
  const [barcodeLabelCount, setBarcodeLabelCount] = useState(2);
  const [barcodeShowName, setBarcodeShowName] = useState(true);
  const [barcodeShowPrice, setBarcodeShowPrice] = useState(true);
  const [barcodeSettingExists, setBarcodeSettingExists] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingPrinters, setIsRefreshingPrinters] = useState(false);
  const [savingTarget, setSavingTarget] = useState<SaveTarget | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const printerOptions = useMemo(
    () =>
      printers.map((printer) => ({
        value: printer.name,
        label: printer.displayName || printer.name,
      })),
    [printers],
  );

  const loadPrinters = async () => {
    setIsRefreshingPrinters(true);
    try {
      if (!window.electronPrinter?.getPrinters) {
        setPrinters([]);
        return [];
      }

      const drivers = await window.electronPrinter.getPrinters();
      setPrinters(drivers);
      return drivers;
    } catch (err) {
      console.error("Error loading printer drivers:", err);
      setPrinters([]);
      return [];
    } finally {
      setIsRefreshingPrinters(false);
    }
  };

  const getAccessToken = async (): Promise<string> => {
    if (!(await ensureValidAccessToken())) {
      throw new Error("ไม่สามารถยืนยันตัวตนได้ กรุณาเข้าสู่ระบบใหม่");
    }

    const token = await window.electronStore.get(ACCESS_TOKEN_KEY);
    if (typeof token !== "string" || !token.trim()) {
      throw new Error("ไม่พบ access token");
    }

    return token;
  };

  const requestBarcodeSetting = async (
    token: string,
    init?: RequestInit,
  ): Promise<Response> =>
    fetch(`${apiBaseUrl}/barcode-print-settings/machine/${encodeURIComponent(machineId)}`, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

  const requestA4MachineSetting = async (
    token: string,
    init?: RequestInit,
  ): Promise<Response> =>
    fetch(`${apiBaseUrl}/pos-machine-settings/machine/${encodeURIComponent(machineId)}`, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

  const loadA4MachineSetting = async (
    baseUrl: string,
    currentMachineId: string,
  ): Promise<void> => {
    if (!(await ensureValidAccessToken())) return;

    let token = await window.electronStore.get(ACCESS_TOKEN_KEY);
    if (typeof token !== "string" || !token.trim()) return;

    const endpoint = `${baseUrl}/pos-machine-settings/machine/${encodeURIComponent(currentMachineId)}`;
    let response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      token = await refreshAccessToken();
      response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    if (response.status === 404) {
      setA4SettingExists(false);
      setA4MachineSetting(null);
      setCurrentA4Printer("");
      setA4Printer("");
      setCurrentSlipPrinter("");
      setCurrentSlipPaperSize("");
      return;
    }

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, `โหลดค่า Printer A4 ไม่สำเร็จ (${response.status})`));
    }

    const setting = await readA4MachineSettingResponse(response);
    if (!setting) {
      setA4SettingExists(false);
      setA4MachineSetting(null);
      setCurrentA4Printer("");
      setA4Printer("");
      setCurrentSlipPrinter("");
      setCurrentSlipPaperSize("");
      return;
    }

    const printerName = setting.a4_printer_name || setting.a4PrinterName || "";
    const receiptPrinterName = setting.receipt_printer_name || setting.receiptPrinterName || "";
    const receiptPaperSize = setting.receipt_paper_size || setting.receiptPaperSize || "";
    setA4SettingExists(true);
    setA4MachineSetting(setting);
    setCurrentA4Printer(printerName);
    setA4Printer(printerName);
    setCurrentSlipPrinter(receiptPrinterName);
    setCurrentSlipPaperSize(receiptPaperSize);
    setSlipPrinter(receiptPrinterName);
    setSlipPaperSize(receiptPaperSize || slipPaperSizes[1].value);
  };

  const loadBarcodeSetting = async (baseUrl: string, currentMachineId: string) => {
    if (!(await ensureValidAccessToken())) return;

    let token = await window.electronStore.get(ACCESS_TOKEN_KEY);
    if (typeof token !== "string" || !token.trim()) return;

    const endpoint = `${baseUrl}/barcode-print-settings/machine/${encodeURIComponent(currentMachineId)}`;
    let response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      token = await refreshAccessToken();
      response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    if (response.status === 404) {
      setBarcodeSettingExists(false);
      setCurrentBarcodePrinter("");
      setCurrentBarcodePaperSize("");
      setCurrentBarcodeCodeType("");
      setCurrentBarcodeLabelCount(null);
      return;
    }

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, `โหลดค่าปริ้นบาร์โค้ดไม่สำเร็จ (${response.status})`));
    }

    const setting = await readBarcodeSettingResponse(response);
    if (!setting) {
      setBarcodeSettingExists(false);
      setCurrentBarcodePrinter("");
      setCurrentBarcodePaperSize("");
      setCurrentBarcodeCodeType("");
      setCurrentBarcodeLabelCount(null);
      return;
    }

    const settingCodeType = setting.barcode_format || setting.code_type || setting.barcode_type || "CODE128";
    const settingLabelCount = Number(setting.items_per_row || setting.labels_per_row || setting.label_count || 2);

    setBarcodeSettingExists(true);
    setCurrentBarcodePrinter(setting.printer_name || "");
    setCurrentBarcodePaperSize(setting.paper_size || "");
    setCurrentBarcodeCodeType(settingCodeType);
    setCurrentBarcodeLabelCount(settingLabelCount);
    setBarcodePrinter(setting?.printer_name || "");
    setBarcodePaperSize(setting?.paper_size || barcodePaperSizes[1].value);
    setBarcodeCodeType(settingCodeType);
    setBarcodeLabelCount(settingLabelCount);
    setBarcodeShowName(Boolean(setting?.show_name ?? setting?.show_product_name ?? true));
    setBarcodeShowPrice(Boolean(setting?.show_price ?? true));
  };

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const [storedApiPath, storedDevice] = await Promise.all([
        window.electronStore.get(API_PATH_KEY),
        window.electronStore.get(POS_DEVICE_KEY),
      ]);

      if (typeof storedApiPath !== "string" || !storedApiPath.trim()) {
        throw new Error("ไม่พบ API endpoint ใน store");
      }

      const storedPosDevice = getStoredDevice(storedDevice);
      if (!storedPosDevice?.machine_id) {
        throw new Error("ไม่พบ machine_id กรุณาลงทะเบียนเครื่อง POS ก่อน");
      }

      const baseUrl = normalizeApiBase(storedApiPath);
      const currentMachineId = storedPosDevice.machine_id;
      setApiBaseUrl(baseUrl);
      setMachineId(currentMachineId);
      setDevice(storedPosDevice);

      const drivers = await loadPrinters();
      const fallbackPrinter = drivers[0]?.name || "";
      setA4Printer("");
      setSlipPrinter(getSlipPrinterName(storedPosDevice) || fallbackPrinter);
      setSlipPaperSize(getSlipPaperSize(storedPosDevice) || slipPaperSizes[1].value);
      setBarcodePrinter((current) => current || fallbackPrinter);

      const deviceResponse = await fetch(`${baseUrl}/pos-devices/${encodeURIComponent(currentMachineId)}`, {
        signal: AbortSignal.timeout(7000),
      });
      if (!deviceResponse.ok) {
        throw new Error(await getApiErrorMessage(deviceResponse, `โหลดข้อมูลเครื่อง POS ไม่สำเร็จ (${deviceResponse.status})`));
      }

      const apiDevice = unwrapObject<PosDevice>(await deviceResponse.json().catch(() => ({})));
      const matchedDevice = {
        ...storedPosDevice,
        ...(apiDevice || {}),
        machine_id: apiDevice?.machine_id || currentMachineId,
      };

      setDevice(matchedDevice);
      setSlipPrinter(getSlipPrinterName(matchedDevice) || fallbackPrinter);
      setSlipPaperSize(getSlipPaperSize(matchedDevice) || slipPaperSizes[1].value);
      setBarcodePrinter((current) => current || fallbackPrinter);

      await loadA4MachineSetting(baseUrl, currentMachineId);
      await loadBarcodeSetting(baseUrl, currentMachineId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดการตั้งค่าเครื่องพิมพ์ไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const savePosDevicePrinters = async (target: "a4" | "slip") => {
    const selectedPrinter = target === "a4" ? a4Printer : slipPrinter;
    if (!selectedPrinter) throw new Error("กรุณาเลือกเครื่องพิมพ์");

    const payload =
      target === "a4"
        ? {
            printer_name: selectedPrinter,
            printer_a4_name: selectedPrinter,
            printer_type: "a4",
          }
        : {
            printer_slip: selectedPrinter,
            paper_slip_size: slipPaperSize,
            printer_slip_name: selectedPrinter,
            printer_slip_paper_size: slipPaperSize,
            printer_type: "slip",
          };

    const response = await fetch(`${apiBaseUrl}/pos-devices/${encodeURIComponent(machineId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, `บันทึกค่าเครื่องพิมพ์ไม่สำเร็จ (${response.status})`));
    }

    const data = unwrapObject<PosDevice>(await response.json().catch(() => ({}))) || {};
    const updatedDevice = {
      ...(device || {}),
      ...data,
      machine_id: data.machine_id || machineId,
      ...payload,
    };

    await window.electronStore.set(POS_DEVICE_KEY, updatedDevice);
    setDevice(updatedDevice);
  };

  const saveA4MachineSetting = async () => {
    if (!a4Printer) throw new Error("กรุณาเลือกเครื่องพิมพ์");
    if (!isUuid(machineId)) throw new Error("machine_id ต้องเป็น UUID");

    let token = await getAccessToken();
    let checkResponse = await requestA4MachineSetting(token);
    if (checkResponse.status === 401) {
      token = await refreshAccessToken();
      checkResponse = await requestA4MachineSetting(token);
    }

    let exists = a4SettingExists;
    let currentSetting = a4MachineSetting;
    if (checkResponse.status === 404) {
      exists = false;
      currentSetting = null;
    } else if (checkResponse.ok) {
      const existingSetting = await readA4MachineSettingResponse(checkResponse);
      exists = Boolean(existingSetting);
      currentSetting = existingSetting;
    } else {
      throw new Error(await getApiErrorMessage(checkResponse, `ตรวจสอบค่า Printer A4 ไม่สำเร็จ (${checkResponse.status})`));
    }

    const endpoint = exists
      ? `${apiBaseUrl}/pos-machine-settings/machine/${encodeURIComponent(machineId)}`
      : `${apiBaseUrl}/pos-machine-settings`;
    const method = exists ? "PUT" : "POST";
    const payload = buildPosMachineSettingPayload({
      setting: currentSetting,
      selectedA4Printer: a4Printer,
      selectedSlipPrinter: currentSetting?.receipt_printer_name || currentSetting?.receiptPrinterName || currentSlipPrinter,
      selectedSlipPaperSize:
        currentSetting?.receipt_paper_size ||
        currentSetting?.receiptPaperSize ||
        currentSlipPaperSize ||
        slipPaperSizes[1].value,
    });
    const requestPayload = exists ? payload : { machine_id: machineId, ...payload };

    let response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (response.status === 401) {
      token = await refreshAccessToken();
      response = await fetch(endpoint, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });
    }

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, `บันทึกค่า Printer A4 ไม่สำเร็จ (${response.status})`));
    }

    setA4SettingExists(true);
    setA4MachineSetting({
      ...(currentSetting || {}),
      machineId,
      machine_id: machineId,
      ...payload,
    });
    const storedDevice = await window.electronStore.get(POS_DEVICE_KEY);
    const updatedStoredDevice = updateStoredA4PrinterName(storedDevice, machineId, a4Printer);
    await window.electronStore.set(POS_DEVICE_KEY, updatedStoredDevice);
    setDevice(getStoredDevice(updatedStoredDevice) || updatedStoredDevice);
    setCurrentA4Printer(a4Printer);
  };

  const saveSlipMachineSetting = async () => {
    if (!slipPrinter) throw new Error("กรุณาเลือกเครื่องพิมพ์ Slip");
    if (!isUuid(machineId)) throw new Error("machine_id ต้องเป็น UUID");

    let token = await getAccessToken();
    let checkResponse = await requestA4MachineSetting(token);
    if (checkResponse.status === 401) {
      token = await refreshAccessToken();
      checkResponse = await requestA4MachineSetting(token);
    }

    let exists = a4SettingExists;
    let currentSetting = a4MachineSetting;
    if (checkResponse.status === 404) {
      exists = false;
      currentSetting = null;
    } else if (checkResponse.ok) {
      const existingSetting = await readA4MachineSettingResponse(checkResponse);
      exists = Boolean(existingSetting);
      currentSetting = existingSetting;
    } else {
      throw new Error(await getApiErrorMessage(checkResponse, `ตรวจสอบค่า Printer Slip ไม่สำเร็จ (${checkResponse.status})`));
    }

    const endpoint = exists
      ? `${apiBaseUrl}/pos-machine-settings/machine/${encodeURIComponent(machineId)}`
      : `${apiBaseUrl}/pos-machine-settings/`;
    const method = exists ? "PUT" : "POST";
    const payload = buildPosMachineSettingPayload({
      setting: currentSetting,
      selectedA4Printer: currentSetting?.a4_printer_name || currentSetting?.a4PrinterName || currentA4Printer,
      selectedSlipPrinter: slipPrinter,
      selectedSlipPaperSize: slipPaperSize,
    });
    const requestPayload = exists ? payload : { machine_id: machineId, ...payload };

    let response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    if (response.status === 401) {
      token = await refreshAccessToken();
      response = await fetch(endpoint, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });
    }

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, `บันทึกค่า Printer Slip ไม่สำเร็จ (${response.status})`));
    }

    setA4SettingExists(true);
    setA4MachineSetting({
      ...(currentSetting || {}),
      machineId,
      machine_id: machineId,
      ...payload,
    });
    const storedDevice = await window.electronStore.get(POS_DEVICE_KEY);
    const updatedStoredDevice = updateStoredSlipPrinter(storedDevice, machineId, slipPrinter, slipPaperSize);
    await window.electronStore.set(POS_DEVICE_KEY, updatedStoredDevice);
    setDevice(getStoredDevice(updatedStoredDevice) || updatedStoredDevice);
    setCurrentSlipPrinter(slipPrinter);
    setCurrentSlipPaperSize(slipPaperSize);
  };

  const saveBarcodeSetting = async () => {
    if (!barcodePrinter) throw new Error("กรุณาเลือกเครื่องพิมพ์บาร์โค้ด");

    const payload = {
      machine_id: machineId,
      printer_name: barcodePrinter,
      paper_size: barcodePaperSize,
      barcode_format: barcodeCodeType,
      code_type: barcodeCodeType,
      barcode_type: barcodeCodeType,
      items_per_row: barcodeLabelCount,
      labels_per_row: barcodeLabelCount,
      label_count: barcodeLabelCount,
      show_name: barcodeShowName,
      show_product_name: barcodeShowName,
      show_price: barcodeShowPrice,
    };

    let token = await getAccessToken();
    let checkResponse = await requestBarcodeSetting(token);
    if (checkResponse.status === 401) {
      token = await refreshAccessToken();
      checkResponse = await requestBarcodeSetting(token);
    }

    let exists = false;
    if (checkResponse.status === 404) {
      exists = false;
    } else if (checkResponse.ok) {
      const existingSetting = await readBarcodeSettingResponse(checkResponse);
      exists = Boolean(existingSetting);
    } else {
      throw new Error(await getApiErrorMessage(checkResponse, `ตรวจสอบค่าปริ้นบาร์โค้ดไม่สำเร็จ (${checkResponse.status})`));
    }

    const endpoint = exists
      ? `${apiBaseUrl}/barcode-print-settings/machine/${encodeURIComponent(machineId)}`
      : `${apiBaseUrl}/barcode-print-settings/`;
    const method = exists ? "PUT" : "POST";

    let response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      token = await refreshAccessToken();
      response = await fetch(endpoint, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, `บันทึกค่าปริ้นบาร์โค้ดไม่สำเร็จ (${response.status})`));
    }

    setBarcodeSettingExists(true);
    setCurrentBarcodePrinter(barcodePrinter);
    setCurrentBarcodePaperSize(barcodePaperSize);
    setCurrentBarcodeCodeType(barcodeCodeType);
    setCurrentBarcodeLabelCount(barcodeLabelCount);
  };

  const handleSave = async (event: FormEvent, target: SaveTarget) => {
    event.preventDefault();
    if (!apiBaseUrl || !machineId) {
      setError("ไม่พบ API endpoint หรือ machine_id");
      return;
    }

    setSavingTarget(target);
    setError(null);
    setMessage(null);

    try {
      if (target === "barcode") {
        await saveBarcodeSetting();
      } else if (target === "a4") {
        await saveA4MachineSetting();
      } else {
        await saveSlipMachineSetting();
      }

      setMessage("บันทึกค่าเครื่องพิมพ์เรียบร้อยแล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกค่าเครื่องพิมพ์ไม่สำเร็จ");
    } finally {
      setSavingTarget(null);
    }
  };

  const renderPrinterSelect = (
    value: string,
    onChange: (value: string) => void,
    label: string,
  ) => {
    const selectedOptionMissing = Boolean(
      value && !printerOptions.some((printer) => printer.value === value),
    );

    return (
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-600">{label}</span>
        <div className="relative">
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
          >
            <option value="">เลือกเครื่องพิมพ์</option>
            {selectedOptionMissing ? <option value={value}>{value}</option> : null}
            {printerOptions.map((printer) => (
              <option key={printer.value} value={printer.value}>
                {printer.label}
              </option>
            ))}
          </select>
          <IconChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>
      </label>
    );
  };

  const renderCircleToggle = (
    checked: boolean,
    onChange: (value: boolean) => void,
    label: string,
  ) => (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          checked ? "border-[#1d6fd8] bg-[#1d6fd8]" : "border-slate-300 bg-white"
        }`}
      >
        {checked ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
      </button>
      <span className="cursor-pointer text-sm text-slate-600" onClick={() => onChange(!checked)}>
        {label}
      </span>
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-slate-50 px-6 pb-12 pt-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ตั้งค่าเครื่องพิมพ์</h1>
          <p className="mt-1 text-sm text-slate-500">
            เลือกเครื่องพิมพ์เริ่มต้นและรูปแบบฉลากสำหรับเครื่อง POS นี้
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSettings()}
          disabled={isLoading || isRefreshingPrinters}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <IconRefresh size={18} className={isRefreshingPrinters ? "animate-spin" : ""} />
          โหลดใหม่
        </button>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400">Machine ID</p>
          <p className="mt-1 truncate font-mono text-sm text-slate-800">{machineId || "-"}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400">POS Device</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-800">
            {device?.device_name || "-"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400">Printer Drivers</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{printers.length} รายการ</p>
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

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-white p-4 pb-8 shadow-sm">
        <div className="grid gap-4 pb-2 xl:grid-cols-3">
          <form
            onSubmit={(event) => void handleSave(event, "a4")}
            className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#1d6fd8]/10">
                <IconPrinter size={22} className="text-[#1d6fd8]" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-800">Printer A4</h2>
                <p className="text-sm text-slate-500">เลือกเครื่องพิมพ์กระดาษ A4 สำหรับการพิมพ์รายงาน</p>
                {currentA4Printer ? (
                  <p className="mt-1 truncate text-xs font-semibold text-[#1d6fd8]">
                    ปัจจุบัน: {currentA4Printer}
                  </p>
                ) : null}
              </div>
            </div>

            {renderPrinterSelect(a4Printer, setA4Printer, "Driver เครื่องพิมพ์")}

            <button
              type="submit"
              disabled={isLoading || savingTarget !== null}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#1a5fc0] disabled:opacity-50"
            >
              <IconDeviceFloppy size={18} />
              {savingTarget === "a4" ? "กำลังบันทึก..." : "บันทึก Printer A4"}
            </button>
          </form>

          <form
            onSubmit={(event) => void handleSave(event, "slip")}
            className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#1d6fd8]/10">
                <IconReceipt size={22} className="text-[#1d6fd8]" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-800">Printer Slip</h2>
                <p className="text-sm text-slate-500">เลือกขนาดกระดาษใบเสร็จ</p>
                <p className="mt-1 truncate text-xs font-semibold text-[#1d6fd8]">
                  ปัจจุบัน: {currentSlipPrinter || "-"}
                  {currentSlipPaperSize ? ` · ${currentSlipPaperSize}` : ""}
                </p>
              </div>
            </div>

            {renderPrinterSelect(slipPrinter, setSlipPrinter, "Driver เครื่องพิมพ์")}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">
                ขนาดกระดาษ
              </span>
              <select
                value={slipPaperSize}
                onChange={(event) => setSlipPaperSize(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
              >
                {slipPaperSizes.map((size) => (
                  <option key={size.value} value={size.value}>
                    {size.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={isLoading || savingTarget !== null}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#1a5fc0] disabled:opacity-50"
            >
              <IconDeviceFloppy size={18} />
              {savingTarget === "slip" ? "กำลังบันทึก..." : "บันทึก Printer Slip"}
            </button>
          </form>

          <form
            onSubmit={(event) => void handleSave(event, "barcode")}
            className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#1d6fd8]/10">
                <IconBarcode size={22} className="text-[#1d6fd8]" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-800">Printer Barcode</h2>
                {<p className="text-sm text-slate-500"> ตั้งค่าการพิมพ์บาร์โค้ด</p>}
                {/* <p className="text-sm text-slate-500">
                  {barcodeSettingExists ? "พบการตั้งค่าเดิม" : "ยังไม่พบการตั้งค่าเดิม"}
                </p> */}
                <p className="mt-1 truncate text-xs font-semibold text-[#1d6fd8]">
                  ปัจจุบัน: {currentBarcodePrinter || "-"}
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-[#1d6fd8]">
                  กระดาษ: {currentBarcodePaperSize ? getBarcodePaperSizeLabel(currentBarcodePaperSize) : "-"}
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-[#1d6fd8]">
                  ชนิด code: {currentBarcodeCodeType ? getBarcodeCodeTypeLabel(currentBarcodeCodeType) : "-"}
                  {currentBarcodeLabelCount ? ` · ${currentBarcodeLabelCount} ดวง` : ""}
                </p>
              </div>
            </div>

            {renderPrinterSelect(barcodePrinter, setBarcodePrinter, "Driver เครื่องพิมพ์")}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">
                ขนาดกระดาษ
              </span>
              <select
                value={barcodePaperSize}
                onChange={(event) => setBarcodePaperSize(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
              >
                {barcodePaperSizes.map((size) => (
                  <option key={size.value} value={size.value}>
                    {size.label}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-600">
                ชนิด code
              </span>
              <div className="space-y-2">
                {barcodeCodeTypes.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:bg-slate-50"
                  >
                    <input
                      type="radio"
                      name="barcode_code_type"
                      value={option.value}
                      checked={barcodeCodeType === option.value}
                      onChange={() => setBarcodeCodeType(option.value)}
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

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">
                จำนวนดวง
              </span>
              <select
                value={barcodeLabelCount}
                onChange={(event) => setBarcodeLabelCount(Number(event.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
              >
                {barcodeLabelCounts.map((count) => (
                  <option key={count} value={count}>
                    {count} ดวง
                  </option>
                ))}
              </select>
            </label>

            {renderCircleToggle(barcodeShowName, setBarcodeShowName, "แสดงชื่อสินค้า")}
            {renderCircleToggle(barcodeShowPrice, setBarcodeShowPrice, "แสดงราคา")}

            <button
              type="submit"
              disabled={isLoading || savingTarget !== null}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#1a5fc0] disabled:opacity-50"
            >
              <IconDeviceFloppy size={18} />
              {savingTarget === "barcode" ? "กำลังบันทึก..." : "บันทึก Printer Barcode"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
