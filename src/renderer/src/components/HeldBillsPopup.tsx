import { IconFolderOpen, IconX } from "@tabler/icons-react";

export interface HeldBillSummary {
  id: number | string;
  hold_no?: string | null;
  hold_name?: string | null;
  item_count?: number | string | null;
  total_qty?: number | string | null;
  total_amount?: number | string | null;
  created_at?: string | null;
}

interface HeldBillsPopupProps {
  heldBills: HeldBillSummary[];
  heldBillsError: string | null;
  isLoadingHeldBills: boolean;
  openingHeldBillId: HeldBillSummary["id"] | null;
  formatBaht: (value: number) => string;
  formatHeldBillDate: (value?: string | null) => string;
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
  onOpenHeldBill: (bill: HeldBillSummary) => void | Promise<void>;
}

export default function HeldBillsPopup({
  heldBills,
  heldBillsError,
  isLoadingHeldBills,
  openingHeldBillId,
  formatBaht,
  formatHeldBillDate,
  onClose,
  onRefresh,
  onOpenHeldBill,
}: HeldBillsPopupProps) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[82vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="held-bills-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <IconFolderOpen size={20} />
            </div>
            <div>
              <h3 id="held-bills-title" className="text-xl font-bold text-slate-900">
                เปิดบิลที่พัก
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                เลือกบิลพักเพื่อแทนที่รายการในตะกร้าปัจจุบัน
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

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {heldBillsError ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {heldBillsError}
            </div>
          ) : null}

          {isLoadingHeldBills ? (
            <div className="grid min-h-40 place-items-center text-sm font-medium text-slate-500">
              กำลังโหลดบิลพัก...
            </div>
          ) : heldBills.length ? (
            <div className="space-y-3">
              {heldBills.map((bill) => {
                const isOpening = openingHeldBillId === bill.id;

                return (
                  <button
                    key={String(bill.id)}
                    type="button"
                    onClick={() => void onOpenHeldBill(bill)}
                    disabled={openingHeldBillId !== null}
                    className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-amber-300 hover:bg-amber-50/60 disabled:cursor-wait disabled:opacity-60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-900">
                          {bill.hold_name || "บิลพัก"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {bill.hold_no || "-"} · {formatHeldBillDate(bill.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">
                          {formatBaht(Number(bill.total_amount) || 0)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {Number(bill.item_count) || 0} รายการ / {Number(bill.total_qty) || 0} ชิ้น
                        </p>
                      </div>
                    </div>
                    {isOpening ? (
                      <p className="mt-2 text-sm font-semibold text-amber-700">
                        กำลังเปิดบิล...
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-400">
              ยังไม่มีบิลพัก
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-slate-100 p-5">
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={isLoadingHeldBills || openingHeldBillId !== null}
            className="h-11 flex-1 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            โหลดใหม่
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl bg-slate-900 font-semibold text-white hover:bg-slate-800"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
