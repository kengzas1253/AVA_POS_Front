interface KeyboardShortcutsPopupProps {
  onClose: () => void;
}

const shortcutItems = [
  { key: "F2", label: "เปิดรายการพักบิล / พักบิล" },
  { key: "F3", label: "เลือกลูกค้า" },
  { key: "F4", label: "ชำระเงิน" },
  { key: "F6", label: "ลบรายการที่เลือก" },
  { key: "F7", label: "ลบรายการสินค้าทั้งหมด" },
  { key: "F8", label: "ใส่ส่วนลดรายการที่เลือก" },
  { key: "+", label: "เพิ่มจำนวนสินค้า" },
  { key: "-", label: "ลดจำนวนสินค้า" },
];

export default function KeyboardShortcutsPopup({
  onClose,
}: KeyboardShortcutsPopupProps) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900">คีย์ลัด</h3>
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          {shortcutItems.map((item) => (
            <p key={item.key}>
              <span className="font-bold text-slate-900">{item.key}</span>{" "}
              {item.label}
            </p>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 h-10 w-full rounded-lg bg-slate-900 text-sm font-bold text-white"
        >
          ปิด
        </button>
      </div>
    </div>
  );
}
