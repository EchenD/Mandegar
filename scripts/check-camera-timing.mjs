import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const options = { json: false, requireReady: false, handoff: "Docs/CreativeProduction/camera-timing-handoff.template.json", asset: "public/models/mandegar/mandegar_environment.glb" };

function readClip(file, handoff) {
  const buffer = readFileSync(file);
  if (buffer.length < 20 || buffer.readUInt32LE(0) !== 0x46546c67 || buffer.readUInt32LE(4) !== 2
    || buffer.readUInt32LE(8) !== buffer.length || buffer.readUInt32LE(16) !== 0x4e4f534a) {
    throw new Error("The camera asset must be a complete GLB version 2 file.");
  }
  const jsonLength = buffer.readUInt32LE(12);
  if (20 + jsonLength > buffer.length) throw new Error("The GLB JSON chunk is truncated.");
  const data = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));
  const binaryHeader = 20 + jsonLength;
  if (binaryHeader + 8 > buffer.length || buffer.readUInt32LE(binaryHeader + 4) !== 0x004e4942) {
    throw new Error("The exported GLB needs its animation keyframes in the binary chunk.");
  }
  const binaryStart = binaryHeader + 8;
  const binaryEnd = binaryStart + buffer.readUInt32LE(binaryHeader);
  if (binaryEnd > buffer.length) throw new Error("The animation binary chunk is truncated.");
  const nodes = data.nodes ?? [];
  const cameraIndex = nodes.findIndex((node) => node.name === handoff.cameraNode);
  if (cameraIndex < 0 || data.cameras?.[nodes[cameraIndex].camera]?.type !== "perspective") {
    throw new Error(`The GLB needs the PerspectiveCamera ${handoff.cameraNode}.`);
  }
  const clip = data.animations?.find((animation) => animation.name === handoff.clipName);
  if (!clip) throw new Error(`The GLB needs the animation ${handoff.clipName}.`);
  const parents = new Map();
  nodes.forEach((node, index) => node.children?.forEach((child) => parents.set(child, index)));
  const ancestors = new Set();
  for (let node = cameraIndex; node !== undefined && !ancestors.has(node); node = parents.get(node)) ancestors.add(node);
  if (!clip.channels?.some((channel) => ancestors.has(channel.target.node) && ["translation", "rotation"].includes(channel.target.path))) {
    throw new Error("The named clip does not animate the camera or its parent transform.");
  }
  const bounds = clip.samplers.map((sampler) => {
    const accessor = data.accessors?.[sampler.input];
    const view = data.bufferViews?.[accessor?.bufferView];
    if (!view || view.buffer !== 0 || accessor.sparse || accessor.componentType !== 5126 || accessor.type !== "SCALAR"
      || !Number.isInteger(accessor.count) || accessor.count < 1) {
      throw new Error("Animation timestamps need a non-sparse float32 scalar accessor in the GLB binary chunk.");
    }
    const offset = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const stride = view.byteStride ?? 4;
    const end = offset + (accessor.count - 1) * stride + 4;
    if (stride < 4 || offset < binaryStart || end > binaryEnd
      || end > binaryStart + (view.byteOffset ?? 0) + view.byteLength) {
      throw new Error("Animation timestamp data is outside its binary buffer view.");
    }
    let first = null;
    let previous = -Infinity;
    for (let index = 0; index < accessor.count; index += 1) {
      const time = buffer.readFloatLE(offset + index * stride);
      if (!Number.isFinite(time) || time < 0 || time <= previous) throw new Error("Animation timestamps must be finite, nonnegative and increasing.");
      first ??= time;
      previous = time;
    }
    return { first, last: previous };
  });
  if (!bounds.length) throw new Error("The exported camera clip has no animation timestamps.");
  if (Math.abs(Math.min(...bounds.map((range) => range.first))) > 0.001) {
    throw new Error("The exported animation must start at clip time zero; firstFrame records the original source frame.");
  }
  return {
    cameraNode: nodes[cameraIndex].name,
    clipName: clip.name,
    durationSeconds: Math.max(...bounds.map((range) => range.last)),
  };
}

try {
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--require-ready") options.requireReady = true;
    else if ((argument === "--handoff" || argument === "--asset") && args[index + 1]) options[argument.slice(2)] = args[++index];
    else throw new Error(`Unknown or incomplete argument: ${argument}. Use --handoff PATH, --asset PATH, --json or --require-ready.`);
  }
  const handoff = JSON.parse(readFileSync(resolve(projectRoot, options.handoff), "utf8"));
  if (typeof handoff !== "object" || handoff === null || Array.isArray(handoff)) throw new Error("The handoff must be a JSON object.");
  const clip = readClip(resolve(projectRoot, options.asset), handoff);
  // Keep the preflight on the same pure TypeScript compiler used by the app.
  // hero-timeline.ts has no runtime imports, so this requires no server or TS loader.
  const source = readFileSync(new URL("../components/experience/hero-timeline.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  const { compileHeroTimeline, HeroTimelineError } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
  let report;
  try {
    const timeline = compileHeroTimeline(handoff, clip);
    report = { status: "valid", ready: handoff.status === "ready", clip, phases: timeline.phases, cueFrames: timeline.cueFrames };
  } catch (error) {
    if (!(error instanceof HeroTimelineError)) throw error;
    report = { status: handoff.status === "draft" ? "pending" : "invalid", ready: false, clip, issues: error.issues };
  }
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Camera clip: ${clip.clipName} (${clip.durationSeconds.toFixed(4)}s).`);
    if (report.status === "valid") {
      console.log(`Validated ${report.phases.length} hero phases and ${Object.keys(report.cueFrames).length} effect cues.`);
      console.log(report.ready ? "Handoff is ready for integration." : "Frame data is valid; status is still draft.");
    } else {
      console.log(report.status === "pending" ? "Draft handoff is pending; the live sequence is unchanged." : "Ready handoff failed validation.");
      report.issues.forEach((issue) => console.log(`- ${issue}`));
    }
  }
  if (report.status === "invalid" || (options.requireReady && !report.ready)) process.exitCode = 1;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (options.json) console.log(JSON.stringify({ status: "invalid", ready: false, issues: [message] }, null, 2));
  else console.error(`Camera timing check failed: ${message}`);
  process.exitCode = 1;
}
