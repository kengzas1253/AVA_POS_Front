import { IconPercentage } from "@tabler/icons-react";
import { FormInput, SectionHeader, SectionContent, StoreSettings } from "./StoreSetting";

interface TaxSettingProps {
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

export function TaxSetting({
  store,
  formStore,
  isEditing,
  updateStoreField,
  expandedSections,
  toggleSection,
}: TaxSettingProps) {
  return (
    <>
      <SectionHeader
        id="tax"
        icon={<IconPercentage size={18} />}
        title="ภาษีและระบบ"
        expandedSections={expandedSections}
        toggleSection={toggleSection}
      />
      <SectionContent id="tax" expandedSections={expandedSections}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <FormInput
              label="ใช้งานภาษี"
              value={isEditing ? formStore.vat_enabled : store.vat_enabled}
              onChange={(v) => updateStoreField("vat_enabled", v)}
              type="checkbox"
              disabled={!isEditing}
            />
            <FormInput
              label="อัตราภาษี (%)"
              value={isEditing ? formStore.vat_rate : store.vat_rate}
              onChange={(v) => updateStoreField("vat_rate", v)}
              type="number"
              disabled={!isEditing || !formStore.vat_enabled}
              helper="เช่น 7 = 7%"
            />
          </div>
          <div className="space-y-2">
            <FormInput
              label="อนุญาตสต็อกติดลบ"
              value={isEditing ? formStore.allow_negative_stock : store.allow_negative_stock}
              onChange={(v) => updateStoreField("allow_negative_stock", v)}
              type="checkbox"
              disabled={!isEditing}
            />
          </div>
        </div>
      </SectionContent>
    </>
  );
}