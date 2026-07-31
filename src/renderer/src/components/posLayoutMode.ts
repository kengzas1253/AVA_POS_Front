export type PosLayoutMode = "STANDARD" | "SCAN_ONLY";

export const POS_LAYOUT_MODE_KEY = "pos_layout_mode";
export const DEFAULT_POS_LAYOUT_MODE: PosLayoutMode = "STANDARD";

export const normalizePosLayoutMode = (value: unknown): PosLayoutMode => {
  return value === "SCAN_ONLY" || value === "STANDARD"
    ? value
    : DEFAULT_POS_LAYOUT_MODE;
};

export const getStoredPosLayoutMode = async (): Promise<PosLayoutMode> => {
  try {
    const storedMode = await window.electronStore.get(POS_LAYOUT_MODE_KEY);
    return normalizePosLayoutMode(storedMode);
  } catch (error) {
    console.error("Error loading POS layout mode:", error);
    return DEFAULT_POS_LAYOUT_MODE;
  }
};

export const setStoredPosLayoutMode = async (
  posLayoutMode: PosLayoutMode,
): Promise<void> => {
  await window.electronStore.set(POS_LAYOUT_MODE_KEY, posLayoutMode);
};

export const POS_LAYOUT_MODE_CHANGED_EVENT = "pos-layout-mode-changed";

export const notifyPosLayoutModeChanged = (posLayoutMode: PosLayoutMode) => {
  window.dispatchEvent(
    new CustomEvent<PosLayoutMode>(POS_LAYOUT_MODE_CHANGED_EVENT, {
      detail: posLayoutMode,
    }),
  );
};
