import { useEffect, useState } from "react";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const API_PATH_KEY = "apiPath";
const POS_DEVICE_KEY = "pos_device";

interface PosDevice {
  device_id?: number;
  machine_id: string;
  device_code?: string;
  device_name: string;
  device_token?: string;
}

interface DeviceInfo {
  hostname: string;
  ip_address: string;
  os_platform: string;
  os_release: string;
}

interface RegisterPosDeviceProps {
  apiPath?: string;
}

const getPosDevice = (stored: unknown): PosDevice | null => {
  if (!stored || typeof stored !== "object") return null;
  const value = stored as Partial<PosDevice> & { pos_device?: PosDevice };
  if (value.machine_id) return value as PosDevice;
  if (value.pos_device?.machine_id) return value.pos_device;
  return null;
};

const normalizeApiPath = (value: string): string => value.replace(/\/+$/, "");

export function RegisterPosDevice({ apiPath = "" }: RegisterPosDeviceProps) {
  const [storedApiPath, setStoredApiPath] = useState(apiPath);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [posDevice, setPosDevice] = useState<PosDevice | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  const activeApiPath = normalizeApiPath(apiPath || storedApiPath);
  const isRegistered = Boolean(posDevice?.machine_id);
  const canRegister = Boolean(activeApiPath) && !isRegistered && !loading && !registering;

  const loadStatus = async () => {
    setLoading(true);
    try {
      const [savedApiPath, storedDevice, info] = await Promise.all([
        window.electronStore.get(API_PATH_KEY),
        window.electronStore.get(POS_DEVICE_KEY),
        window.electronDevice.getInfo(),
      ]);
      if (typeof savedApiPath === "string") setStoredApiPath(savedApiPath);
      setDeviceInfo(info);
      setPosDevice(getPosDevice(storedDevice));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "ไม่ทราบสาเหตุ";
      setMessage(`ไม่สามารถโหลดสถานะเครื่อง POS ได้: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [apiPath]);

  const handleRegister = async () => {
    if (!activeApiPath) {
      setMessage("กรุณาบันทึกที่อยู่ API ก่อนลงทะเบียนเครื่อง POS");
      return;
    }
    if (isRegistered) {
      setMessage("เครื่องนี้ลงทะเบียนแล้ว ไม่สามารถลงทะเบียนซ้ำได้");
      return;
    }

    setRegistering(true);
    setMessage("");

    try {
      const systemInfo = deviceInfo ?? (await window.electronDevice.getInfo());
      const appVersion = await window.electronAPI.getAppVersion();

      const payload = {
        device_name: "เครื่องคิดเงินหน้าร้าน",
        machine_id: uuidv4(),
        hostname: systemInfo.hostname,
        ip_address: systemInfo.ip_address,
        os_platform: systemInfo.os_platform,
        os_release: systemInfo.os_release,
        app_version: appVersion,
        printer_name: "",
        printer_type: "",
      };

      const response = await axios.post(`${activeApiPath}/pos-devices/register`, payload);

      const responseDevice = response.data?.pos_device ?? response.data?.data ?? response.data;
      const savedDevice: PosDevice = {
        device_id: responseDevice?.device_id,
        machine_id: responseDevice?.machine_id ?? payload.machine_id,
        device_code: responseDevice?.device_code,
        device_name: responseDevice?.device_name ?? payload.device_name,
        device_token: responseDevice?.device_token,
      };

      await window.electronStore.set(POS_DEVICE_KEY, savedDevice);
      setPosDevice(savedDevice);
      setDeviceInfo(systemInfo);
      setMessage("ลงทะเบียนเครื่อง POS สำเร็จ");
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message || err?.message || "ไม่สามารถลงทะเบียนเครื่อง POS ได้";
      setMessage(errorMessage);
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-5">

      {/* Status badge */}
      <div
        className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
          isRegistered
            ? "border-emerald-500/25 bg-emerald-500/8"
            : "border-yellow-500/25 bg-yellow-500/8"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`relative flex h-3 w-3 ${isRegistered ? "" : "animate-pulse"}`}
          >
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isRegistered ? "bg-emerald-400" : "bg-yellow-400 animate-ping"
              }`}
            />
            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${
                isRegistered ? "bg-emerald-500" : "bg-yellow-500"
              }`}
            />
          </span>
          <span
            className={`text-[13px] font-semibold ${
              isRegistered ? "text-emerald-300" : "text-yellow-300"
            }`}
          >
            {isRegistered ? "ลงทะเบียนแล้ว" : "ยังไม่ได้ลงทะเบียน"}
          </span>
        </div>
        {posDevice?.device_code && (
          <span className="font-mono text-[11px] text-slate-400">
            #{posDevice.device_code}
          </span>
        )}
      </div>

      {/* Device info grid */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900 overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            ข้อมูลเครื่อง
          </span>
        </div>
        <div className="divide-y divide-slate-800/60">
          {[
            { label: "API Endpoint", value: activeApiPath || "ยังไม่ได้บันทึก", mono: true },
            { label: "Hostname", value: deviceInfo?.hostname || (loading ? "กำลังโหลด…" : "-"), mono: true },
            { label: "IP Address", value: deviceInfo?.ip_address || (loading ? "กำลังโหลด…" : "-"), mono: true },
            {
              label: "ระบบปฏิบัติการ",
              value: deviceInfo ? `${deviceInfo.os_platform} ${deviceInfo.os_release}` : (loading ? "กำลังโหลด…" : "-"),
              mono: false,
            },
            ...(posDevice
              ? [
                  { label: "Machine ID", value: posDevice.machine_id, mono: true },
                  { label: "Device Code", value: posDevice.device_code || "-", mono: true },
                ]
              : []),
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex items-start gap-4 px-4 py-3">
              <span className="w-32 shrink-0 text-[11px] font-medium text-slate-500 pt-0.5">
                {label}
              </span>
              <span
                className={`flex-1 text-[12px] text-slate-200 break-all leading-relaxed ${
                  mono ? "font-mono" : ""
                }`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Register button */}
      <button
        type="button"
        onClick={handleRegister}
        disabled={!canRegister}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-pink-600 text-sm font-semibold text-white transition hover:bg-pink-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 shadow-lg shadow-pink-600/20"
      >
        {registering ? (
          <>
            <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            กำลังลงทะเบียน…
          </>
        ) : isRegistered ? (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            ลงทะเบียนแล้ว
          </>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            ลงทะเบียนเครื่อง POS
          </>
        )}
      </button>

      {/* Helper texts */}
      {!activeApiPath && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-2.5 text-center text-[12px] text-red-400">
          กรุณาบันทึก API path ฝั่งซ้ายก่อน จึงจะลงทะเบียนเครื่อง POS ได้
        </p>
      )}

      {isRegistered && (
        <p className="text-center text-[14px] text-slate-500">
          พบ machine_id ในเครื่องแล้ว ระบบจะไม่อนุญาตให้ลงทะเบียนซ้ำ
        </p>
      )}

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-[12px] font-medium ${
            message.includes("สำเร็จ")
              ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-300"
              : "border-teal-500/25 bg-teal-500/8 text-teal-300"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}