import { authorizedFetch, getApiErrorMessage } from "./StoreSetting";

export interface CheckDiscountRequest {
  product_id: string;
  machine_id: string;
  discount_amount: number;
}

export interface CheckDiscountResponse {
  success: boolean;
  permitted: boolean;
  message: string;
}

interface CheckDiscountResponsePayload extends Partial<CheckDiscountResponse> {
  data?: Partial<CheckDiscountResponse>;
}

export const checkDiscount = async (
  payload: CheckDiscountRequest,
): Promise<CheckDiscountResponse> => {
  console.info("[POS discount] request", payload);

  const response = await authorizedFetch("/pos/check-discount", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as CheckDiscountResponsePayload;
  const result = data.data ?? data;

  console.info("[POS discount] response", {
    status: response.status,
    body: data,
  });

  if (!response.ok) {
    throw new Error(
      typeof result.message === "string" && result.message
        ? result.message
        : await getApiErrorMessage(
            new Response(JSON.stringify(data), { status: response.status }),
            "Unable to validate the discount. Please try again.",
          ),
    );
  }

  return {
    success: Boolean(result.success),
    permitted: result.permitted === true,
    message: typeof result.message === "string" ? result.message : "",
  };
};
