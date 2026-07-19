import { authorizedFetch, getApiErrorMessage } from "./StoreSetting";

export interface PosDevice {
  id: number | string;
  deviceName?: string;
  device_name?: string;
  deviceCode?: string;
  device_code?: string;
  machineId?: string;
  machine_id?: string;
  hostname?: string | null;
  ipAddress?: string | null;
  ip_address?: string | null;
  osPlatform?: string | null;
  os_platform?: string | null;
  osRelease?: string | null;
  os_release?: string | null;
  appVersion?: string | null;
  app_version?: string | null;
  printerName?: string | null;
  printer_name?: string | null;
  status?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
}

export interface UpdatePosDevicePayload {
  device_name: string;
}

interface PosDevicesResponse {
  data?: PosDevice[] | PosDevice | { items?: PosDevice[]; data?: PosDevice[] };
  pos_device?: PosDevice;
  items?: PosDevice[];
  message?: string;
}

const hasNestedDeviceList = (
  value: PosDevice | { items?: PosDevice[]; data?: PosDevice[] },
): value is { items?: PosDevice[]; data?: PosDevice[] } =>
  "items" in value || "data" in value;

const unwrapDevice = (payload: PosDevicesResponse | PosDevice): PosDevice => {
  if ("pos_device" in payload && payload.pos_device) return payload.pos_device;
  if ("data" in payload && payload.data && !Array.isArray(payload.data)) {
    if (hasNestedDeviceList(payload.data)) {
      throw new Error("ไม่พบข้อมูลเครื่อง POS");
    }
    return payload.data;
  }
  return payload as PosDevice;
};

export const getDeviceName = (device: PosDevice | null): string =>
  device?.device_name ?? device?.deviceName ?? "";

export const getDeviceCode = (device: PosDevice): string =>
  device.device_code ?? device.deviceCode ?? "-";

export const getMachineId = (device: PosDevice): string =>
  device.machine_id ?? device.machineId ?? "";

export const getAllPosDevices = async (): Promise<PosDevice[]> => {
  const response = await authorizedFetch("/pos-devices");

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        `ไม่สามารถโหลดข้อมูลเครื่อง POS ได้ (${response.status})`,
      ),
    );
  }

  const payload = (await response.json().catch(() => ({}))) as
    | PosDevicesResponse
    | PosDevice[];

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  if (
    payload.data &&
    !Array.isArray(payload.data) &&
    hasNestedDeviceList(payload.data)
  ) {
    if (Array.isArray(payload.data.items)) return payload.data.items;
    if (Array.isArray(payload.data.data)) return payload.data.data;
  }

  return [];
};

export const getCurrentPosDevice = async (
  machineId: string,
): Promise<PosDevice> => {
  const response = await authorizedFetch(
    `/pos-devices/${encodeURIComponent(machineId)}`,
  );

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        `ไม่สามารถโหลดข้อมูลเครื่อง POS ได้ (${response.status})`,
      ),
    );
  }

  const payload = (await response.json().catch(() => ({}))) as PosDevicesResponse;

  return unwrapDevice(payload);
};

export const updateCurrentPosDevice = async (
  machineId: string,
  payload: UpdatePosDevicePayload,
): Promise<PosDevice> => {
  const response = await authorizedFetch(
    `/pos-devices/${encodeURIComponent(machineId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        `ไม่สามารถบันทึกชื่อเครื่อง POS ได้ (${response.status})`,
      ),
    );
  }

  const data = (await response.json().catch(() => ({}))) as PosDevicesResponse;

  return unwrapDevice(data);
};
