import type { RefObject } from "react";
import { IconDiscount, IconX } from "@tabler/icons-react";

interface DiscountPopupItem {
  name: string;
  price: number;
  qty: number;
}

interface DiscountPopupProps {
  item: DiscountPopupItem;
  value: string;
  inputRef: RefObject<HTMLInputElement | null>;
  formatBaht: (value: number) => string;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  errorMessage?: string | null;
}

export default function DiscountPopup({
  item,
  value,
  inputRef,
  formatBaht,
  onChange,
  onClose,
  onConfirm,
  isLoading = false,
  errorMessage = null,
}: DiscountPopupProps) {
  const lineTotal = item.price * item.qty;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4">
      <form
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isLoading) {
            void onConfirm();
          }
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#1d6fd8]">
              <IconDiscount size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">ใส่ส่วนลด</h3>
              <p className="mt-1 text-sm text-slate-500">{item.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="ปิด"
          >
            <IconX size={20} />
          </button>
        </div>

        <p className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700">
          ยอดรวมรายการ {formatBaht(lineTotal)}
        </p>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          ส่วนลดรายการนี้ (บาท)
        </label>
        <input
          ref={inputRef}
          type="number"
          min="0"
          max={lineTotal}
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0.00"
          className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 text-lg font-semibold text-slate-900 outline-none focus:border-[#1d6fd8] focus:ring-2 focus:ring-[#1d6fd8]/20"
        />

        {errorMessage ? (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="h-11 flex-1 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="h-11 flex-1 rounded-xl bg-[#1d6fd8] font-semibold text-white hover:bg-[#1557ad] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "กำลังตรวจสอบ..." : "บันทึกส่วนลด"}
          </button>
        </div>
      </form>
    </div>
  );
}
