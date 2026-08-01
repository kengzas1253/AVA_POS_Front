const AUTO_LAUNCH_SETTING_KEY = "settings.autoLaunch";

export const loadAutoLaunchSetting = async (): Promise<boolean> => {
  const storedValue = await window.electronStore.get(AUTO_LAUNCH_SETTING_KEY);
  return typeof storedValue === "boolean" ? storedValue : false;
};

export const saveAutoLaunchSetting = async (enable: boolean): Promise<void> => {
  await window.electronStore.set(AUTO_LAUNCH_SETTING_KEY, enable);
};
