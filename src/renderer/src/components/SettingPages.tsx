import { useEffect, useState, type FormEvent } from "react";
import {
  IconCheck,
  IconDeviceFloppy,
  IconEdit,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import StoreSetting, {
  authorizedFetch,
  getApiErrorMessage,
  type PaymentAccount,
  type StoreData,
  type StoreSettings,
} from "./StoreSetting";
import { TaxSetting } from "./TaxSetting";
import { PaymentSetting } from "./PaymentSetting";
import { BillSetting } from "./BillSetting";

interface SettingPagesProps {
  page: string;
}

interface StoredPosDevice {
  pos_device?: StoredPosDevice;
  [key: string]: unknown;
}

const getDefaultExpandedSections = (page: string) => {
  if (page === "tax") return new Set(["tax"]);
  if (page === "payment") return new Set(["payment"]);
  if (page === "receipt") return new Set(["receipt"]);
  return new Set(["general", "address", "system"]);
};

const getPageHeader = (page: string) => {
  if (page === "tax") {
    return {
      title: "ตั้งค่าภาษี",
      description: "จัดการการใช้งานภาษี อัตราภาษี และเงื่อนไขสต็อก",
    };
  }

  if (page === "payment") {
    return {
      title: "ตั้งค่าชำระเงิน",
      description: "จัดการบัญชีธนาคารและข้อมูล PromptPay สำหรับรับชำระเงิน",
    };
  }

  if (page === "receipt") {
    return {
      title: "ตั้งค่าใบเสร็จรับเงิน",
      description: "จัดการหัวท้ายใบเสร็จ ขนาดกระดาษ โลโก้ และตัวเลือกการพิมพ์",
    };
  }

  return {
    title: "ตั้งค่าร้านค้า",
    description: "จัดการข้อมูลร้านค้า ที่อยู่ ภาษา และข้อมูลระบบพื้นฐาน",
  };
};

export default function SettingPages({ page }: SettingPagesProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [formStore, setFormStore] = useState<Partial<StoreSettings>>({});
  const [formPayment, setFormPayment] = useState<Partial<PaymentAccount>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    getDefaultExpandedSections(page),
  );

  const fetchStoreSettings = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authorizedFetch("/store/settings");

      if (!response.ok) {
        throw new Error(`โหลดข้อมูลร้านไม่สำเร็จ (${response.status})`);
      }

      const result = await response.json();
      const data: StoreData = result.data;
      setStoreData(data);
      setFormStore(data.store);
      setFormPayment(data.payment_account);
    } catch (err) {
      console.error("Error fetching store settings:", err);
      setError("ไม่สามารถโหลดข้อมูลร้านได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchStoreSettings();
  }, []);

  useEffect(() => {
    setExpandedSections(getDefaultExpandedSections(page));
    setSaveError(null);
    setSuccessMessage(null);
  }, [page]);

  const toggleSection = (section: string) => {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const updateStoreField = <K extends keyof StoreSettings>(
    key: K,
    value: StoreSettings[K],
  ) => {
    setFormStore((current) => ({ ...current, [key]: value }));
  };

  const updatePaymentField = <K extends keyof PaymentAccount>(
    key: K,
    value: PaymentAccount[K],
  ) => {
    setFormPayment((current) => ({ ...current, [key]: value }));
  };

  const saveVatRateToPosDeviceStore = async (
    vatRate: StoreSettings["vat_rate"],
  ) => {
    const savedVatRate = Number(vatRate) || 0;
    const storedDevice = await window.electronStore.get("pos_device");

    if (storedDevice && typeof storedDevice === "object") {
      const device = storedDevice as StoredPosDevice;
      const updatedDevice = device.pos_device
        ? {
            ...device,
            pos_device: {
              ...device.pos_device,
              vat_rate: savedVatRate,
            },
          }
        : {
            ...device,
            vat_rate: savedVatRate,
          };

      await window.electronStore.set("pos_device", updatedDevice);
      return;
    }

    await window.electronStore.set("pos_device", { vat_rate: savedVatRate });
  };

  const startEditing = () => {
    if (!storeData) return;
    setFormStore(storeData.store);
    setFormPayment(storeData.payment_account);
    setIsEditing(true);
    setSaveError(null);
    setSuccessMessage(null);
  };

  const cancelEditing = () => {
    if (!storeData) return;
    setFormStore(storeData.store);
    setFormPayment(storeData.payment_account);
    setIsEditing(false);
    setSaveError(null);
    setSuccessMessage(null);
  };

  const saveStoreSettings = async (overrides: Partial<StoreSettings> = {}) => {
    const storePayload = {
      store_name: formStore.store_name,
      owner_name: formStore.owner_name,
      tax_id: formStore.tax_id,
      branch_name: formStore.branch_name,
      branch_no: formStore.branch_no,
      address: formStore.address,
      phone: formStore.phone,
      email: formStore.email,
      website: formStore.website,
      logo_url: formStore.logo_url,
      receipt_image_url: formStore.receipt_image_url,
      receipt_header: formStore.receipt_header,
      receipt_footer: formStore.receipt_footer,
      receipt_paper_size: formStore.receipt_paper_size,
      show_logo: formStore.show_logo,
      show_receipt_image: formStore.show_receipt_image,
      show_promptpay_qr: formStore.show_promptpay_qr,
      auto_print_receipt: formStore.auto_print_receipt,
      vat_enabled: formStore.vat_enabled,
      vat_rate: formStore.vat_rate,
      language: formStore.language,
      currency: formStore.currency,
      timezone: formStore.timezone,
      allow_negative_stock: formStore.allow_negative_stock,
      default_customer_name: formStore.default_customer_name,
      ...overrides,
    };

    const storeResponse = await authorizedFetch("/store-settings/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(storePayload),
    });

    if (!storeResponse.ok) {
      throw new Error(
        await getApiErrorMessage(
          storeResponse,
          `บันทึกข้อมูลร้านไม่สำเร็จ (${storeResponse.status})`,
        ),
      );
    }

    const savedVatRate = Number(storePayload.vat_rate) || 0;
    await saveVatRateToPosDeviceStore(savedVatRate);
    setStoreData((current) =>
      current
        ? {
            ...current,
            store: {
              ...current.store,
              vat_rate: savedVatRate,
            },
          }
        : current,
    );
  };

  const handleLogoUploaded = async (logoUrl: string) => {
    setFormStore((current) => ({ ...current, logo_url: logoUrl }));
    setStoreData((current) =>
      current
        ? {
            ...current,
            store: {
              ...current.store,
              logo_url: logoUrl,
            },
          }
        : current,
    );

    await saveStoreSettings({ logo_url: logoUrl });
    setSuccessMessage("อัปโหลดโลโก้ร้านเรียบร้อยแล้ว");
  };

  const handleLogoDeleted = async () => {
    setFormStore((current) => ({ ...current, logo_url: "" }));
    setStoreData((current) =>
      current
        ? {
            ...current,
            store: {
              ...current.store,
              logo_url: "",
            },
          }
        : current,
    );

    await saveStoreSettings({ logo_url: "" });
    setSuccessMessage("ลบโลโก้ร้านเรียบร้อยแล้ว");
  };

  const savePaymentSettings = async () => {
    const paymentResponse = await authorizedFetch("/store-settings/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_name: formPayment.account_name,
        bank_name: formPayment.bank_name,
        account_no: formPayment.account_no,
        account_holder: formPayment.account_holder,
        promptpay_type: formPayment.promptpay_type,
        promptpay_id: formPayment.promptpay_id,
        is_default: formPayment.is_default,
      }),
    });

    if (!paymentResponse.ok) {
      throw new Error(
        await getApiErrorMessage(
          paymentResponse,
          `บันทึกข้อมูลบัญชีไม่สำเร็จ (${paymentResponse.status})`,
        ),
      );
    }
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSuccessMessage(null);

    try {
      if (page === "payment") {
        await savePaymentSettings();
      } else {
        await saveStoreSettings();
      }

      await fetchStoreSettings();
      setIsEditing(false);
      setSuccessMessage("บันทึกข้อมูลเรียบร้อยแล้ว");
    } catch (err) {
      console.error("Error saving settings:", err);
      setSaveError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 px-6 py-6 pb-8">
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">
          กำลังโหลดข้อมูล...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 px-6 py-6 pb-8">
        <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-red-500">{error}</p>
          <button
            type="button"
            onClick={() => void fetchStoreSettings()}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <IconRefresh size={16} />
            ลองอีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  const renderSettingPage = () => {
    if (!storeData) {
      return (
        <StoreSetting
          storeData={storeData}
          formStore={formStore}
          isEditing={isEditing}
          isSaving={isSaving}
          updateStoreField={updateStoreField}
          expandedSections={expandedSections}
          toggleSection={toggleSection}
          onLogoUploaded={handleLogoUploaded}
          onLogoDeleted={handleLogoDeleted}
        />
      );
    }

    if (page === "tax") {
      return (
        <TaxSetting
          store={storeData.store}
          formStore={formStore}
          isEditing={isEditing}
          updateStoreField={updateStoreField}
          expandedSections={expandedSections}
          toggleSection={toggleSection}
        />
      );
    }

    if (page === "payment") {
      return (
        <PaymentSetting
          paymentAccount={storeData.payment_account}
          formPayment={formPayment}
          isEditing={isEditing}
          updatePaymentField={updatePaymentField}
          expandedSections={expandedSections}
          toggleSection={toggleSection}
        />
      );
    }

    if (page === "receipt") {
      return (
        <BillSetting
          store={storeData.store}
          formStore={formStore}
          isEditing={isEditing}
          updateStoreField={updateStoreField}
          expandedSections={expandedSections}
          toggleSection={toggleSection}
        />
      );
    }

    return (
      <StoreSetting
        storeData={storeData}
        formStore={formStore}
        isEditing={isEditing}
        isSaving={isSaving}
        updateStoreField={updateStoreField}
        expandedSections={expandedSections}
        toggleSection={toggleSection}
        onLogoUploaded={handleLogoUploaded}
        onLogoDeleted={handleLogoDeleted}
      />
    );
  };

  const pageHeader = getPageHeader(page);
  const showPageActions = page !== "payment";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 px-6 py-6 pb-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{pageHeader.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {pageHeader.description}
          </p>
        </div>
        <div className="flex gap-2">
          {showPageActions ? (
            <>
          {!isEditing ? (
            <button
              type="button"
              onClick={startEditing}
              className="flex items-center gap-2 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1a5fc0]"
            >
              <IconEdit size={18} />
              แก้ไขข้อมูล
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <IconX size={18} />
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                <IconDeviceFloppy size={18} />
                {isSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </>
          )}
            </>
          ) : null}
        </div>
      </div>

      {successMessage ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <IconCheck size={18} className="shrink-0" />
          <span>{successMessage}</span>
        </div>
      ) : null}

      {saveError ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <IconX size={18} className="shrink-0" />
          <span>{saveError}</span>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="space-y-4">{renderSettingPage()}</div>
      </div>
    </div>
  );
}
