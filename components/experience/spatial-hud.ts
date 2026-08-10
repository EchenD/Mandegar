export type SpatialScreenPoint = {
  x: number;
  y: number;
  visible: boolean;
};

export type SpatialHudModeId =
  | "assembly"
  | "activationLeft"
  | "activationRight"
  | "reveal"
  | "experiences"
  | "proof"
  | "intelligence";

export type SpatialHudFrame = {
  mode: SpatialHudModeId | null;
  opacity: number;
  compact: boolean;
  width: number;
  height: number;
  primary: SpatialScreenPoint;
  secondary: SpatialScreenPoint;
  measureStart: SpatialScreenPoint;
  measureEnd: SpatialScreenPoint;
  measureMeters: number;
};
