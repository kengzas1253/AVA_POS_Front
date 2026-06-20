export {};

declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
    };
    electronStore: {
      get: (key: string) => Promise<any>;
      set: (key: string, value: any) => Promise<boolean>;
    };
    electronDevice: {
      getInfo: () => Promise<{
        hostname: string;
        ip_address: string;
        os_platform: string;
        os_release: string;
      }>;
    };
  }
}
