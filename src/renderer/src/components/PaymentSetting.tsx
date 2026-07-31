import { useEffect, useState } from "react";
import {
  IconCheck,
  IconBuildingBank,
  IconCashBanknote,
  IconCreditCard,
  IconDeviceFloppy,
  IconDeviceMobile,
  IconPencil,
  IconPlus,
  IconQrcode,
  IconRefresh,
  IconTrash,
  IconWallet,
  IconX,
  type Icon,
} from "@tabler/icons-react";
import {
  SectionHeader,
  SectionContent,
  type PaymentAccount as StorePaymentAccount,
  authorizedFetch,
  getApiErrorMessage,
} from "./StoreSetting";

interface PaymentAccount extends Omit<StorePaymentAccount, "id"> {
  id: number | string;
  [key: string]: unknown;
}

interface PaymentType {
  id: string;
  paymentCode: string;
  paymentName: string;
  paymentNameEn: string;
  icon: string | null;
  description: string | null;
  isGovernmentScheme: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface PaymentForm {
  account_name: string;
  bank_name: string;
  account_no: string;
  account_holder: string;
  promptpay_type: string;
  promptpay_id: string;
  is_default: boolean;
}

interface PaymentTypeForm {
  paymentCode: string;
  paymentName: string;
  paymentNameEn: string;
  icon: string;
  description: string;
  isGovernmentScheme: boolean;
  isActive: boolean;
  sortOrder: number;
}

type PaymentSettingTab = "accounts" | "paymentTypes";

interface PaymentTypeIconOption {
  name: string;
  label: string;
  icon: Icon;
  colorClass: string;
  selectedColorClass: string;
}

interface PaymentSettingProps {
  paymentAccount: StorePaymentAccount;
  formPayment: Partial<StorePaymentAccount>;
  isEditing: boolean;
  updatePaymentField: <K extends keyof StorePaymentAccount>(
    key: K,
    value: StorePaymentAccount[K],
  ) => void;
  expandedSections: Set<string>;
  toggleSection: (section: string) => void;
}

const BANKS = [
  "ธนาคารกรุงไทย",
  "ธนาคารไทยพาณิชย์",
   "ธนาคารกสิกรไทย",
  "ธนาคารกรุงเทพ",
  "ธนาคารกรุงศรีอยุธยา",
  "ธนาคารออมสิน",
  "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส.)",
  "ธนาคารเกียรตินาคินภัทร",
  "ธนาคารซีไอเอ็มบี ไทย",
  "ธนาคารทหารไทยธนชาต (ttb)",
  "ธนาคารทิสโก้",
  "ธนาคารอาคารสงเคราะห์ (ธอส.)",
  "ธนาคารอิสลามแห่งประเทศไทย (ไอแบงก์)",
  "ธนาคารไทยเครดิต",
  "ธนาคารยูโอบี",
  "ธนาคารแลนด์ แอนด์ เฮ้าส์ (LH Bank)",
];

const PROMPTPAY_TYPES = [
  { value: "", label: "ไม่ระบุ" },
  { value: "PHONE", label: "เบอร์โทรศัพท์" },
  { value: "ID", label: "เลขบัตรประชาชน" },
  { value: "E-WALLET", label: "E-Wallet" },
];

const PAYMENT_TYPE_ICON_OPTIONS: PaymentTypeIconOption[] = [
  {
    name: "CashBanknote",
    label: "เงินสด",
    icon: IconCashBanknote,
    colorClass: "text-emerald-600",
    selectedColorClass: "text-emerald-700",
  },
  {
    name: "QrCode",
    label: "QR Code",
    icon: IconQrcode,
    colorClass: "text-sky-600",
    selectedColorClass: "text-sky-700",
  },
  {
    name: "BuildingBank",
    label: "ธนาคาร",
    icon: IconBuildingBank,
    colorClass: "text-indigo-600",
    selectedColorClass: "text-indigo-700",
  },
  {
    name: "CreditCard",
    label: "บัตร",
    icon: IconCreditCard,
    colorClass: "text-violet-600",
    selectedColorClass: "text-violet-700",
  },
  {
    name: "Wallet",
    label: "กระเป๋าเงิน",
    icon: IconWallet,
    colorClass: "text-amber-600",
    selectedColorClass: "text-amber-700",
  },
  {
    name: "DeviceMobile",
    label: "มือถือ",
    icon: IconDeviceMobile,
    colorClass: "text-rose-600",
    selectedColorClass: "text-rose-700",
  },
];

const emptyForm: PaymentForm = {
  account_name: "",
  bank_name: BANKS[0],
  account_no: "",
  account_holder: "",
  promptpay_type: "",
  promptpay_id: "",
  is_default: false,
};

const unwrapPaymentAccounts = (payload: unknown): PaymentAccount[] => {
  if (Array.isArray(payload)) return payload as PaymentAccount[];
  if (!payload || typeof payload !== "object") return [];

  const value = payload as {
    data?: unknown;
    payment_accounts?: unknown;
    accounts?: unknown;
    rows?: unknown;
  };

  if (Array.isArray(value.data)) return value.data as PaymentAccount[];
  if (Array.isArray(value.payment_accounts)) return value.payment_accounts as PaymentAccount[];
  if (Array.isArray(value.accounts)) return value.accounts as PaymentAccount[];
  if (Array.isArray(value.rows)) return value.rows as PaymentAccount[];
  return [];
};

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

const formFromAccount = (account: PaymentAccount): PaymentForm => ({
  account_name: account.account_name || "",
  bank_name: account.bank_name || BANKS[0],
  account_no: account.account_no || "",
  account_holder: account.account_holder || "",
  promptpay_type: account.promptpay_type || "",
  promptpay_id: account.promptpay_id || "",
  is_default: Boolean(account.is_default),
});

const buildPayload = (form: PaymentForm) => ({
  account_name: form.account_name.trim(),
  bank_name: form.bank_name,
  account_no: form.account_no.trim(),
  account_holder: form.account_holder.trim(),
  promptpay_type: form.promptpay_type,
  promptpay_id: form.promptpay_id.trim(),
  is_default: form.is_default,
});

const formFromPaymentType = (paymentType: PaymentType): PaymentTypeForm => ({
  paymentCode: paymentType.paymentCode || "",
  paymentName: paymentType.paymentName || "",
  paymentNameEn: paymentType.paymentNameEn || "",
  icon: paymentType.icon || "",
  description: paymentType.description || "",
  isGovernmentScheme: Boolean(paymentType.isGovernmentScheme),
  isActive: Boolean(paymentType.isActive),
  sortOrder: Number(paymentType.sortOrder) || 0,
});

const buildPaymentTypePayload = (form: PaymentTypeForm) => ({
  paymentCode: form.paymentCode.trim(),
  paymentName: form.paymentName.trim(),
  paymentNameEn: form.paymentNameEn.trim(),
  icon: form.icon.trim() || null,
  description: form.description.trim() || null,
  isGovernmentScheme: form.isGovernmentScheme,
  isActive: form.isActive,
  sortOrder: Number(form.sortOrder) || 0,
});

const emptyPaymentTypeForm = (sortOrder = 1): PaymentTypeForm => ({
  paymentCode: "",
  paymentName: "",
  paymentNameEn: "",
  icon: "",
  description: "",
  isGovernmentScheme: false,
  isActive: true,
  sortOrder,
});

const getOrderedPaymentTypes = (items: PaymentType[]) =>
  [...items].sort((left, right) => {
    const sortOrderDiff =
      (Number(left.sortOrder) || 0) - (Number(right.sortOrder) || 0);

    if (sortOrderDiff !== 0) return sortOrderDiff;
    return String(left.id).localeCompare(String(right.id), "th");
  });

export function PaymentSetting({
  expandedSections,
  toggleSection,
}: PaymentSettingProps) {
  const [activeSettingTab, setActiveSettingTab] =
    useState<PaymentSettingTab>("accounts");
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [editForm, setEditForm] = useState<PaymentForm>(emptyForm);
  const [editingPaymentTypeId, setEditingPaymentTypeId] = useState<string | null>(
    null,
  );
  const [paymentTypeEditForm, setPaymentTypeEditForm] =
    useState<PaymentTypeForm | null>(null);
  const [isAddingPaymentType, setIsAddingPaymentType] = useState(false);
  const [paymentTypeCreateForm, setPaymentTypeCreateForm] =
    useState<PaymentTypeForm>(() => emptyPaymentTypeForm());
  const [openIconPickerPaymentTypeId, setOpenIconPickerPaymentTypeId] =
    useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPaymentTypes, setIsLoadingPaymentTypes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPaymentType, setIsSavingPaymentType] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentTypesError, setPaymentTypesError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadPaymentAccounts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authorizedFetch("/payment-accounts");
      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `โหลดบัญชีรับชำระเงินไม่สำเร็จ (${response.status})`,
          ),
        );
      }

      const payload = await response.json().catch(() => []);
      setAccounts(unwrapPaymentAccounts(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดบัญชีรับชำระเงินไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  const loadPaymentTypes = async () => {
    setIsLoadingPaymentTypes(true);
    setPaymentTypesError(null);

    try {
      const response = await authorizedFetch("/payment-types");
      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `โหลดช่องทางชำระเงินไม่สำเร็จ (${response.status})`,
          ),
        );
      }

      const payload = await response.json().catch(() => []);
      setPaymentTypes(unwrapPaymentTypes(payload));
    } catch (err) {
      setPaymentTypesError(
        err instanceof Error ? err.message : "โหลดช่องทางชำระเงินไม่สำเร็จ",
      );
    } finally {
      setIsLoadingPaymentTypes(false);
    }
  };

  useEffect(() => {
    void loadPaymentAccounts();
  }, []);

  useEffect(() => {
    if (activeSettingTab === "paymentTypes" && paymentTypes.length === 0) {
      void loadPaymentTypes();
    }
  }, [activeSettingTab, paymentTypes.length]);

  const validateForm = (value: PaymentForm): string | null => {
    if (!value.account_name.trim()) return "กรุณากรอกชื่อบัญชี";
    if (!value.bank_name) return "กรุณาเลือกธนาคาร";
    if (!value.account_no.trim()) return "กรุณากรอกเลขที่บัญชี";
    if (!value.account_holder.trim()) return "กรุณากรอกชื่อเจ้าของบัญชี";
    return null;
  };

  const validatePaymentTypeForm = (value: PaymentTypeForm): string | null => {
    if (!value.paymentCode.trim()) return "กรุณากรอกรหัสช่องทางชำระเงิน";
    if (!value.paymentName.trim()) return "กรุณากรอกชื่อช่องทางชำระเงิน";
    if (!value.paymentNameEn.trim()) return "กรุณากรอกชื่อภาษาอังกฤษ";
    if (!Number.isFinite(Number(value.sortOrder))) return "กรุณากรอกลำดับเป็นตัวเลข";
    return null;
  };

  const demoteOtherDefaultAccounts = async (selectedId?: number | string) => {
    const otherAccounts = accounts.filter((account) => account.id !== selectedId);

    await Promise.all(
      otherAccounts.map((account) =>
        authorizedFetch(`/payment-accounts/${account.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildPayload({
              ...formFromAccount(account),
              is_default: false,
            }),
          ),
        }).then(async (response) => {
          if (!response.ok) {
            throw new Error(
              await getApiErrorMessage(
                response,
                `ปรับบัญชี ${account.account_name || account.bank_name} เป็นบัญชีสำรองไม่สำเร็จ (${response.status})`,
              ),
            );
          }
        }),
      ),
    );
  };

  const handleAdd = async () => {
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (form.is_default) {
        await demoteOtherDefaultAccounts();
      }

      const response = await authorizedFetch("/payment-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form)),
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `เพิ่มบัญชีรับชำระเงินไม่สำเร็จ (${response.status})`,
          ),
        );
      }

      setForm(emptyForm);
      setIsAddModalOpen(false);
      setMessage("เพิ่มบัญชีรับชำระเงินเรียบร้อยแล้ว");
      await loadPaymentAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เพิ่มบัญชีรับชำระเงินไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const openAddModal = () => {
    setForm(emptyForm);
    setError(null);
    setMessage(null);
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    if (isSaving) return;
    setIsAddModalOpen(false);
    setForm(emptyForm);
    setError(null);
  };

  const startEditing = (account: PaymentAccount) => {
    setEditingId(account.id);
    setEditForm(formFromAccount(account));
    setError(null);
    setMessage(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(emptyForm);
    setError(null);
  };

  const startEditingPaymentType = (paymentType: PaymentType) => {
    setEditingPaymentTypeId(paymentType.id);
    setPaymentTypeEditForm(formFromPaymentType(paymentType));
    setPaymentTypesError(null);
    setMessage(null);
  };

  const cancelEditingPaymentType = () => {
    if (isSavingPaymentType) return;
    setEditingPaymentTypeId(null);
    setPaymentTypeEditForm(null);
    setPaymentTypesError(null);
    setOpenIconPickerPaymentTypeId(null);
  };

  const startAddingPaymentType = () => {
    const nextSortOrder = getOrderedPaymentTypes(paymentTypes).length + 1;
    setIsAddingPaymentType(true);
    setPaymentTypeCreateForm(emptyPaymentTypeForm(nextSortOrder));
    setEditingPaymentTypeId(null);
    setPaymentTypeEditForm(null);
    setPaymentTypesError(null);
    setMessage(null);
  };

  const cancelAddingPaymentType = () => {
    if (isSavingPaymentType) return;
    setIsAddingPaymentType(false);
    setPaymentTypeCreateForm(emptyPaymentTypeForm());
    setPaymentTypesError(null);
    setOpenIconPickerPaymentTypeId(null);
  };

  const handleUpdate = async () => {
    if (editingId === null) return;

    const validationError = validateForm(editForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await authorizedFetch(`/payment-accounts/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(editForm)),
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `แก้ไขบัญชีรับชำระเงินไม่สำเร็จ (${response.status})`,
          ),
        );
      }

      if (editForm.is_default) {
        await demoteOtherDefaultAccounts(editingId);
      }

      setEditingId(null);
      setEditForm(emptyForm);
      setMessage("แก้ไขบัญชีรับชำระเงินเรียบร้อยแล้ว");
      await loadPaymentAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "แก้ไขบัญชีรับชำระเงินไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (account: PaymentAccount) => {
    const confirmed = window.confirm(`ลบบัญชี ${account.account_name || account.bank_name} ใช่ไหม?`);
    if (!confirmed) return;

    setDeletingId(account.id);
    setError(null);
    setMessage(null);

    try {
      const response = await authorizedFetch(`/payment-accounts/${account.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `ลบบัญชีรับชำระเงินไม่สำเร็จ (${response.status})`,
          ),
        );
      }

      setMessage("ลบบัญชีรับชำระเงินเรียบร้อยแล้ว");
      await loadPaymentAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบบัญชีรับชำระเงินไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdatePaymentType = async () => {
    if (!editingPaymentTypeId || !paymentTypeEditForm) return;

    const validationError = validatePaymentTypeForm(paymentTypeEditForm);
    if (validationError) {
      setPaymentTypesError(validationError);
      return;
    }

    setIsSavingPaymentType(true);
    setPaymentTypesError(null);
    setMessage(null);

    try {
      const response = await authorizedFetch(
        `/payment-types/${encodeURIComponent(editingPaymentTypeId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPaymentTypePayload(paymentTypeEditForm)),
        },
      );

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `แก้ไขช่องทางชำระเงินไม่สำเร็จ (${response.status})`,
          ),
        );
      }

      setEditingPaymentTypeId(null);
      setPaymentTypeEditForm(null);
      setOpenIconPickerPaymentTypeId(null);
      setMessage("แก้ไขช่องทางชำระเงินเรียบร้อยแล้ว");
      await loadPaymentTypes();
    } catch (err) {
      setPaymentTypesError(
        err instanceof Error ? err.message : "แก้ไขช่องทางชำระเงินไม่สำเร็จ",
      );
    } finally {
      setIsSavingPaymentType(false);
    }
  };

  const handleCreatePaymentType = async () => {
    const validationError = validatePaymentTypeForm(paymentTypeCreateForm);
    if (validationError) {
      setPaymentTypesError(validationError);
      return;
    }

    setIsSavingPaymentType(true);
    setPaymentTypesError(null);
    setMessage(null);

    try {
      const response = await authorizedFetch("/payment-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPaymentTypePayload(paymentTypeCreateForm)),
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `เพิ่มช่องทางชำระเงินไม่สำเร็จ (${response.status})`,
          ),
        );
      }

      setIsAddingPaymentType(false);
      setPaymentTypeCreateForm(emptyPaymentTypeForm());
      setOpenIconPickerPaymentTypeId(null);
      setMessage("เพิ่มช่องทางชำระเงินเรียบร้อยแล้ว");
      await loadPaymentTypes();
    } catch (err) {
      setPaymentTypesError(
        err instanceof Error ? err.message : "เพิ่มช่องทางชำระเงินไม่สำเร็จ",
      );
    } finally {
      setIsSavingPaymentType(false);
    }
  };

  const updateForm = <K extends keyof PaymentForm>(
    key: K,
    value: PaymentForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateEditForm = <K extends keyof PaymentForm>(
    key: K,
    value: PaymentForm[K],
  ) => {
    setEditForm((current) => ({ ...current, [key]: value }));
  };

  const updatePaymentTypeEditForm = <K extends keyof PaymentTypeForm>(
    key: K,
    value: PaymentTypeForm[K],
  ) => {
    setPaymentTypeEditForm((current) =>
      current ? { ...current, [key]: value } : current,
    );
  };

  const updatePaymentTypeCreateForm = <K extends keyof PaymentTypeForm>(
    key: K,
    value: PaymentTypeForm[K],
  ) => {
    setPaymentTypeCreateForm((current) => ({ ...current, [key]: value }));
  };

  const getPaymentTypeIconOption = (iconName: string | null | undefined) =>
    PAYMENT_TYPE_ICON_OPTIONS.find((option) => option.name === iconName);

  const renderTextInput = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder = "",
  ) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-600">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
      />
    </label>
  );

  const renderBankSelect = (
    value: string,
    onChange: (value: string) => void,
  ) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-600">ธนาคาร</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
      >
        {BANKS.map((bank) => (
          <option key={bank} value={bank}>
            {bank}
          </option>
        ))}
      </select>
    </label>
  );

  const renderPromptPaySelect = (
    value: string,
    onChange: (value: string) => void,
  ) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-600">ประเภท PromptPay</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
      >
        {PROMPTPAY_TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
    </label>
  );

  const renderAccountForm = (
    value: PaymentForm,
    onChange: <K extends keyof PaymentForm>(key: K, nextValue: PaymentForm[K]) => void,
  ) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {renderTextInput("ชื่อบัญชี", value.account_name, (nextValue) => onChange("account_name", nextValue))}
      {renderBankSelect(value.bank_name, (nextValue) => onChange("bank_name", nextValue))}
      {renderTextInput("เลขที่บัญชี", value.account_no, (nextValue) => onChange("account_no", nextValue))}
      {renderTextInput("ชื่อเจ้าของบัญชี", value.account_holder, (nextValue) => onChange("account_holder", nextValue))}
      {renderPromptPaySelect(value.promptpay_type, (nextValue) => onChange("promptpay_type", nextValue))}
      {renderTextInput("PromptPay ID", value.promptpay_id, (nextValue) => onChange("promptpay_id", nextValue))}
      <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <input
          type="checkbox"
          checked={value.is_default}
          onChange={(event) => onChange("is_default", event.target.checked)}
          className="h-4 w-4 accent-[#1d6fd8]"
        />
        <span className="text-sm font-medium text-slate-600">ใช้เป็นบัญชีหลัก</span>
      </label>
    </div>
  );

  const renderStatusBadge = (enabled: boolean, enabledText: string, disabledText: string) => (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
        enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      {enabled ? enabledText : disabledText}
    </span>
  );

  const renderPaymentTypeRow = (
    paymentType: PaymentType,
    displayOrder: number,
  ) => {
    const isEditingPaymentType = false;

    if (isEditingPaymentType && paymentTypeEditForm) {
      return (
        <tr key={paymentType.id} className="bg-blue-50/40 align-top">
          <td className="px-4 py-3">
            <input
              type="number"
              value={paymentTypeEditForm.sortOrder}
              onChange={(event) =>
                updatePaymentTypeEditForm("sortOrder", Number(event.target.value))
              }
              className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
            />
          </td>
          <td className="px-4 py-3">
            <input
              value={paymentTypeEditForm.paymentCode}
              onChange={(event) =>
                updatePaymentTypeEditForm("paymentCode", event.target.value)
              }
              className="w-44 rounded-lg border border-slate-200 bg-white px-2 py-2 font-mono text-xs font-semibold text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
            />
          </td>
          <td className="px-4 py-3">
            <input
              value={paymentTypeEditForm.paymentName}
              onChange={(event) =>
                updatePaymentTypeEditForm("paymentName", event.target.value)
              }
              className="w-48 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
            />
          </td>
          <td className="px-4 py-3">
            <div className="space-y-2">
              <input
                value={paymentTypeEditForm.paymentNameEn}
                onChange={(event) =>
                  updatePaymentTypeEditForm("paymentNameEn", event.target.value)
                }
                className="w-48 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
              />
              <div className="relative w-48">
                <button
                  type="button"
                  onClick={() =>
                    setOpenIconPickerPaymentTypeId((current) =>
                      current === paymentType.id ? null : paymentType.id,
                    )
                  }
                  className="flex h-9 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-left text-xs text-slate-600 outline-none hover:bg-slate-50 focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                >
                  {(() => {
                    const selectedIcon = getPaymentTypeIconOption(
                      paymentTypeEditForm.icon,
                    );
                    const SelectedIcon = selectedIcon?.icon ?? IconCreditCard;
                    return (
                      <>
                        <SelectedIcon
                          size={16}
                          className={`shrink-0 ${
                            selectedIcon?.selectedColorClass ?? "text-slate-400"
                          }`}
                        />
                        <span className="truncate">
                          {paymentTypeEditForm.icon || "เลือก icon"}
                        </span>
                      </>
                    );
                  })()}
                </button>
                {openIconPickerPaymentTypeId === paymentType.id ? (
                  <div className="absolute left-0 top-10 z-30 grid w-64 grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    {PAYMENT_TYPE_ICON_OPTIONS.map((option) => {
                      const OptionIcon = option.icon;
                      const isSelected = paymentTypeEditForm.icon === option.name;

                      return (
                        <button
                          key={option.name}
                          type="button"
                          onClick={() => {
                            updatePaymentTypeEditForm("icon", option.name);
                            setOpenIconPickerPaymentTypeId(null);
                          }}
                          className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs font-medium transition ${
                            isSelected
                              ? "border-[#1d6fd8] bg-blue-50 text-[#1d6fd8]"
                              : "border-slate-100 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <OptionIcon
                            size={17}
                            className={`shrink-0 ${
                              isSelected
                                ? option.selectedColorClass
                                : option.colorClass
                            }`}
                          />
                          <span className="min-w-0">
                            <span className="block truncate">{option.label}</span>
                            <span className="block truncate font-mono text-[10px] opacity-70">
                              {option.name}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        updatePaymentTypeEditForm("icon", "");
                        setOpenIconPickerPaymentTypeId(null);
                      }}
                      className="col-span-2 rounded-lg border border-slate-100 px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                    >
                      ไม่ใช้ icon
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </td>
          <td className="px-4 py-3">
            <textarea
              value={paymentTypeEditForm.description}
              onChange={(event) =>
                updatePaymentTypeEditForm("description", event.target.value)
              }
              className="h-20 w-52 resize-none rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
              placeholder="รายละเอียด"
            />
          </td>
          <td className="px-4 py-3 text-center">
            <input
              type="checkbox"
              checked={paymentTypeEditForm.isGovernmentScheme}
              onChange={(event) =>
                updatePaymentTypeEditForm("isGovernmentScheme", event.target.checked)
              }
              className="mt-2 h-4 w-4 accent-[#1d6fd8]"
            />
          </td>
          <td className="px-4 py-3 text-center">
            <input
              type="checkbox"
              checked={paymentTypeEditForm.isActive}
              onChange={(event) =>
                updatePaymentTypeEditForm("isActive", event.target.checked)
              }
              className="mt-2 h-4 w-4 accent-[#1d6fd8]"
            />
          </td>
          <td className="px-4 py-3">
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => void handleUpdatePaymentType()}
                disabled={isSavingPaymentType}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                aria-label="บันทึกช่องทางชำระเงิน"
              >
                <IconDeviceFloppy size={18} />
              </button>
              <button
                type="button"
                onClick={cancelEditingPaymentType}
                disabled={isSavingPaymentType}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                aria-label="ยกเลิก"
              >
                <IconX size={18} />
              </button>
            </div>
          </td>
        </tr>
      );
    }

    return (
      <tr key={paymentType.id} className="hover:bg-slate-50">
        <td className="px-4 py-3 text-slate-600">{displayOrder}</td>
        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
          {paymentType.paymentCode || "-"}
        </td>
        <td className="px-4 py-3 font-semibold text-slate-800">
          {paymentType.paymentName || "-"}
        </td>
        <td className="px-4 py-3 text-slate-600">
          <div>{paymentType.paymentNameEn || "-"}</div>
          {paymentType.icon ? (
            <div className="mt-1 text-xs text-slate-400">
              icon: {paymentType.icon}
            </div>
          ) : null}
        </td>
        <td className="px-4 py-3 text-slate-600">
          {paymentType.description || "-"}
        </td>
        <td className="px-4 py-3 text-center">
          {renderStatusBadge(paymentType.isGovernmentScheme, "ใช่", "ไม่ใช่")}
        </td>
        <td className="px-4 py-3 text-center">
          {renderStatusBadge(paymentType.isActive, "ใช้งาน", "ปิดใช้งาน")}
        </td>
        <td className="px-4 py-3">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => startEditingPaymentType(paymentType)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="แก้ไขช่องทางชำระเงิน"
            >
              <IconPencil size={18} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderEditPaymentTypeModal = () => {
    if (!editingPaymentTypeId || !paymentTypeEditForm) return null;

    const selectedIcon = getPaymentTypeIconOption(paymentTypeEditForm.icon);
    const SelectedIcon = selectedIcon?.icon ?? IconCreditCard;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
        <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                แก้ไขช่องทางชำระเงิน
              </h3>
              <p className="text-sm text-slate-500">
                ปรับข้อมูลประเภทการชำระเงิน
              </p>
            </div>
            <button
              type="button"
              onClick={cancelEditingPaymentType}
              disabled={isSavingPaymentType}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              aria-label="ปิด"
            >
              <IconX size={18} />
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-600">ลำดับ</span>
              <input
                type="number"
                value={paymentTypeEditForm.sortOrder}
                onChange={(event) =>
                  updatePaymentTypeEditForm("sortOrder", Number(event.target.value))
                }
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-600">รหัส</span>
              <input
                value={paymentTypeEditForm.paymentCode}
                onChange={(event) =>
                  updatePaymentTypeEditForm("paymentCode", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-slate-200 px-3 font-mono text-sm font-semibold outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-600">ชื่อช่องทาง</span>
              <input
                value={paymentTypeEditForm.paymentName}
                onChange={(event) =>
                  updatePaymentTypeEditForm("paymentName", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-600">ชื่ออังกฤษ</span>
              <input
                value={paymentTypeEditForm.paymentNameEn}
                onChange={(event) =>
                  updatePaymentTypeEditForm("paymentNameEn", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
              />
            </label>

            <div className="relative space-y-1">
              <span className="text-sm font-medium text-slate-600">ICON</span>
              <button
                type="button"
                onClick={() =>
                  setOpenIconPickerPaymentTypeId((current) =>
                    current === "edit" ? null : "edit",
                  )
                }
                className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 px-3 text-left text-sm text-slate-600 hover:bg-slate-50 focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
              >
                <SelectedIcon
                  size={17}
                  className={selectedIcon?.selectedColorClass ?? "text-slate-400"}
                />
                <span className="truncate">
                  {paymentTypeEditForm.icon || "เลือก icon"}
                </span>
              </button>
              {openIconPickerPaymentTypeId === "edit" ? (
                <div className="absolute left-0 top-16 z-50 grid w-72 grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  {PAYMENT_TYPE_ICON_OPTIONS.map((option) => {
                    const OptionIcon = option.icon;
                    const isSelected = paymentTypeEditForm.icon === option.name;

                    return (
                      <button
                        key={option.name}
                        type="button"
                        onClick={() => {
                          updatePaymentTypeEditForm("icon", option.name);
                          setOpenIconPickerPaymentTypeId(null);
                        }}
                        className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs font-medium transition ${
                          isSelected
                            ? "border-[#1d6fd8] bg-blue-50 text-[#1d6fd8]"
                            : "border-slate-100 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <OptionIcon
                          size={17}
                          className={isSelected ? option.selectedColorClass : option.colorClass}
                        />
                        <span className="min-w-0">
                          <span className="block truncate">{option.label}</span>
                          <span className="block truncate font-mono text-[10px] opacity-70">
                            {option.name}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      updatePaymentTypeEditForm("icon", "");
                      setOpenIconPickerPaymentTypeId(null);
                    }}
                    className="col-span-2 rounded-lg border border-slate-100 px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                  >
                    ไม่ใช้ icon
                  </button>
                </div>
              ) : null}
            </div>

            <label className="space-y-1 md:row-span-2">
              <span className="text-sm font-medium text-slate-600">รายละเอียด</span>
              <textarea
                value={paymentTypeEditForm.description}
                onChange={(event) =>
                  updatePaymentTypeEditForm("description", event.target.value)
                }
                className="h-28 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                placeholder="รายละเอียด"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
              <input
                type="checkbox"
                checked={paymentTypeEditForm.isGovernmentScheme}
                onChange={(event) =>
                  updatePaymentTypeEditForm("isGovernmentScheme", event.target.checked)
                }
                className="h-4 w-4 accent-[#1d6fd8]"
              />
              <span className="text-sm font-medium text-slate-600">โครงการรัฐ</span>
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
              <input
                type="checkbox"
                checked={paymentTypeEditForm.isActive}
                onChange={(event) =>
                  updatePaymentTypeEditForm("isActive", event.target.checked)
                }
                className="h-4 w-4 accent-[#1d6fd8]"
              />
              <span className="text-sm font-medium text-slate-600">ใช้งาน</span>
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelEditingPaymentType}
              disabled={isSavingPaymentType}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => void handleUpdatePaymentType()}
              disabled={isSavingPaymentType}
              className="flex items-center gap-2 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a5fc0] disabled:opacity-50"
            >
              <IconDeviceFloppy size={18} />
              บันทึก
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCreatePaymentTypeForm = () => {
    if (!isAddingPaymentType) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
        <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                เพิ่มประเภทชำระเงิน
              </h3>
              <p className="text-sm text-slate-500">
                กรอกข้อมูลช่องทางชำระเงินใหม่
              </p>
            </div>
            <button
              type="button"
              onClick={cancelAddingPaymentType}
              disabled={isSavingPaymentType}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              aria-label="ปิด"
            >
              <IconX size={18} />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={paymentTypeCreateForm.paymentCode}
            onChange={(event) =>
              updatePaymentTypeCreateForm("paymentCode", event.target.value)
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
            placeholder="รหัส"
          />
          <input
            value={paymentTypeCreateForm.paymentName}
            onChange={(event) =>
              updatePaymentTypeCreateForm("paymentName", event.target.value)
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
            placeholder="ชื่อช่องทาง"
          />
          <input
            value={paymentTypeCreateForm.paymentNameEn}
            onChange={(event) =>
              updatePaymentTypeCreateForm("paymentNameEn", event.target.value)
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
            placeholder="ชื่ออังกฤษ"
          />
          <textarea
            value={paymentTypeCreateForm.description}
            onChange={(event) =>
              updatePaymentTypeCreateForm("description", event.target.value)
            }
            className="h-24 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20 sm:col-span-2"
            placeholder="รายละเอียด"
          />
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setOpenIconPickerPaymentTypeId((current) =>
                  current === "new" ? null : "new",
                )
              }
              className="flex h-10 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-xs text-slate-600 outline-none hover:bg-slate-50 focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
            >
              {(() => {
                const selectedIcon = getPaymentTypeIconOption(
                  paymentTypeCreateForm.icon,
                );
                const SelectedIcon = selectedIcon?.icon ?? IconCreditCard;
                return (
                  <>
                    <SelectedIcon
                      size={16}
                      className={`shrink-0 ${
                        selectedIcon?.selectedColorClass ?? "text-slate-400"
                      }`}
                    />
                    <span className="truncate">
                      {paymentTypeCreateForm.icon || "เลือก icon"}
                    </span>
                  </>
                );
              })()}
            </button>
            {openIconPickerPaymentTypeId === "new" ? (
              <div className="absolute left-0 top-11 z-30 grid w-64 grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {PAYMENT_TYPE_ICON_OPTIONS.map((option) => {
                  const OptionIcon = option.icon;
                  const isSelected = paymentTypeCreateForm.icon === option.name;

                  return (
                    <button
                      key={option.name}
                      type="button"
                      onClick={() => {
                        updatePaymentTypeCreateForm("icon", option.name);
                        setOpenIconPickerPaymentTypeId(null);
                      }}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs font-medium transition ${
                        isSelected
                          ? "border-[#1d6fd8] bg-blue-50 text-[#1d6fd8]"
                          : "border-slate-100 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <OptionIcon
                        size={17}
                        className={`shrink-0 ${
                          isSelected ? option.selectedColorClass : option.colorClass
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{option.label}</span>
                        <span className="block truncate font-mono text-[10px] opacity-70">
                          {option.name}
                        </span>
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    updatePaymentTypeCreateForm("icon", "");
                    setOpenIconPickerPaymentTypeId(null);
                  }}
                  className="col-span-2 rounded-lg border border-slate-100 px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  ไม่ใช้ icon
                </button>
              </div>
            ) : null}
          </div>
          <label className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={paymentTypeCreateForm.isGovernmentScheme}
              onChange={(event) =>
                updatePaymentTypeCreateForm(
                  "isGovernmentScheme",
                  event.target.checked,
                )
              }
              className="h-4 w-4 accent-[#1d6fd8]"
            />
            โครงการรัฐ
          </label>
          <label className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={paymentTypeCreateForm.isActive}
              onChange={(event) =>
                updatePaymentTypeCreateForm("isActive", event.target.checked)
              }
              className="h-4 w-4 accent-[#1d6fd8]"
            />
            ใช้งาน
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={() => void handleCreatePaymentType()}
              disabled={isSavingPaymentType}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              aria-label="บันทึกประเภทชำระเงิน"
            >
              <IconDeviceFloppy size={18} />
            </button>
            <button
              type="button"
              onClick={cancelAddingPaymentType}
              disabled={isSavingPaymentType}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              aria-label="ยกเลิก"
            >
              <IconX size={18} />
            </button>
          </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPaymentTypesTable = () => {
    if (paymentTypesError) {
      return (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <IconX size={18} className="shrink-0" />
          <span>{paymentTypesError}</span>
        </div>
      );
    }

    if (isLoadingPaymentTypes) {
      return (
        <div className="flex h-32 items-center justify-center text-sm text-slate-400">
          กำลังโหลดข้อมูล...
        </div>
      );
    }

    if (paymentTypes.length === 0) {
      return (
        <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-400">
          <IconCreditCard size={28} className="text-slate-300" />
          ยังไม่มีช่องทางชำระเงิน
        </div>
      );
    }

    const orderedPaymentTypes = getOrderedPaymentTypes(paymentTypes);

    return (
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">ลำดับ</th>
                <th className="px-4 py-3 text-left">รหัส</th>
                <th className="px-4 py-3 text-left">ชื่อช่องทาง</th>
                <th className="px-4 py-3 text-left">ชื่ออังกฤษ / icon</th>
                <th className="px-4 py-3 text-left">รายละเอียด</th>
                <th className="px-4 py-3 text-center">โครงการรัฐ</th>
                <th className="px-4 py-3 text-center">สถานะ</th>
                <th className="px-4 py-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {orderedPaymentTypes.map((paymentType, index) =>
                renderPaymentTypeRow(paymentType, index + 1),
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <>
      <SectionHeader
        id="payment"
        icon={<IconWallet size={18} />}
        title="การตั้งค่าการชำระเงิน"
        expandedSections={expandedSections}
        toggleSection={toggleSection}
      />
      <SectionContent id="payment" expandedSections={expandedSections}>
        <div className="space-y-4">
          <div className="inline-flex w-fit items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {[
              { id: "accounts" as const, label: "บัญชีรับชำระเงิน", icon: IconWallet },
              { id: "paymentTypes" as const, label: "ช่องทางชำระเงิน", icon: IconCreditCard },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSettingTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSettingTab(tab.id)}
                  className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[#1d6fd8] text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <Icon size={17} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {error ? (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <IconX size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {message ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <IconCheck size={18} className="shrink-0" />
              <span>{message}</span>
            </div>
          ) : null}

          {activeSettingTab === "paymentTypes" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-800">ช่องทางชำระเงิน</h3>
                  <p className="text-sm text-slate-500">{paymentTypes.length} รายการ</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={startAddingPaymentType}
                    disabled={isAddingPaymentType || isSavingPaymentType}
                    className="flex items-center gap-2 rounded-xl bg-[#1d6fd8] px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1a5fc0] disabled:opacity-50"
                  >
                    <IconPlus size={16} />
                    เพิ่มประเภท
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadPaymentTypes()}
                    disabled={isLoadingPaymentTypes}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <IconRefresh
                      size={16}
                      className={isLoadingPaymentTypes ? "animate-spin" : ""}
                    />
                    โหลดใหม่
                  </button>
                </div>
              </div>
              {renderCreatePaymentTypeForm()}
              {renderEditPaymentTypeModal()}
              {renderPaymentTypesTable()}
            </div>
          ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-800">รายการ Payment</h3>
                <p className="text-sm text-slate-500">{accounts.length} รายการ</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void loadPaymentAccounts()}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <IconRefresh size={16} className={isLoading ? "animate-spin" : ""} />
                  โหลดใหม่
                </button>
                <button
                  type="button"
                  onClick={openAddModal}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl bg-[#1d6fd8] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1a5fc0] disabled:opacity-50"
                >
                  <IconPlus size={18} />
                  เพิ่มบัญชี
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex h-32 items-center justify-center text-sm text-slate-400">
                กำลังโหลดข้อมูล...
              </div>
            ) : accounts.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-400">
                <IconWallet size={28} className="text-slate-300" />
                ยังไม่มี Payment
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {accounts.map((account) => {
                  const isEditingAccount = editingId === account.id;

                  return (
                    <div
                      key={account.id}
                      className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                    >
                      {isEditingAccount ? (
                        <div className="space-y-4">
                          {renderAccountForm(editForm, updateEditForm)}
                          <div className="flex flex-wrap justify-end gap-2">
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
                              onClick={() => void handleUpdate()}
                              disabled={isSaving}
                              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <IconDeviceFloppy size={18} />
                              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-semibold text-slate-800">
                                {account.account_name || "-"}
                              </p>
                              {account.is_default ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                  บัญชีหลัก
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              {account.bank_name || "-"} · {account.account_no || "-"}
                            </p>
                            <p className="mt-0.5 text-sm text-slate-500">
                              เจ้าของบัญชี: {account.account_holder || "-"}
                            </p>
                            {account.promptpay_id ? (
                              <p className="mt-0.5 text-sm text-slate-500">
                                PromptPay: {account.promptpay_type || "-"} · {account.promptpay_id}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEditing(account)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              aria-label="แก้ไข Payment"
                            >
                              <IconPencil size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(account)}
                              disabled={deletingId === account.id}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              aria-label="ลบ Payment"
                            >
                              <IconTrash size={18} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}
        </div>
      </SectionContent>
      {isAddModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onClick={closeAddModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">เพิ่มบัญชี</h3>
                <p className="mt-1 text-sm text-slate-500">
                  เพิ่มบัญชีธนาคารหรือ PromptPay สำหรับรับชำระเงิน
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddModal}
                disabled={isSaving}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                aria-label="ปิด"
              >
                <IconX size={18} />
              </button>
            </div>

            {error ? (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                <IconX size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {renderAccountForm(form, updateForm)}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeAddModal}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <IconX size={18} />
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#1a5fc0] disabled:opacity-50"
              >
                <IconPlus size={18} />
                {isSaving && editingId === null ? "กำลังเพิ่ม..." : "เพิ่มบัญชี"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
