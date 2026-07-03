import { useEffect, useState, type FormEvent } from "react";
import {
  IconAlertCircle,
  IconCheck,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconId,
  IconLock,
  IconNumber123,
  IconPhone,
  IconRefresh,
  IconTrash,
  IconUser,
  IconUserPlus,
  IconUserShield,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { ensureValidAccessToken, refreshAccessToken } from "./auth";

const API_PATH_KEY = "apiPath";

type UserRole = "owner" | "admin" | "manager" | "staff" | "cashier";
type ActiveTab = "add" | "manage";

interface UserRecord {
  user_id: string;
  username: string;
  full_name: string;
  phone_number?: string;
  role: UserRole | string;
  is_active?: boolean;
  last_login_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface RegisterResponse {
  status: string;
  message: string;
  data?: UserRecord;
}

interface UsersResponse {
  status?: string;
  message?: string;
  data?: UserRecord[] | { users?: UserRecord[]; data?: UserRecord[] };
  users?: UserRecord[];
}

interface StoredUser {
  user_id?: string;
  username?: string;
}

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "owner", label: "เจ้าของร้าน" },
  { value: "admin", label: "ผู้ดูแลระบบ" },
  { value: "manager", label: "ผู้จัดการ" },
  { value: "staff", label: "พนักงาน" },
  { value: "cashier", label: "พนักงานคิดเงิน" },
];

const getRoleLabel = (role: string): string =>
  roleOptions.find((option) => option.value === role)?.label || role;

const getApiBaseUrl = async (): Promise<string> => {
  const apiPath = await window.electronStore.get(API_PATH_KEY);

  if (typeof apiPath !== "string" || !apiPath.trim()) {
    throw new Error("ไม่พบ API path กรุณาตั้งค่า API ก่อนใช้งาน");
  }

  return apiPath.trim().replace(/\/+$/, "");
};

const getAccessToken = async (): Promise<string> => {
  if (!(await ensureValidAccessToken())) {
    throw new Error("ไม่สามารถยืนยันตัวตนได้ กรุณาเข้าสู่ระบบใหม่");
  }

  const token = await window.electronStore.get("access_token");
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("ไม่พบ access token กรุณาเข้าสู่ระบบใหม่");
  }

  return token;
};

const getApiErrorMessage = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  try {
    const data = (await response.json()) as {
      message?: string | string[];
      error?: string;
    };

    if (Array.isArray(data.message)) {
      return data.message.join(", ");
    }

    return data.message || data.error || fallback;
  } catch {
    return fallback;
  }
};

const unwrapUsers = (payload: UsersResponse): UserRecord[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.users)) {
    return payload.users;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (payload.data && !Array.isArray(payload.data)) {
    if (Array.isArray(payload.data.users)) {
      return payload.data.users;
    }

    if (Array.isArray(payload.data.data)) {
      return payload.data.data;
    }
  }

  return [];
};

const requestWithAuth = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  let token = await getAccessToken();
  const buildRequest = (accessToken: string) =>
    fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

  let response = await buildRequest(token);
  if (response.status === 401) {
    token = await refreshAccessToken();
    response = await buildRequest(token);
  }

  return response;
};

export function RegisterPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("add");

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState<UserRole>("staff");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registeredUser, setRegisteredUser] = useState<UserRecord | null>(null);

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [manageMessage, setManageMessage] = useState<string | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("staff");
  const [editPassword, setEditPassword] = useState("");
  const [editPinCode, setEditPinCode] = useState("");
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const resetForm = () => {
    setUsername("");
    setFullName("");
    setPhoneNumber("");
    setRole("staff");
    setPassword("");
    setConfirmPassword("");
    setPinCode("");
  };

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    setManageError(null);
    setManageMessage(null);

    try {
      const [baseUrl, storedUser] = await Promise.all([
        getApiBaseUrl(),
        window.electronStore.get("user"),
      ]);
      setCurrentUser(
        storedUser && typeof storedUser === "object"
          ? (storedUser as StoredUser)
          : null,
      );

      const response = await requestWithAuth(`${baseUrl}/users`, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `โหลดรายชื่อพนักงานไม่สำเร็จ (${response.status})`,
          ),
        );
      }

      const data = (await response.json()) as UsersResponse;
      setUsers(unwrapUsers(data));
    } catch (err) {
      setManageError(
        err instanceof Error
          ? err.message
          : "โหลดรายชื่อพนักงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === "manage") {
      void loadUsers();
    }
  }, [activeTab]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedUsername = username.trim();
    const trimmedFullName = fullName.trim();
    const trimmedPhoneNumber = phoneNumber.trim();
    const trimmedPinCode = pinCode.trim();

    setError(null);
    setMessage(null);
    setRegisteredUser(null);

    if (
      !trimmedUsername ||
      !trimmedFullName ||
      !trimmedPhoneNumber ||
      !password ||
      !trimmedPinCode
    ) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (password !== confirmPassword) {
      setError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setIsSubmitting(true);

    try {
      const baseUrl = await getApiBaseUrl();
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: trimmedUsername,
          password,
          full_name: trimmedFullName,
          phone_number: trimmedPhoneNumber,
          role,
          pin_code: trimmedPinCode,
          is_active: true,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `ลงทะเบียนไม่สำเร็จ (${response.status})`,
          ),
        );
      }

      const data = (await response.json()) as RegisterResponse;
      if (data.status !== "ok") {
        throw new Error(data.message || "ลงทะเบียนไม่สำเร็จ");
      }

      setMessage(data.message || "ลงทะเบียนผู้ใช้สำเร็จ");
      setRegisteredUser(data.data ?? null);
      resetForm();
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "TimeoutError" || err.message.includes("timeout")) {
          setError("เชื่อมต่อ API ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        } else {
          setError(err.message);
        }
      } else {
        setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditUser = (user: UserRecord) => {
    setEditingUser(user);
    setEditUsername(user.username || "");
    setEditFullName(user.full_name || "");
    setEditPhoneNumber(user.phone_number || "");
    setEditRole(
      roleOptions.some((option) => option.value === user.role)
        ? (user.role as UserRole)
        : "staff",
    );
    setEditPassword("");
    setEditPinCode("");
    setManageError(null);
    setManageMessage(null);
  };

  const closeEditUser = () => {
    if (isSavingUser) return;
    setEditingUser(null);
    setEditPassword("");
    setEditPinCode("");
  };

  const handleUpdateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingUser) return;

    const payload: Record<string, string> = {
      username: editUsername.trim(),
      full_name: editFullName.trim(),
      phone_number: editPhoneNumber.trim(),
      role: editRole,
    };

    if (!payload.username || !payload.full_name) {
      setManageError("กรุณากรอกชื่อผู้ใช้และชื่อ-นามสกุล");
      return;
    }

    if (editPassword.trim()) {
      payload.password = editPassword;
    }

    if (editPinCode.trim()) {
      payload.pin_code = editPinCode.trim();
    }

    setIsSavingUser(true);
    setManageError(null);
    setManageMessage(null);

    try {
      const baseUrl = await getApiBaseUrl();
      const response = await requestWithAuth(
        `${baseUrl}/users/${encodeURIComponent(editingUser.user_id)}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `แก้ไขพนักงานไม่สำเร็จ (${response.status})`,
          ),
        );
      }

      setManageMessage("แก้ไขข้อมูลพนักงานสำเร็จ");
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      setManageError(
        err instanceof Error
          ? err.message
          : "แก้ไขข้อมูลพนักงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setIsSavingUser(false);
    }
  };

  const isCurrentUser = (user: UserRecord): boolean =>
    Boolean(
      currentUser?.user_id
        ? currentUser.user_id === user.user_id
        : currentUser?.username && currentUser.username === user.username,
    );

  const handleDeleteUser = async (user: UserRecord) => {
    if (isCurrentUser(user)) {
      setManageError("ไม่สามารถลบผู้ใช้ที่กำลังเข้าสู่ระบบอยู่ได้");
      return;
    }

    if (!window.confirm(`ต้องการลบผู้ใช้ ${user.full_name || user.username} ใช่หรือไม่?`)) {
      return;
    }

    setDeletingUserId(user.user_id);
    setManageError(null);
    setManageMessage(null);

    try {
      const baseUrl = await getApiBaseUrl();
      const response = await requestWithAuth(
        `${baseUrl}/users/${encodeURIComponent(user.user_id)}`,
        {
          method: "DELETE",
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `ลบพนักงานไม่สำเร็จ (${response.status})`,
          ),
        );
      }

      setManageMessage("ลบพนักงานสำเร็จ");
      setUsers((items) => items.filter((item) => item.user_id !== user.user_id));
    } catch (err) {
      setManageError(
        err instanceof Error ? err.message : "ลบพนักงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">พนักงาน</h1>
          <p className="mt-1 text-sm text-slate-500">
            เพิ่มและจัดการผู้ใช้สำหรับเข้าใช้งานระบบ POS
          </p>
        </div>
      </div>

      <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-xl border border-blue-100 bg-white p-1.5 shadow-sm">
        {[
          { id: "add" as ActiveTab, label: "เพิ่มพนักงาน", icon: IconUserPlus },
          { id: "manage" as ActiveTab, label: "จัดการพนักงาน", icon: IconUsers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex h-11 items-center gap-2 rounded-lg border px-5 text-sm font-semibold shadow-sm transition active:scale-[0.98] ${
                isActive
                  ? "border-[#1d6fd8] bg-[#1d6fd8] text-white shadow-[#1d6fd8]/20"
                  : "border-slate-200 bg-white text-slate-600 hover:border-[#1d6fd8]/40 hover:bg-blue-50 hover:text-[#1d6fd8]"
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl bg-white p-5 shadow-sm">
        {activeTab === "add" ? (
          <>
            <form
              onSubmit={handleSubmit}
              className="grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-2"
            >
              <Field label="ชื่อผู้ใช้">
                <IconId
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-base text-slate-800 outline-none transition focus:border-[#1d6fd8] focus:bg-white focus:ring-2 focus:ring-[#1d6fd8]/15"
                  autoComplete="username"
                />
              </Field>

              <Field label="ชื่อ-นามสกุล">
                <IconUser
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-base text-slate-800 outline-none transition focus:border-[#1d6fd8] focus:bg-white focus:ring-2 focus:ring-[#1d6fd8]/15"
                  autoComplete="name"
                />
              </Field>

              <Field label="เบอร์โทรศัพท์">
                <IconPhone
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-base text-slate-800 outline-none transition focus:border-[#1d6fd8] focus:bg-white focus:ring-2 focus:ring-[#1d6fd8]/15"
                  autoComplete="tel"
                />
              </Field>

              <Field label="สิทธิ์การใช้งาน">
                <IconUserShield
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as UserRole)}
                  className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-base font-medium text-slate-800 outline-none transition focus:border-[#1d6fd8] focus:bg-white focus:ring-2 focus:ring-[#1d6fd8]/15"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="PIN Code">
                <IconNumber123
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinCode}
                  onChange={(event) => setPinCode(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-base text-slate-800 outline-none transition focus:border-[#1d6fd8] focus:bg-white focus:ring-2 focus:ring-[#1d6fd8]/15"
                  autoComplete="off"
                />
              </Field>

              <Field label="รหัสผ่าน">
                <IconLock
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-12 text-base text-slate-800 outline-none transition focus:border-[#1d6fd8] focus:bg-white focus:ring-2 focus:ring-[#1d6fd8]/15"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </Field>

              <Field label="ยืนยันรหัสผ่าน">
                <IconLock
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-base text-slate-800 outline-none transition focus:border-[#1d6fd8] focus:bg-white focus:ring-2 focus:ring-[#1d6fd8]/15"
                  autoComplete="new-password"
                />
              </Field>

              <div className="lg:col-span-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1d6fd8] px-5 text-base font-semibold text-white transition hover:bg-[#1a5fc0] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <IconUserPlus size={20} />
                  )}
                  ลงทะเบียน
                </button>
              </div>
            </form>

            {error ? <AlertMessage type="error" message={error} /> : null}
            {message ? (
              <SuccessMessage message={message} registeredUser={registeredUser} />
            ) : null}
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">จัดการพนักงาน</h2>
              <button
                type="button"
                onClick={loadUsers}
                disabled={isLoadingUsers}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                <IconRefresh size={18} className={isLoadingUsers ? "animate-spin" : ""} />
                โหลดใหม่
              </button>
            </div>

            {manageError ? <AlertMessage type="error" message={manageError} /> : null}
            {manageMessage ? <AlertMessage type="success" message={manageMessage} /> : null}

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">ชื่อผู้ใช้</th>
                    <th className="px-4 py-3">ชื่อ-นามสกุล</th>
                    <th className="px-4 py-3">เบอร์โทรศัพท์</th>
                    <th className="px-4 py-3">สิทธิ์</th>
                    <th className="px-4 py-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingUsers ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        กำลังโหลดรายชื่อพนักงาน...
                      </td>
                    </tr>
                  ) : users.length ? (
                    users.map((user) => {
                      const cannotDelete = isCurrentUser(user);

                      return (
                        <tr key={user.user_id} className="bg-white">
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {user.username}
                            {cannotDelete ? (
                              <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                                คุณ
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{user.full_name}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {user.phone_number || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {getRoleLabel(user.role)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditUser(user)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                                aria-label="แก้ไขพนักงาน"
                              >
                                <IconEdit size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(user)}
                                disabled={cannotDelete || deletingUserId === user.user_id}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35"
                                aria-label="ลบพนักงาน"
                                title={cannotDelete ? "ไม่สามารถลบผู้ใช้ที่กำลังเข้าสู่ระบบอยู่ได้" : "ลบพนักงาน"}
                              >
                                {deletingUserId === user.user_id ? (
                                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-red-500" />
                                ) : (
                                  <IconTrash size={18} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        ไม่พบรายชื่อพนักงาน
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {editingUser ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={closeEditUser}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">แก้ไขพนักงาน</h2>
              <button
                type="button"
                onClick={closeEditUser}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <IconX size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  ชื่อผู้ใช้
                </span>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(event) => setEditUsername(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/15"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  ชื่อ-นามสกุล
                </span>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(event) => setEditFullName(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/15"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  เบอร์โทรศัพท์
                </span>
                <input
                  type="tel"
                  value={editPhoneNumber}
                  onChange={(event) => setEditPhoneNumber(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/15"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  สิทธิ์การใช้งาน
                </span>
                <select
                  value={editRole}
                  onChange={(event) => setEditRole(event.target.value as UserRole)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/15"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  รหัสผ่านใหม่
                </span>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(event) => setEditPassword(event.target.value)}
                  placeholder="เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยนรหัสผ่าน"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/15"
                  autoComplete="new-password"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  PIN ใหม่
                </span>
                <input
                  type="password"
                  inputMode="numeric"
                  value={editPinCode}
                  onChange={(event) => setEditPinCode(event.target.value)}
                  placeholder="เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน PIN"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/15"
                  autoComplete="off"
                />
              </label>

              <div className="flex justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={closeEditUser}
                  disabled={isSavingUser}
                  className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1d6fd8] px-4 text-sm font-semibold text-white hover:bg-[#1a5fc0] disabled:opacity-60"
                >
                  {isSavingUser ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : null}
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <span className="relative block">{children}</span>
    </label>
  );
}

function AlertMessage({
  type,
  message,
}: {
  type: "error" | "success";
  message: string;
}) {
  const isError = type === "error";
  const Icon = isError ? IconAlertCircle : IconCheck;

  return (
    <div
      className={`mt-5 flex max-w-5xl items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      <Icon size={20} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function SuccessMessage({
  message,
  registeredUser,
}: {
  message: string;
  registeredUser: UserRecord | null;
}) {
  return (
    <div className="mt-5 max-w-5xl rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      <div className="flex items-center gap-2 font-semibold">
        <IconCheck size={20} className="shrink-0" />
        <span>{message}</span>
      </div>
      {registeredUser ? (
        <div className="mt-3 grid grid-cols-1 gap-2 text-slate-700 sm:grid-cols-2">
          <p>
            <span className="font-semibold">ชื่อผู้ใช้:</span>{" "}
            {registeredUser.username}
          </p>
          <p>
            <span className="font-semibold">ชื่อ-นามสกุล:</span>{" "}
            {registeredUser.full_name}
          </p>
          <p>
            <span className="font-semibold">เบอร์โทรศัพท์:</span>{" "}
            {registeredUser.phone_number || "-"}
          </p>
          <p>
            <span className="font-semibold">สิทธิ์:</span>{" "}
            {getRoleLabel(registeredUser.role)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
