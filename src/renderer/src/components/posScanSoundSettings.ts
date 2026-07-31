import firstProductScanSound from "../assets/First product scan.wav";
import noProductsFoundSound from "../assets/No products found.wav";

export interface PosScanSoundSettings {
  enabled: boolean;
  firstProductScanEnabled: boolean;
  noProductsFoundEnabled: boolean;
}

export type PosScanSoundType = "firstProductScan" | "noProductsFound";

const POS_SCAN_SOUND_SETTINGS_KEY = "pos_scan_sound_settings";
const POS_SCAN_SOUND_SETTINGS_CHANGED_EVENT = "posScanSoundSettingsChanged";

export const defaultPosScanSoundSettings: PosScanSoundSettings = {
  enabled: true,
  firstProductScanEnabled: true,
  noProductsFoundEnabled: true,
};

const normalizeBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

export const normalizePosScanSoundSettings = (
  value: unknown,
): PosScanSoundSettings => {
  if (!value || typeof value !== "object") {
    return defaultPosScanSoundSettings;
  }

  const settings = value as Partial<PosScanSoundSettings>;
  return {
    enabled: normalizeBoolean(
      settings.enabled,
      defaultPosScanSoundSettings.enabled,
    ),
    firstProductScanEnabled: normalizeBoolean(
      settings.firstProductScanEnabled,
      defaultPosScanSoundSettings.firstProductScanEnabled,
    ),
    noProductsFoundEnabled: normalizeBoolean(
      settings.noProductsFoundEnabled,
      defaultPosScanSoundSettings.noProductsFoundEnabled,
    ),
  };
};

export const getStoredPosScanSoundSettings =
  async (): Promise<PosScanSoundSettings> => {
    const stored = await window.electronStore.get(POS_SCAN_SOUND_SETTINGS_KEY);
    return normalizePosScanSoundSettings(stored);
  };

export const setStoredPosScanSoundSettings = async (
  settings: PosScanSoundSettings,
): Promise<void> => {
  await window.electronStore.set(POS_SCAN_SOUND_SETTINGS_KEY, settings);
};

export const notifyPosScanSoundSettingsChanged = (
  settings: PosScanSoundSettings,
) => {
  window.dispatchEvent(
    new CustomEvent<PosScanSoundSettings>(
      POS_SCAN_SOUND_SETTINGS_CHANGED_EVENT,
      { detail: settings },
    ),
  );
};

export const subscribePosScanSoundSettingsChanged = (
  listener: (settings: PosScanSoundSettings) => void,
) => {
  const handleSettingsChanged = (event: Event) => {
    listener((event as CustomEvent<PosScanSoundSettings>).detail);
  };

  window.addEventListener(
    POS_SCAN_SOUND_SETTINGS_CHANGED_EVENT,
    handleSettingsChanged,
  );

  return () => {
    window.removeEventListener(
      POS_SCAN_SOUND_SETTINGS_CHANGED_EVENT,
      handleSettingsChanged,
    );
  };
};

export const getPosScanSoundUrl = (type: PosScanSoundType): string =>
  type === "firstProductScan" ? firstProductScanSound : noProductsFoundSound;

