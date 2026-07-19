import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconCheck,
  IconCopy,
  IconDeviceDesktop,
  IconDeviceFloppy,
  IconRefresh,
  IconSettings,
  IconShieldCheck,
  IconX,
} from "@tabler/icons-react";
import {
  getAllPosDevices,
  getCurrentPosDevice,
  getDeviceCode,
  getDeviceName,
  getMachineId,
  updateCurrentPosDevice,
  type PosDevice,
} from "./posDeviceService";
import {
  getPosMachineSettings,
  updatePosMachineSettings,
  type PosMachineSettings,
} from "./posMachineSettingService";

type TabId = "current" | "all";

interface StoredPosDevice {
  machine_id?: unknown;
  device_name?: unknown;
  deviceName?: unknown;
  pos_device?: StoredPosDevice;
  [key: string]: unknown;
}

const POS_DEVICE_KEY = "pos_device";
const missingMachineMessage =
  "ไม่พบข้อมูลเครื่อง POS กรุณาลงทะเบียนเครื่องก่อนใช้งาน";

const getStoredPosDevice = (value: unknown): StoredPosDevice | null => {
  if (!value || typeof value !== "object") return null;
  const stored = value as StoredPosDevice;
  return stored.pos_device && typeof stored.pos_device === "object"
    ? stored.pos_device
    : stored;
};

const getStoredMachineId = (value: unknown): string | null => {
  const device = getStoredPosDevice(value);
  const machineId = device?.machine_id;
  return typeof machineId === "string" && machineId.trim()
    ? machineId.trim()
    : null;
};

const syncDeviceNameToStore = async (deviceName: string) => {
  const stored = await window.electronStore.get(POS_DEVICE_KEY);
  if (!stored || typeof stored !== "object") return;

  const root = stored as StoredPosDevice;
  if (root.pos_device && typeof root.pos_device === "object") {
    await window.electronStore.set(POS_DEVICE_KEY, {
      ...root,
      pos_device: { ...root.pos_device, device_name: deviceName },
    });
    return;
  }

  await window.electronStore.set(POS_DEVICE_KEY, {
    ...root,
    device_name: deviceName,
  });
};

const syncMachineSettingsToStore = async ({
  allowBelowCost,
  minProfitAmount,
  autoConvertUnitPrice,
}: {
  allowBelowCost: boolean;
  minProfitAmount: number;
  autoConvertUnitPrice: boolean;
}) => {
  const stored = await window.electronStore.get(POS_DEVICE_KEY);
  if (!stored || typeof stored !== "object") return;

  const settingsPayload = {
    allow_below_cost: allowBelowCost,
    min_profit_amount: minProfitAmount,
    autoConvertUnitPrice,
  };
  const root = stored as StoredPosDevice;

  if (root.pos_device && typeof root.pos_device === "object") {
    await window.electronStore.set(POS_DEVICE_KEY, {
      ...root,
      pos_device: {
        ...root.pos_device,
        ...settingsPayload,
      },
    });
    return;
  }

  await window.electronStore.set(POS_DEVICE_KEY, {
    ...root,
    ...settingsPayload,
  });
};

const formatDateThai = (value?: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const normalizeDecimalInput = (value: string): string =>
  value.replace(/[^\d.]/g, "").replace(/^(\d*\.?\d{0,2}).*$/, "$1");

const getFriendlyError = (error: unknown, fallback: string): string => {
  if (error instanceof TypeError) {
    return "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้";
  }
  return error instanceof Error && error.message ? error.message : fallback;
};

export default function POSSettingPage() {
  const [activeTab, setActiveTab] = useState<TabId>("current");
  const [machineId, setMachineId] = useState<string | null>(null);
  const [currentDevice, setCurrentDevice] = useState<PosDevice | null>(null);
  const [settings, setSettings] = useState<PosMachineSettings | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [allowBelowCost, setAllowBelowCost] = useState(false);
  const [minProfitAmount, setMinProfitAmount] = useState("0.00");
  const [autoConvertUnitPrice, setAutoConvertUnitPrice] = useState(false);
  const [allDevices, setAllDevices] = useState<PosDevice[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [allLoading, setAllLoading] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [allError, setAllError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deviceNameError, setDeviceNameError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingDevice, setSavingDevice] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const hasLoadedAllDevicesRef = useRef(false);
  const initialLoadStartedRef = useRef(false);

  const validateDeviceName = () => {
    const trimmed = deviceName.trim();
    if (!trimmed) return "กรุณากรอกชื่อเครื่อง POS";
    if (trimmed.length > 100) return "ชื่อเครื่อง POS ต้องไม่เกิน 100 ตัวอักษร";
    return null;
  };

  const validateMinProfit = () => {
    if (!minProfitAmount.trim()) return "กรุณากรอกกำไรขั้นต่ำ";
    const numericValue = Number(minProfitAmount);
    if (!Number.isFinite(numericValue)) return "กำไรขั้นต่ำต้องเป็นตัวเลข";
    if (numericValue < 0) return "กำไรขั้นต่ำต้องไม่ติดลบ";
    if (!/^\d+(\.\d{0,2})?$/.test(minProfitAmount)) {
      return "รองรับทศนิยมสูงสุด 2 ตำแหน่ง";
    }
    return null;
  };

  const loadCurrent = useCallback(async () => {
    setInitialLoading(true);
    setCurrentError(null);
    setSuccessMessage(null);

    try {
      const storedDevice = await window.electronStore.get(POS_DEVICE_KEY);
      const storedMachineId = getStoredMachineId(storedDevice);
      if (!storedMachineId) {
        setMachineId(null);
        setCurrentError(missingMachineMessage);
        return;
      }

      setMachineId(storedMachineId);
      const [device, machineSettings] = await Promise.all([
        getCurrentPosDevice(storedMachineId),
        getPosMachineSettings(storedMachineId),
      ]);

      setCurrentDevice(device);
      setSettings(machineSettings);
      setDeviceName(getDeviceName(device));
      setAllowBelowCost(Boolean(machineSettings?.allowBelowCost ?? machineSettings?.allow_below_cost));
      setMinProfitAmount(String(machineSettings?.minProfitAmount ?? machineSettings?.min_profit_amount ?? "0.00"));
      setAutoConvertUnitPrice(Boolean(machineSettings?.autoConvertUnitPrice ?? machineSettings?.auto_convert_unit_price));
    } catch (error) {
      console.error("Error loading POS setting:", error);
      setCurrentError(
        getFriendlyError(error, "ไม่สามารถโหลดข้อมูลเครื่อง POS ได้"),
      );
    } finally {
      setInitialLoading(false);
    }
  }, []);

  const loadAllDevices = useCallback(async (force = false) => {
    if (hasLoadedAllDevicesRef.current && !force) return;
    setAllLoading(true);
    setAllError(null);

    try {
      const devices = await getAllPosDevices();
      setAllDevices(devices);
      hasLoadedAllDevicesRef.current = true;
    } catch (error) {
      console.error("Error loading all POS devices:", error);
      setAllError(getFriendlyError(error, "ไม่สามารถโหลดข้อมูลเครื่อง POS ได้"));
    } finally {
      setAllLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialLoadStartedRef.current) return;
    initialLoadStartedRef.current = true;
    void loadCurrent();
  }, [loadCurrent]);

  useEffect(() => {
    if (activeTab === "all" && machineId) {
      void loadAllDevices();
    }
  }, [activeTab, loadAllDevices, machineId]);

  const normalizedDevices = useMemo(
    () =>
      allDevices.map((device) => ({
        ...device,
        displayMachineId: getMachineId(device),
      })),
    [allDevices],
  );

  const saveDeviceName = async () => {
    const validationError = validateDeviceName();
    setDeviceNameError(validationError);
    setSuccessMessage(null);
    if (validationError || !machineId) return;

    const trimmedName = deviceName.trim();
    setSavingDevice(true);
    try {
      const savedDevice = await updateCurrentPosDevice(machineId, {
        device_name: trimmedName,
      });
      setCurrentDevice(savedDevice);
      setDeviceName(getDeviceName(savedDevice) || trimmedName);
      await syncDeviceNameToStore(trimmedName);
      setSuccessMessage("บันทึกชื่อเครื่อง POS เรียบร้อยแล้ว");
      hasLoadedAllDevicesRef.current = false;
    } catch (error) {
      console.error("Error saving POS device name:", error);
      setDeviceNameError(
        getFriendlyError(error, "ไม่สามารถบันทึกชื่อเครื่อง POS ได้"),
      );
    } finally {
      setSavingDevice(false);
    }
  };

  const saveSettings = async () => {
    const validationError = validateMinProfit();
    setSettingsError(validationError);
    setSuccessMessage(null);
    if (validationError || !machineId) return;

    setSavingSettings(true);
    try {
      const payload = {
        machine_id: machineId,
        allowBelowCost,
        minProfitAmount: Number(minProfitAmount),
        autoConvertUnitPrice,
      };
      const existingSettings = settings ?? (await getPosMachineSettings(machineId));
      const savedSettings = await updatePosMachineSettings(
        payload,
        Boolean(existingSettings),
      );
      setSettings(savedSettings);
      const savedAllowBelowCost = Boolean(savedSettings.allowBelowCost ?? savedSettings.allow_below_cost);
      const savedMinProfitAmount = Number(
        savedSettings.minProfitAmount ??
          savedSettings.min_profit_amount ??
          payload.minProfitAmount,
      );
      const savedAutoConvertUnitPrice = Boolean(
        savedSettings.autoConvertUnitPrice ??
          savedSettings.auto_convert_unit_price ??
          payload.autoConvertUnitPrice,
      );
      setAllowBelowCost(savedAllowBelowCost);
      setMinProfitAmount(String(savedMinProfitAmount));
      setAutoConvertUnitPrice(savedAutoConvertUnitPrice);
      await syncMachineSettingsToStore({
        allowBelowCost: savedAllowBelowCost,
        minProfitAmount: savedMinProfitAmount,
        autoConvertUnitPrice: savedAutoConvertUnitPrice,
      });
      setSuccessMessage("บันทึกการตั้งค่าเรียบร้อยแล้ว");
    } catch (error) {
      console.error("Error saving POS machine settings:", error);
      setSettingsError(
        getFriendlyError(error, "ไม่สามารถบันทึกการตั้งค่าได้ กรุณาลองใหม่อีกครั้ง"),
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const tabs = [
    { id: "current" as const, label: "เครื่อง POS ปัจจุบัน" },
    { id: "all" as const, label: "POS ทั้งหมด" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 px-6 py-6 pb-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ตั้งค่าเครื่อง POS</h1>
          <p className="mt-1 text-sm text-slate-500">
            จัดการข้อมูลและการตั้งค่าเฉพาะเครื่องที่ใช้งานอยู่
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCurrent()}
          className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-white"
        >
          <IconRefresh size={18} />
          โหลดใหม่
        </button>
      </div>

      {successMessage ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <IconCheck size={18} />
          {successMessage}
        </div>
      ) : null}

      <div className="mb-4 flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "bg-[#1d6fd8] text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {activeTab === "current" ? (
          initialLoading ? (
            <div className="grid h-40 place-items-center text-sm text-slate-400">
              กำลังโหลดข้อมูล...
            </div>
          ) : currentError ? (
            <ErrorState message={currentError} onRetry={loadCurrent} />
          ) : (
            <div className="space-y-4">
              <section className="rounded-xl border border-slate-200 p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <IconDeviceDesktop size={18} className="text-[#1d6fd8]" />
                  ชื่อเครื่อง POS
                </div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">
                  ชื่อเครื่อง
                </label>
                <input
                  type="text"
                  value={deviceName}
                  maxLength={100}
                  onChange={(event) => {
                    setDeviceName(event.target.value);
                    setDeviceNameError(null);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
                {deviceNameError ? (
                  <p className="mt-1 text-xs text-red-500">{deviceNameError}</p>
                ) : null}
                <p className="mt-2 text-xs text-slate-400">
                  Machine ID: {machineId ?? "-"}
                </p>
                <button
                  type="button"
                  onClick={() => void saveDeviceName()}
                  disabled={savingDevice}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a5fc0] disabled:opacity-50"
                >
                  <IconDeviceFloppy size={18} />
                  {savingDevice ? "กำลังบันทึก..." : "บันทึกชื่อเครื่อง"}
                </button>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <IconShieldCheck size={18} className="text-[#1d6fd8]" />
                  การแจ้งเตือนกำไรขั้นต่ำ
                </div>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={allowBelowCost}
                    onChange={(event) => setAllowBelowCost(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#1d6fd8] focus:ring-[#1d6fd8]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-700">
                      อนุญาตให้แจ้งเตือนเมื่อราคาขายต่ำกว่ากำไรขั้นต่ำ
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">
                      ระบบจะแจ้งเตือนเมื่อราคาขายทำให้กำไรต่อหน่วยต่ำกว่าจำนวนเงินที่กำหนด
                    </span>
                  </span>
                </label>
                <div className="mt-4 max-w-sm">
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    กำไรขั้นต่ำ
                  </label>
                  <div className="flex rounded-xl border border-slate-200 focus-within:border-[#1d6fd8] focus-within:ring-2 focus-within:ring-[#1d6fd8]/20">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={minProfitAmount}
                      disabled={!allowBelowCost}
                      onChange={(event) => {
                        setMinProfitAmount(normalizeDecimalInput(event.target.value));
                        setSettingsError(null);
                      }}
                      className="min-w-0 flex-1 rounded-l-xl px-3 py-2.5 text-sm text-slate-700 outline-none disabled:bg-slate-50 disabled:text-slate-500"
                    />
                    <span className="flex items-center rounded-r-xl bg-slate-50 px-3 text-sm text-slate-500">
                      บาท
                    </span>
                  </div>
                  {settingsError ? (
                    <p className="mt-1 text-xs text-red-500">{settingsError}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={savingSettings}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <IconDeviceFloppy size={18} />
                  {savingSettings ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
                </button>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <IconSettings size={18} className="text-[#1d6fd8]" />
                  คิดราคาแพ็คและลังอัตโนมัติ
                </div>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={autoConvertUnitPrice}
                    onChange={(event) => setAutoConvertUnitPrice(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#1d6fd8] focus:ring-[#1d6fd8]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-700">
                      คิดราคาแพ็คและลังอัตโนมัติ
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">
                      เมื่อสแกนสินค้าหน่วยย่อยครบตามจำนวน ระบบจะเปลี่ยนไปใช้ราคาแพ็คหรือลังที่ถูกกว่าโดยอัตโนมัติ
                    </span>
                  </span>
                </label>
                <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  หาก 1 แพ็คมี 6 กล่อง เมื่อสแกนครบ 6 ครั้ง ระบบจะใช้ราคาแพ็คโดยอัตโนมัติ
                </p>
                <button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={savingSettings}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <IconDeviceFloppy size={18} />
                  {savingSettings ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
                </button>
              </section>
            </div>
          )
        ) : allLoading ? (
          <div className="grid h-40 place-items-center text-sm text-slate-400">
            กำลังโหลด POS ทั้งหมด...
          </div>
        ) : allError ? (
          <ErrorState message={allError} onRetry={() => loadAllDevices(true)} />
        ) : normalizedDevices.length === 0 ? (
          <div className="grid h-40 place-items-center text-center text-sm text-slate-400">
            ไม่พบข้อมูล POS
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">ชื่อเครื่อง</th>
                  <th className="px-3 py-3">รหัสเครื่อง</th>
                  <th className="px-3 py-3">Machine ID</th>
                  <th className="px-3 py-3">Hostname</th>
                  <th className="px-3 py-3">IP Address</th>
                  <th className="px-3 py-3">ระบบปฏิบัติการ</th>
                  <th className="px-3 py-3">เวอร์ชันโปรแกรม</th>
                  <th className="px-3 py-3">เครื่องพิมพ์</th>
                  <th className="px-3 py-3">อัปเดตล่าสุด</th>
                  <th className="px-3 py-3">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {normalizedDevices.map((device) => {
                  const rowMachineId = device.displayMachineId;
                  const isCurrent = rowMachineId && rowMachineId === machineId;
                  return (
                    <tr key={`${device.id}-${rowMachineId}`} className="align-top">
                      <td className="px-3 py-3 font-medium text-slate-800">
                        {getDeviceName(device) || "-"}
                        {isCurrent ? (
                          <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-[#1d6fd8]">
                            เครื่องปัจจุบัน
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{getDeviceCode(device)}</td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => void navigator.clipboard?.writeText(rowMachineId)}
                          className="flex max-w-[180px] items-center gap-1 text-slate-600 hover:text-[#1d6fd8]"
                          title={rowMachineId}
                        >
                          <span className="truncate font-mono text-xs">{rowMachineId || "-"}</span>
                          {rowMachineId ? <IconCopy size={14} /> : null}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{device.hostname ?? "-"}</td>
                      <td className="px-3 py-3 text-slate-600">{device.ip_address ?? device.ipAddress ?? "-"}</td>
                      <td className="px-3 py-3 text-slate-600">{device.os_platform ?? device.osPlatform ?? device.os_release ?? device.osRelease ?? "-"}</td>
                      <td className="px-3 py-3 text-slate-600">{device.app_version ?? device.appVersion ?? "-"}</td>
                      <td className="px-3 py-3 text-slate-600">{device.printer_name ?? device.printerName ?? "-"}</td>
                      <td className="px-3 py-3 text-slate-600">{formatDateThai(device.updated_at ?? device.updatedAt)}</td>
                      <td className="px-3 py-3 text-slate-600">{device.status ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="hidden">{currentDevice?.id}{settings?.id}</div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void | Promise<void>;
}) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
      <div className="flex items-center gap-2 text-sm text-red-500">
        <IconX size={18} />
        {message}
      </div>
      <button
        type="button"
        onClick={() => void onRetry()}
        className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <IconRefresh size={16} />
        ลองใหม่
      </button>
    </div>
  );
}
