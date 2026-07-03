import { useEffect, useState } from "react";
import {
  IconCheck,
  IconDeviceFloppy,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconWallet,
  IconX,
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

interface PaymentForm {
  account_name: string;
  bank_name: string;
  account_no: string;
  account_holder: string;
  promptpay_type: string;
  promptpay_id: string;
  is_default: boolean;
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

export function PaymentSetting({
  expandedSections,
  toggleSection,
}: PaymentSettingProps) {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [editForm, setEditForm] = useState<PaymentForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    void loadPaymentAccounts();
  }, []);

  const validateForm = (value: PaymentForm): string | null => {
    if (!value.account_name.trim()) return "กรุณากรอกชื่อบัญชี";
    if (!value.bank_name) return "กรุณาเลือกธนาคาร";
    if (!value.account_no.trim()) return "กรุณากรอกเลขที่บัญชี";
    if (!value.account_holder.trim()) return "กรุณากรอกชื่อเจ้าของบัญชี";
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
