import type { InteractionInput, InteractionState, InteractionStation } from "./interaction-types";

export const initialInteractionState: InteractionState = {
  activeStation: null,
  availableStation: null,
  lifecycle: "unavailable",
  input: null,
  completed: {
    photo: false,
    touch: false,
    stage: false,
    game: false,
    draw: false,
  },
};

export type InteractionAction =
  | { type: "AVAILABILITY"; station: InteractionStation | null }
  | { type: "ENTER"; station: InteractionStation; input: InteractionInput }
  | { type: "COMPLETING" }
  | { type: "COMPLETE"; station: InteractionStation }
  | { type: "RESTART"; station: InteractionStation }
  | { type: "EXIT"; cancelled: boolean }
  | { type: "RESET" };

export function interactionReducer(
  state: InteractionState,
  action: InteractionAction,
): InteractionState {
  switch (action.type) {
    case "AVAILABILITY":
      if (state.activeStation) return state;
      return {
        ...state,
        availableStation: action.station,
        lifecycle: action.station ? "available" : "unavailable",
      };
    case "ENTER":
      if (state.availableStation !== action.station) return state;
      return {
        ...state,
        activeStation: action.station,
        lifecycle: "active",
        input: action.input,
      };
    case "COMPLETING":
      return state.activeStation ? { ...state, lifecycle: "completing" } : state;
    case "COMPLETE":
      if (state.activeStation !== action.station) return state;
      return {
        ...state,
        lifecycle: "complete",
        completed: { ...state.completed, [action.station]: true },
      };
    case "RESTART":
      if (state.activeStation !== action.station && state.availableStation !== action.station) return state;
      return {
        ...state,
        lifecycle: state.activeStation ? "active" : state.lifecycle,
        completed: { ...state.completed, [action.station]: false },
      };
    case "EXIT":
      return {
        ...state,
        activeStation: null,
        lifecycle: action.cancelled ? "cancelled" : state.availableStation ? "available" : "unavailable",
        input: null,
      };
    case "RESET":
      return initialInteractionState;
  }
}
