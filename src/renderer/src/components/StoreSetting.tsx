import { useEffect, useState, type FormEvent, useRef } from "react";
import {
  IconBuildingStore,
  IconMapPin,
  IconGlobe,
  IconRefresh,
  IconEdit,
  IconDeviceFloppy,
  IconX,
  IconCheck,
  IconUpload,
  IconTrash,
  IconEye,
} from "@tabler/icons-react";
import { ensureValidAccessToken, refreshAccessToken } from "./auth";

// Types
export interface StoreSettings {
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
  logo_url: string;
  receipt_image_url: string;
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

export interface PaymentAccount {
  id: number;
  account_name: string;
  bank_name: string;
  account_no: string;
  account_holder: string;
  promptpay_type: string;
  promptpay_id: string;
  is_default: boolean;
}

export interface StoreData {
  store: StoreSettings;
  payment_account: PaymentAccount;
}

// API Helpers
const getApiBaseUrl = async (): Promise<string> => {
  const apiPath = await window.electronStore.get("apiPath");
  if (typeof apiPath !== "string" || !apiPath.trim()) {
    throw new Error("ไม่พบ API endpoint ใน store");
  }
  return apiPath.trim().replace(/\/+$/, "");
};

export const authorizedFetch = async (
  path: string,
  init: RequestInit = {},
): Promise<Response> => {
  const isAuthenticated = await ensureValidAccessToken();
  if (!isAuthenticated) {
    throw new Error("ไม่สามารถยืนยันตัวตนได้");
  }

  const apiBaseUrl = await getApiBaseUrl();
  let accessToken = await window.electronStore.get("access_token");

  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw new Error("ไม่พบ access token");
  }

  const request = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
    });
  };

  let response = await request(accessToken);
  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    response = await request(accessToken);
  }
  return response;
};

export const getApiErrorMessage = async (
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

const getUploadedImageUrl = async (response: Response): Promise<string> => {
  const data: {
    url?: string;
    image_url?: string;
    imageUrl?: string;
    path?: string;
    filename?: string;
    data?:
      | string
      | {
          url?: string;
          image_url?: string;
          imageUrl?: string;
          path?: string;
          filename?: string;
        };
  } = await response.json().catch(() => ({}));

  const nestedData = typeof data.data === "object" ? data.data : undefined;
  const uploadedImageUrl =
    data.url ||
    data.image_url ||
    data.imageUrl ||
    data.path ||
    (typeof data.data === "string" ? data.data : undefined) ||
    nestedData?.url ||
    nestedData?.image_url ||
    nestedData?.imageUrl ||
    nestedData?.path ||
    (data.filename ? `/images/${data.filename}` : undefined) ||
    (nestedData?.filename ? `/images/${nestedData.filename}` : undefined) ||
    response.headers.get("Location");

  if (!uploadedImageUrl) {
    throw new Error("อัปโหลดโลโก้สำเร็จ แต่ไม่พบ URL ของรูปที่อัปโหลด");
  }

  return uploadedImageUrl;
};

const getImageRequestPath = (imageUrl?: string | null): string | null => {
  if (!imageUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(imageUrl)) {
    try {
      return new URL(imageUrl).pathname;
    } catch {
      return null;
    }
  }

  return imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
};

// Form Input Component
export const FormInput = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  disabled = false,
  helper,
  rows,
}: {
  label: string;
  value?: string | number | boolean;
  onChange?: (value: any) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  helper?: string;
  rows?: number;
}) => {
  const inputClassName =
    "w-full box-border rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20 disabled:bg-slate-50 disabled:text-slate-500";

  if (type === "checkbox") {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-slate-300 text-[#1d6fd8] focus:ring-[#1d6fd8]"
        />
        <label className="text-sm text-slate-600">{label}</label>
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <div className="min-w-0">
        <label className="mb-1.5 block text-sm font-medium text-slate-600">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <textarea
          value={String(value || "")}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows || 3}
          className={inputClassName}
        />
        {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
      </div>
    );
  }

  if (type === "select") {
    const options = [
      { value: "80MM", label: "80 มม." },
      { value: "58MM", label: "58 มม." },
      { value: "A4", label: "A4" },
    ];

    return (
      <div className="min-w-0">
        <label className="mb-1.5 block text-sm font-medium text-slate-600">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <select
          value={String(value || "")}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className={inputClassName}
        >
          <option value="">เลือก</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-sm font-medium text-slate-600">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={String(value || "")}
        onChange={(e) => {
          if (type === "number") {
            onChange?.(parseFloat(e.target.value) || 0);
          } else {
            onChange?.(e.target.value);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClassName}
      />
      {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
    </div>
  );
};

// Section Components
export const SectionHeader = ({
  id,
  icon,
  title,
  count,
  expandedSections,
  toggleSection,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  count?: number;
  expandedSections: Set<string>;
  toggleSection: (section: string) => void;
}) => {
  const isExpanded = expandedSections.has(id);

  return (
    <button
      type="button"
      onClick={() => toggleSection(id)}
      className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
    >
      <div className="flex items-center gap-2">
        <span className="text-[#1d6fd8]">{icon}</span>
        <span className="text-sm font-medium text-slate-700">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-[#1d6fd8]/10 px-2 py-0.5 text-xs text-[#1d6fd8]">
            {count}
          </span>
        )}
      </div>
      <span className="text-slate-400">{isExpanded ? "▾" : "▸"}</span>
    </button>
  );
};

export const SectionContent = ({
  id,
  children,
  expandedSections,
}: {
  id: string;
  children: React.ReactNode;
  expandedSections: Set<string>;
}) => {
  if (!expandedSections.has(id)) return null;
  return <div className="mt-3 space-y-4">{children}</div>;
};

// Main Component - เฉพาะข้อมูลทั่วไปของร้าน
interface StoreSettingProps {
  storeData: StoreData | null;
  formStore: Partial<StoreSettings>;
  isEditing: boolean;
  isSaving: boolean;
  updateStoreField: <K extends keyof StoreSettings>(
    key: K,
    value: StoreSettings[K]
  ) => void;
  expandedSections: Set<string>;
  toggleSection: (section: string) => void;
  onStartEditing?: () => void;
  onCancelEditing?: () => void;
  onSave?: (event: FormEvent) => void;
  onLogoUploaded?: (logoUrl: string) => Promise<void>;
  onLogoDeleted?: () => Promise<void>;
}

export default function StoreSetting({
  storeData,
  formStore,
  isEditing,
  isSaving,
  updateStoreField,
  expandedSections,
  toggleSection,
  onStartEditing,
  onCancelEditing,
  onSave,
  onLogoUploaded,
  onLogoDeleted,
}: StoreSettingProps) {
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deletingLogo, setDeletingLogo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [showLogoPreviewModal, setShowLogoPreviewModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoUrl = storeData
    ? isEditing
      ? formStore.logo_url
      : storeData.store.logo_url
    : "";

  useEffect(() => {
    let isCancelled = false;
    let objectUrl: string | null = null;

    const loadLogo = async () => {
      setLogoPreviewUrl(null);
      const imagePath = getImageRequestPath(typeof logoUrl === "string" ? logoUrl : null);
      if (!imagePath) {
        return;
      }

      try {
        const response = await authorizedFetch(imagePath);
        if (!response.ok) {
          throw new Error(`โหลดโลโก้ไม่สำเร็จ (${response.status})`);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);

        if (!isCancelled) {
          setLogoPreviewUrl(objectUrl);
        }
      } catch (err) {
        console.error("Error loading store logo:", err);
        if (!isCancelled) {
          setLogoPreviewUrl(null);
        }
      }
    };

    void loadLogo();

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [logoUrl]);

  if (!storeData) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-slate-400">
        <IconBuildingStore size={34} className="text-slate-300" />
        <p className="text-sm">ไม่พบข้อมูลร้าน</p>
      </div>
    );
  }

  const { store } = storeData;

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await authorizedFetch("/images/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, "อัปโหลดโลโก้ไม่สำเร็จ")
        );
      }

      const uploadedLogoUrl = await getUploadedImageUrl(response);
      updateStoreField("logo_url", uploadedLogoUrl);
      await onLogoUploaded?.(uploadedLogoUrl);
      setShowLogoPreviewModal(true);
    } catch (err) {
      console.error("Error uploading logo:", err);
      setUploadError(err instanceof Error ? err.message : "อัปโหลดโลโก้ไม่สำเร็จ");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleLogoDelete = async () => {
    const imagePath = getImageRequestPath(typeof logoUrl === "string" ? logoUrl : null);
    if (!imagePath) return;

    setDeletingLogo(true);
    setUploadError(null);

    try {
      const response = await authorizedFetch(imagePath, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, `ลบโลโก้ไม่สำเร็จ (${response.status})`),
        );
      }

      updateStoreField("logo_url", "");
      await onLogoDeleted?.();
    } catch (err) {
      console.error("Error deleting logo:", err);
      setUploadError(err instanceof Error ? err.message : "ลบโลโก้ไม่สำเร็จ");
    } finally {
      setDeletingLogo(false);
    }
  };

  return (
    <>
    <div className="min-w-0 space-y-4">
      {/* ข้อมูลทั่วไป */}
      <SectionHeader
        id="general"
        icon={<IconBuildingStore size={18} />}
        title="ข้อมูลทั่วไป"
        expandedSections={expandedSections}
        toggleSection={toggleSection}
      />
      <SectionContent id="general" expandedSections={expandedSections}>
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
          <FormInput
            label="ชื่อร้าน"
            value={isEditing ? formStore.store_name : store.store_name}
            onChange={(v) => updateStoreField("store_name", v)}
            required
            disabled={!isEditing}
          />
          <FormInput
            label="ชื่อเจ้าของ"
            value={isEditing ? formStore.owner_name : store.owner_name}
            onChange={(v) => updateStoreField("owner_name", v)}
            disabled={!isEditing}
          />
          <FormInput
            label="เลขประจำตัวผู้เสียภาษี"
            value={isEditing ? formStore.tax_id : store.tax_id}
            onChange={(v) => updateStoreField("tax_id", v)}
            disabled={!isEditing}
            helper="13 หลัก"
          />
          <FormInput
            label="ชื่อสาขา"
            value={isEditing ? formStore.branch_name : store.branch_name}
            onChange={(v) => updateStoreField("branch_name", v)}
            disabled={!isEditing}
          />
          <FormInput
            label="รหัสสาขา"
            value={isEditing ? formStore.branch_no : store.branch_no}
            onChange={(v) => updateStoreField("branch_no", v)}
            disabled={!isEditing}
            helper="00000 = สำนักงานใหญ่"
          />
        </div>

        {/* Logo Upload */}
        <div className="border-t border-slate-100 pt-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-600">
            โลโก้ร้าน
          </label>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {logoPreviewUrl ? (
                <img
                  src={logoPreviewUrl}
                  alt="Logo"
                  className="h-full w-full object-cover"
                />
              ) : (
                <IconBuildingStore size={28} className="text-slate-300" />
              )}
            </div>
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={!isEditing || uploadingLogo}
                className="hidden"
                id="logo-upload"
              />
              <label
                htmlFor="logo-upload"
                className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 ${
                  (!isEditing || uploadingLogo) && "opacity-50 cursor-not-allowed"
                }`}
              >
                <IconUpload size={18} />
                {uploadingLogo ? "กำลังอัปโหลด..." : "อัปโหลดโลโก้"}
              </label>
              {logoUrl ? (
                <button
                  type="button"
                  onClick={() => setShowLogoPreviewModal(true)}
                  disabled={!logoPreviewUrl}
                  className="ml-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <IconEye size={18} />
                  ดูตัวอย่างโลโก้
                </button>
              ) : null}
              {logoUrl ? (
                <button
                  type="button"
                  onClick={() => void handleLogoDelete()}
                  disabled={!isEditing || deletingLogo}
                  className="ml-2 inline-flex items-center gap-2 rounded-xl border border-red-100 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <IconTrash size={18} />
                  {deletingLogo ? "กำลังลบ..." : "ลบโลโก้"}
                </button>
              ) : null}
              <p className="mt-1 text-xs text-slate-400">
                รองรับไฟล์ JPG, PNG, GIF ขนาดไม่เกิน 2MB
              </p>
              {uploadError && (
                <p className="mt-1 text-xs text-red-500">{uploadError}</p>
              )}
            </div>
          </div>
        </div>
      </SectionContent>

      {/* ที่อยู่และข้อมูลติดต่อ */}
      <SectionHeader
        id="address"
        icon={<IconMapPin size={18} />}
        title="ที่อยู่และข้อมูลติดต่อ"
        expandedSections={expandedSections}
        toggleSection={toggleSection}
      />
      <SectionContent id="address" expandedSections={expandedSections}>
        <div className="grid min-w-0 grid-cols-1 gap-4">
          <FormInput
            label="ที่อยู่"
            value={isEditing ? formStore.address : store.address}
            onChange={(v) => updateStoreField("address", v)}
            type="textarea"
            rows={3}
            disabled={!isEditing}
          />
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
            <FormInput
              label="เบอร์โทรศัพท์"
              value={isEditing ? formStore.phone : store.phone}
              onChange={(v) => updateStoreField("phone", v)}
              disabled={!isEditing}
            />
            <FormInput
              label="อีเมล"
              value={isEditing ? formStore.email : store.email}
              onChange={(v) => updateStoreField("email", v)}
              type="email"
              disabled={!isEditing}
            />
            <FormInput
              label="เว็บไซต์"
              value={isEditing ? formStore.website : store.website}
              onChange={(v) => updateStoreField("website", v)}
              disabled={!isEditing}
            />
          </div>
        </div>
      </SectionContent>

      {/* ภาษาและเขตเวลา */}
      <SectionHeader
        id="system"
        icon={<IconGlobe size={18} />}
        title="ภาษาและเขตเวลา"
        expandedSections={expandedSections}
        toggleSection={toggleSection}
      />
      <SectionContent id="system" expandedSections={expandedSections}>
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
          <FormInput
            label="ภาษา"
            value={isEditing ? formStore.language : store.language}
            onChange={(v) => updateStoreField("language", v)}
            disabled={!isEditing}
            helper="th = ไทย, en = อังกฤษ"
          />
          <FormInput
            label="สกุลเงิน"
            value={isEditing ? formStore.currency : store.currency}
            onChange={(v) => updateStoreField("currency", v)}
            disabled={!isEditing}
            helper="THB = บาท, USD = ดอลลาร์"
          />
          <FormInput
            label="เขตเวลา"
            value={isEditing ? formStore.timezone : store.timezone}
            onChange={(v) => updateStoreField("timezone", v)}
            disabled={!isEditing}
            helper="Asia/Bangkok"
          />
        </div>
        <FormInput
          label="ชื่อลูกค้าเริ่มต้น"
          value={isEditing ? formStore.default_customer_name : store.default_customer_name}
          onChange={(v) => updateStoreField("default_customer_name", v)}
          disabled={!isEditing}
          helper="ใช้สำหรับการขายหน้าร้านที่ไม่มีข้อมูลลูกค้า"
        />
      </SectionContent>

      {/* เว้นระยะด้านล่างกันเนื้อหาชิดขอบจอ/taskbar ตอนเลื่อนสุด */}
      <div className="h-12" aria-hidden="true" />
    </div>

    {showLogoPreviewModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={() => setShowLogoPreviewModal(false)}
      >
        <div
          className="relative max-h-[80vh] max-w-[90vw] rounded-2xl bg-white p-4 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setShowLogoPreviewModal(false)}
            className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-md transition-colors hover:bg-slate-100"
          >
            <IconX size={18} />
          </button>
          <p className="mb-3 text-center text-sm font-medium text-slate-600">
            ตัวอย่างโลโก้ร้าน
          </p>
          {logoPreviewUrl ? (
            <img
              src={logoPreviewUrl}
              alt="Logo preview"
              className="max-h-[65vh] max-w-full rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center text-slate-300">
              <IconBuildingStore size={40} />
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}
