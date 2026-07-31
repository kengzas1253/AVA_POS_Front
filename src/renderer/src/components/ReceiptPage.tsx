import React, { useState } from 'react';

// --- SVG Icons (inline เพื่อให้ใช้ได้ทันทีโดยไม่ต้องติดตั้ง library) ---
const CashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="3" />
    <path d="M6 6v0M18 6v0M6 18v0M18 18v0" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="w-3 h-3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const PrintIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);
const NoteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const ShopIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M3 9l1-5h16l1 5" />
    <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
    <path d="M9 21V13h6v8" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-slate-400">
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const MoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <circle cx="12" cy="5" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="12" cy="19" r="1.6" />
  </svg>
);

// --- Data ---
const receipts = [
  { id: "#7-3109", tx: "TXN20260724001847", time: "11:50 น.", total: 8, customer: "", items: [{ name: "ไอศกรีมช็อคโกแลตนม", qty: 1, price: 8 }] },
  { id: "#7-3108", tx: "TXN20260724001846", time: "11:49 น.", total: 10, customer: "สมชาย วงศ์สิทธิ", items: [{ name: "น้ำแข็ง", qty: 2, price: 5 }] },
  { id: "#7-3107", tx: "TXN20260724001845", time: "11:43 น.", total: 5, customer: "", items: [{ name: "ลูกอม", qty: 1, price: 5 }] },
  { id: "#7-3106", tx: "TXN20260724001844", time: "11:42 น.", total: 5, customer: "นิดา ชุมเชื้อ", items: [{ name: "หมากฝรั่ง", qty: 1, price: 5 }] },
  { id: "#7-3105", tx: "TXN20260724001843", time: "11:41 น.", total: 13, customer: "", items: [{ name: "ขนม5บาท", qty: 1, price: 5 }, { name: "น้ำแข็ง", qty: 1, price: 3 }, { name: "ลูกอม", qty: 1, price: 5 }] },
  { id: "#7-3104", tx: "TXN20260724001842", time: "11:39 น.", total: 15, customer: "พิมพ์นภา กิจปรโมท", items: [{ name: "ยาเมารถ", qty: 1, price: 10 }, { name: "ลูกอม", qty: 1, price: 5 }] },
  { id: "#7-3103", tx: "TXN20260724001841", time: "11:39 น.", total: 10, customer: "", items: [{ name: "ปลายไกด์", qty: 1, price: 10 }] },
  { id: "#7-3102", tx: "TXN20260724001840", time: "11:35 น.", total: 25, customer: "อรัญญา สิริสถิต", items: [{ name: "เค้ก", qty: 1, price: 25 }] },
  { id: "#7-3101", tx: "TXN20260724001839", time: "11:31 น.", total: 20, customer: "", items: [{ name: "ขนมญัชชา", qty: 1, price: 20 }] },
];

// --- Helpers ---
const money = (n: number) => "฿" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReceiptPage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeReceipt = receipts[activeIdx];

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50 text-slate-900 antialiased"
      style={{ fontFamily: '"Sarabun", ui-sans-serif, system-ui, sans-serif' }}
    >
      
      {/* Topbar */}
      <header className="z-10 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5 text-slate-900 shadow-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#1d6fd8]">
          <MenuIcon />
        </div>
        <h1 className="m-0 shrink-0 text-base font-bold">ใบเสร็จรับเงิน</h1>
        <div className="ml-auto flex items-center gap-4">
          <span className="rounded-lg bg-blue-50 px-3 py-1.5 font-mono text-[0.95rem] font-semibold tracking-[0.5px] text-[#1d6fd8]">
            {activeReceipt.id}
          </span>
          <button className="rounded-lg bg-[#1d6fd8] px-4 py-2 text-[0.85rem] font-semibold text-white transition hover:bg-[#1557ad]">
            คืนเงิน
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="ตัวเลือกเพิ่มเติม">
            <MoreIcon />
          </button>
        </div>
      </header>

      {/* Body Split */}
      <div className="flex flex-1 min-h-0">
        
        {/* Left List */}
        <aside className="flex min-h-0 w-[370px] flex-col border-r border-slate-200 bg-white max-md:w-full max-md:max-h-[44vh] max-md:border-b">
          <div className="p-4 pb-2.5 shrink-0">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">
                <SearchIcon />
              </span>
              <input 
                type="text" 
                placeholder="ค้นหาใบเสร็จ" 
                className="w-full rounded-lg border border-[#dfe7fb] bg-[#f4f8ff] py-3 pl-9 pr-3 text-base outline-none transition-colors focus:border-[#3d78f0] focus:bg-white"
              />
            </div>
          </div>
          <div className="shrink-0 px-4 pb-2 text-sm font-bold text-[#1d5ce0]">
            วันศุกร์ที่ 24 กรกฎาคม ค.ศ. 2026
          </div>
          <div className="flex-1 overflow-y-auto">
            {receipts.map((r, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`group flex w-full items-stretch gap-4 px-4 text-left transition-colors ${
                  i === activeIdx ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                }`}
              >
                <div
                  className={`flex w-10 shrink-0 items-center justify-center py-4 ${
                    i === activeIdx ? "text-[#1d6fd8]" : "text-slate-500"
                  }`}
                >
                  <CashIcon />
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-4 border-b border-slate-200 py-3.5">
                  <div className="min-w-0">
                    <div className="font-mono text-xl font-bold leading-6 text-slate-900">
                      {money(r.total)}
                    </div>
                    <div className="mt-1 text-base font-medium leading-5 text-slate-500">
                      {r.time}
                    </div>
                    <div
                      className={`mt-1 max-w-[180px] truncate text-sm font-semibold leading-5 ${
                        r.customer ? "text-[#1d6fd8]" : "text-slate-400"
                      }`}
                    >
                      {r.customer || "ลูกค้าทั่วไป"}
                    </div>
                  </div>
                  <div
                    className={`shrink-0 font-mono text-xl font-medium ${
                      i === activeIdx ? "text-[#1d6fd8]" : "text-slate-500"
                    }`}
                  >
                    {r.id}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Right Detail */}
        <main className="flex flex-1 justify-center overflow-y-auto p-6 max-md:p-4">
          <div className="relative w-full max-w-[400px] animate-[rise_0.28s_ease] rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            
            {/* Header */}
            <div className="flex flex-col items-center gap-1.5 mb-4.5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1d5ce0] to-[#3d78f0] flex items-center justify-center text-white shadow-[0_4px_12px_rgba(29,92,224,0.35)]">
                <ShopIcon />
              </div>
              <div className="font-extrabold text-[0.95rem] tracking-[0.4px] text-[#1547a8]">ASIA MINIMART</div>
            </div>

            {/* Total */}
            <div className="text-center py-1.5 pb-5">
              <div className="font-mono font-extrabold text-[2.6rem] tracking-[-0.5px]">{money(activeReceipt.total)}</div>
              <div className="text-[0.8rem] text-[#5c6690] mt-0.5">รวมทั้งหมด</div>
            </div>

            {/* Transaction Box */}
            <div className="bg-[#f4f8ff] border border-[#c5d9ff] rounded-xl p-3 my-3.5">
              <div className="text-[0.75rem] text-[#5c6690] mb-1">หมายเลข Transaction</div>
              <div className="font-mono font-bold text-[0.95rem] text-[#1547a8] break-all">{activeReceipt.tx}</div>
            </div>

            {/* Meta */}
            {activeReceipt.customer && (
              <div className="flex justify-between py-3 border-t border-dashed border-[#dfe7fb] text-[0.85rem]">
                <span className="text-[#5c6690]">ชื่อลูกค้า</span>
                <span className="font-semibold">{activeReceipt.customer}</span>
              </div>
            )}
            <div className="flex justify-between py-3 border-t border-dashed border-[#dfe7fb] text-[0.85rem]">
              <span className="text-[#5c6690]">พนักงาน</span>
              <span className="font-semibold">เจ้าของ</span>
            </div>
            <div className="flex justify-between py-3 text-[0.85rem] border-t-0 pt-0">
              <span className="text-[#5c6690]">ระบบขายหน้าร้าน</span>
              <span className="font-semibold">POS PC</span>
            </div>

            {/* Items */}
            <div className="border-t border-dashed border-[#dfe7fb] pt-3.5 pb-1.5">
              {activeReceipt.items.map((it, idx) => (
                <div key={idx} className="flex justify-between gap-3 py-2">
                  <div>
                    <div className="font-semibold text-[0.92rem]">{it.name}</div>
                    <div className="text-[0.78rem] text-[#5c6690] mt-0.5">{it.qty} × {money(it.price)}</div>
                  </div>
                  <div className="font-mono font-bold whitespace-nowrap text-[0.92rem]">{money(it.qty * it.price)}</div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-dashed border-[#dfe7fb] pt-3 mt-1.5">
              <div className="flex justify-between py-1.5 text-[0.9rem]">
                <span>รวมทั้งหมด</span>
                <span>{money(activeReceipt.total)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-[1rem] pt-2.5 border-t border-[#dfe7fb] mt-1.5">
                <span>เงินสด</span>
                <span className="inline-flex items-center gap-1 bg-[#e4f9f1] text-[#0f9d6e] font-bold text-[0.78rem] px-2.5 py-0.5 rounded-full">
                  <CheckIcon /> {money(activeReceipt.total)}
                </span>
              </div>
            </div>

            {/* Footer Meta */}
            <div className="flex justify-between items-center border-t border-dashed border-[#dfe7fb] mt-4 pt-3.5 text-[0.76rem] text-[#5c6690] font-mono">
              <span>24/7/26 {activeReceipt.time}</span>
              <span>{activeReceipt.id}</span>
            </div>

            {/* Actions Row */}
            <div className="flex gap-2.5 mt-5.5">
              <button className="flex-1 py-2.5 rounded-xl border border-[#dfe7fb] bg-white text-[#1547a8] font-bold text-[0.82rem] flex items-center justify-center gap-1.5 transition-colors hover:bg-[#f4f8ff] hover:border-[#3d78f0]">
                <PrintIcon /> พิมพ์
              </button>
              <button className="flex-1 py-2.5 rounded-xl border border-[#dfe7fb] bg-white text-[#1547a8] font-bold text-[0.82rem] flex items-center justify-center gap-1.5 transition-colors hover:bg-[#f4f8ff] hover:border-[#3d78f0]">
                <NoteIcon /> บันทึก
              </button>
              <button className="flex-1 py-2.5 rounded-xl border border-[#1d5ce0] bg-[#1d5ce0] text-white font-bold text-[0.82rem] flex items-center justify-center gap-1.5 transition-colors hover:bg-[#1547a8] hover:border-[#1547a8]">
                <PrintIcon /> พิมพ์อีกครั้ง
              </button>
            </div>

          </div>
        </main>
      </div>

      {/* CSS keyframe for Tailwind via style tag (since we can't use @keyframes in inline) */}
      <style>{`
        @keyframes rise {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
