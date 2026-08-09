import {
  IconPhone,
  IconRefresh,
  IconSearch,
  IconUser,
  IconUserPlus,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState, type RefObject } from "react";
import { authorizedFetch, getApiErrorMessage } from "./StoreSetting";

export interface PosCustomer {
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
  tax_id?: string | null;
  points_balance?: number;
  total_purchase_amount?: number;
}

interface CustomersPaginationResponse {
  items: PosCustomer[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface CustomerPickerPopupProps {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  customers: PosCustomer[];
  selectedCustomer: PosCustomer | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
  onSelectCustomer: (customer: PosCustomer) => void;
}

export const getCustomerName = (customer: PosCustomer): string =>
  customer.customer_name ?? customer.name ?? customer.full_name ?? "-";

export const getCustomerPhone = (customer: PosCustomer): string =>
  customer.phone ?? customer.phone_number ?? customer.mobile ?? "-";

export default function CustomerPickerPopup({
  searchInputRef,
  searchQuery,
  onSearchQueryChange,
  customers: _customers,
  selectedCustomer,
  isLoading: _isLoading,
  error: _error,
  onClose,
  onRefresh: _onRefresh,
  onSelectCustomer,
}: CustomerPickerPopupProps) {
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState(searchQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery.trim());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const keyword = debouncedSearch.trim();

      if (keyword) {
        params.set("search", keyword);
      }

      const response = await authorizedFetch(`/customers?${params.toString()}`);

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `โหลดข้อมูลลูกค้าไม่สำเร็จ (${response.status})`,
          ),
        );
      }

      const data: CustomersPaginationResponse = await response.json();
      setCustomers(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setTotalPages(
        typeof data.total_pages === "number" ? data.total_pages : 0,
      );
    } catch (err) {
      console.error("Error loading customers:", err);
      setError(
        err instanceof Error
          ? err.message
          : "ไม่สามารถโหลดข้อมูลลูกค้าได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, limit, page, refreshKey]);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [search]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    onSearchQueryChange(value);
  };

  const refreshCustomers = () => {
    setPage(1);
    setRefreshKey((current) => current + 1);
  };

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[82vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#1d6fd8]">
              <IconUserPlus size={20} />
            </div>
            <div>
              <h3
                id="customer-picker-title"
                className="text-xl font-bold text-slate-900"
              >
                เลือกลูกค้า
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                ค้นหาแล้วเลือกลูกค้าสำหรับบิลนี้
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="ปิด"
          >
            <IconX size={20} />
          </button>
        </div>

        <div className="border-b border-slate-100 p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <IconSearch
                size={16}
                className="pointer-events-none absolute inset-y-0 left-3 my-auto text-slate-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="ค้นหาชื่อ / รหัส / เบอร์โทร"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
              />
            </div>
            <button
              type="button"
              onClick={refreshCustomers}
              disabled={isLoading}
              title="โหลดข้อมูลใหม่"
              aria-label="โหลดข้อมูลลูกค้าใหม่"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-[#1d6fd8] hover:text-[#1d6fd8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconRefresh size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="grid h-40 place-items-center text-sm text-slate-400">
              กำลังโหลดข้อมูลลูกค้า...
            </div>
          ) : error ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-red-500">{error}</p>
              <button
                type="button"
                onClick={refreshCustomers}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <IconRefresh size={16} />
                ลองอีกครั้ง
              </button>
            </div>
          ) : customers.length === 0 ? (
            <div className="grid h-40 place-items-center text-center text-sm text-slate-400">
              ไม่พบลูกค้า
            </div>
          ) : (
            <div className="space-y-2">
              {customers.map((customer) => {
                const isSelected = selectedCustomer?.id === customer.id;

                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => onSelectCustomer(customer)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? "border-[#1d6fd8] bg-blue-50"
                        : "border-slate-200 hover:border-[#4d9bf0] hover:bg-blue-50/50"
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1d6fd8]">
                      <IconUser size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {getCustomerName(customer)}
                        </p>
                        {customer.customer_code ? (
                          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                            {customer.customer_code}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-500">
                        <IconPhone size={13} className="shrink-0" />
                        <span className="truncate">
                          {getCustomerPhone(customer)}
                        </span>
                        {customer.tax_id ? (
                          <span className="truncate">
                            Tax: {customer.tax_id}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-slate-500">
                <span>
                  แสดง {customers.length} จาก {total} รายการ
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    disabled={page <= 1 || isLoading}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ก่อนหน้า
                  </button>
                  <span>
                    หน้า {page} / {Math.max(totalPages, 1)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) =>
                        totalPages > 0
                          ? Math.min(totalPages, current + 1)
                          : current,
                      )
                    }
                    disabled={page >= totalPages || isLoading}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
