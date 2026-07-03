import { IconReceipt } from "@tabler/icons-react";
import { FormInput, SectionHeader, SectionContent, StoreSettings } from "./StoreSetting";

interface BillSettingProps {
  store: StoreSettings;
  formStore: Partial<StoreSettings>;
  isEditing: boolean;
  updateStoreField: <K extends keyof StoreSettings>(
    key: K,
    value: StoreSettings[K]
  ) => void;
  expandedSections: Set<string>;
  toggleSection: (section: string) => void;
}

export function BillSetting({
  store,
  formStore,
  isEditing,
  updateStoreField,
  expandedSections,
  toggleSection,
}: BillSettingProps) {
  return (
    <>
      <SectionHeader
        id="receipt"
        icon={<IconReceipt size={18} />}
        title="การตั้งค่าใบเสร็จ"
        expandedSections={expandedSections}
        toggleSection={toggleSection}
      />
      <SectionContent id="receipt" expandedSections={expandedSections}>
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormInput
              label="หัวข้อใบเสร็จ"
              value={isEditing ? formStore.receipt_header : store.receipt_header}
              onChange={(v) => updateStoreField("receipt_header", v)}
              disabled={!isEditing}
            />
            <FormInput
              label="ส่วนท้ายใบเสร็จ"
              value={isEditing ? formStore.receipt_footer : store.receipt_footer}
              onChange={(v) => updateStoreField("receipt_footer", v)}
              disabled={!isEditing}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormInput
              label="ขนาดกระดาษ"
              value={isEditing ? formStore.receipt_paper_size : store.receipt_paper_size}
              onChange={(v) => updateStoreField("receipt_paper_size", v)}
              type="select"
              disabled={!isEditing}
            />
            <div className="space-y-2">
              <FormInput
                label="แสดงโลโก้"
                value={isEditing ? formStore.show_logo : store.show_logo}
                onChange={(v) => updateStoreField("show_logo", v)}
                type="checkbox"
                disabled={!isEditing}
              />
              <FormInput
                label="แสดงภาพส่วนท้าย"
                value={isEditing ? formStore.show_receipt_image : store.show_receipt_image}
                onChange={(v) => updateStoreField("show_receipt_image", v)}
                type="checkbox"
                disabled={!isEditing}
              />
              <FormInput
                label="แสดง QR PromptPay"
                value={isEditing ? formStore.show_promptpay_qr : store.show_promptpay_qr}
                onChange={(v) => updateStoreField("show_promptpay_qr", v)}
                type="checkbox"
                disabled={!isEditing}
              />
              <FormInput
                label="พิมพ์ใบเสร็จอัตโนมัติ"
                value={isEditing ? formStore.auto_print_receipt : store.auto_print_receipt}
                onChange={(v) => updateStoreField("auto_print_receipt", v)}
                type="checkbox"
                disabled={!isEditing}
              />
            </div>
          </div>
        </div>
      </SectionContent>
    </>
  );
}