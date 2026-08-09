import React, { forwardRef, useEffect, useState } from "react";
import QRCode from "qrcode";
import generatePayload from "promptpay-qr";
import type { PaymentAccount, StoreSettings } from "./StoreSetting";

export type ReceiptPaperSize = "58MM" | "80MM" | "A4";
export type ReceiptDocumentMode = "preview" | "print" | "export";

export interface SaleReceiptItem {
  barcode_snapshot?: string | null;
  product_name_snapshot?: string | null;
  quantity: string;
  unit_code_snapshot?: string | null;
  unit_name_snapshot?: string | null;
  unit_price: string;
  discount_amount?: string | null;
  net_amount: string;
}

export interface SaleReceiptPayment {
  payment_type_id: string;
  payment_name: string;
  amount: string;
  reference_no?: string | null;
}

export interface SaleReceipt {
  id: string;
  sale_no: string;
  sale_at: string;
  customer_name?: string | null;
  cashier_name?: string | null;
  machine_id?: string | null;
  machine_name?: string | null;
  subtotal?: string | null;
  item_discount_total?: string | null;
  bill_discount_total?: string | null;
  promotion_discount_total?: string | null;
  tax_total?: string | null;
  total_amount: string;
  paid_total?: string | null;
  change_amount?: string | null;
  status?: string | null;
  items?: SaleReceiptItem[] | null;
  payments?: SaleReceiptPayment[] | null;
}

export interface ReceiptDocumentProps {
  receipt: SaleReceipt;
  storeSettings: StoreSettings | null;
  paymentAccount?: PaymentAccount | null;
  paperSize?: ReceiptPaperSize;
  mode?: ReceiptDocumentMode;
  apiBaseUrl?: string;
}

const FALLBACK_STORE_NAME = "AVA MY POS";
const FALLBACK_CUSTOMER_NAME = "ลูกค้าทั่วไป";
const BANGKOK_TIME_ZONE = "Asia/Bangkok";

const formatMoney = (value?: string | number | null) => {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return numeric.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDateTime = (value?: string | null, timezone?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone || BANGKOK_TIME_ZONE,
  }).format(date);
};

const getAssetUrl = (apiBaseUrl: string | undefined, path?: string | null) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = apiBaseUrl?.replace(/\/+$/, "") ?? "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

const getCustomerName = (receipt: SaleReceipt, storeSettings: StoreSettings | null) =>
  receipt.customer_name?.trim() || storeSettings?.default_customer_name?.trim() || FALLBACK_CUSTOMER_NAME;

const getPaperClass = (paperSize: ReceiptPaperSize) => {
  if (paperSize === "A4") return "receipt-document receipt-document-a4";
  if (paperSize === "58MM") return "receipt-document receipt-document-slip receipt-document-58";
  return "receipt-document receipt-document-slip receipt-document-80";
};

const isA4 = (paperSize: ReceiptPaperSize) => paperSize === "A4";

const getTotalDiscount = (receipt: SaleReceipt) =>
  Number(receipt.item_discount_total ?? 0) +
  Number(receipt.bill_discount_total ?? 0) +
  Number(receipt.promotion_discount_total ?? 0);

const getUnitLabel = (item: SaleReceiptItem) =>
  item.unit_name_snapshot?.trim() || item.unit_code_snapshot?.trim() || "-";

const buildPromptPayPayload = (promptpayId: string, amount: number) => {
  const cleanId = promptpayId.replace(/[\s-]/g, "");
  if (!cleanId) return null;
  return generatePayload(cleanId, amount > 0 ? { amount } : {});
};

const ReceiptDocument = forwardRef<HTMLDivElement, ReceiptDocumentProps>(
  ({ receipt, storeSettings, paymentAccount, paperSize = "80MM", mode = "preview", apiBaseUrl }, ref) => {
    const logoUrl = getAssetUrl(apiBaseUrl, storeSettings?.show_logo ? storeSettings.logo_url : null);
    const receiptImageUrl = getAssetUrl(
      apiBaseUrl,
      storeSettings?.show_receipt_image ? storeSettings.receipt_image_url : null,
    );
    const items = receipt.items ?? [];
    const payments = receipt.payments ?? [];
    const a4 = isA4(paperSize);
    const paymentTotal = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const itemDiscountTotal = Number(receipt.item_discount_total ?? 0);
    const billDiscountTotal = Number(receipt.bill_discount_total ?? 0);
    const promotionDiscountTotal = Number(receipt.promotion_discount_total ?? 0);
    const taxTotal = Number(receipt.tax_total ?? 0);
    const totalDiscount = itemDiscountTotal + billDiscountTotal + promotionDiscountTotal;
    const hasDiscount = totalDiscount > 0;
    const hasTax = taxTotal > 0;
    const [promptPayQrDataUrl, setPromptPayQrDataUrl] = useState<string | null>(null);

    useEffect(() => {
      if (!storeSettings?.show_promptpay_qr || !paymentAccount?.promptpay_id) {
        setPromptPayQrDataUrl(null);
        return;
      }

      const payload = buildPromptPayPayload(paymentAccount.promptpay_id, Number(receipt.total_amount ?? 0));
      if (!payload) {
        setPromptPayQrDataUrl(null);
        return;
      }

      let cancelled = false;
      void QRCode.toDataURL(payload, {
        margin: 1,
        width: a4 ? 160 : 180,
        errorCorrectionLevel: "M",
      })
        .then((dataUrl) => {
          if (!cancelled) setPromptPayQrDataUrl(dataUrl);
        })
        .catch(() => {
          if (!cancelled) setPromptPayQrDataUrl(null);
        });

      return () => {
        cancelled = true;
      };
    }, [a4, paymentAccount?.promptpay_id, receipt.total_amount, storeSettings?.show_promptpay_qr]);

    return (
      <div ref={ref} className={`${getPaperClass(paperSize)} receipt-document-${mode}`}>
        <style>{`
          @import url("https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap");
          .receipt-document {
            box-sizing: border-box;
            background: #ffffff;
            color: #020617;
            font-family: "Sarabun", "TH Sarabun New", "TH SarabunPSK", Tahoma, Arial, sans-serif;
            overflow-wrap: anywhere;
          }
          .receipt-document * {
            box-sizing: border-box;
            font-family: "Sarabun", "TH Sarabun New", "TH SarabunPSK", Tahoma, Arial, sans-serif;
          }
          .receipt-document-slip {
            padding: 14px;
            font-size: 12px;
            line-height: 1.45;
          }
          .receipt-document-80 {
            width: 302px;
            max-width: 302px;
          }
          .receipt-document-58 {
            width: 219px;
            max-width: 219px;
            padding: 10px;
            font-size: 10.5px;
          }
          .receipt-document-a4 {
            width: 794px;
            min-height: 1123px;
            padding: 40px;
            font-size: 12px;
            line-height: 1.5;
            display: flex;
            flex-direction: column;
          }
          .receipt-document-header {
            text-align: center;
          }
          .receipt-document-slip .receipt-document-brand {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
          }
          .receipt-document-a4 .receipt-document-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
            border-bottom: 0;
            padding-bottom: 0;
            text-align: left;
          }
          .receipt-document-brand {
            display: flex;
            align-items: flex-start;
            gap: 16px;
          }
          .receipt-document-logo {
            display: block;
            max-width: 96px;
            max-height: 56px;
            object-fit: contain;
            margin: 0 auto 8px;
          }
          .receipt-document-slip .receipt-document-logo {
            width: auto;
            height: auto;
            max-width: 142px;
            max-height: 110px;
            margin: 0 auto 2px;
          }
          .receipt-document-58 .receipt-document-logo {
            max-width: 112px;
            max-height: 88px;
          }
          .receipt-document-a4 .receipt-document-logo {
            width: 56px;
            height: 56px;
            max-width: 56px;
            max-height: 56px;
            border-radius: 10px;
            object-fit: cover;
            margin: 0;
          }
          .receipt-document-a4-icon {
            display: none;
          }
          .receipt-document-a4 .receipt-document-a4-icon {
            display: flex;
            width: 56px;
            height: 56px;
            flex-shrink: 0;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            background: #2446a8;
            color: #ffffff;
          }
          .receipt-document-store {
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
          }
          .receipt-document-a4 .receipt-document-store {
            font-size: 18px;
          }
          .receipt-document-heading {
            text-align: right;
            flex-shrink: 0;
          }
          .receipt-document-heading-title {
            color: #1d6fd8;
            font-size: 28px;
            font-weight: 800;
            letter-spacing: 0;
          }
          .receipt-document-heading-subtitle {
            color: #94a3b8;
            font-size: 12px;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }
          .receipt-document-muted {
            color: #475569;
          }
          .receipt-document-section {
            border-top: 1px dashed #cbd5e1;
            margin-top: 10px;
            padding-top: 10px;
          }
          .receipt-document-a4 .receipt-document-section {
            border-top: 0;
            margin-top: 20px;
            padding-top: 0;
          }
          .receipt-document-card {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            min-height: 96px;
            background: #fbfdff;
          }
          .receipt-document-card-label {
            margin-bottom: 6px;
            color: #94a3b8;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.025em;
            text-transform: uppercase;
          }
          .receipt-document-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            padding: 3px 0;
          }
          .receipt-document-row > :last-child {
            text-align: right;
            font-weight: 600;
          }
          .receipt-document-title {
            font-weight: 800;
            font-size: 18px;
            text-align: center;
            margin: 14px 0 4px;
          }
          .receipt-document-a4 .receipt-document-title {
            display: none;
          }
          .receipt-document-total {
            font-size: 28px;
            font-weight: 900;
            text-align: center;
            margin: 8px 0 2px;
          }
          .receipt-document-58 .receipt-document-total {
            font-size: 22px;
          }
          .receipt-document-a4 .receipt-document-total {
            display: none;
            text-align: right;
          }
          .receipt-document-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #e2e8f0;
          }
          .receipt-document-table th,
          .receipt-document-table td {
            padding: 9px 8px;
            border: 1px solid #e2e8f0;
            vertical-align: top;
          }
          .receipt-document-table th {
            background: #f8fafc;
            text-align: left;
            color: #475569;
            font-size: 11px;
            font-weight: 700;
          }
          .receipt-document-table .number {
            text-align: right;
            white-space: nowrap;
          }
          .receipt-document-slip-item {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 8px;
            padding: 7px 0;
            border-bottom: 1px dashed #e2e8f0;
          }
          .receipt-document-footer {
            text-align: center;
            white-space: pre-line;
          }
          .receipt-document-footer-image {
            display: block;
            max-width: 96px;
            max-height: 96px;
            object-fit: contain;
            margin: 12px auto 0;
          }
          .receipt-document-a4 .receipt-document-footer-image {
            max-width: 160px;
            max-height: 160px;
          }
          .receipt-document-a4-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            align-items: start;
          }
          .receipt-document-a4-summary {
            width: 256px;
            margin-left: auto;
          }
          .receipt-document-a4-bottom {
            display: grid;
            grid-template-columns: 1.1fr 0.95fr;
            gap: 24px;
            margin-top: 22px;
            align-items: start;
          }
          .receipt-document-a4-note {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 14px 16px;
            color: #475569;
          }
          .receipt-document-a4-note-content {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }
          .receipt-document-a4-note + .receipt-document-a4-note {
            margin-top: 14px;
          }
          .receipt-document-a4-payment {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }
          .receipt-document-a4-payment-qr {
            width: 84px;
            height: 84px;
            object-fit: contain;
          }
          .receipt-document-promptpay {
            margin-top: 12px;
            text-align: center;
          }
          .receipt-document-promptpay img {
            width: 130px;
            height: 130px;
            object-fit: contain;
            margin: 6px auto 0;
          }
          .receipt-document-a4 .receipt-document-promptpay {
            margin-top: 0;
            text-align: center;
          }
          .receipt-document-a4 .receipt-document-promptpay img {
            width: 96px;
            height: 96px;
          }
          .receipt-document-a4-total-row {
            margin-top: 4px;
            border-radius: 8px;
            background: rgba(29, 111, 216, 0.05);
            color: #1d6fd8;
            font-size: 16px;
            font-weight: 800;
            padding: 12px;
          }
          .receipt-document-signatures {
            display: none;
          }
          .receipt-document-a4 .receipt-document-signatures {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: auto;
            padding-top: 64px;
            color: #475569;
            font-size: 12px;
            text-align: center;
          }
          .receipt-document-sign-line {
            border-top: 1px solid #cbd5e1;
            padding-top: 8px;
          }
          @media print {
            body * {
              visibility: hidden;
            }
            .receipt-document,
            .receipt-document * {
              visibility: visible;
            }
            .receipt-document {
              position: absolute;
              left: 0;
              top: 0;
              box-shadow: none !important;
            }
            @page {
              margin: 0;
              size: ${paperSize === "A4" ? "A4" : "auto"};
            }
          }
        `}</style>

        <header className="receipt-document-header">
          <div className="receipt-document-brand">
            {logoUrl ? (
              <img src={logoUrl} alt={storeSettings?.store_name || FALLBACK_STORE_NAME} className="receipt-document-logo" />
            ) : (
              <div className="receipt-document-a4-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                  <path d="M3 9l1-5h16l1 5" />
                  <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
                  <path d="M9 20v-7h6v7" />
                </svg>
              </div>
            )}
            <div>
              <div className="receipt-document-store">{storeSettings?.store_name || FALLBACK_STORE_NAME}</div>
              <div className="receipt-document-muted">
                {storeSettings?.address && <div>{storeSettings.address}</div>}
                {(storeSettings?.phone || storeSettings?.email) && (
                  <div>
                    {storeSettings?.phone ? `โทร. ${storeSettings.phone}` : ""}
                    {storeSettings?.email && a4 ? `${storeSettings?.phone ? " · " : ""}${storeSettings.email}` : ""}
                  </div>
                )}
                {storeSettings?.tax_id && (
                  <div>
                    เลขผู้เสียภาษี {storeSettings.tax_id}
                    {storeSettings.branch_name ? ` (${storeSettings.branch_name}${storeSettings.branch_no ? `/${storeSettings.branch_no}` : ""})` : ""}
                  </div>
                )}
                {!a4 && storeSettings?.receipt_header && (
                  <div style={{ whiteSpace: "pre-line", marginTop: 4 }}>{storeSettings.receipt_header}</div>
                )}
              </div>
            </div>
          </div>
          {a4 && (
            <div className="receipt-document-heading">
              <div className="receipt-document-heading-title">ใบเสร็จรับเงิน</div>
              <div className="receipt-document-heading-subtitle">Receipt</div>
              <div className="receipt-document-muted" style={{ marginTop: 12 }}>
                <div>
                  <span style={{ color: "#94a3b8" }}>เลขที่: </span>
                  <strong style={{ color: "#1e293b" }}>{receipt.sale_no}</strong>
                </div>
                <div>
                  <span style={{ color: "#94a3b8" }}>วันที่: </span>
                  {formatDateTime(receipt.sale_at, storeSettings?.timezone)}
                </div>
                <div>
                  <span style={{ color: "#94a3b8" }}>สถานะ: </span>
                  <strong style={{ color: "#1e293b" }}>{receipt.status || "-"}</strong>
                </div>
              </div>
            </div>
          )}
        </header>

        <div className="receipt-document-title">{a4 ? "ใบเสร็จรับเงิน / ใบกำกับภาษี" : "ใบเสร็จรับเงิน"}</div>

        <section className={a4 ? "receipt-document-section receipt-document-a4-grid" : "receipt-document-section"}>
          <div className={a4 ? "receipt-document-card" : undefined}>
            {a4 ? (
              <>
                <div className="receipt-document-card-label">ลูกค้า</div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{getCustomerName(receipt, storeSettings)}</div>
              </>
            ) : (
              <>
                <InfoRow label="เลขที่ใบเสร็จ" value={receipt.sale_no} />
                <InfoRow label="วันที่" value={formatDateTime(receipt.sale_at, storeSettings?.timezone)} />
                <InfoRow label="พนักงาน" value={receipt.cashier_name || "-"} />
              </>
            )}
          </div>
          <div className={a4 ? "receipt-document-card" : undefined}>
            {a4 && <div className="receipt-document-card-label">รายละเอียด</div>}
            {a4 && <InfoRow label="พนักงาน" value={receipt.cashier_name || "-"} />}
            <InfoRow label="เครื่อง POS" value={receipt.machine_name || receipt.machine_id || "-"} />
            {a4 ? (
              <InfoRow label="สกุลเงิน" value={storeSettings?.currency || "THB"} />
            ) : (
              <>
                <InfoRow label="ลูกค้า" value={getCustomerName(receipt, storeSettings)} />
                <InfoRow label="สถานะ" value={receipt.status || "-"} />
              </>
            )}
          </div>
        </section>

        <div className={a4 ? "receipt-document-total" : "receipt-document-total"}>฿{formatMoney(receipt.total_amount)}</div>
        {!a4 && <div className="receipt-document-muted" style={{ textAlign: "center" }}>รวมทั้งหมด</div>}

        <section className="receipt-document-section">
          {a4 ? (
            <table className="receipt-document-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>รายการ</th>
                  <th className="number" style={{ width: 90 }}>จำนวน</th>
                  <th style={{ width: 80, textAlign: "center" }}>หน่วย</th>
                  <th className="number" style={{ width: 100 }}>ราคา/หน่วย</th>
                  <th className="number" style={{ width: 110 }}>จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={`${item.barcode_snapshot ?? "item"}-${index}`}>
                    <td>{index + 1}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{item.product_name_snapshot || "-"}</div>
                      <div className="receipt-document-muted" style={{ fontSize: 11 }}>{item.barcode_snapshot || "-"}</div>
                    </td>
                    <td className="number">{formatMoney(item.quantity).replace(/\.00$/, "")}</td>
                    <td style={{ textAlign: "center" }}>
                      {getUnitLabel(item)}
                    </td>
                    <td className="number">{formatMoney(item.unit_price)}</td>
                    <td className="number">฿{formatMoney(item.net_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            items.map((item, index) => (
              <div key={`${item.barcode_snapshot ?? "item"}-${index}`} className="receipt-document-slip-item">
                <div>
                  <strong>{item.product_name_snapshot || "-"}</strong>
                  <div className="receipt-document-muted">
                    {item.barcode_snapshot || "-"} · {formatMoney(item.quantity)} {getUnitLabel(item)} x ฿{formatMoney(item.unit_price)}
                  </div>
                  {Number(item.discount_amount ?? 0) > 0 && <div className="receipt-document-muted">ส่วนลด ฿{formatMoney(item.discount_amount)}</div>}
                </div>
                <strong>฿{formatMoney(item.net_amount)}</strong>
              </div>
            ))
          )}
        </section>

        {a4 ? (
          <section className="receipt-document-a4-bottom">
            <div>
              <div className="receipt-document-a4-note">
                <div style={{ marginBottom: 8, fontWeight: 800, color: "#0f172a" }}>หมายเหตุ</div>
                <div className="receipt-document-a4-note-content">
                  <div style={{ whiteSpace: "pre-line" }}>
                    {storeSettings?.receipt_footer?.trim() || "สามารถเปลี่ยนสินค้าได้ภายใน 7 วันหลังซื้อ\nขอบคุณที่ใช้บริการ"}
                  </div>
                  {receiptImageUrl && <img src={receiptImageUrl} alt="Receipt note" className="receipt-document-a4-payment-qr" />}
                </div>
              </div>
              <div className="receipt-document-a4-note receipt-document-a4-payment">
                <div>
                  <div style={{ marginBottom: 8, fontWeight: 800, color: "#0f172a" }}>ชำระโดย</div>
                  {payments.length > 0 ? (
                    payments.map((payment) => (
                      <div key={`${payment.payment_type_id}-${payment.reference_no ?? payment.amount}`} style={{ marginTop: 4 }}>
                        <div>{payment.payment_name}</div>
                        <div className="receipt-document-muted">
                          {paymentAccount?.promptpay_id ? `พร้อมเพย์ ${paymentAccount.promptpay_id}` : `ยอดชำระ ฿${formatMoney(payment.amount)}`}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div>-</div>
                  )}
                  <div className="receipt-document-muted" style={{ marginTop: 4 }}>
                    รับเงิน ฿{formatMoney(receipt.paid_total ?? paymentTotal)} · เงินทอน ฿{formatMoney(receipt.change_amount)}
                  </div>
                </div>
                {promptPayQrDataUrl && (
                  <div className="receipt-document-promptpay">
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>PromptPay</div>
                    <img src={promptPayQrDataUrl} alt="PromptPay QR" />
                  </div>
                )}
              </div>
            </div>

            <div className="receipt-document-a4-summary">
              <InfoRow label="รวมเป็นเงิน" value={formatMoney(receipt.subtotal)} />
              {hasDiscount && <InfoRow label="ส่วนลด" value={formatMoney(totalDiscount)} />}
              {hasTax && <InfoRow label="ภาษี" value={formatMoney(receipt.tax_total)} />}
              <InfoRow label="รวมทั้งสิ้น" value={`฿${formatMoney(receipt.total_amount)}`} strong />
            </div>
          </section>
        ) : (
          <>
            <section className="receipt-document-section">
              {hasDiscount && <InfoRow label="ยอดก่อนส่วนลด" value={`฿${formatMoney(receipt.subtotal)}`} />}
              {itemDiscountTotal > 0 && <InfoRow label="ส่วนลดสินค้า" value={`฿${formatMoney(receipt.item_discount_total)}`} />}
              {billDiscountTotal > 0 && <InfoRow label="ส่วนลดท้ายบิล" value={`฿${formatMoney(receipt.bill_discount_total)}`} />}
              {promotionDiscountTotal > 0 && <InfoRow label="ส่วนลดโปรโมชัน" value={`฿${formatMoney(receipt.promotion_discount_total)}`} />}
              {hasTax && <InfoRow label="ภาษี" value={`฿${formatMoney(receipt.tax_total)}`} />}
              <InfoRow label="รวมทั้งหมด" value={`฿${formatMoney(receipt.total_amount)}`} strong />
              <InfoRow label="รับเงิน" value={`฿${formatMoney(receipt.paid_total)}`} />
              <InfoRow label="เงินทอน" value={`฿${formatMoney(receipt.change_amount)}`} />
            </section>

            {payments.length > 0 && (
              <section className="receipt-document-section">
                {payments.map((payment) => (
                  <InfoRow
                    key={`${payment.payment_type_id}-${payment.reference_no ?? payment.amount}`}
                    label={payment.payment_name}
                    value={`฿${formatMoney(payment.amount)}`}
                  />
                ))}
              </section>
            )}

            {promptPayQrDataUrl && (
              <section className="receipt-document-section receipt-document-promptpay">
                <div style={{ fontWeight: 800 }}>PromptPay</div>
                <div className="receipt-document-muted">สแกนเพื่อชำระเงิน</div>
                <img src={promptPayQrDataUrl} alt="PromptPay QR" />
              </section>
            )}

            <footer className="receipt-document-section receipt-document-footer">
              {storeSettings?.receipt_footer?.trim() || "ขอบคุณที่ใช้บริการ"}
            </footer>

            {receiptImageUrl && <img src={receiptImageUrl} alt="Facebook page QR" className="receipt-document-footer-image" />}
          </>
        )}

        {a4 && (
          <div className="receipt-document-signatures">
            <div>
              <div style={{ height: 64 }} />
              <p className="receipt-document-sign-line">ผู้รับเงิน</p>
              <p style={{ marginTop: 4, color: "#94a3b8" }}>วันที่ ....../....../......</p>
            </div>
            <div>
              <div style={{ height: 64 }} />
              <p className="receipt-document-sign-line">ผู้รับสินค้า / ลูกค้า</p>
              <p style={{ marginTop: 4, color: "#94a3b8" }}>วันที่ ....../....../......</p>
            </div>
          </div>
        )}
      </div>
    );
  },
);

ReceiptDocument.displayName = "ReceiptDocument";

interface InfoRowProps {
  label: string;
  value: string;
  strong?: boolean;
}

function InfoRow({ label, value, strong }: InfoRowProps) {
  return (
    <div className={strong ? "receipt-document-row receipt-document-a4-total-row" : "receipt-document-row"}>
      <span>{label}</span>
      <span style={strong ? { fontWeight: 900 } : undefined}>{value}</span>
    </div>
  );
}

export default ReceiptDocument;
