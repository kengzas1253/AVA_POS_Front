import { useEffect, useState, type FormEvent } from "react";
import {
  IconDeviceLaptop,
  IconId,
  IconPencil,
  IconUser,
  IconUserShield,
  IconX,
} from "@tabler/icons-react";

interface UserInfo {
  device_name: string;
  username: string;
  full_name: string;
  role: string;
}

interface StoredUser {
  username?: string;
  full_name?: string;
  role?: string;
}

interface PosDevice {
  device_id?: number;
  machine_id?: string;
  device_code?: string;
  device_name?: string;
  device_token?: string;
  pos_device?: PosDevice;
  [key: string]: unknown;
}

const API_PATH_KEY = "apiPath";
const POS_DEVICE_KEY = "pos_device";

const fallbackUserInfo: UserInfo = {
  device_name: "-",
  username: "-",
  full_name: "ผู้ใช้งาน",
  role: "-",
};

const getApiBaseUrl = async (): Promise<string> => {
  const apiPath = await window.electronStore.get(API_PATH_KEY);

  if (typeof apiPath !== "string" || !apiPath.trim()) {
    throw new Error("ไม่พบ API endpoint ใน store");
  }

  return apiPath.trim().replace(/\/+$/, "");
};

const getStoredDevice = (value: unknown): PosDevice | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const device = value as PosDevice;
  return device.machine_id ? device : device.pos_device ?? null;
};

const getUserInfo = (value: unknown): Omit<UserInfo, "device_name"> => {
  if (!value || typeof value !== "object") {
    return {
      username: "-",
      full_name: "ผู้ใช้งาน",
      role: "-",
    };
  }

  const user = value as StoredUser;

  return {
    username: user.username || "-",
    full_name: user.full_name || user.username || "ผู้ใช้งาน",
    role: user.role || "-",
  };
};

const getRoleLabel = (role: string): string => {
  const roleMap: Record<string, string> = {
    owner: "เจ้าของร้าน",
    admin: "ผู้ดูแลระบบ",
    manager: "ผู้จัดการ",
    staff: "พนักงาน",
    cashier: "พนักงานคิดเงิน",
  };

  return roleMap[role.toLowerCase()] || role;
};

const getApiErrorMessage = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  try {
    const data: { message?: string | string[]; error?: string } =
      await response.json();

    if (Array.isArray(data.message)) {
      return data.message.join(", ");
    }

    return data.message || data.error || fallback;
  } catch {
    return fallback;
  }
};

export function UserInfoPage() {
  const [userInfo, setUserInfo] = useState<UserInfo>(fallbackUserInfo);
  const [storedDevice, setStoredDevice] = useState<PosDevice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deviceNameInput, setDeviceNameInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadUserInfo = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [storedUser, rawStoredDevice] = await Promise.all([
        window.electronStore.get("user"),
        window.electronStore.get(POS_DEVICE_KEY),
      ]);

      const device = getStoredDevice(rawStoredDevice);
      const user = getUserInfo(storedUser);

      setStoredDevice(device);
      setUserInfo({
        ...user,
        device_name: device?.device_name || "-",
      });
    } catch (err) {
      console.error("Error loading user info:", err);
      setError("ไม่สามารถโหลดข้อมูลผู้ใช้งานได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUserInfo();
  }, []);

  const openEditModal = () => {
    setDeviceNameInput(userInfo.device_name === "-" ? "" : userInfo.device_name);
    setSubmitError(null);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsEditModalOpen(false);
    setDeviceNameInput("");
    setSubmitError(null);
  };

  const handleEditDeviceName = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedName = deviceNameInput.trim();
    if (!trimmedName) {
      setSubmitError("กรุณากรอกชื่อเครื่อง POS");
      return;
    }

    if (!storedDevice?.machine_id) {
      setSubmitError("ไม่พบ machine_id ของเครื่อง POS");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const apiBaseUrl = await getApiBaseUrl();
      const response = await fetch(
        `${apiBaseUrl}/pos-devices/${encodeURIComponent(storedDevice.machine_id)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ device_name: trimmedName }),
        },
      );

      if (!response.ok) {
        const message = await getApiErrorMessage(
          response,
          `แก้ไขชื่อเครื่องไม่สำเร็จ (${response.status})`,
        );
        throw new Error(message);
      }

      const data = await response.json().catch(() => ({}));
      const responseDevice = data?.pos_device ?? data?.data ?? data;
      const updatedDevice: PosDevice = {
        ...storedDevice,
        ...responseDevice,
        machine_id: responseDevice?.machine_id ?? storedDevice.machine_id,
        device_name: responseDevice?.device_name ?? trimmedName,
      };

      await window.electronStore.set(POS_DEVICE_KEY, updatedDevice);

      setStoredDevice(updatedDevice);
      setUserInfo((current) => ({
        ...current,
        device_name: updatedDevice.device_name || trimmedName,
      }));
      setIsEditModalOpen(false);
      setDeviceNameInput("");
    } catch (err) {
      console.error("Error updating device name:", err);
      setSubmitError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถแก้ไขชื่อเครื่องได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const cards = [
    {
      key: "device_name",
      label: "ชื่อเครื่อง POS",
      value: userInfo.device_name,
      icon: IconDeviceLaptop,
      editable: true,
    },
    {
      key: "username",
      label: "ชื่อผู้ใช้",
      value: userInfo.username,
      icon: IconId,
    },
    {
      key: "full_name",
      label: "ชื่อ-นามสกุล",
      value: userInfo.full_name,
      icon: IconUser,
    },
    {
      key: "role",
      label: "สิทธิ์การใช้งาน",
      value: getRoleLabel(userInfo.role),
      icon: IconUserShield,
    },
  ];

  return (
    <div className="flex h-full flex-col bg-slate-50 px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ข้อมูลผู้ใช้งาน</h1>
          <p className="mt-1 text-sm text-slate-500">
            ดูข้อมูลผู้ใช้งานและเครื่อง POS ที่ผูกกับร้านของคุณ
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl bg-white p-4 shadow-sm">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400">
            กำลังโหลดข้อมูล...
          </div>
        ) : error ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <button
              type="button"
              onClick={loadUserInfo}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              ลองอีกครั้ง
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => {
              const Icon = card.icon;

              return (
                <li
                  key={card.key}
                  className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#1d6fd8]/10">
                    <Icon size={21} className="text-[#1d6fd8]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold leading-6 text-slate-800">
                      {card.label}
                    </p>
                    <p className="text-base font-medium leading-6 text-slate-600">
                      {card.value || "-"}
                    </p>
                  </div>
                  {card.editable ? (
                    <button
                      type="button"
                      onClick={openEditModal}
                      aria-label="แก้ไขชื่อเครื่อง POS"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                    >
                      <IconPencil size={16} />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isEditModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={closeEditModal}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                แก้ไขชื่อเครื่อง POS
              </h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <IconX size={20} />
              </button>
            </div>

            <form onSubmit={handleEditDeviceName} className="space-y-4">
              <div>
                <label
                  htmlFor="device-name"
                  className="mb-1.5 block text-sm font-medium text-slate-600"
                >
                  ชื่อเครื่อง POS
                </label>
                <input
                  id="device-name"
                  type="text"
                  value={deviceNameInput}
                  onChange={(event) => setDeviceNameInput(event.target.value)}
                  placeholder="เช่น เครื่องคิดเงินหน้าร้าน"
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
                {storedDevice?.machine_id ? (
                  <p className="mt-1.5 text-sm text-slate-400">
                    Machine ID: {storedDevice.machine_id}
                  </p>
                ) : null}
                {submitError ? (
                  <p className="mt-1.5 text-sm text-red-500">{submitError}</p>
                ) : null}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a5fc0] disabled:opacity-50"
                >
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
