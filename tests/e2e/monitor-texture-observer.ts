import type { Page } from "@playwright/test";

export type MonitorTextureSample = {
  screen: "game" | "main" | "interactive" | "videoWall";
  media: string;
  base: string;
  blend: number;
  transition: number | null;
  opacity: number;
  activation: number;
};

/** Observe rendered sampler ownership rather than adding hooks to the scene. */
export async function observeMonitorTextures(page: Page) {
  await page.addInitScript(() => {
    type Source = { label: string; screen: "game" | "main" | "interactive" | "videoWall" | null; canvas?: HTMLCanvasElement };
    type Program = { media?: number; base?: number; blend?: number; opacity?: number; activation?: number };
    type Context = {
      program: WebGLProgram | null;
      unit: number;
      bindings: Map<number, WebGLTexture | null>;
      sources: WeakMap<WebGLTexture, Source>;
      programs: WeakMap<WebGLProgram, Program>;
      locations: WeakMap<WebGLUniformLocation, { program: Program; name: string }>;
    };
    const observer = window as unknown as Window & { __monitorTextureSamples: MonitorTextureSample[] };
    observer.__monitorTextureSamples = [];
    const contexts = new WeakMap<WebGLRenderingContext, Context>();
    const stateFor = (gl: WebGLRenderingContext) => {
      let state = contexts.get(gl);
      if (!state) {
        state = { program: null, unit: 0, bindings: new Map(), sources: new WeakMap(), programs: new WeakMap(), locations: new WeakMap() };
        contexts.set(gl, state);
      }
      return state;
    };
    const describe = (source: HTMLCanvasElement | HTMLImageElement): Source => {
      if (source instanceof HTMLImageElement) {
        const screen = source.src.includes("screen-game-") || source.src.includes("race-idle.webp") ? "game"
          : source.src.includes("screen-main-") ? "main"
            : source.src.includes("screen-interactive-") || source.src.includes("connected-experience.webp") ? "interactive"
              : source.src.includes("screen-center-") || source.src.includes("lighting-screen-v1.webp") ? "videoWall" : null;
        return { label: "image", screen };
      }
      const canvasScreen = source.hasAttribute("data-game-canvas") || source.hasAttribute("data-game-ambient") ? "game"
        : source.hasAttribute("data-drawing-canvas") ? "main"
          : source.hasAttribute("data-composer-canvas") ? "interactive"
            : source.hasAttribute("data-stage-scroll") || source.hasAttribute("data-stage-canvas") || source.hasAttribute("data-intelligence-monitor-canvas") ? "videoWall" : null;
      // Retained walls and handoff snapshots are detached canvases. They keep
      // the physical monitor's exact canvas size, without the producer's DOM
      // attributes; no poster sampler remains to supply their screen identity.
      const screen = canvasScreen ?? (source.width === 960 && source.height === 718 ? "main"
        : source.width === 501 && source.height === 720 ? "game"
          : source.width === 1031 && source.height === 540 ? "interactive"
            : source.width === 1740 && source.height === 450 ? "videoWall" : null);
      const label = source.hasAttribute("data-game-ambient") ? "ambient"
        : source.hasAttribute("data-intelligence-monitor-canvas") ? "intelligence"
          : canvasScreen === "videoWall" ? "stage" : canvasScreen ? "interactive" : "retained";
      return { label, screen, canvas: source };
    };
    const record = (gl: WebGLRenderingContext) => {
      const state = stateFor(gl);
      const program = state.program ? state.programs.get(state.program) : undefined;
      if (program?.media === undefined || program.base === undefined || program.blend === undefined) return;
      const mediaTexture = state.bindings.get(program.media);
      const baseTexture = state.bindings.get(program.base);
      const media = mediaTexture ? state.sources.get(mediaTexture) : undefined;
      const base = baseTexture ? state.sources.get(baseTexture) : undefined;
      const screen = media?.screen ?? base?.screen;
      if (!screen) return;
      // A live canvas identifies its paired neutral base texture. Remember that
      // texture so reverse travel can be observed after the live canvas releases.
      if (baseTexture && !base) state.sources.set(baseTexture, { label: "neutral", screen });
      observer.__monitorTextureSamples.push({
        screen,
        media: media?.label ?? "unknown",
        base: base?.label ?? "unknown",
        blend: program.blend,
        transition: media?.canvas?.dataset.transitionProgress ? Number(media.canvas.dataset.transitionProgress) : null,
        opacity: program.opacity ?? 1,
        activation: program.activation ?? 1,
      });
      if (observer.__monitorTextureSamples.length > 2_000) observer.__monitorTextureSamples.shift();
    };

    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const use = prototype.useProgram;
      prototype.useProgram = function (program) {
        stateFor(this).program = program;
        use.call(this, program);
      };
      const active = prototype.activeTexture;
      prototype.activeTexture = function (texture) {
        stateFor(this).unit = texture - this.TEXTURE0;
        active.call(this, texture);
      };
      const bind = prototype.bindTexture;
      prototype.bindTexture = function (target, texture) {
        if (target === this.TEXTURE_2D) {
          const state = stateFor(this);
          state.bindings.set(state.unit, texture);
        }
        bind.call(this, target, texture);
      };
      const uploads = prototype as unknown as Record<"texImage2D" | "texSubImage2D", (this: WebGLRenderingContext, ...args: unknown[]) => void>;
      for (const method of ["texImage2D", "texSubImage2D"] as const) {
        const upload = uploads[method];
        uploads[method] = function (this: WebGLRenderingContext, ...args: unknown[]) {
          const source = args.find((argument) => argument instanceof HTMLCanvasElement || argument instanceof HTMLImageElement);
          const state = stateFor(this);
          const texture = state.bindings.get(state.unit);
          if (texture && (source instanceof HTMLCanvasElement || source instanceof HTMLImageElement)) {
            state.sources.set(texture, describe(source));
          }
          upload.apply(this, args);
        };
      }
      const locate = prototype.getUniformLocation;
      prototype.getUniformLocation = function (program, name) {
        const location = locate.call(this, program, name);
        if (location && ["uMedia", "uBaseMedia", "uMediaBlend", "uContentOpacity", "uActivation"].includes(name)) {
          const state = stateFor(this);
          let uniforms = state.programs.get(program);
          if (!uniforms) {
            uniforms = {};
            state.programs.set(program, uniforms);
          }
          state.locations.set(location, { program: uniforms, name });
        }
        return location;
      };
      const integer = prototype.uniform1i;
      prototype.uniform1i = function (location, value) {
        const uniform = location ? stateFor(this).locations.get(location) : undefined;
        if (uniform?.name === "uMedia") uniform.program.media = value;
        else if (uniform?.name === "uBaseMedia") uniform.program.base = value;
        integer.call(this, location, value);
      };
      const scalar = prototype.uniform1f;
      prototype.uniform1f = function (location, value) {
        const uniform = location ? stateFor(this).locations.get(location) : undefined;
        if (uniform?.name === "uMediaBlend") uniform.program.blend = value;
        else if (uniform?.name === "uContentOpacity") uniform.program.opacity = value;
        else if (uniform?.name === "uActivation") uniform.program.activation = value;
        scalar.call(this, location, value);
      };
      const indexed = prototype.drawElements;
      prototype.drawElements = function (mode, count, type, offset) {
        record(this);
        indexed.call(this, mode, count, type, offset);
      };
      const arrays = prototype.drawArrays;
      prototype.drawArrays = function (mode, first, count) {
        record(this);
        arrays.call(this, mode, first, count);
      };
    }
  });
}

export async function clearMonitorTextureSamples(page: Page) {
  await page.evaluate(() => {
    (window as unknown as Window & { __monitorTextureSamples: MonitorTextureSample[] }).__monitorTextureSamples = [];
  });
}

export async function getMonitorTextureSamples(page: Page, screen: MonitorTextureSample["screen"]) {
  return page.evaluate((id) => (
    (window as unknown as Window & { __monitorTextureSamples: MonitorTextureSample[] }).__monitorTextureSamples.filter((sample) => sample.screen === id)
  ), screen);
}
