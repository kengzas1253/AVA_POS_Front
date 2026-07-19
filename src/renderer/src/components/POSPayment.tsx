import React, { useEffect, useState, useRef } from "react";
import { authorizedFetch, type StoreData } from "./StoreSetting";
import QRCode from "qrcode";
import generatePayload from "promptpay-qr";

interface POSPaymentCartItem {
  id?: number | string;
  name: string;
  product_name?: string;
  price: number;
  qty: number;
  discount?: number;
  discount_amount?: number | string | null;
  final_price?: number | string | null;
  total_amount?: number | string | null;
}

interface POSPaymentProps {
  onBack?: () => void;
  onPaymentComplete?: () => void;
  cartItems?: POSPaymentCartItem[];
  subtotal?: number;
  discount?: number;
  total?: number;
}

// ✅ Mixed Payment Method Types
export type PaymentMethodType = "cash" | "transfer" | "gov_welfare" | "khon_la_krueng" | "digital_money" | "other";

interface MixedPaymentLine {
  id: string;
  type: PaymentMethodType;
  amount: string;
  reference?: string;
}

const formatBaht = (value: number): string => `฿${value.toFixed(2)}`;

const getCartItemName = (item: POSPaymentCartItem): string =>
  item.product_name || item.name || "-";

const getCartItemTotal = (item: POSPaymentCartItem): number => {
  const fallback = Number(item.price || 0) * Number(item.qty || 0);
  return Number(item.final_price ?? item.total_amount ?? fallback) || fallback;
};

const getQuickCashAmounts = (total: number): number[] => {
  if (total <= 0) {
    return [0, 0, 0, 0];
  }

  const wholeTotal = Math.ceil(total);
  const nextTen = Math.ceil(wholeTotal / 10) * 10;
  const nextTwenty = Math.ceil(wholeTotal / 20) * 20;
  const nextFifty = Math.ceil(wholeTotal / 50) * 50;
  const nextHundred = Math.ceil(wholeTotal / 100) * 100;
  const nextFiveHundred = Math.ceil(wholeTotal / 500) * 500;
  const nextThousand = Math.ceil(wholeTotal / 1000) * 1000;
  const candidates =
    wholeTotal < 10
      ? [5, 10, 20, 50, 100, 500, 1000]
      : [
          nextTen,
          nextTwenty,
          nextFifty,
          nextHundred,
          nextFiveHundred,
          nextThousand,
        ];

  return candidates
    .filter((amount) => amount > total)
    .filter((amount, index, amounts) => amounts.indexOf(amount) === index)
    .sort((a, b) => a - b)
    .slice(0, 7);
};

// ✅ สร้าง PromptPay QR code ด้วย promptpay-qr library (มาตรฐาน EMV)
const generatePromptPayQr = async (
  promptpayId?: string | null,
  amount?: number,
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
): Promise<string | null> => {
  if (!promptpayId || !canvasRef?.current) return null;

  const cleanId = promptpayId.replace(/[^0-9]/g, "");
  if (!cleanId) return null;

  try {
    let payload: string;

    if (cleanId.length === 10 && cleanId.startsWith("0")) {
      payload = generatePayload(cleanId, { amount: amount });
    } else if (cleanId.length === 13) {
      payload = generatePayload(cleanId, { amount: amount });
    } else {
      payload = generatePayload(cleanId, { amount: amount });
    }

    console.log("✅ PromptPay Payload:", payload);

    await QRCode.toCanvas(canvasRef.current, payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 200,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    const dataUrl = canvasRef.current?.toDataURL("image/png");
    return dataUrl || null;
  } catch (error) {
    console.error("❌ Generate PromptPay QR error:", error);
    return null;
  }
};

// ✅ Get payment method display name
const getPaymentMethodLabel = (type: PaymentMethodType): string => {
  switch (type) {
    case "cash":
      return "💵 เงินสด";
    case "transfer":
      return "📱 โอน/พร้อมเพย์";
    case "gov_welfare":
      return "🏛️ บัตรสวัสดิการแห่งรัฐ";
    case "khon_la_krueng":
      return "🤝 คนละครึ่ง";
    case "digital_money":
      return "💳 เงินดิจิตอล";
    case "other":
      return "📌 อื่นๆ";
    default:
      return "วิธีชำระเงิน";
  }
};

const POSPayment: React.FC<POSPaymentProps> = ({
  onBack,
  onPaymentComplete,
  cartItems = [],
  subtotal = 0,
  discount = 0,
  total = 0,
}) => {
  // ---------- state ----------
  const [activeTab, setActiveTab] = useState<"cash" | "transfer" | "gov">("cash");
  const [cashInput, setCashInput] = useState<string>(total.toFixed(2));
  const [popupChange, setPopupChange] = useState<number | null>(null);
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [showSplitPopup, setShowSplitPopup] = useState(false);
  
  // ✅ Mixed payment state
  const [mixedPayments, setMixedPayments] = useState<MixedPaymentLine[]>([
    { id: "1", type: "cash", amount: total.toFixed(2) }
  ]);

  // ✅ Ref สำหรับช่อง Input เงินสด
  const cashInputRef = useRef<HTMLInputElement>(null);
  
  // ✅ Ref สำหรับ popup container
  const popupContainerRef = useRef<HTMLDivElement>(null);

  // ✅ QR code state
  const [splitQrDataUrl, setSplitQrDataUrl] = useState<string | null>(null);
  const [splitQrLoading, setSplitQrLoading] = useState(false);
  const splitQrCanvasRef = useRef<HTMLCanvasElement>(null);

  // ✅ Transfer tab QR code state
  const [transferQrDataUrl, setTransferQrDataUrl] = useState<string | null>(null);
  const transferQrCanvasRef = useRef<HTMLCanvasElement>(null);

  const itemCount = cartItems.length;
  const totalQty = cartItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

  // ---------- tab switch ----------
  const switchTab = (tab: "cash" | "transfer" | "gov") => {
    setActiveTab(tab);
    if (tab === "cash") {
      setTimeout(() => {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }, 50);
    }
  };

  // ---------- popup ----------
  const showPopup = (change: number) => {
    setPopupChange(change);
  };

  const closePopup = () => {
    setPopupChange(null);
    setTimeout(() => {
      cashInputRef.current?.focus();
      cashInputRef.current?.select();
    }, 100);
  };

  const confirmSuccessfulPayment = () => {
    closePopup();
    onPaymentComplete?.();
  };

  // ---------- cash payment ----------
  const processCashPayment = () => {
    const received = parseFloat(cashInput);
    if (isNaN(received) || received < 0) {
      alert("กรุณากรอกจำนวนเงินที่ถูกต้อง");
      setTimeout(() => {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }, 50);
      return;
    }
    if (received < total) {
      alert("จำนวนเงินไม่พอชำระ (ยอดรวม " + total.toFixed(2) + " บาท)");
      setTimeout(() => {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }, 50);
      return;
    }
    const change = received - total;
    showPopup(change);
  };

  // ---------- transfer / gov payment ----------
  const processExactPayment = () => {
    showPopup(0);
  };

  // ---------- quick amount buttons ----------
  const handleQuickAmount = (amount: string) => {
    setCashInput(amount);
    setTimeout(() => {
      cashInputRef.current?.focus();
      cashInputRef.current?.select();
    }, 50);
    
    // ✅ คำนวณและแสดง popup ทันทีเมื่อคลิกปุ่ม quick cash
    const received = parseFloat(amount);
    if (!isNaN(received) && received >= total) {
      const change = received - total;
      showPopup(change);
    } else if (!isNaN(received) && received < total) {
      alert("จำนวนเงินไม่พอชำระ (ยอดรวม " + total.toFixed(2) + " บาท)");
    }
  };

  // ✅ Mixed payment functions
  const openSplitPopup = () => {
    setMixedPayments([{ id: "1", type: "cash", amount: total.toFixed(2) }]);
    setShowSplitPopup(true);
  };

  const closeSplitPopup = () => {
    setShowSplitPopup(false);
    setTimeout(() => {
      cashInputRef.current?.focus();
      cashInputRef.current?.select();
    }, 100);
  };

  // ✅ Add new payment line
  const addPaymentLine = () => {
    const newId = (Math.max(...mixedPayments.map(p => parseInt(p.id) || 0)) + 1).toString();
    setMixedPayments([...mixedPayments, { id: newId, type: "cash", amount: "0.00" }]);
  };

  // ✅ Remove payment line
  const removePaymentLine = (id: string) => {
    if (mixedPayments.length > 1) {
      setMixedPayments(mixedPayments.filter(p => p.id !== id));
    }
  };

  // ✅ Update payment line
  const updatePaymentLine = (id: string, field: keyof MixedPaymentLine, value: any) => {
    setMixedPayments(mixedPayments.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  // ✅ Calculate total from mixed payments
  const calculateMixedTotal = (): number => {
    return mixedPayments.reduce((sum, payment) => {
      const amount = parseFloat(payment.amount) || 0;
      return sum + amount;
    }, 0);
  };

  // ✅ Check if mixed payment is valid
  const isMixedPaymentValid = (): boolean => {
    const combined = calculateMixedTotal();
    return Math.abs(combined - total) < 0.01 && mixedPayments.every(p => parseFloat(p.amount) >= 0);
  };

  // ✅ Confirm mixed payment
  const confirmMixedPayment = () => {
    if (!isMixedPaymentValid()) {
      alert("กรุณากรอกจำนวนเงินให้ครบถ้วน");
      return;
    }
    
    const change = calculateMixedTotal() - total;
    console.log("✅ Mixed Payment Confirmed:", {
      payments: mixedPayments,
      total: calculateMixedTotal(),
      change
    });
    
    closeSplitPopup();
    if (Math.abs(change) < 0.01) {
      showPopup(0);
    } else {
      showPopup(change);
    }
  };

  // ✅ Generate QR for split bill transfer amount
  useEffect(() => {
    const generateSplitQr = async () => {
      const transferLine = mixedPayments.find(p => p.type === "transfer");
      const transferAmt = parseFloat(transferLine?.amount || "0");
      
      if (!storeData?.payment_account?.promptpay_id || transferAmt <= 0) {
        setSplitQrDataUrl(null);
        return;
      }

      setSplitQrLoading(true);
      try {
        const dataUrl = await generatePromptPayQr(
          storeData.payment_account.promptpay_id,
          transferAmt,
          splitQrCanvasRef
        );
        setSplitQrDataUrl(dataUrl);
      } catch (error) {
        console.error("❌ Split QR generation failed:", error);
        setSplitQrDataUrl(null);
      } finally {
        setSplitQrLoading(false);
      }
    };

    void generateSplitQr();
  }, [mixedPayments, storeData?.payment_account?.promptpay_id]);

  // ✅ Generate QR for transfer tab (full amount)
  useEffect(() => {
    const generateTransferQr = async () => {
      if (!storeData?.payment_account?.promptpay_id) {
        setTransferQrDataUrl(null);
        return;
      }

      try {
        const dataUrl = await generatePromptPayQr(
          storeData.payment_account.promptpay_id,
          total,
          transferQrCanvasRef
        );
        setTransferQrDataUrl(dataUrl);
      } catch (error) {
        console.error("❌ Transfer QR generation failed:", error);
        setTransferQrDataUrl(null);
      }
    };

    if (activeTab === "transfer") {
      void generateTransferQr();
    }
  }, [activeTab, storeData?.payment_account?.promptpay_id, total]);

  // ✅ Load store settings - ใช้ /store/settings เหมือนเดิม
  useEffect(() => {
    let isMounted = true;

    const loadStoreSettings = async () => {
      try {
        const response = await authorizedFetch("/store/settings");
        const payload = (await response.json().catch(() => ({}))) as {
          data?: StoreData;
          message?: string;
        };

        if (!response.ok) {
          throw new Error(payload.message || `Load store settings failed (${response.status})`);
        }

        if (isMounted) {
          setStoreData(payload.data ?? null);
          setStoreError(null);
        }
      } catch (error) {
        if (isMounted) {
          setStoreError(error instanceof Error ? error.message : "Load store settings failed");
        }
      }
    };

    void loadStoreSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  // ✅ Update cash input when total changes
  useEffect(() => {
    setCashInput(total.toFixed(2));
  }, [total]);

  // ✅ โฟกัสที่ Input เงินสดอัตโนมัติเมื่อ component ถูก mount
  useEffect(() => {
    setTimeout(() => {
      cashInputRef.current?.focus();
      cashInputRef.current?.select();
    }, 150);
  }, []);

  // ✅ เมื่อ popup เปิด ให้โฟกัสที่ container เพื่อรับ event keyboard
  useEffect(() => {
    if (popupChange !== null) {
      setTimeout(() => {
        popupContainerRef.current?.focus();
      }, 50);
    }
  }, [popupChange]);

  // ✅ Escape key handler
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onBack?.();
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onBack]);

  const mixedCombined = calculateMixedTotal();
  const mixedRemaining = total - mixedCombined;
  const quickCashAmounts = getQuickCashAmounts(total);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Sarabun', sans-serif" }}>
      {/* ---------- LEFT ORDER PANEL ---------- */}
      <div
        style={{
          width: 340,
          background: "var(--white, #fff)",
          borderRight: "1px solid var(--gray-300, #d7dee8)",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: "24px 24px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--gray-300, #d7dee8)",
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>ตั๋วออเดอร์</h1>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "var(--blue-100, #e8f0fe)",
              color: "var(--blue-600, #1b4b8f)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            ＋
          </div>
        </div>

        <div style={{ flex: "0 0 auto", padding: "12px 24px 0" }}>
          <div style={{ borderBottom: "1px dashed var(--gray-300, #d7dee8)", paddingBottom: 12, textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--ink, #0b1726)" }}>
              {storeData?.store.store_name || "ร้านค้า"}
            </div>
            {storeData?.store.receipt_header ? (
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--gray-500, #6b7785)" }}>
                {storeData.store.receipt_header}
              </div>
            ) : null}
            {storeData?.store.branch_name ? (
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--gray-500, #6b7785)" }}>
                {storeData.store.branch_name}
                {storeData.store.branch_no ? ` (${storeData.store.branch_no})` : ""}
              </div>
            ) : null}
            {storeData?.store.address ? (
              <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.45, color: "var(--gray-500, #6b7785)" }}>
                {storeData.store.address}
              </div>
            ) : null}
            {storeData?.store.phone ? (
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--gray-500, #6b7785)" }}>
                โทร. {storeData.store.phone}
              </div>
            ) : null}
            {storeData?.store.tax_id ? (
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--gray-500, #6b7785)" }}>
                เลขประจำตัวผู้เสียภาษี {storeData.store.tax_id}
              </div>
            ) : null}
            {storeError ? (
              <div style={{ marginTop: 8, fontSize: 11, color: "#dc2626" }}>
                {storeError}
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "8px 24px 12px" }}>
          {cartItems.length ? (
            cartItems.map((item) => (
              <div
                key={`${item.id ?? getCartItemName(item)}-${getCartItemName(item)}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px dashed var(--gray-300, #d7dee8)",
                  fontSize: 14,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {getCartItemName(item)}
                  </span>
                  <span style={{ color: "var(--gray-500, #6b7785)", fontSize: 12 }}>
                    {formatBaht(Number(item.price) || 0)} x {Number(item.qty) || 0}
                  </span>
                </span>
                <span style={{ flexShrink: 0, fontFamily: "'Sarabun', sans-serif", fontWeight: 700 }}>
                  {formatBaht(getCartItemTotal(item))}
                </span>
              </div>
            ))
          ) : (
            <div style={{ padding: "24px 0", textAlign: "center", fontSize: 13, color: "var(--gray-500, #6b7785)" }}>
              ไม่มีรายการสินค้า
            </div>
          )}
        </div>

        <div style={{ flex: "0 0 auto", padding: "16px 24px 20px", borderTop: "1px solid var(--gray-300, #d7dee8)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--gray-500, #6b7785)", padding: "4px 0" }}>
            <span>ยอดรวมสินค้า</span>
            <span>{formatBaht(subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--gray-500, #6b7785)", padding: "4px 0" }}>
            <span>ส่วนลด</span>
            <span>{formatBaht(discount)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--gray-500, #6b7785)", padding: "4px 0" }}>
            <span>รายการ / จำนวนสินค้า</span>
            <span>{itemCount} รายการ / {totalQty} ชิ้น</span>
          </div>
          <div
            style={{
              marginTop: 10,
              paddingTop: 14,
              borderTop: "1px solid var(--gray-300, #d7dee8)",
              display: "flex",
              justifyContent: "space-between",
              fontSize: 16,
              fontWeight: 700,
              color: "var(--ink, #0b1726)",
            }}
          >
            <span>รวมทั้งหมด</span>
            <span style={{ fontFamily: "'Sarabun', sans-serif", fontSize: 18, color: "var(--blue-600, #1b4b8f)" }}>{formatBaht(total)}</span>
          </div>
        </div>
      </div>

      {/* ---------- RIGHT PAYMENT PANEL ---------- */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* top bar */}
        <div
          style={{
            background: "linear-gradient(135deg, var(--blue-700, #13315c), var(--blue-500, #2563eb))",
            color: "#fff",
            padding: "22px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "rgba(255,255,255,0.14)",
              border: "none",
              color: "#fff",
              fontSize: 18,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ←
          </button>
          <button
            type="button"
            onClick={openSplitPopup}
            style={{
              background: "rgba(255,255,255,0.14)",
              color: "#fff",
              border: "none",
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            แยกบิล
          </button>
        </div>

        {/* amount hero */}
        <div style={{ textAlign: "center", padding: "48px 0 28px" }}>
          <div style={{ fontSize: 16, letterSpacing: "0.04em", color: "var(--gray-500, #6b7785)", marginBottom: 6 }}>
            จำนวนเงินที่ต้องชำระ
          </div>
          <div style={{ fontFamily: "'Sarabun', sans-serif", fontSize: 76, fontWeight: 700, color: "var(--blue-700, #13315c)", lineHeight: 1 }}>
            {formatBaht(total)}
          </div>
        </div>

        {/* pay body */}
        <div style={{ flex: 1, maxWidth: 760, width: "100%", margin: "0 auto", padding: "0 32px 32px" }}>
          {/* tabs */}
          <div
            style={{
              display: "flex",
              gap: 10,
              background: "var(--blue-100, #e8f0fe)",
              padding: 6,
              borderRadius: 14,
              marginBottom: 28,
            }}
          >
            {[
              { id: "cash", label: "เงินสด", icon: "💵" },
              { id: "transfer", label: "โอน / พร้อมเพย์", icon: "📱" },
              { id: "gov", label: "โครงการรัฐ", icon: "🏛️" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id as any)}
                style={{
                  flex: 1,
                  background: activeTab === tab.id ? "var(--white, #fff)" : "transparent",
                  color: activeTab === tab.id ? "var(--blue-700, #13315c)" : "var(--gray-500, #6b7785)",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 18px",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ---------- CASH TAB ---------- */}
          {activeTab === "cash" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--blue-600, #1b4b8f)", marginBottom: 14 }}>
                💵 รับเงินสด
              </div>
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "var(--white, #fff)",
                    border: "1.5px solid var(--gray-300, #d7dee8)",
                    borderRadius: 14,
                    padding: "14px 16px",
                  }}
                >
                  <span style={{ color: "var(--gray-500, #6b7785)", fontSize: 18 }}>฿</span>
                  <input
                    ref={cashInputRef}
                    type="text"
                    value={cashInput}
                    onChange={(e) => setCashInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        processCashPayment();
                      }
                    }}
                    placeholder="0.00"
                    style={{
                      border: "none",
                      outline: "none",
                      fontFamily: "'Sarabun', sans-serif",
                      fontSize: 36,
                      fontWeight: 700,
                      width: "100%",
                      color: "var(--ink, #0b1726)",
                      background: "transparent",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: `repeat(${quickCashAmounts.length}, minmax(0, 1fr))`, gap: 8, marginBottom: 26 }}>
                {quickCashAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleQuickAmount(amount.toFixed(2))}
                    style={{
                      background: "var(--blue-100, #e8f0fe)",
                      color: "var(--blue-600, #1b4b8f)",
                      border: "none",
                      borderRadius: 10,
                      padding: "12px 8px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {formatBaht(amount)}
                  </button>
                ))}
              </div>

              <button
                onClick={processCashPayment}
                style={{
                  width: "100%",
                  background: "var(--blue-600, #1b4b8f)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 16,
                  padding: 18,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                รับเงินสดและคำนวณเงินทอน
              </button>
            </div>
          )}

          {/* ---------- TRANSFER TAB ---------- */}
          {activeTab === "transfer" && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--blue-600, #1b4b8f)", marginBottom: 14 }}>
                📱 โอนเงิน / PromptPay
              </div>

              {transferQrDataUrl ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 20,
                    padding: 16,
                    border: "1px solid var(--gray-300, #d7dee8)",
                    borderRadius: 14,
                    background: "var(--blue-50, #f0f5ff)",
                  }}
                >
                  <div
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 10,
                      overflow: "hidden",
                      flexShrink: 0,
                      background: "#fff",
                      border: "2px solid var(--gray-300, #d7dee8)",
                    }}
                  >
                    <img
                      src={transferQrDataUrl}
                      alt="PromptPay QR"
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                      {storeData?.payment_account.account_holder || storeData?.store.store_name || "ร้านค้า"}
                    </div>
                    <div style={{ fontSize: 16, color: "var(--gray-500, #6b7785)", marginBottom: 8 }}>
                      PromptPay: {storeData?.payment_account.promptpay_id || "-"}
                    </div>
                    <div style={{ fontFamily: "'Sarabun', sans-serif", fontSize: 18, fontWeight: 700, color: "var(--blue-700, #13315c)" }}>
                      {formatBaht(total)}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "32px 16px",
                    color: "var(--gray-500, #6b7785)",
                    fontSize: 16,
                  }}
                >
                  ⏳ กำลังสร้าง QR Code...
                </div>
              )}

              <div
                style={{
                  background: "var(--blue-50, #f0f5ff)",
                  borderRadius: 12,
                  padding: "12px 16px",
                  marginBottom: 18,
                  fontSize: 13,
                  color: "var(--blue-700, #13315c)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--blue-500, #2563eb)",
                    animation: "pulse 1.4s infinite",
                  }}
                />
                กำลังรอการชำระเงิน...
              </div>

              <button
                onClick={processExactPayment}
                style={{
                  width: "100%",
                  background: "var(--blue-600, #1b4b8f)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 16,
                  padding: 18,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                ยืนยันว่าได้รับเงินแล้ว
              </button>
            </div>
          )}

          {/* ---------- GOV TAB ---------- */}
          {activeTab === "gov" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--blue-600, #1b4b8f)", marginBottom: 10 }}>
                เลือกโครงการของรัฐ
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { icon: "🪪", name: "บัตรสวัสดิการแห่งรัฐ", desc: "ชำระผ่านบัตรประจำตัวประชาชน" },
                  { icon: "🛍️", name: "คนละครึ่ง", desc: "สแกนแอปเป๋าตัง เพื่อชำระเงิน" },
                  { icon: "💳", name: "เงินดิจิทัล", desc: "ตรวจสอบสิทธิ์และยืนยันการใช้งาน" },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      background: "var(--white, #fff)",
                      border: "1.5px solid var(--gray-300, #d7dee8)",
                      borderRadius: 14,
                      padding: "16px 20px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 11,
                        background: "var(--blue-100, #e8f0fe)",
                        color: "var(--blue-600, #1b4b8f)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 19,
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: "var(--gray-500, #6b7785)", marginTop: 2 }}>{item.desc}</div>
                    </div>
                    <div style={{ color: "var(--gray-300, #d7dee8)", fontSize: 18 }}>›</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 24 }}>
                <button
                  onClick={processExactPayment}
                  style={{
                    width: "100%",
                    background: "var(--blue-600, #1b4b8f)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 16,
                    padding: 18,
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "background 0.15s ease",
                  }}
                >
                  ดำเนินการต่อ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ✅ MIXED PAYMENT POPUP - Click outside does NOT close */}
      {showSplitPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              background: "var(--white, #fff)",
              borderRadius: 24,
              padding: "32px 36px",
              width: "100%",
              maxWidth: 500,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              animation: "popFade 0.25s ease",
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--gray-200, #e5e7eb)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink, #0b1726)", margin: 0 }}>
                  แยกบิล / ชำระแบบผสม
                </h3>
                <button
                  onClick={closeSplitPopup}
                  style={{
                    background: "var(--blue-100, #e8f0fe)",
                    border: "none",
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    fontSize: 16,
                    cursor: "pointer",
                    color: "var(--blue-700, #13315c)",
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ fontSize: 13, color: "var(--gray-500, #6b7785)" }}>
                เลือกวิธีชำระเงินและจำนวนสำหรับแต่ละวิธี
              </div>
            </div>

            {/* Total Amount */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "var(--gray-500, #6b7785)" }}>ยอดที่ต้องชำระทั้งหมด</div>
              <div style={{ fontFamily: "'Sarabun', sans-serif", fontSize: 32, fontWeight: 700, color: "var(--blue-700, #13315c)" }}>
                {formatBaht(total)}
              </div>
            </div>

            {/* Payment Lines */}
            <div style={{ marginBottom: 20 }}>
              {mixedPayments.map((payment) => (
                <div
                  key={payment.id}
                  style={{
                    background: "var(--gray-50, #f9fafb)",
                    border: "1px solid var(--gray-200, #e5e7eb)",
                    borderRadius: 12,
                    padding: "14px",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                    <select
                      value={payment.type}
                      onChange={(e) => updatePaymentLine(payment.id, "type", e.target.value as PaymentMethodType)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        border: "1px solid var(--gray-300, #d7dee8)",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--ink, #0b1726)",
                        background: "var(--white, #fff)",
                        cursor: "pointer",
                      }}
                    >
                      <option value="cash">{getPaymentMethodLabel("cash")}</option>
                      <option value="transfer">{getPaymentMethodLabel("transfer")}</option>
                      <option value="gov_welfare">{getPaymentMethodLabel("gov_welfare")}</option>
                      <option value="khon_la_krueng">{getPaymentMethodLabel("khon_la_krueng")}</option>
                      <option value="digital_money">{getPaymentMethodLabel("digital_money")}</option>
                      <option value="other">{getPaymentMethodLabel("other")}</option>
                    </select>

                    {mixedPayments.length > 1 && (
                      <button
                        onClick={() => removePaymentLine(payment.id)}
                        style={{
                          background: "#fee2e2",
                          border: "1px solid #fca5a5",
                          borderRadius: 8,
                          padding: "6px 8px",
                          fontSize: 16,
                          cursor: "pointer",
                          color: "#dc2626",
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: "var(--white, #fff)",
                      border: "1.5px solid var(--gray-300, #d7dee8)",
                      borderRadius: 8,
                      padding: "8px 12px",
                    }}
                  >
                    <span style={{ color: "var(--gray-500, #6b7785)", fontWeight: 600 }}>฿</span>
                    <input
                      type="text"
                      value={payment.amount}
                      onChange={(e) => updatePaymentLine(payment.id, "amount", e.target.value)}
                      placeholder="0.00"
                      style={{
                        border: "none",
                        outline: "none",
                        fontFamily: "'Sarabun', sans-serif",
                        fontSize: 16,
                        fontWeight: 700,
                        width: "100%",
                        color: "var(--ink, #0b1726)",
                        background: "transparent",
                      }}
                    />
                  </div>

                  {/* ✅ Show QR Code for transfer method */}
                  {payment.type === "transfer" && parseFloat(payment.amount) > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        marginTop: 10,
                        padding: 12,
                        border: "1px solid var(--gray-300, #d7dee8)",
                        borderRadius: 10,
                        background: "var(--blue-50, #f0f5ff)",
                      }}
                    >
                      <div
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 8,
                          overflow: "hidden",
                          flexShrink: 0,
                          background: "#fff",
                          border: "1px solid var(--gray-300, #d7dee8)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {splitQrLoading ? (
                          <span style={{ fontSize: 12, color: "var(--gray-500, #6b7785)" }}>⏳</span>
                        ) : splitQrDataUrl ? (
                          <img
                            src={splitQrDataUrl}
                            alt="PromptPay QR"
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        ) : null}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>
                          {storeData?.payment_account.account_holder || storeData?.store.store_name || "ร้านค้า"}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--gray-500, #6b7785)" }}>
                          PromptPay: {storeData?.payment_account.promptpay_id || "-"}
                        </div>
                        <div style={{ fontFamily: "'Sarabun', sans-serif", fontSize: 14, fontWeight: 700, color: "var(--blue-700, #13315c)", marginTop: 2 }}>
                          {formatBaht(parseFloat(payment.amount) || 0)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add Payment Line Button */}
            <button
              onClick={addPaymentLine}
              style={{
                width: "100%",
                background: "var(--gray-100, #f3f4f6)",
                border: "2px dashed var(--blue-600, #1b4b8f)",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--blue-600, #1b4b8f)",
                cursor: "pointer",
                marginBottom: 20,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.background = "var(--blue-50, #f0f5ff)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.background = "var(--gray-100, #f3f4f6)";
              }}
            >
              ➕ เพิ่มวิธีชำระเงิน
            </button>

            {/* Summary */}
            <div
              style={{
                background: "var(--blue-100, #e8f0fe)",
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 20,
                fontSize: 13,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "var(--blue-700, #13315c)" }}>
                <span>ยอดรวมที่กรอก</span>
                <span style={{ fontWeight: 700 }}>{formatBaht(mixedCombined)}</span>
              </div>
              {Math.abs(mixedRemaining) > 0.004 ? (
                mixedRemaining > 0 ? (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#dc2626" }}>
                    <span>ยังขาดอีก</span>
                    <span style={{ fontWeight: 700 }}>{formatBaht(mixedRemaining)}</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#16a34a" }}>
                    <span>เงินทอน</span>
                    <span style={{ fontWeight: 700 }}>{formatBaht(-mixedRemaining)}</span>
                  </div>
                )
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#16a34a" }}>
                  <span>✓ จำนวนเงินถูกต้อง</span>
                </div>
              )}
            </div>

            {/* Confirm Button */}
            <button
              onClick={confirmMixedPayment}
              disabled={!isMixedPaymentValid()}
              style={{
                width: "100%",
                background: isMixedPaymentValid() ? "var(--blue-600, #1b4b8f)" : "var(--gray-300, #d7dee8)",
                color: "#fff",
                border: "none",
                borderRadius: 14,
                padding: 16,
                fontSize: 15,
                fontWeight: 700,
                cursor: isMixedPaymentValid() ? "pointer" : "not-allowed",
                transition: "background 0.15s ease",
              }}
            >
              ✓ ยืนยันการชำระเงินแบบผสม
            </button>
          </div>
        </div>
      )}

      {/* ---------- PAYMENT SUCCESS POPUP - Click outside does NOT close, press Enter to close ---------- */}
      {popupChange !== null && (
        <div
          ref={popupContainerRef}
          tabIndex={-1}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmSuccessfulPayment();
            }
          }}
        >
          <div
            style={{
              background: "var(--white, #fff)",
              padding: "40px 48px 36px",
              borderRadius: 28,
              maxWidth: 400,
              width: "90%",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              animation: "popFade 0.25s ease",
            }}
          >
            <div style={{ fontSize: 54, marginBottom: 8 }}>🧾</div>
            <h2 style={{ fontSize: 22, color: "var(--ink, #0b1726)", marginBottom: 12 }}>ชำระเงินสำเร็จ</h2>
            {popupChange > 0 ? (
              <>
                <div style={{ color: "var(--gray-500, #6b7785)", fontSize: 16, marginBottom: 22 }}>เงินทอน</div>
                <div
                  style={{
                    fontFamily: "'Sarabun', sans-serif",
                    fontSize: 62,
                    fontWeight: 700,
                    color: "#16a34a",
                    margin: "12px 0 18px",
                  }}
                >
                  ฿{popupChange.toFixed(2)}
                </div>
              </>
            ) : (
              <div
                style={{
                  fontFamily: "'Sarabun', sans-serif",
                  fontSize: 62,
                  fontWeight: 700,
                  color: "#16a34a",
                  margin: "12px 0 18px",
                }}
              >
                ✓
              </div>
            )}
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--gray-500, #6b7785)" }}>ยอดรวม {formatBaht(total)}</div>
            <br />
            <button
              type="button"
              onClick={confirmSuccessfulPayment}
              style={{
                background: "var(--blue-600, #1b4b8f)",
                color: "#fff",
                border: "none",
                borderRadius: 14,
                padding: "14px 38px",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* ✅ Hidden Canvas Elements for QR Generation */}
      <canvas ref={splitQrCanvasRef} style={{ display: "none" }} />
      <canvas ref={transferQrCanvasRef} style={{ display: "none" }} />

      {/* inject keyframes for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes popFade {
          0% { transform: scale(0.94); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default POSPayment;