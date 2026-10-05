import type { InteractionCopy } from "./interaction-copy";
import { getRaceArtwork, raceCarSprites } from "./race-artwork";
import { raceBoard, type RaceGame } from "./race-game";

export type RaceControl = "action";
const pauseControl = { x: 453, y: 49, radius: 23 };

export function raceControlAtPoint(x: number, y: number): RaceControl | null {
  return Math.hypot(x * raceBoard.width - pauseControl.x, y * raceBoard.height - pauseControl.y) <= pauseControl.radius + 4
    ? "action"
    : null;
}

function car(context: CanvasRenderingContext2D, x: number, y: number, color: string, crashed = false) {
  context.save();
  context.translate(x, y);
  if (crashed) context.rotate(-0.2);
  const artwork = getRaceArtwork();
  if (artwork.cars) {
    const sprite = color === "#396ed4" ? raceCarSprites.blue
      : color === "#bc9a69" ? raceCarSprites.bronze
      : color === "#c5cbc5" ? raceCarSprites.ivory : raceCarSprites.silver;
    context.fillStyle = "rgba(8,8,7,.28)";
    context.beginPath(); context.roundRect(-16, -29, 38, 69, 8); context.fill();
    const [sourceX, sourceY, sourceWidth, sourceHeight] = sprite;
    const spriteWidth = 64 * sourceWidth / sourceHeight;
    context.drawImage(artwork.cars, sourceX, sourceY, sourceWidth, sourceHeight, -spriteWidth / 2, -32, spriteWidth, 64);
    context.restore();
    return;
  }
  context.fillStyle = "rgba(8,8,7,.32)";
  context.beginPath(); context.roundRect(-16, -29, 38, 69, 8); context.fill();
  context.fillStyle = "#141716";
  for (const wheelX of [-21, 15]) for (const wheelY of [-21, 13]) context.fillRect(wheelX, wheelY, 7, 16);
  const body = context.createLinearGradient(-17, 0, 17, 0);
  body.addColorStop(0, color); body.addColorStop(0.5, color); body.addColorStop(1, "#444944");
  context.fillStyle = body;
  context.beginPath(); context.roundRect(-17, -32, 34, 64, 7); context.fill();
  context.strokeStyle = "rgba(247,238,211,.2)";
  context.beginPath(); context.roundRect(-14, -29, 28, 59, 5); context.stroke();
  context.fillStyle = "#adc5cb"; context.fillRect(-12, -18, 24, 11);
  context.fillStyle = "#203239"; context.fillRect(-11, -4, 22, 23);
  context.fillStyle = "#7396a0"; context.fillRect(-11, 22, 22, 5);
  context.fillStyle = "#fff0cb"; context.fillRect(-13, -29, 7, 4); context.fillRect(6, -29, 7, 4);
  context.fillStyle = "#dd6559"; context.fillRect(-13, 28, 7, 3); context.fillRect(6, 28, 7, 3);
  context.restore();
}

function road(context: CanvasRenderingContext2D, offset: number, travel: number) {
  const { width, height, left, right } = raceBoard;
  const artwork = getRaceArtwork();
  context.fillStyle = "#8a7960"; context.fillRect(0, 0, width, height);
  const asphalt = context.createLinearGradient(left, 0, right, 0);
  asphalt.addColorStop(0, "#343837"); asphalt.addColorStop(0.5, "#444847"); asphalt.addColorStop(1, "#343837");
  context.fillStyle = asphalt; context.fillRect(left, 0, right - left, height);
  if (artwork.road) {
    // Stretch the three material strips independently so the authored curb
    // edges stay aligned with the game's road and collision coordinates.
    const sourceLeft = artwork.road.naturalWidth * 0.15;
    const sourceRight = artwork.road.naturalWidth * 0.85;
    const sourceHeight = artwork.road.naturalHeight;
    const tileHeight = (right - left) * sourceHeight / (sourceRight - sourceLeft);
    const tileOffset = travel % tileHeight;
    for (let y = tileOffset - tileHeight; y < height; y += tileHeight) {
      context.drawImage(artwork.road, 0, 0, sourceLeft, sourceHeight, 0, y, left, tileHeight);
      context.drawImage(artwork.road, sourceLeft, 0, sourceRight - sourceLeft, sourceHeight, left, y, right - left, tileHeight);
      context.drawImage(artwork.road, sourceRight, 0, artwork.road.naturalWidth - sourceRight, sourceHeight, right, y, width - right, tileHeight);
    }
  } else {
    context.fillStyle = "#d4c29d";
    context.fillRect(left - 13, 0, 11, height); context.fillRect(right + 2, 0, 11, height);
    context.fillStyle = "rgba(13,17,15,.3)";
    context.fillRect(left - 2, 0, 8, height); context.fillRect(right - 6, 0, 8, height);
  }
  context.fillStyle = "#eee6cf";
  context.fillRect(left + 6, 0, 3, height); context.fillRect(right - 9, 0, 3, height);
  for (let y = offset - 72; y < height; y += 72) {
    if (!artwork.road) {
      context.fillStyle = "#ac9572"; context.fillRect(left - 13, y, 11, 34); context.fillRect(right + 2, y, 11, 34);
    }
    context.fillStyle = "rgba(244,233,208,.65)";
    for (const x of [left + 123, left + 246]) context.fillRect(x - 2, y, 4, 34);
  }
  if (!artwork.road) for (let y = travel % 216 - 216; y < height; y += 216) {
    for (const x of [28, width - 28]) {
      context.fillStyle = "rgba(28,34,25,.2)";
      context.beginPath(); context.ellipse(x + 5, y + 8, 23, 19, 0, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#53604b";
      context.beginPath(); context.arc(x, y, 17, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#75816a";
      context.beginPath(); context.arc(x - 4, y - 5, 12, 0, Math.PI * 2); context.fill();
    }
  }
}

export function paintRaceScreen(context: CanvasRenderingContext2D, game: RaceGame, options: {
  copy: InteractionCopy;
  best: number;
  transition?: number;
  background?: CanvasImageSource | null;
  interactive?: boolean;
  focused?: RaceControl | null;
}) {
  const { copy, best, transition = 1, background = null, interactive = true, focused = null } = options;
  const { width, height, playerY } = raceBoard;
  context.clearRect(0, 0, width, height);
  if (background) context.drawImage(background, 0, 0, width, height);
  context.save();
  context.globalAlpha = transition;
  road(context, game.roadOffset, game.distance / 0.17);
  game.traffic.forEach((vehicle) => car(context, vehicle.x, vehicle.y, vehicle.color));
  car(context, game.x, playerY, "#396ed4", game.outcome === "crashed");

  context.fillStyle = "rgba(25,29,28,.9)";
  context.beginPath(); context.roundRect(17, 16, width - 34, 68, 16); context.fill();
  context.strokeStyle = "rgba(231,213,174,.25)"; context.stroke();
  const rtl = document.documentElement.dir === "rtl";
  context.textAlign = "center";
  context.direction = rtl ? "rtl" : "ltr";
  const distanceX = rtl ? 290 : 137;
  const bestX = rtl ? 137 : 290;
  context.fillStyle = "#cfbea0"; context.font = '500 12px "Vazirmatn Variable", sans-serif';
  context.fillText(copy.game.distance, distanceX, 36, 130);
  context.fillText(copy.game.best, bestX, 36, 130);
  context.direction = "ltr";
  context.fillStyle = "#faf2e0"; context.font = '650 23px "Vazirmatn Variable", sans-serif';
  context.fillText(`${game.score} m`, distanceX, 66, 135);
  context.fillText(`${best} m`, bestX, 66, 135);

  if (game.status === "paused") {
    context.fillStyle = "rgba(24,29,27,.84)";
    context.beginPath(); context.roundRect(125, 312, width - 250, 76, 18); context.fill();
    context.direction = rtl ? "rtl" : "ltr";
    context.fillStyle = "#f5ead4"; context.font = '600 22px "Vazirmatn Variable", sans-serif';
    context.fillText(copy.game.pause, width / 2, 358, width - 275);
  }
  if (interactive && game.status !== "complete") {
    context.fillStyle = focused === "action" ? "#386be0" : "#424943";
    context.beginPath(); context.arc(pauseControl.x, pauseControl.y, pauseControl.radius, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#f5ead4";
    if (game.status === "paused") {
      context.beginPath(); context.moveTo(pauseControl.x - 5, pauseControl.y - 9); context.lineTo(pauseControl.x + 9, pauseControl.y); context.lineTo(pauseControl.x - 5, pauseControl.y + 9); context.closePath(); context.fill();
    } else {
      context.fillRect(pauseControl.x - 7, pauseControl.y - 8, 4, 16);
      context.fillRect(pauseControl.x + 3, pauseControl.y - 8, 4, 16);
    }
  }
  context.restore();
}
