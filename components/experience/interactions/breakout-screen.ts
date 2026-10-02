import type { InteractionCopy } from "./interaction-copy";
import { breakoutBoard, type BreakoutGame } from "./breakout-game";

const { width: canvasWidth, height: canvasHeight } = breakoutBoard;
export type GameControl = "close" | "reset" | "action" | "finish";
export type BlockSpark = { x: number; y: number; startedAt: number };
export const gameControls = {
  reset: { left: 0.065, width: 0.23 },
  action: { left: 0.33, width: 0.34 },
  finish: { left: 0.705, width: 0.23 },
} as const;


function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, Math.min(radius, width / 2, height / 2));
}

type BreakoutScreenOptions = {
  copy: InteractionCopy;
  best: number;
  reducedMotion: boolean;
  transition: number;
  background: HTMLImageElement | null;
  trail: ReadonlyArray<{ x: number; y: number }>;
  sparks: ReadonlyArray<BlockSpark>;
  hoveredControl?: GameControl | null;
  focusedControl?: GameControl | null;
  interactive?: boolean;
};

export function paintBreakoutScreen(
  context: CanvasRenderingContext2D,
  current: BreakoutGame,
  {
    copy,
    best,
    reducedMotion,
    transition,
    background: backgroundImage,
    trail,
    sparks,
    hoveredControl = null,
    focusedControl = null,
    interactive = true,
  }: BreakoutScreenOptions,
) {
  const now = performance.now();
  const direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
  const cleared = current.blocks.filter((block) => !block.alive).length;
  const actionLabel = current.status === "running" ? copy.game.pause : current.status === "paused" ? copy.game.resume : current.serves > 0 ? copy.game.serve : copy.game.action;
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  if (backgroundImage?.complete) context.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);
  else {
    context.fillStyle = "#080b10";
    context.fillRect(0, 0, canvasWidth, canvasHeight);
  }
  context.save();
  context.globalAlpha = transition;
  const background = context.createLinearGradient(0, 0, canvasWidth, canvasHeight);
  background.addColorStop(0, "#141b26");
  background.addColorStop(1, "#080d16");
  context.fillStyle = background;
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  roundedRect(context, 12, 12, canvasWidth - 24, canvasHeight - 24, 22);
  context.strokeStyle = "rgba(247,247,244,.13)";
  context.lineWidth = 1;
  context.stroke();
  context.direction = direction;
  context.textAlign = "center";
  context.fillStyle = "#75d8ff";
  context.font = '700 12px "Vazirmatn Variable", Tahoma, sans-serif';
  context.fillText("MANDEGAR", canvasWidth / 2, 29);
  context.fillStyle = "#f7f7f4";
  context.font = '650 27px "Vazirmatn Variable", Tahoma, sans-serif';
  context.fillText(copy.stations.game.title, canvasWidth / 2, 62, canvasWidth - 100);
  [
    { label: copy.game.score, value: String(current.score), x: 85 },
    { label: copy.game.lives, value: String(current.lives), x: canvasWidth / 2 },
    { label: copy.game.time, value: `${Math.max(0, Math.ceil(breakoutBoard.duration - current.elapsed))}`, x: canvasWidth - 85 },
  ].forEach(({ label, value, x }) => {
    context.fillStyle = "rgba(247,247,244,.56)";
    context.font = '500 13px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText(label, x, 96, 130);
    context.fillStyle = "#f7f7f4";
    context.font = '700 20px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText(value, x, 120);
  });
  roundedRect(context, breakoutBoard.left, breakoutBoard.top, breakoutBoard.right - breakoutBoard.left, breakoutBoard.bottom - breakoutBoard.top, 16);
  context.fillStyle = "rgba(2,7,15,.55)";
  context.fill();
  context.strokeStyle = "rgba(117,216,255,.12)";
  context.stroke();
  current.blocks.forEach((block) => {
    if (!block.alive) return;
    roundedRect(context, block.x + 2, block.y, block.width - 4, block.height, 7);
    context.fillStyle = block.id < 4 ? "rgba(67,151,211,.36)" : "rgba(34,92,255,.36)";
    context.fill();
    context.strokeStyle = block.id < 4 ? "#75d8ff" : "#4d85ff";
    context.lineWidth = 1.5;
    context.stroke();
    context.fillStyle = "rgba(247,247,244,.2)";
    context.fillRect(block.x + 13, block.y + 6, block.width - 26, 1);
  });
  if (!reducedMotion) {
    if (current.status === "running") trail.forEach((point, index) => {
      context.save();
      context.globalAlpha = transition * (index + 1) / Math.max(1, trail.length) * 0.18;
      context.fillStyle = "#75d8ff";
      context.beginPath();
      context.arc(point.x, point.y, 2 + index * 0.55, 0, Math.PI * 2);
      context.fill();
      context.restore();
    });
      sparks.forEach((spark) => {
      const progress = (now - spark.startedAt) / 320;
      context.save();
      context.globalAlpha = transition * (1 - progress) * 0.7;
      context.fillStyle = "#75d8ff";
      for (let index = 0; index < 6; index += 1) {
        const angle = index / 6 * Math.PI * 2;
        context.beginPath();
        context.arc(spark.x + Math.cos(angle) * progress * 28, spark.y + Math.sin(angle) * progress * 20, 2, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    });
  }
  if (current.status !== "complete") {
    context.save();
    context.shadowColor = "#75d8ff";
    context.shadowBlur = reducedMotion ? 0 : 12;
    context.fillStyle = "#ecfaff";
    context.beginPath();
    context.arc(current.ball.x, current.ball.y, breakoutBoard.ballRadius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  roundedRect(context, current.paddleX - breakoutBoard.paddleWidth / 2, breakoutBoard.paddleY, breakoutBoard.paddleWidth, breakoutBoard.paddleHeight, 6);
  context.fillStyle = "#75d8ff";
  context.fill();
  context.fillStyle = "rgba(247,247,244,.72)";
  context.fillRect(current.paddleX - breakoutBoard.paddleWidth / 2 + 8, breakoutBoard.paddleY + 2, breakoutBoard.paddleWidth - 16, 2);
  if (interactive && current.status !== "running") {
    const complete = current.status === "complete";
    roundedRect(context, 67, 329, canvasWidth - 134, complete ? 173 : 105, 18);
    context.fillStyle = "rgba(8,13,22,.92)";
    context.fill();
    context.strokeStyle = "rgba(117,216,255,.2)";
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = "#f7f7f4";
    context.font = '650 25px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillText(complete ? current.outcome === "won" ? copy.game.win : copy.game.result : actionLabel, canvasWidth / 2, 368, canvasWidth - 166);
    context.fillStyle = "rgba(247,247,244,.65)";
    context.font = '500 15px "Vazirmatn Variable", Tahoma, sans-serif';
    if (complete) {
      context.fillStyle = "#75d8ff";
      context.font = '750 46px "Vazirmatn Variable", Tahoma, sans-serif';
      context.fillText(String(current.score), canvasWidth / 2, 425);
      context.font = '500 17px "Vazirmatn Variable", Tahoma, sans-serif';
      context.fillText(`${copy.game.best}: ${best}`, canvasWidth / 2, 466, canvasWidth - 166);
    } else context.fillText(copy.stations.game.instruction, canvasWidth / 2, 402, canvasWidth - 166);
  }
  context.fillStyle = "rgba(247,247,244,.56)";
  context.font = '500 14px "Vazirmatn Variable", Tahoma, sans-serif';
  context.fillText(`${copy.game.remaining}: ${cleared}`, canvasWidth / 2, 628, canvasWidth - 100);
  if (interactive) {
    (Object.keys(gameControls) as Array<keyof typeof gameControls>).forEach((control) => {
      if (control === "action" && current.status === "complete") return;
      const bounds = gameControls[control];
      const enabled = control === "action" ? current.status !== "complete" : current.serves > 0;
      const focused = hoveredControl === control || focusedControl === control;
      const label = control === "reset" ? current.status === "complete" ? copy.replay : copy.reset
        : control === "finish" ? current.status === "complete" ? copy.continue : copy.game.finish : actionLabel;
      roundedRect(context, bounds.left * canvasWidth, 651, bounds.width * canvasWidth, 47, 23);
      context.fillStyle = control === "action" && enabled ? "#225cff" : focused ? "rgba(117,216,255,.13)" : "rgba(247,247,244,.05)";
      context.fill();
      context.strokeStyle = focused ? "#75d8ff" : "rgba(247,247,244,.24)";
      context.lineWidth = focused ? 2 : 1;
      context.stroke();
      context.fillStyle = enabled ? "#f7f7f4" : "rgba(247,247,244,.28)";
      context.font = '600 17px "Vazirmatn Variable", Tahoma, sans-serif';
      context.fillText(label, (bounds.left + bounds.width / 2) * canvasWidth, 681, bounds.width * canvasWidth - 14);
    });
    context.strokeStyle = hoveredControl === "close" || focusedControl === "close" ? "#75d8ff" : "rgba(247,247,244,.65)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(canvasWidth * 0.925 - 6, canvasHeight * 0.057 - 6);
    context.lineTo(canvasWidth * 0.925 + 6, canvasHeight * 0.057 + 6);
    context.moveTo(canvasWidth * 0.925 + 6, canvasHeight * 0.057 - 6);
    context.lineTo(canvasWidth * 0.925 - 6, canvasHeight * 0.057 + 6);
    context.stroke();
  }
  context.restore();
}

