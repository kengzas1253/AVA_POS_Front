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
    electronPrinter?: {
      getPrinters: () => Promise<
        {
          name: string;
          displayName: string;
          description: string;
          options: Record<string, unknown>;
        }[]
      >;
      printHtml: (payload: { html: string; printerName?: string }) => Promise<boolean>;
      exportPdf: (payload: { html: string; defaultPath?: string }) => Promise<string | null>;
    };
  }
}
