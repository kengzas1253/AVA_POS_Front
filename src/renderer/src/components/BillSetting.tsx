import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  IconBuildingStore,
  IconPhoto,
  IconQrcode,
  IconReceipt,
  IconRefresh,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import QRCode from "qrcode";
import generatePayload from "promptpay-qr";
import {
  authorizedFetch,
  FormInput,
  getApiErrorMessage,
  SectionContent,
  SectionHeader,
  type PaymentAccount,
  type StoreData,
  type StoreSettings,
} from "./StoreSetting";

interface BillSettingProps {
  store: StoreSettings;
  formStore: Partial<StoreSettings>;
  isEditing: boolean;
  updateStoreField: <K extends keyof StoreSettings>(
    key: K,
    value: StoreSettings[K]
  ) => void;
  expandedSections: Set<string>;
  toggleSection: (section: string) => void;
}

interface StoreSettingsApiResponse {
  status?: string;
  message?: string;
  data?: StoreData;
}

interface UploadImageResponse {
  url?: string;
  filename?: string;
  message?: string;
}

const MAX_RECEIPT_IMAGE_SIZE = 5 * 1024 * 1024;
const RECEIPT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

const getImageFilename = (imageUrl?: string | null): string | null => {
  const requestPath = getImageRequestPath(imageUrl);
  if (!requestPath) {
    return null;
  }

  const parts = requestPath.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
};

const loadImageObjectUrl = async (
  imageUrl?: string | null,
): Promise<string | null> => {
  const requestPath = getImageRequestPath(imageUrl);
  if (!requestPath) {
    return null;
  }

  const response = await authorizedFetch(requestPath);
  if (!response.ok) {
    throw new Error(`Load image failed (${response.status})`);
  }

  return URL.createObjectURL(await response.blob());
};

const getUploadedImageUrl = async (response: Response): Promise<string> => {
  const data = (await response.json().catch(() => ({}))) as UploadImageResponse;
  const uploadedUrl =
    data.url ||
    (data.filename ? `/images/${data.filename}` : undefined) ||
    response.headers.get("Location");

  if (!uploadedUrl) {
    throw new Error("อัปโหลดรูปสำเร็จ แต่ไม่พบ URL ของรูป");
  }

  return uploadedUrl;
};

const generatePromptPayQrDataUrl = async (
  promptpayId?: string | null,
  amount?: number,
): Promise<string | null> => {
  const cleanId = promptpayId?.replace(/[^0-9]/g, "");
  if (!cleanId) {
    return null;
  }

  try {
    const payload = generatePayload(cleanId, { amount });
    return await QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 160,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
  } catch (err) {
    console.error("Error generating PromptPay QR:", err);
    return null;
  }
};

const formatPreviewDateTime = (date: Date): string =>
  new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(date);

export function BillSetting({
  store,
  formStore,
  isEditing,
  updateStoreField,
  expandedSections,
  toggleSection,
}: BillSettingProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewStore, setPreviewStore] = useState<StoreSettings | null>(store);
  const [paymentAccount, setPaymentAccount] = useState<PaymentAccount | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadingReceiptImage, setIsUploadingReceiptImage] = useState(false);
  const [isDeletingReceiptImage, setIsDeletingReceiptImage] = useState(false);
  const [isReceiptImageModalOpen, setIsReceiptImageModalOpen] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [receiptImagePreviewUrl, setReceiptImagePreviewUrl] = useState<string | null>(null);
  const [promptPayQrDataUrl, setPromptPayQrDataUrl] = useState<string | null>(null);
  const [previewDateTime, setPreviewDateTime] = useState(() =>
    formatPreviewDateTime(new Date()),
  );

  const fetchPreviewStore = async () => {
    setIsPreviewLoading(true);
    setPreviewError(null);
    setPreviewDateTime(formatPreviewDateTime(new Date()));

    try {
      const response = await authorizedFetch("/store/settings");
      const payload = (await response.json().catch(() => ({}))) as StoreSettingsApiResponse;

      if (!response.ok) {
        throw new Error(payload.message || `Load preview failed (${response.status})`);
      }

      setPreviewStore(payload.data?.store ?? store);
      setPaymentAccount(payload.data?.payment_account ?? null);
    } catch (err) {
      console.error("Error loading receipt preview:", err);
      setPreviewError("ไม่สามารถโหลด Preview ใบเสร็จได้");
      setPreviewStore(store);
      setPaymentAccount(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  useEffect(() => {
    void fetchPreviewStore();
  }, [store]);

  useEffect(() => {
    let isCancelled = false;

    const buildQr = async () => {
      if (!previewStore?.show_promptpay_qr) {
        setPromptPayQrDataUrl(null);
        return;
      }

      const qrDataUrl = await generatePromptPayQrDataUrl(
        paymentAccount?.promptpay_id,
        95,
      );

      if (!isCancelled) {
        setPromptPayQrDataUrl(qrDataUrl);
      }
    };

    void buildQr();

    return () => {
      isCancelled = true;
    };
  }, [paymentAccount?.promptpay_id, previewStore?.show_promptpay_qr]);

  useEffect(() => {
    let isCancelled = false;
    let logoObjectUrl: string | null = null;
    let receiptImageObjectUrl: string | null = null;

    const loadPreviewImages = async () => {
      setLogoPreviewUrl(null);
      setReceiptImagePreviewUrl(null);

      try {
        const [logoUrl, receiptImageUrl] = await Promise.all([
          previewStore?.show_logo
            ? loadImageObjectUrl(previewStore.logo_url)
            : Promise.resolve(null),
          previewStore?.receipt_image_url
            ? loadImageObjectUrl(previewStore.receipt_image_url)
            : Promise.resolve(null),
        ]);

        logoObjectUrl = logoUrl;
        receiptImageObjectUrl = receiptImageUrl;

        if (!isCancelled) {
          setLogoPreviewUrl(logoUrl);
          setReceiptImagePreviewUrl(receiptImageUrl);
        }
      } catch (err) {
        console.error("Error loading receipt preview images:", err);
        if (!isCancelled) {
          setLogoPreviewUrl(null);
          setReceiptImagePreviewUrl(null);
        }
      }
    };

    void loadPreviewImages();

    return () => {
      isCancelled = true;
      if (logoObjectUrl) {
        URL.revokeObjectURL(logoObjectUrl);
      }
      if (receiptImageObjectUrl) {
        URL.revokeObjectURL(receiptImageObjectUrl);
      }
    };
  }, [previewStore]);

  const uploadReceiptImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const uploadResponse = await authorizedFetch("/images/upload", {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(
        await getApiErrorMessage(
          uploadResponse,
          `อัปโหลดรูปท้ายบิลไม่สำเร็จ (${uploadResponse.status})`,
        ),
      );
    }

    return getUploadedImageUrl(uploadResponse);
  };

  const saveReceiptImageUrl = async (receiptImageUrl: string) => {
    const storeId = previewStore?.id ?? store.id;
    const saveResponse = await authorizedFetch(`/store-settings/${storeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receipt_image_url: receiptImageUrl }),
    });

    if (!saveResponse.ok) {
      throw new Error(
        await getApiErrorMessage(
          saveResponse,
          `บันทึกรูปท้ายบิลไม่สำเร็จ (${saveResponse.status})`,
        ),
      );
    }
  };

  const deleteReceiptImage = async () => {
    const filename = getImageFilename(previewStore?.receipt_image_url ?? store.receipt_image_url);
    if (!filename) {
      setUploadError("ไม่พบชื่อไฟล์รูปท้ายบิล");
      return;
    }

    setIsDeletingReceiptImage(true);
    setUploadError(null);

    try {
      const deleteResponse = await authorizedFetch(`/images/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });

      if (!deleteResponse.ok) {
        throw new Error(
          await getApiErrorMessage(
            deleteResponse,
            `ลบรูปท้ายบิลไม่สำเร็จ (${deleteResponse.status})`,
          ),
        );
      }

      await saveReceiptImageUrl("");
      updateStoreField("receipt_image_url", "");
      setPreviewStore((current) =>
        current ? { ...current, receipt_image_url: "" } : current,
      );
      setIsReceiptImageModalOpen(false);
      await fetchPreviewStore();
    } catch (err) {
      console.error("Error deleting receipt image:", err);
      setUploadError(
        err instanceof Error ? err.message : "ลบรูปท้ายบิลไม่สำเร็จ",
      );
    } finally {
      setIsDeletingReceiptImage(false);
    }
  };

  const handleReceiptImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadError(null);

    if (!RECEIPT_IMAGE_TYPES.includes(file.type)) {
      setUploadError("รองรับเฉพาะ JPG, JPEG, PNG และ WEBP");
      return;
    }

    if (file.size > MAX_RECEIPT_IMAGE_SIZE) {
      setUploadError("ขนาดรูปต้องไม่เกิน 5 MB");
      return;
    }

    setIsUploadingReceiptImage(true);

    try {
      const uploadedUrl = await uploadReceiptImage(file);
      await saveReceiptImageUrl(uploadedUrl);
      updateStoreField("receipt_image_url", uploadedUrl);
      setPreviewStore((current) =>
        current ? { ...current, receipt_image_url: uploadedUrl } : current,
      );
      await fetchPreviewStore();
    } catch (err) {
      console.error("Error uploading receipt image:", err);
      setUploadError(
        err instanceof Error ? err.message : "อัปโหลดรูปท้ายบิลไม่สำเร็จ",
      );
    } finally {
      setIsUploadingReceiptImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const activePreviewStore = previewStore ?? store;
  const hasReceiptImage = !!activePreviewStore.receipt_image_url;
  const paperWidthClass =
    activePreviewStore.receipt_paper_size === "80MM"
      ? "w-[320px]"
      : activePreviewStore.receipt_paper_size === "A4"
        ? "w-[380px]"
        : "w-[250px]";

  return (
    <>
      <SectionHeader
        id="receipt"
        icon={<IconReceipt size={18} />}
        title="การตั้งค่าใบเสร็จ"
        expandedSections={expandedSections}
        toggleSection={toggleSection}
      />
      <SectionContent id="receipt" expandedSections={expandedSections}>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                label="หัวข้อใบเสร็จ"
                value={isEditing ? formStore.receipt_header : store.receipt_header}
                onChange={(v) => updateStoreField("receipt_header", v)}
                disabled={!isEditing}
              />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  ส่วนท้ายใบเสร็จ
                </label>
                <textarea
                  value={isEditing ? formStore.receipt_footer ?? "" : store.receipt_footer ?? ""}
                  onChange={(e) => updateStoreField("receipt_footer", e.target.value)}
                  disabled={!isEditing}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="ข้อความส่วนท้ายใบเสร็จ"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                label="ขนาดกระดาษ"
                value={isEditing ? formStore.receipt_paper_size : store.receipt_paper_size}
                onChange={(v) => updateStoreField("receipt_paper_size", v)}
                type="select"
                disabled={!isEditing}
              />
              <div className="space-y-2">
                <FormInput
                  label="แสดงโลโก้"
                  value={isEditing ? formStore.show_logo : store.show_logo}
                  onChange={(v) => updateStoreField("show_logo", v)}
                  type="checkbox"
                  disabled={!isEditing}
                />
                <FormInput
                  label="แสดงภาพส่วนท้าย"
                  value={isEditing ? formStore.show_receipt_image : store.show_receipt_image}
                  onChange={(v) => updateStoreField("show_receipt_image", v)}
                  type="checkbox"
                  disabled={!isEditing}
                />
                <FormInput
                  label="แสดง QR PromptPay"
                  value={isEditing ? formStore.show_promptpay_qr : store.show_promptpay_qr}
                  onChange={(v) => updateStoreField("show_promptpay_qr", v)}
                  type="checkbox"
                  disabled={!isEditing}
                />
                <FormInput
                  label="พิมพ์ใบเสร็จอัตโนมัติ"
                  value={isEditing ? formStore.auto_print_receipt : store.auto_print_receipt}
                  onChange={(v) => updateStoreField("auto_print_receipt", v)}
                  type="checkbox"
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                รูปท้ายบิล
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {receiptImagePreviewUrl ? (
                    <img
                      src={receiptImagePreviewUrl}
                      alt="Receipt footer preview"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <IconPhoto size={24} className="text-slate-300" />
                  )}
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    id="receipt-image-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => void handleReceiptImageChange(event)}
                    disabled={!isEditing || isUploadingReceiptImage}
                    className="hidden"
                  />
                  <label
                    htmlFor="receipt-image-upload"
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 ${
                      (!isEditing || isUploadingReceiptImage) ? "cursor-not-allowed opacity-50" : ""
                    }`}
                  >
                    <IconUpload size={18} />
                    {isUploadingReceiptImage ? "กำลังอัปโหลด..." : "อัปโหลดรูปท้ายบิล"}
                  </label>
                  <p className="mt-1 text-xs text-slate-400">
                    รองรับ JPG, JPEG, PNG, WEBP ขนาดไม่เกิน 5 MB
                  </p>
                  {hasReceiptImage ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setIsReceiptImageModalOpen(true)}
                        disabled={!receiptImagePreviewUrl}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <IconPhoto size={17} />
                        ดูรูป
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteReceiptImage()}
                        disabled={!isEditing || isDeletingReceiptImage}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-white px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <IconTrash size={17} />
                        {isDeletingReceiptImage ? "กำลังลบ..." : "ลบรูป"}
                      </button>
                    </div>
                  ) : null}
                  {uploadError ? (
                    <p className="mt-1 text-xs text-red-500">{uploadError}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <IconReceipt size={18} className="text-[#1d6fd8]" />
                Preview ใบเสร็จ
              </div>
              <button
                type="button"
                onClick={() => void fetchPreviewStore()}
                disabled={isPreviewLoading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                title="Refresh preview"
              >
                <IconRefresh size={16} />
              </button>
            </div>

            {previewError ? (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {previewError}
              </p>
            ) : null}

            <div className="overflow-x-auto">
              <div className={`${paperWidthClass} mx-auto bg-white p-4 font-mono text-[11px] leading-relaxed text-slate-800 shadow-sm`}>
                {isPreviewLoading ? (
                  <div className="py-10 text-center text-slate-400">Loading preview...</div>
                ) : (
                  <>
                    <div className="text-center">
                      {activePreviewStore.show_logo ? (
                        <div className="mb-2 flex justify-center">
                          {logoPreviewUrl ? (
                            <img
                              src={logoPreviewUrl}
                              alt="Store logo"
                              className="max-h-14 max-w-[120px] object-contain"
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded border border-dashed border-slate-300 text-slate-300">
                              <IconBuildingStore size={24} />
                            </div>
                          )}
                        </div>
                      ) : null}
                      <div className="text-sm font-bold">{activePreviewStore.store_name}</div>
                      <div>{activePreviewStore.receipt_header}</div>
                      <div>{activePreviewStore.address}</div>
                      <div>Tel: {activePreviewStore.phone}</div>
                      <div>Tax ID: {activePreviewStore.tax_id}</div>
                      <div>{activePreviewStore.branch_name} {activePreviewStore.branch_no}</div>
                    </div>

                    <div className="my-3 border-t border-dashed border-slate-300" />
                    <div className="flex justify-between">
                      <span>Receipt No.</span>
                      <span>RC-000001</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date</span>
                      <span>{previewDateTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Customer</span>
                      <span>{activePreviewStore.default_customer_name}</span>
                    </div>

                    <div className="my-3 border-t border-dashed border-slate-300" />
                    <div className="space-y-1">
                      <div>
                        <div>สินค้า A</div>
                        <div className="flex justify-between">
                          <span>1 x 45.00</span>
                          <span>45.00</span>
                        </div>
                      </div>
                      <div>
                        <div>สินค้า B</div>
                        <div className="flex justify-between">
                          <span>2 x 25.00</span>
                          <span>50.00</span>
                        </div>
                      </div>
                    </div>

                    <div className="my-3 border-t border-dashed border-slate-300" />
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>95.00</span>
                    </div>
                    {activePreviewStore.vat_enabled ? (
                      <div className="flex justify-between">
                        <span>VAT {activePreviewStore.vat_rate}%</span>
                        <span>6.65</span>
                      </div>
                    ) : null}
                    <div className="mt-1 flex justify-between text-sm font-bold">
                      <span>Total</span>
                      <span>95.00 {activePreviewStore.currency}</span>
                    </div>

                    {activePreviewStore.show_promptpay_qr ? (
                      <div className="my-3 flex flex-col items-center gap-1">
                        <div className="flex h-24 w-24 items-center justify-center border border-slate-300 bg-white text-slate-400">
                          {promptPayQrDataUrl ? (
                            <img
                              src={promptPayQrDataUrl}
                              alt="PromptPay QR"
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <IconQrcode size={52} />
                          )}
                        </div>
                        <div>PromptPay: {paymentAccount?.promptpay_id ?? "-"}</div>
                      </div>
                    ) : null}

                    <div className="mt-3 whitespace-pre-line text-center">
                      {activePreviewStore.receipt_footer}
                    </div>

                    {activePreviewStore.show_receipt_image ? (
                      <div className="mt-3 flex justify-center">
                        {receiptImagePreviewUrl ? (
                          <img
                            src={receiptImagePreviewUrl}
                            alt="Receipt footer"
                            className="max-h-20 max-w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-16 w-full items-center justify-center rounded border border-dashed border-slate-300 text-slate-300">
                            <IconPhoto size={24} />
                          </div>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </SectionContent>
      {isReceiptImageModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsReceiptImageModalOpen(false)}
        >
          <div
            className="relative max-h-[86vh] max-w-[92vw] rounded-2xl bg-white p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsReceiptImageModalOpen(false)}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-md transition-colors hover:bg-slate-100"
            >
              <IconX size={18} />
            </button>
            <p className="mb-3 text-center text-sm font-medium text-slate-600">
              รูปท้ายบิล
            </p>
            {receiptImagePreviewUrl ? (
              <img
                src={receiptImagePreviewUrl}
                alt="Receipt footer preview"
                className="max-h-[72vh] max-w-full rounded-lg object-contain"
              />
            ) : (
              <div className="flex h-40 w-64 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300">
                <IconPhoto size={32} />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
