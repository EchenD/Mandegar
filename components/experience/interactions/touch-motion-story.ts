import type { Locale } from "@/lib/i18n";
import type { InstallationView } from "./installation-demo";

export type StoryMotion = {
  title: number;
  scene: number;
  detail: number;
  footer: number;
};

export type StoryExit = { title: number; scene: number; detail: number; footer: number };

const width = 1031;
const height = 540;
const signal = { x: 775, y: 265 };
const colors = { ivory: "#f4e9d5", gold: "#d7b981", blue: "#297dff", cyan: "#a1dcff" };
const views: InstallationView[] = ["assembled", "parts", "details", "image"];
const copy = {
  en: {
    titles: ["IDEA", "SPACE", "PARTICIPATION", "MEMORY"],
    descriptions: [
      ["Every experience begins with a spark.", "Strategy, concept and story give it direction."],
      ["An idea becomes a place.", "Design, light and content bring it to life."],
      ["The audience becomes part of the story.", "Touch. Play. Connect."],
      ["The experience stays with us.", "A shared moment becomes a lasting memory."],
    ],
    tags: [["STRATEGY", "CONCEPT", "STORY"], ["DESIGN", "LIGHT", "CONTENT"], ["TOUCH", "PLAY", "CONNECT"], ["EXPERIENCE", "IMPRESSION", "MEMORY"]],
  },
  fa: {
    titles: ["ایده", "فضا", "مشارکت", "خاطره"],
    descriptions: [
      ["از یک جرقه شروع می‌کنیم؛", "با راهبرد، مفهوم و روایت."],
      ["ایده را به فضا می‌آوریم؛", "با طراحی، نور و محتوا."],
      ["مخاطب بخشی از داستان می‌شود؛", "لمس می‌کند، بازی می‌کند و ارتباط می‌گیرد."],
      ["تجربه ادامه پیدا می‌کند؛", "در ذهن و احساس مخاطب."],
    ],
    tags: [["راهبرد", "مفهوم", "روایت"], ["طراحی", "نور", "محتوا"], ["لمس", "بازی", "ارتباط"], ["تجربه", "اثر", "خاطره"]],
  },
  ar: {
    titles: ["فكرة", "مساحة", "مشاركة", "ذكرى"],
    descriptions: [
      ["تبدأ القصة بشرارة؛", "نحو استراتيجية ومفهوم وسرد."],
      ["نمنح الفكرة مساحة؛", "بالتصميم والضوء والمحتوى."],
      ["الجمهور يصبح جزءًا من القصة؛", "يلمس ويلعب ويتواصل."],
      ["وتبقى التجربة؛", "في ذاكرة الجمهور وشعوره."],
    ],
    tags: [["استراتيجية", "مفهوم", "سرد"], ["تصميم", "ضوء", "محتوى"], ["لمس", "لعب", "تواصل"], ["تجربة", "أثر", "ذكرى"]],
  },
} satisfies Record<Locale, { titles: string[]; descriptions: string[][]; tags: string[][] }>;

function clamp(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function stagger(progress: number, delay: number) {
  return clamp((progress - delay) / (1 - delay));
}

function random(index: number) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function line(context: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], color: string, thickness = 1) {
  context.beginPath();
  points.forEach(([x, y], index) => { if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); });
  context.strokeStyle = color;
  context.lineWidth = thickness;
  context.stroke();
}

function dot(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, glow = 0) {
  context.save();
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = glow;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function light(context: CanvasRenderingContext2D, x: number, y: number, radius: number, opacity: number) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(78,166,255,${opacity})`);
  gradient.addColorStop(0.2, `rgba(34,103,255,${opacity * 0.6})`);
  gradient.addColorStop(1, "rgba(15,51,112,0)");
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function spark(context: CanvasRenderingContext2D, time: number, progress: number) {
  context.save();
  context.globalAlpha *= progress;
  light(context, signal.x, signal.y, 54, 0.75);
  const radius = 3.5 + Math.sin(time * 1.6) * 0.6;
  dot(context, signal.x, signal.y, radius, "#eefaff", 22);
  line(context, [[signal.x - 17, signal.y], [signal.x + 17, signal.y]], "rgba(204,235,255,.75)");
  line(context, [[signal.x, signal.y - 17], [signal.x, signal.y + 17]], "rgba(204,235,255,.75)");
  context.restore();
}

function paintIdea(context: CanvasRenderingContext2D, progress: number, time: number) {
  context.save();
  context.globalAlpha *= progress;
  light(context, signal.x, signal.y, 170, 0.28);
  line(context, [[signal.x - 185, signal.y], [signal.x + 185, signal.y]], "rgba(215,185,129,.2)");
  line(context, [[signal.x, signal.y - 191], [signal.x, signal.y + 174]], "rgba(215,185,129,.2)");
  for (let index = 0; index < 9; index += 1) {
    const amount = stagger(progress, index * 0.05);
    const radius = 22 + index * 18;
    context.beginPath();
    context.arc(signal.x, signal.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * amount);
    context.strokeStyle = index % 3 === 2 ? "rgba(215,185,129,.62)" : `rgba(55,136,255,${0.82 - index * 0.06})`;
    context.lineWidth = index < 3 ? 1.5 : 0.8;
    context.stroke();
    const angle = time * (index % 2 ? -0.18 : 0.22) + index * 1.3;
    context.beginPath();
    context.arc(signal.x, signal.y, radius, angle - 0.32 * amount, angle);
    context.strokeStyle = "rgba(161,220,255,.72)";
    context.stroke();
    dot(context, signal.x + Math.cos(angle) * radius, signal.y + Math.sin(angle) * radius, 1.5, index % 3 === 2 ? colors.gold : colors.cyan, 7);
  }
  for (let index = 0; index < 30; index += 1) {
    const angle = random(index + 14) * Math.PI * 2 + time * 0.03;
    const radius = 40 + random(index + 88) * 156;
    dot(context, signal.x + Math.cos(angle) * radius, signal.y + Math.sin(angle) * radius, 0.6 + random(index) * 0.7, "rgba(94,166,255,.5)");
  }
  context.restore();
  spark(context, time, progress);
}

function paintSpace(context: CanvasRenderingContext2D, progress: number, time: number) {
  const project = (x: number, y: number, z = 0): [number, number] => [signal.x + (x - y) * 30, 337 + (x + y) * 15 - z];
  context.save();
  context.globalAlpha *= progress;
  light(context, signal.x, 337, 157, 0.32);
  for (let index = -5; index <= 5; index += 1) {
    line(context, [project(-5, index), project(5, index)], index === 0 ? "rgba(215,185,129,.5)" : "rgba(66,122,186,.25)");
    line(context, [project(index, -5), project(index, 5)], index === 0 ? "rgba(215,185,129,.5)" : "rgba(66,122,186,.25)");
  }
  const panels = [
    { x: -2.4, y: -0.7, dx: 0, dy: 2.9, height: 143, delay: 0.04 },
    { x: 0.4, y: -2.4, dx: 2.8, dy: 0, height: 177, delay: 0.18 },
    { x: 3, y: 0.6, dx: 0, dy: 2.5, height: 109, delay: 0.34 },
  ];
  panels.forEach((panel, index) => {
    const amount = stagger(progress, panel.delay);
    const base = project(panel.x, panel.y);
    const end = project(panel.x + panel.dx, panel.y + panel.dy);
    const top = project(panel.x, panel.y, panel.height * amount);
    const topEnd = project(panel.x + panel.dx, panel.y + panel.dy, panel.height * amount);
    const glow = context.createLinearGradient(base[0], base[1], top[0], top[1]);
    glow.addColorStop(0, "rgba(39,125,255,.5)");
    glow.addColorStop(0.3, "rgba(31,88,199,.12)");
    glow.addColorStop(1, "rgba(39,125,255,.04)");
    context.fillStyle = glow;
    context.beginPath();
    context.moveTo(...base);
    context.lineTo(...end);
    context.lineTo(...topEnd);
    context.lineTo(...top);
    context.closePath();
    context.fill();
    line(context, [base, top, topEnd, end], "rgba(215,185,129,.7)", 1.1);
    line(context, [base, end], "rgba(87,176,255,.9)", 1.8);
    for (let divider = 1; divider < 5; divider += 1) {
      const fraction = divider / 5;
      line(context, [
        project(panel.x + panel.dx * fraction, panel.y + panel.dy * fraction),
        project(panel.x + panel.dx * fraction, panel.y + panel.dy * fraction, panel.height * amount),
      ], "rgba(94,158,229,.18)");
    }
    dot(context, top[0], top[1], 1.8, colors.gold, 5);
    const travel = (time * 0.16 + index * 0.27) % 1;
    dot(context, base[0] + (end[0] - base[0]) * travel, base[1] + (end[1] - base[1]) * travel, 2.3, colors.cyan, 12);
  });
  line(context, [[signal.x, signal.y], [signal.x, 337]], "rgba(161,220,255,.55)");
  for (let index = 0; index < 3; index += 1) {
    context.beginPath();
    context.ellipse(signal.x, 337, 24 + index * 18 + Math.sin(time + index) * 2, 8 + index * 6, 0, 0, Math.PI * 2);
    context.strokeStyle = index === 2 ? "rgba(215,185,129,.6)" : "rgba(58,139,255,.8)";
    context.stroke();
  }
  context.restore();
  spark(context, time, progress);
}

function paintParticipation(context: CanvasRenderingContext2D, progress: number, time: number) {
  const points = Array.from({ length: 40 }, (_, index) => {
    const angle = index * 2.399963;
    const radius = Math.sqrt(index / 39) * 179;
    return {
      x: signal.x + Math.cos(angle) * radius,
      y: signal.y + Math.sin(angle) * radius * 0.72 + Math.sin(time * 0.58 + index) * Math.min(7, radius / 10),
      amount: stagger(progress, index / 65),
    };
  });
  context.save();
  context.globalAlpha *= progress;
  light(context, signal.x, signal.y, 195, 0.2);
  points.forEach((point, index) => {
    context.save();
    context.globalAlpha *= point.amount;
    line(context, [[point.x, point.y], [point.x, point.y + 28]], "rgba(88,148,223,.3)");
    for (let targetIndex = index + 1; targetIndex < points.length; targetIndex += 1) {
      const target = points[targetIndex];
      if (Math.hypot(point.x - target.x, point.y - target.y) > 84) continue;
      context.globalAlpha = progress * Math.min(point.amount, target.amount);
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.quadraticCurveTo((point.x + target.x) / 2, (point.y + target.y) / 2 - 12, target.x, target.y);
      context.strokeStyle = "rgba(77,143,235,.28)";
      context.lineWidth = 0.8;
      context.stroke();
      if ((index + targetIndex) % 7 === 0) {
        const travel = (time * 0.24 + index * 0.09) % 1;
        const inverse = 1 - travel;
        dot(context, inverse * inverse * point.x + 2 * inverse * travel * (point.x + target.x) / 2 + travel * travel * target.x,
          inverse * inverse * point.y + 2 * inverse * travel * ((point.y + target.y) / 2 - 12) + travel * travel * target.y, 1.5, colors.gold, 6);
      }
    }
    context.globalAlpha = progress * point.amount;
    dot(context, point.x, point.y, 1.8 + Math.sin(time * 1.5 + index) * 0.5, index % 9 === 0 ? colors.gold : colors.cyan, 11);
    context.restore();
  });
  for (let index = 0; index < 3; index += 1) {
    const pulse = (time * 0.18 + index / 3) % 1;
    context.beginPath();
    context.ellipse(signal.x, signal.y, 35 + pulse * 151, 24 + pulse * 108, -0.12, 0, Math.PI * 2);
    context.strokeStyle = `rgba(67,133,241,${(1 - pulse) * 0.3})`;
    context.stroke();
  }
  context.restore();
  spark(context, time, progress);
}

function paintMemory(context: CanvasRenderingContext2D, progress: number, time: number) {
  context.save();
  context.globalAlpha *= progress;
  light(context, signal.x, signal.y, 181, 0.22);
  for (let index = 0; index < 7; index += 1) {
    const radius = 113 + index * 2.7 + Math.sin(time * 0.6 + index) * 0.8;
    context.beginPath();
    context.arc(signal.x, signal.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * stagger(progress, index * 0.05));
    context.strokeStyle = index === 0 ? "rgba(238,224,195,.85)" : `rgba(55,132,255,${0.55 - index * 0.06})`;
    context.lineWidth = index === 0 ? 1.6 : 0.7;
    context.shadowColor = colors.blue;
    context.shadowBlur = index === 0 ? 10 : 0;
    context.stroke();
  }
  context.shadowBlur = 0;
  for (let ribbon = 0; ribbon < 6; ribbon += 1) {
    context.beginPath();
    const end = 531 + 443 * progress;
    for (let x = 531; x <= end; x += 3) {
      const offset = (x - signal.x) / 109;
      const wave = Math.sin(offset + time * 0.48) - Math.sin(time * 0.48) * Math.exp(-offset * offset * 0.45);
      const y = signal.y + wave * (37 + ribbon * 2) + (ribbon - 2.5) * 2.1;
      if (x === 531) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.strokeStyle = ribbon === 2 ? "rgba(241,226,195,.95)" : `rgba(71,149,255,${0.7 - ribbon * 0.08})`;
    context.lineWidth = ribbon === 2 ? 1.8 : 0.7;
    context.shadowColor = ribbon === 2 ? colors.gold : colors.blue;
    context.shadowBlur = ribbon === 2 ? 12 : 4;
    context.stroke();
  }
  context.shadowBlur = 0;
  for (let index = 0; index < 40; index += 1) {
    const angle = random(index + 73) * Math.PI * 2 + time * 0.03;
    const radius = Math.sqrt(random(index + 17)) * 106;
    dot(context, signal.x + Math.cos(angle) * radius, signal.y + Math.sin(angle) * radius, 0.65, "rgba(178,209,246,.36)");
  }
  const orbit = time * 0.24;
  dot(context, signal.x + Math.cos(orbit) * 114, signal.y + Math.sin(orbit) * 114, 3, colors.cyan, 16);
  context.restore();
  spark(context, time, progress);
}

function textFont(context: CanvasRenderingContext2D, text: string, size: number, locale: Locale, maximumWidth: number, serif = false) {
  const family = serif ? "Georgia, serif" : '"Vazirmatn Variable", Tahoma, sans-serif';
  context.font = `${serif ? "400" : "500"} ${size}px ${family}`;
  while (context.measureText(text).width > maximumWidth && size > 12) {
    size -= 1;
    context.font = `${serif ? "400" : "500"} ${size}px ${family}`;
  }
  context.direction = locale === "en" ? "ltr" : "rtl";
}

export function getTouchStoryDescription(view: InstallationView, locale: Locale) {
  const index = Math.max(0, views.indexOf(view));
  const words = copy[locale];
  return `${words.titles[index]}: ${words.descriptions[index].join(" ")}`;
}

/** Four live chapters share one signal, with no poster or external image dependency. */
export function paintTouchStory(
  context: CanvasRenderingContext2D,
  view: InstallationView,
  locale: Locale,
  motion: StoryMotion,
  time: number,
  exit: StoryExit = { title: 0, scene: 0, detail: 0, footer: 0 },
  options: { transparent?: boolean; scene?: boolean } = {},
) {
  const index = Math.max(0, views.indexOf(view));
  const words = copy[locale];
  const rtl = locale !== "en";
  const title = clamp(motion.title);
  const scene = clamp(motion.scene);
  const detail = clamp(motion.detail);
  const footer = clamp(motion.footer);
  const seconds = Number.isFinite(time) ? time : 0;
  context.save();
  context.setTransform(context.canvas.width / width, 0, 0, context.canvas.height / height, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.shadowBlur = 0;
  context.setLineDash([]);
  if (options.transparent) context.clearRect(0, 0, width, height);
  else {
    context.fillStyle = "#030c18";
    context.fillRect(0, 0, width, height);
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#071525");
    background.addColorStop(0.5, "#040d19");
    background.addColorStop(1, "#081831");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    light(context, signal.x, signal.y, 260, 0.09);
    for (let star = 0; star < 86; star += 1) {
      const x = 26 + random(star + 201) * 976;
      const y = 67 + random(star + 317) * 365;
      dot(context, x, y, star % 5 === 0 ? 0.9 : 0.5, `rgba(116,159,214,${0.12 + random(star) * 0.18})`);
    }
    context.strokeStyle = "rgba(215,185,129,.4)";
    context.lineWidth = 0.8;
    context.strokeRect(14.5, 14.5, width - 29, height - 29);
    context.direction = "ltr";
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.font = '500 13px "Vazirmatn Variable", Tahoma, sans-serif';
    context.fillStyle = "rgba(244,233,213,.83)";
    Array.from("MANDEGAR").forEach((letter, letterIndex) => context.fillText(letter, 51 + letterIndex * 18, 49));
    line(context, [[222, 44], [514, 44]], "rgba(215,185,129,.4)");
  }
  context.save();
  context.globalAlpha = options.transparent ? footer : 1 - exit.footer;
  context.direction = "ltr";
  context.font = "400 39px Georgia, serif";
  context.textAlign = "right";
  context.fillStyle = colors.gold;
  context.fillText(`0${index + 1}`, 980, 58);
  context.restore();

  context.save();
  context.beginPath();
  context.rect(515, 72, 482, 365);
  context.clip();
  context.globalAlpha = 1 - exit.scene;
  context.translate(signal.x + exit.scene * 150, signal.y);
  context.scale(0.8 + scene * 0.2 - exit.scene * 0.18, 0.8 + scene * 0.2 - exit.scene * 0.18);
  context.rotate(exit.scene * 0.12);
  context.translate(-signal.x, -signal.y);
  if (options.scene !== false) [paintIdea, paintSpace, paintParticipation, paintMemory][index](context, scene, seconds);
  context.restore();

  context.save();
  context.globalAlpha = title * (1 - exit.title);
  context.beginPath();
  context.rect(27, 120, 488, 136);
  context.clip();
  context.translate((1 - title) * 180 - exit.title * 380, -exit.title * 25);
  context.textAlign = rtl ? "right" : "left";
  const textX = rtl ? 491 : 51;
  textFont(context, words.titles[index], rtl ? 78 : index === 2 ? 57 : 93, locale, 454, !rtl);
  context.fillStyle = colors.ivory;
  context.fillText(words.titles[index], textX, 222 + (1 - title) * 16);
  context.restore();

  context.save();
  context.globalAlpha = detail * (1 - exit.detail);
  context.translate((1 - detail) * -30 - exit.detail * 90, 0);
  line(context, [[51, 250], [89 + 54 * detail, 250]], "rgba(215,185,129,.85)", 1.5);
  context.textAlign = rtl ? "right" : "left";
  context.fillStyle = "rgba(237,232,222,.82)";
  words.descriptions[index].forEach((description, lineIndex) => {
    textFont(context, description, rtl ? 21 : 19, locale, 440);
    context.fillText(description, rtl ? 491 : 51, 289 + lineIndex * 33 + (1 - detail) * 9);
  });
  let tagX = 51;
  words.tags[index].forEach((tag) => {
    textFont(context, tag, rtl ? 16 : 12, locale, 132);
    const tagWidth = Math.max(92, context.measureText(tag).width + 28);
    context.strokeStyle = "rgba(215,185,129,.35)";
    context.lineWidth = 0.8;
    const tagOffset = (1 - detail) * (tagX - 51) * 0.2 + exit.detail * (tagX - 51) * 0.15;
    context.strokeRect(tagX + tagOffset, 358, tagWidth, 34);
    context.textAlign = "center";
    context.fillStyle = colors.gold;
    context.fillText(tag, tagX + tagWidth / 2 + tagOffset, 380);
    tagX += tagWidth + 10;
  });
  context.restore();

  context.save();
  context.globalAlpha = footer * (1 - exit.footer);
  context.translate(0, (1 - footer) * 25 + exit.footer * 42);
  line(context, [[51, 449], [980, 449]], "rgba(215,185,129,.22)");
  words.titles.forEach((label, chapter) => {
    const x = 51 + chapter * 239;
    context.direction = "ltr";
    context.textAlign = "left";
    context.font = "400 18px Georgia, serif";
    context.fillStyle = chapter === index ? colors.gold : "rgba(244,233,213,.38)";
    context.fillText(`0${chapter + 1}`, x, 480);
    textFont(context, label, rtl ? 16 : 11, locale, 167);
    context.textAlign = rtl ? "right" : "left";
    context.fillText(label, rtl ? x + 213 : x + 35, 480);
    line(context, [[x, 498], [x + 213, 498]], "rgba(80,119,160,.3)", 1.4);
    if (chapter <= index) {
      line(context, [[x, 498], [x + 213 * (chapter === index ? Math.max(0.04, footer) : 1), 498]], chapter === index ? colors.gold : "rgba(77,135,209,.6)", 1.5);
    }
  });
  context.restore();
  context.restore();
}

function morphPoints(view: InstallationView, time: number): [number, number][] {
  return Array.from({ length: 48 }, (_, index) => {
    if (view === "assembled") {
      const angle = index % 12 / 12 * Math.PI * 2 + Math.floor(index / 12) * 0.16 + time * 0.08;
      const radius = 38 + Math.floor(index / 12) * 38;
      return [signal.x + Math.cos(angle) * radius, signal.y + Math.sin(angle) * radius];
    }
    if (view === "parts") {
      const column = index % 8 - 3.5;
      const row = Math.floor(index / 8) - 2.5;
      const lift = index % 8 === 2 || index % 8 === 5 ? 95 : 0;
      return [signal.x + (column - row) * 28, 319 + (column + row) * 14 - lift];
    }
    if (view === "details") {
      const angle = index * 2.399963;
      const radius = Math.sqrt(index / 47) * 179;
      return [signal.x + Math.cos(angle) * radius, signal.y + Math.sin(angle) * radius * 0.72 + Math.sin(time * 0.58 + index) * 5];
    }
    const angle = index / 48 * Math.PI * 2;
    return [signal.x + Math.cos(angle) * 120, signal.y + Math.sin(angle) * 120 + Math.sin(angle * 3 + time * 0.5) * 2];
  });
}

/** The same signal points move into each chapter's geometry rather than swap. */
export function paintTouchStoryMorph(
  context: CanvasRenderingContext2D,
  from: InstallationView,
  to: InstallationView,
  progress: number,
  time: number,
) {
  const amount = clamp(progress);
  const eased = amount * amount * (3 - 2 * amount);
  const source = morphPoints(from, time);
  const target = morphPoints(to, time);
  const points = source.map(([x, y], index): [number, number] => [
    x + (target[index][0] - x) * eased,
    y + (target[index][1] - y) * eased,
  ]);
  context.save();
  context.setTransform(context.canvas.width / width, 0, 0, context.canvas.height / height, 0, 0);
  context.beginPath();
  context.rect(515, 72, 482, 365);
  context.clip();
  context.globalAlpha = Math.sin(amount * Math.PI);
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    line(context, [point, next], index % 8 === 0 ? "rgba(215,185,129,.65)" : "rgba(87,154,255,.45)", 0.85);
    if (index % 3 === 0) line(context, [point, points[(index + 8) % points.length]], "rgba(70,129,215,.22)", 0.6);
    dot(context, point[0], point[1], index % 8 === 0 ? 2.2 : 1.3, index % 8 === 0 ? colors.gold : colors.cyan, 7);
  });
  spark(context, time, 1);
  context.restore();
}
