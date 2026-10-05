import type { IntelligenceSignalState } from "./intelligence-monitor-graphics";
import { interactionSurfaceSizes } from "./scene-config";

const tau = Math.PI * 2;
const palette = {
  ivory: "#f2e8dd",
  copper: "#d9a183",
  muted: "rgba(226, 204, 184, .42)",
  edge: "rgba(213, 155, 122, .24)",
  cyan: "#9bd4d5",
};

function roundedPanel(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.arc(x + width - radius, y + radius, radius, -Math.PI / 2, 0);
  context.lineTo(x + width, y + height - radius);
  context.arc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2);
  context.lineTo(x + radius, y + height);
  context.arc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI);
  context.lineTo(x, y + radius);
  context.arc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5);
}

function circle(context: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  context.beginPath();
  context.arc(x, y, radius, 0, tau);
}

/** Warm, architectural artwork reuses the illustrative signal buffers and cached gradients. */
export function createIntelligenceMonitorArtwork(context: CanvasRenderingContext2D, signal: string, example: string, rtl: boolean) {
  const { width, height } = interactionSurfaceSizes.videoWall.canvas;
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#211916");
  background.addColorStop(0.48, "#171311");
  background.addColorStop(1, "#100f0e");
  const panel = context.createLinearGradient(0, 54, 0, 398);
  panel.addColorStop(0, "#271e19");
  panel.addColorStop(1, "#1a1613");
  const flow = context.createLinearGradient(rtl ? width - 80 : 80, 0, rtl ? width - 1192 : 1192, 0);
  flow.addColorStop(0, "#d4a384");
  flow.addColorStop(0.52, "#f2e8dd");
  flow.addColorStop(1, "#dca386");
  const x = (value: number) => rtl ? width - value : value;
  const left = 80;
  const flowWidth = 1112;
  const baseline = 264;
  const amplitude = 102;
  const panelWidth = 394;
  const panelLeft = rtl ? 66 : width - 66 - panelWidth;
  const audienceX = panelLeft + panelWidth / 2;
  const audienceY = 221;
  const panelTextX = rtl ? panelLeft + panelWidth - 30 : panelLeft + 30;
  const waveStyles = [flow, "rgba(217, 161, 131, .62)", "rgba(190, 180, 168, .24)"];
  const pointColors = [palette.cyan, palette.ivory, palette.copper];
  const font = '"Vazirmatn Variable", Tahoma, sans-serif';

  return (state: IntelligenceSignalState) => {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.direction = rtl ? "rtl" : "ltr";
    context.textAlign = rtl ? "right" : "left";
    context.textBaseline = "middle";

    // The heading is large enough to remain legible on the in-world monitor.
    context.fillStyle = palette.ivory;
    context.font = `500 52px ${font}`;
    context.fillText(signal, x(left), 91, flowWidth - 50);
    context.fillStyle = palette.copper;
    context.fillRect(rtl ? x(left) - 70 : x(left), 139, 70, 3);
    context.fillStyle = "rgba(220, 166, 135, .14)";
    context.fillRect(rtl ? x(left) - flowWidth : x(left), 140, flowWidth, 1);

    // A quiet reference field gives the flowing signal a clear reading area.
    context.strokeStyle = "rgba(212, 177, 152, .08)";
    context.lineWidth = 1;
    for (let row = -1; row <= 1; row += 1) {
      context.beginPath();
      context.moveTo(x(left), baseline + row * 77);
      context.lineTo(x(left + flowWidth), baseline + row * 77);
      context.stroke();
    }
    const samples = state.waves.length / waveStyles.length;
    for (let wave = waveStyles.length - 1; wave >= 0; wave -= 1) {
      context.strokeStyle = waveStyles[wave];
      context.lineWidth = wave === 0 ? 5.5 : wave === 1 ? 3 : 2;
      context.beginPath();
      for (let index = 0; index < samples; index += 1) {
        const positionX = x(left + index / (samples - 1) * flowWidth);
        const positionY = baseline + state.waves[wave * samples + index] * amplitude;
        if (index === 0) context.moveTo(positionX, positionY);
        else context.lineTo(positionX, positionY);
      }
      context.stroke();
    }
    for (let index = 0; index < state.points.length / 2; index += 3) {
      const pointX = x(left + state.points[index * 2] * flowWidth);
      const pointY = baseline + state.points[index * 2 + 1] * amplitude;
      const color = pointColors[(index / 3) % pointColors.length];
      context.fillStyle = color;
      context.globalAlpha = 0.08;
      circle(context, pointX, pointY, 13);
      context.fill();
      context.globalAlpha = 1;
      circle(context, pointX, pointY, index % 6 === 0 ? 4 : 2.6);
      context.fill();
    }
    for (let endpoint = 0; endpoint < 2; endpoint += 1) {
      const endpointX = x(left + flowWidth * endpoint);
      context.fillStyle = "#201814";
      circle(context, endpointX, baseline, 11);
      context.fill();
      context.strokeStyle = endpoint === 0 ? "rgba(155, 212, 213, .48)" : "rgba(217, 161, 131, .58)";
      context.lineWidth = 1.5;
      context.stroke();
      context.fillStyle = endpoint === 0 ? palette.cyan : palette.ivory;
      circle(context, endpointX, baseline, 4);
      context.fill();
    }

    // Abstract activity marks carry the selected pattern without suggesting measured totals.
    const activityWidth = 9;
    const activityGap = 8;
    for (let index = 0; index < state.bars.length; index += 1) {
      const barHeight = 5 + state.bars[index] * 27;
      context.fillStyle = index % 5 === 0 ? "rgba(155, 212, 213, .46)" : "rgba(217, 161, 131, .38)";
      context.fillRect(x(left + index * (activityWidth + activityGap)) - (rtl ? activityWidth : 0), 403 - barHeight, activityWidth, barHeight);
    }
    context.strokeStyle = "rgba(212, 177, 152, .14)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x(left + 315), 403);
    context.lineTo(x(left + flowWidth), 403);
    context.stroke();

    // One framed audience motif replaces the detached ring and mini dashboard.
    roundedPanel(context, panelLeft, 54, panelWidth, 344, 18);
    context.fillStyle = panel;
    context.fill();
    context.strokeStyle = palette.edge;
    context.lineWidth = 1.5;
    context.stroke();
    context.direction = rtl ? "rtl" : "ltr";
    context.textAlign = rtl ? "right" : "left";
    context.font = `500 32px ${font}`;
    context.fillStyle = palette.ivory;
    context.fillText(example, panelTextX, 97, panelWidth - 60);
    context.strokeStyle = "rgba(217, 161, 131, .17)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(panelLeft + 30, 126);
    context.lineTo(panelLeft + panelWidth - 30, 126);
    context.stroke();

    context.strokeStyle = "rgba(217, 161, 131, .14)";
    context.lineWidth = 1;
    circle(context, audienceX, audienceY, 77);
    context.stroke();
    circle(context, audienceX, audienceY, 59);
    context.stroke();
    context.strokeStyle = "rgba(217, 161, 131, .7)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(audienceX, audienceY, 77, state.time * 0.18 - Math.PI / 2, state.time * 0.18 + Math.PI * 0.1);
    context.stroke();
    context.fillStyle = "#2c211b";
    circle(context, audienceX, audienceY, 43);
    context.fill();
    context.strokeStyle = "rgba(225, 184, 156, .22)";
    context.lineWidth = 1.5;
    context.stroke();
    context.fillStyle = palette.ivory;
    circle(context, audienceX, audienceY - 10, 10);
    context.fill();
    context.strokeStyle = palette.ivory;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(audienceX, audienceY + 20, 19, Math.PI * 1.08, Math.PI * 1.92);
    context.stroke();
    for (let index = 0; index < 5; index += 1) {
      const angle = -Math.PI / 2 + index * tau / 5;
      const nodeX = audienceX + Math.cos(angle) * 77;
      const nodeY = audienceY + Math.sin(angle) * 77;
      context.fillStyle = "#231a16";
      circle(context, nodeX, nodeY, 8);
      context.fill();
      context.fillStyle = index === 0 ? palette.cyan : palette.copper;
      circle(context, nodeX, nodeY, 3);
      context.fill();
    }
    const barWidth = 10;
    const barGap = 8;
    const barsWidth = state.bars.length * (barWidth + barGap) - barGap;
    for (let index = 0; index < state.bars.length; index += 1) {
      const barHeight = 7 + state.bars[index] * 35;
      context.fillStyle = index % 7 === 0 ? "rgba(155, 212, 213, .56)" : "rgba(217, 161, 131, .56)";
      context.fillRect(audienceX - barsWidth / 2 + index * (barWidth + barGap), 363 - barHeight, barWidth, barHeight);
    }
    context.fillStyle = palette.muted;
    context.fillRect(panelLeft + 30, 372, panelWidth - 60, 1);
  };
}
