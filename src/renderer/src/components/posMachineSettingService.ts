import { authorizedFetch, getApiErrorMessage } from "./StoreSetting";

export interface PosMachineSettings {
  id?: number | string;
  machineId?: string;
  machine_id?: string;
  allowBelowCost?: boolean;
  allow_below_cost?: boolean;
  minProfitAmount?: string | number | null;
  min_profit_amount?: string | number | null;
  autoConvertUnitPrice?: boolean;
  auto_convert_unit_price?: boolean;
}

export interface UpdatePosMachineSettingsPayload {
  machine_id: string;
  allowBelowCost: boolean;
  minProfitAmount: number;
  autoConvertUnitPrice: boolean;
}

const toApiPayload = (payload: UpdatePosMachineSettingsPayload) => ({
  allow_below_cost: payload.allowBelowCost,
  min_profit_amount: payload.minProfitAmount,
  autoConvertUnitPrice: payload.autoConvertUnitPrice,
});

interface PosMachineSettingsResponse {
  data?: PosMachineSettings;
  message?: string;
}

export const getPosMachineSettings = async (
  machineId: string,
): Promise<PosMachineSettings | null> => {
  const response = await authorizedFetch(
    `/pos-machine-settings/machine/${encodeURIComponent(machineId)}`,
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        `ไม่สามารถโหลดข้อมูลการตั้งค่าของเครื่องนี้ได้ (${response.status})`,
      ),
    );
  }

  const payload = (await response.json().catch(() => ({}))) as
    | PosMachineSettingsResponse
    | PosMachineSettings;

  if ("data" in payload && payload.data) return payload.data;
  return payload as PosMachineSettings;
};

export const updatePosMachineSettings = async (
  payload: UpdatePosMachineSettingsPayload,
  exists: boolean,
): Promise<PosMachineSettings> => {
  const response = exists
    ? await authorizedFetch(
        `/pos-machine-settings/machine/${encodeURIComponent(payload.machine_id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toApiPayload(payload)),
        },
      )
    : await authorizedFetch("/pos-machine-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machine_id: payload.machine_id,
          ...toApiPayload(payload),
        }),
      });

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(
        response,
        `ไม่สามารถบันทึกการตั้งค่าได้ (${response.status})`,
      ),
    );
  }

  const data = (await response.json().catch(() => ({}))) as
    | PosMachineSettingsResponse
    | PosMachineSettings;

  if ("data" in data && data.data) return data.data;
  return data as PosMachineSettings;
};
