import { useReducer } from "react";

interface StoreState {
  device_name: string;
  username: string;
  full_name: string;
  role: string;
}

type StoreAction = { type: "LOGOUT" };

const initialState: StoreState = {
  device_name: "AVA MY POS",
  username: "",
  full_name: "",
  role: "",
};

function reducer(state: StoreState, action: StoreAction): StoreState {
  if (action.type === "LOGOUT") {
    return initialState;
  }

  return state;
}

export function useStore() {
  const [state, dispatch] = useReducer(reducer, initialState);

  return { state, dispatch };
}
