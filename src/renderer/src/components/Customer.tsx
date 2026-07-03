import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  IconMail,
  IconPhone,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUser,
  IconUsers,
  IconX,
  IconEdit,
  IconCoin,
  IconShoppingBag,
  IconCalendar,
} from "@tabler/icons-react";
import { ensureValidAccessToken, refreshAccessToken } from "./auth";

interface Customer {
  id: number | string;
  customer_code?: string;
  customer_name?: string;
  name?: string;
  full_name?: string;
  phone?: string | null;
  phone_number?: string | null;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  created_at?: string;
  total_purchase_amount?: number;
  points_balance?: number;
  first_purchase_at?: string | null;
  last_purchase_at?: string | null;
  [key: string]: unknown;
}

const EMPTY_FORM = {
  customer_code: "",
  customer_name: "",
  phone: "",
  email: "",
  address: "",
};

const getApiBaseUrl = async (): Promise<string> => {
  const apiPath = await window.electronStore.get("apiPath");

  if (typeof apiPath !== "string" || !apiPath.trim()) {
    throw new Error("ไม่พบ API endpoint ใน store");
  }

  return apiPath.trim().replace(/\/+$/, "");
};

const authorizedFetch = async (
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

const getCustomerName = (customer: Customer): string =>
  customer.customer_name ?? customer.name ?? customer.full_name ?? "-";

const getCustomerPhone = (customer: Customer): string =>
  customer.phone ?? customer.phone_number ?? customer.mobile ?? "-";

const formatCurrency = (amount?: number): string => {
  if (amount === undefined || amount === null) return "฿0";
  return `฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPoints = (points?: number): string => {
  if (points === undefined || points === null) return "0";
  return points.toLocaleString("th-TH");
};

const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
};

// ตรวจสอบว่า customer_code ซ้ำหรือไม่ (ยกเว้นรหัสตัวเองตอนแก้ไข)
const isCustomerCodeDuplicate = (
  customers: Customer[],
  code: string,
  excludeId?: number | string,
): boolean => {
  return customers.some(
    (customer) =>
      customer.customer_code?.toLowerCase() === code.toLowerCase() &&
      customer.id !== excludeId,
  );
};

export default function Customer() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // State สำหรับแก้ไขลูกค้า
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({
    customer_code: "",
    customer_name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [customerPendingDelete, setCustomerPendingDelete] =
    useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // State สำหรับมุมมอง (list หรือ table)
  const [viewMode, setViewMode] = useState<"list" | "table">(() => {
    // ตรวจสอบขนาดหน้าจอตอนโหลดครั้งแรก
    if (typeof window !== "undefined") {
      return window.innerWidth < 768 ? "table" : "list";
    }
    return "list";
  });

  // ตรวจจับการเปลี่ยนแปลงขนาดหน้าจอ
  useEffect(() => {
    const handleResize = () => {
      setViewMode(window.innerWidth < 768 ? "table" : "list");
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchCustomers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authorizedFetch("/customers");

      if (!response.ok) {
        throw new Error(`โหลดข้อมูลลูกค้าไม่สำเร็จ (${response.status})`);
      }

      const data: Customer[] | { data?: Customer[] } = await response.json();
      const list = Array.isArray(data) ? data : data.data ?? [];
      setCustomers(list);
    } catch (err) {
      console.error("Error fetching customers:", err);
      setError("ไม่สามารถโหลดข้อมูลลูกค้าได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    if (!keyword) {
      return customers;
    }

    return customers.filter((customer) =>
      [
        getCustomerName(customer),
        customer.customer_code ?? "",
        getCustomerPhone(customer),
        customer.email ?? "",
        customer.address ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [customers, searchTerm]);

  // ฟังก์ชันเปิด Modal เพิ่ม
  const openModal = () => {
    setForm(EMPTY_FORM);
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setSubmitError(null);
  };

  const updateForm = <K extends keyof typeof EMPTY_FORM>(
    key: K,
    value: (typeof EMPTY_FORM)[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  // ฟังก์ชันเปิด Modal แก้ไข
  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditForm({
      customer_code: customer.customer_code ?? "",
      customer_name: getCustomerName(customer),
      phone: getCustomerPhone(customer) !== "-" ? getCustomerPhone(customer) : "",
      email: customer.email ?? "",
      address: customer.address ?? "",
    });
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (isEditing) {
      return;
    }

    setIsEditModalOpen(false);
    setEditingCustomer(null);
    setEditError(null);
  };

  const updateEditForm = <K extends keyof typeof editForm>(
    key: K,
    value: (typeof editForm)[K],
  ) => {
    setEditForm((current) => ({ ...current, [key]: value }));
  };

  // ฟังก์ชันแก้ไขลูกค้า
  const handleEditCustomer = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedCode = editForm.customer_code.trim();
    const trimmedName = editForm.customer_name.trim();

    if (!trimmedCode) {
      setEditError("กรุณากรอกรหัสลูกค้า");
      return;
    }

    if (!trimmedName) {
      setEditError("กรุณากรอกชื่อลูกค้า");
      return;
    }

    if (!editingCustomer) {
      return;
    }

    // ตรวจสอบรหัสซ้ำ (ยกเว้นตัวเอง)
    if (isCustomerCodeDuplicate(customers, trimmedCode, editingCustomer.id)) {
      setEditError(`รหัสลูกค้า "${trimmedCode}" มีอยู่แล้วในระบบ`);
      return;
    }

    setIsEditing(true);
    setEditError(null);

    try {
      const response = await authorizedFetch(`/customers/${editingCustomer.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_code: trimmedCode,
          customer_name: trimmedName,
          phone_number: editForm.phone.trim() || undefined,
          email: editForm.email.trim() || undefined,
          address: editForm.address.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `แก้ไขลูกค้าไม่สำเร็จ (${response.status})`,
          ),
        );
      }

      setIsEditModalOpen(false);
      setEditingCustomer(null);
      await fetchCustomers();
    } catch (err) {
      console.error("Error editing customer:", err);
      setEditError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถแก้ไขลูกค้าได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setIsEditing(false);
    }
  };

  const handleAddCustomer = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedCode = form.customer_code.trim();
    const trimmedName = form.customer_name.trim();

    if (!trimmedCode) {
      setSubmitError("กรุณากรอกรหัสลูกค้า");
      return;
    }

    if (!trimmedName) {
      setSubmitError("กรุณากรอกชื่อลูกค้า");
      return;
    }

    // ตรวจสอบรหัสซ้ำ
    if (isCustomerCodeDuplicate(customers, trimmedCode)) {
      setSubmitError(`รหัสลูกค้า "${trimmedCode}" มีอยู่แล้วในระบบ`);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await authorizedFetch("/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_code: trimmedCode,
          customer_name: trimmedName,
          phone_number: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
          total_purchase_amount: 0,
          points_balance: 0,
          first_purchase_at: null,
          last_purchase_at: null,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `เพิ่มลูกค้าไม่สำเร็จ (${response.status})`,
          ),
        );
      }

      setIsModalOpen(false);
      setForm(EMPTY_FORM);
      await fetchCustomers();
    } catch (err) {
      console.error("Error adding customer:", err);
      setSubmitError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถเพิ่มลูกค้าได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteDialog = (customer: Customer) => {
    setCustomerPendingDelete(customer);
    setDeleteError(null);
  };

  const closeDeleteDialog = () => {
    if (isDeleting) {
      return;
    }

    setCustomerPendingDelete(null);
    setDeleteError(null);
  };

  const handleDeleteCustomer = async () => {
    if (!customerPendingDelete) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await authorizedFetch(
        `/customers/${customerPendingDelete.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `ลบลูกค้าไม่สำเร็จ (${response.status})`,
          ),
        );
      }

      setCustomerPendingDelete(null);
      await fetchCustomers();
    } catch (err) {
      console.error("Error deleting customer:", err);
      setDeleteError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถลบลูกค้าได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // คอมโพเนนต์แสดงข้อมูลแบบ List (จอกว้าง)
  const renderListView = () => (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {filteredCustomers.map((customer) => (
        <li
          key={customer.id}
          className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1d6fd8]/10">
              <IconUser size={20} className="text-[#1d6fd8]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">
                {getCustomerName(customer)}
              </p>
              {customer.customer_code ? (
                <p className="mt-0.5 text-xs font-medium text-[#1d6fd8]">
                  {customer.customer_code}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => openEditModal(customer)}
                aria-label="แก้ไขลูกค้า"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-500"
              >
                <IconEdit size={16} />
              </button>
              <button
                type="button"
                onClick={() => openDeleteDialog(customer)}
                aria-label="ลบลูกค้า"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
              >
                <IconTrash size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div className="flex items-center gap-1.5 text-slate-500">
              <IconPhone size={14} className="shrink-0" />
              <span className="truncate">{getCustomerPhone(customer)}</span>
            </div>
            {customer.email ? (
              <div className="flex items-center gap-1.5 text-slate-500">
                <IconMail size={14} className="shrink-0" />
                <span className="truncate">{customer.email}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5 text-emerald-600">
              <IconShoppingBag size={14} className="shrink-0" />
              <span className="truncate font-medium">
                {formatCurrency(customer.total_purchase_amount)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-600">
              <IconCoin size={14} className="shrink-0" />
              <span className="truncate font-medium">
                {formatPoints(customer.points_balance)} แต้ม
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <IconCalendar size={14} className="shrink-0" />
              <span className="truncate text-xs">
                ครั้งแรก: {formatDate(customer.first_purchase_at)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <IconCalendar size={14} className="shrink-0" />
              <span className="truncate text-xs">
                ครั้งล่าสุด: {formatDate(customer.last_purchase_at)}
              </span>
            </div>
          </div>

          {customer.address ? (
            <p className="line-clamp-2 text-xs text-slate-400">
              {customer.address}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );

  // คอมโพเนนต์แสดงข้อมูลแบบ Table (จอแคบ)
  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
            <th className="px-3 py-2">รหัส</th>
            <th className="px-3 py-2">ชื่อ</th>
            <th className="px-3 py-2">เบอร์โทร</th>
            <th className="px-3 py-2 text-right">ยอดซื้อ</th>
            <th className="px-3 py-2 text-right">แต้ม</th>
            <th className="px-3 py-2 text-center">จัดการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredCustomers.map((customer) => (
            <tr key={customer.id} className="hover:bg-slate-50">
              <td className="px-3 py-2.5 text-xs font-medium text-[#1d6fd8]">
                {customer.customer_code || "-"}
              </td>
              <td className="px-3 py-2.5 font-medium text-slate-800">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1d6fd8]/10">
                    <IconUser size={14} className="text-[#1d6fd8]" />
                  </div>
                  <span className="truncate max-w-[100px]">
                    {getCustomerName(customer)}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-slate-600">
                <div className="flex items-center gap-1">
                  <IconPhone size={12} className="text-slate-400" />
                  <span>{getCustomerPhone(customer)}</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right font-medium text-emerald-600">
                {formatCurrency(customer.total_purchase_amount)}
              </td>
              <td className="px-3 py-2.5 text-right font-medium text-amber-600">
                {formatPoints(customer.points_balance)}
              </td>
              <td className="px-3 py-2.5 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(customer)}
                    aria-label="แก้ไขลูกค้า"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-500"
                  >
                    <IconEdit size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteDialog(customer)}
                    aria-label="ลบลูกค้า"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-slate-50 px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ลูกค้า</h1>
          <p className="mt-1 text-sm text-slate-500">
            จัดการรายชื่อลูกค้าสำหรับการขายและติดตามข้อมูลติดต่อ
          </p>
        </div>

        <button
          type="button"
          onClick={openModal}
          className="flex items-center gap-2 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1a5fc0]"
        >
          <IconPlus size={18} />
          เพิ่มลูกค้า
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm min-w-[200px]">
          <IconSearch size={18} className="text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="ค้นหาชื่อลูกค้า เบอร์โทร อีเมล หรือที่อยู่"
            className="h-9 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>

        {/* ปุ่มสลับมุมมอง - แสดงเฉพาะเมื่อเป็นหน้าจอใหญ่ */}
        <div className="hidden md:flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "list"
                ? "bg-[#1d6fd8] text-white"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            รายการ
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "table"
                ? "bg-[#1d6fd8] text-white"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            ตาราง
          </button>
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
              onClick={() => void fetchCustomers()}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              <IconRefresh size={16} />
              ลองอีกครั้ง
            </button>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-slate-400">
            <IconUsers size={34} className="text-slate-300" />
            <p className="text-sm">
              {customers.length === 0
                ? "ยังไม่มีลูกค้า กดปุ่มเพิ่มลูกค้าเพื่อเริ่มต้น"
                : "ไม่พบลูกค้าที่ตรงกับคำค้นหา"}
            </p>
          </div>
        ) : (
          <>
            {/* สลับการแสดงผลตาม viewMode */}
            {viewMode === "list" ? renderListView() : renderTableView()}

            {/* แสดงจำนวนรายการทั้งหมด */}
            <div className="mt-4 text-center text-xs text-slate-400">
              แสดงทั้งหมด {filteredCustomers.length} รายการ
            </div>
          </>
        )}
      </div>

      {/* Modal เพิ่มลูกค้า */}
      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                เพิ่มลูกค้า
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <IconX size={20} />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">
                  รหัสลูกค้า <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.customer_code}
                  onChange={(event) =>
                    updateForm("customer_code", event.target.value)
                  }
                  placeholder="เช่น CUST001"
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
                <p className="mt-1 text-xs text-slate-400">
                  ต้องไม่ซ้ำกับรหัสลูกค้าอื่นในระบบ
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">
                  ชื่อลูกค้า <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={(event) =>
                    updateForm("customer_name", event.target.value)
                  }
                  placeholder="เช่น คุณสมชาย"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    เบอร์โทร
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) => updateForm("phone", event.target.value)}
                    placeholder="0812345678"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    อีเมล
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm("email", event.target.value)}
                    placeholder="customer@example.com"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">
                  ที่อยู่
                </label>
                <textarea
                  value={form.address}
                  onChange={(event) => updateForm("address", event.target.value)}
                  placeholder="ที่อยู่หรือหมายเหตุเพิ่มเติม"
                  rows={3}
                  className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
              </div>

              {submitError ? (
                <p className="text-sm text-red-500">{submitError}</p>
              ) : null}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeModal}
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

      {/* Modal แก้ไขลูกค้า */}
      {isEditModalOpen && editingCustomer ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={closeEditModal}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                แก้ไขลูกค้า
              </h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <IconX size={20} />
              </button>
            </div>

            <form onSubmit={handleEditCustomer} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">
                  รหัสลูกค้า <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.customer_code}
                  onChange={(event) =>
                    updateEditForm("customer_code", event.target.value)
                  }
                  placeholder="เช่น CUST001"
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
                <p className="mt-1 text-xs text-slate-400">
                  ต้องไม่ซ้ำกับรหัสลูกค้าอื่นในระบบ
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">
                  ชื่อลูกค้า <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.customer_name}
                  onChange={(event) =>
                    updateEditForm("customer_name", event.target.value)
                  }
                  placeholder="ชื่อลูกค้า"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    เบอร์โทร
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(event) =>
                      updateEditForm("phone", event.target.value)
                    }
                    placeholder="0812345678"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">
                    อีเมล
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(event) =>
                      updateEditForm("email", event.target.value)
                    }
                    placeholder="customer@example.com"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600">
                  ที่อยู่
                </label>
                <textarea
                  value={editForm.address}
                  onChange={(event) =>
                    updateEditForm("address", event.target.value)
                  }
                  placeholder="ที่อยู่หรือหมายเหตุเพิ่มเติม"
                  rows={3}
                  className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
                />
              </div>

              {editError ? (
                <p className="text-sm text-red-500">{editError}</p>
              ) : null}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={isEditing}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="flex-1 rounded-xl bg-[#1d6fd8] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a5fc0] disabled:opacity-50"
                >
                  {isEditing ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal ลบลูกค้า */}
      {customerPendingDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={closeDeleteDialog}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                ลบลูกค้า
              </h2>
              <button
                type="button"
                onClick={closeDeleteDialog}
                className="text-slate-400 hover:text-slate-600"
              >
                <IconX size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              ต้องการลบลูกค้า "
              <span className="font-medium text-slate-800">
                {getCustomerName(customerPendingDelete)}
              </span>
              " ใช่หรือไม่? การลบนี้ไม่สามารถย้อนกลับได้
            </p>

            {deleteError ? (
              <p className="mt-2 text-sm text-red-500">{deleteError}</p>
            ) : null}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteCustomer()}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting ? "กำลังลบ..." : "ลบ"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}