import type { InteractionStation } from "./interaction-types";

export type ParticipatingInteractionStation = Extract<InteractionStation, "touch" | "game" | "draw">;

export function reportInteractionParticipation(station: ParticipatingInteractionStation) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("mandegar:interaction-participation", {
    detail: { station },
  }));
}
