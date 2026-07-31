import { useEffect, useState } from "react";
import {
  IconDeviceFloppy,
  IconRefresh,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";
import {
  defaultPosScanSoundSettings,
  getPosScanSoundUrl,
  getStoredPosScanSoundSettings,
  notifyPosScanSoundSettingsChanged,
  setStoredPosScanSoundSettings,
  type PosScanSoundSettings,
  type PosScanSoundType,
} from "./posScanSoundSettings";

const playPreviewSound = (type: PosScanSoundType) => {
  const audio = new Audio(getPosScanSoundUrl(type));
  audio.currentTime = 0;
  void audio.play().catch(() => undefined);
};

export default function POSScanSoundSetting() {
  const [settings, setSettings] = useState<PosScanSoundSettings>(
    defaultPosScanSoundSettings,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void getStoredPosScanSoundSettings()
      .then((storedSettings) => {
        if (isMounted) setSettings(storedSettings);
      })
      .catch(() => {
        if (isMounted) setError("โหลดค่าการแจ้งเตือนเสียงไม่สำเร็จ");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const updateField = <K extends keyof PosScanSoundSettings>(
    field: K,
    value: PosScanSoundSettings[K],
  ) => {
    setSettings((current) => ({ ...current, [field]: value }));
    setMessage(null);
    setError(null);
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      await setStoredPosScanSoundSettings(settings);
      notifyPosScanSoundSettingsChanged(settings);
      setMessage("บันทึกค่าการแจ้งเตือนเสียงเรียบร้อยแล้ว");
    } catch {
      setError("ไม่สามารถบันทึกค่าการแจ้งเตือนเสียงได้");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {settings.enabled ? (
          <IconVolume size={18} className="text-[#1d6fd8]" />
        ) : (
          <IconVolumeOff size={18} className="text-slate-400" />
        )}
        แจ้งเตือนเสียงตอนสแกนสินค้า
      </div>

      {isLoading ? (
        <div className="py-4 text-sm text-slate-400">กำลังโหลดค่าเสียง...</div>
      ) : (
        <div className="space-y-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => updateField("enabled", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-[#1d6fd8] focus:ring-[#1d6fd8]"
            />
            <span>
              <span className="block text-sm font-medium text-slate-700">
                เปิดเสียงแจ้งเตือนตอนสแกนสินค้า
              </span>
              <span className="mt-1 block text-xs text-slate-400">
                ใช้เสียงที่มากับโปรแกรมสำหรับสแกนสินค้ารายการแรกและกรณีไม่พบสินค้า
              </span>
            </span>
          </label>

          <SoundOption
            checked={settings.firstProductScanEnabled}
            disabled={!settings.enabled}
            label="เล่นเสียงเมื่อสแกนสินค้ารายการแรก"
            description="ใช้ไฟล์ First product scan.wav เมื่อตะกร้ายังไม่มีสินค้าและสแกนเจอสินค้า"
            onChange={(checked) =>
              updateField("firstProductScanEnabled", checked)
            }
            onPreview={() => playPreviewSound("firstProductScan")}
          />

          <SoundOption
            checked={settings.noProductsFoundEnabled}
            disabled={!settings.enabled}
            label="เล่นเสียงเมื่อไม่พบสินค้าในระบบ"
            description="ใช้ไฟล์ No products found.wav เมื่อบาร์โค้ดที่สแกนไม่มีในระบบ"
            onChange={(checked) =>
              updateField("noProductsFoundEnabled", checked)
            }
            onPreview={() => playPreviewSound("noProductsFound")}
          />

          {message ? <p className="text-xs text-emerald-600">{message}</p> : null}
          {error ? <p className="text-xs text-red-500">{error}</p> : null}

          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={isSaving}
            className="mt-1 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <IconDeviceFloppy size={18} />
            {isSaving ? "กำลังบันทึก..." : "บันทึกค่าเสียง"}
          </button>
        </div>
      )}
    </section>
  );
}

function SoundOption({
  checked,
  disabled,
  label,
  description,
  onChange,
  onPreview,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
  onPreview: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3">
      <label className="flex min-w-0 flex-1 items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-[#1d6fd8] focus:ring-[#1d6fd8] disabled:opacity-50"
        />
        <span>
          <span className="block text-sm font-medium text-slate-700">
            {label}
          </span>
          <span className="mt-1 block text-xs text-slate-400">
            {description}
          </span>
        </span>
      </label>
      <button
        type="button"
        onClick={onPreview}
        disabled={disabled}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:border-[#1d6fd8] hover:text-[#1d6fd8] disabled:opacity-50"
      >
        <IconRefresh size={15} />
        ทดสอบเสียง
      </button>
    </div>
  );
}

