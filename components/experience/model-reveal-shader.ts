import * as THREE from "three";

export type ModelRevealUniforms = {
  uModelRevealProgress: { value: number };
  uModelRevealTime: { value: number };
  uModelRevealCenter: { value: THREE.Vector3 };
  uModelRevealExtent: { value: number };
};

export const modelRevealVertexPars = `
  varying vec3 vModelRevealWorldPosition;
`;

export const modelRevealVertexPosition = `
  vModelRevealWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

export const modelRevealFragmentPars = `
  varying vec3 vModelRevealWorldPosition;
  uniform float uModelRevealProgress;
  uniform float uModelRevealTime;
  uniform vec3 uModelRevealCenter;
  uniform float uModelRevealExtent;

  float mandegarRevealTurbulence(vec3 point) {
    float first = sin(dot(point, vec3(1.73, 2.41, 1.19)) + uModelRevealTime * 1.35);
    float second = sin(dot(point, vec3(-3.11, 1.27, 2.63)) - uModelRevealTime * 1.08);
    float third = sin(dot(point, vec3(5.17, -2.03, 3.79)) + uModelRevealTime * 0.72);
    return first * 0.52 + second * 0.31 + third * 0.17;
  }
`;

export const modelRevealFragmentMask = `
  vec3 mandegarRevealPoint = vModelRevealWorldPosition - uModelRevealCenter;
  mandegarRevealPoint.y *= 0.82;
  float mandegarRevealDistance = length(mandegarRevealPoint);
  float mandegarRevealNoise = mandegarRevealTurbulence(mandegarRevealPoint * 0.72);
  float mandegarRevealNoiseAmount = smoothstep(0.02, 0.24, uModelRevealProgress) * 0.72;
  float mandegarRevealRadius = uModelRevealProgress * (uModelRevealExtent + 1.25) - 0.48;
  float mandegarRevealField = mandegarRevealRadius - mandegarRevealDistance
    + mandegarRevealNoise * mandegarRevealNoiseAmount;
  float mandegarRevealCoverage = smoothstep(-0.42, 0.34, mandegarRevealField);
  float mandegarRevealDither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (mandegarRevealCoverage < mandegarRevealDither) discard;
  float mandegarRevealEdgeGlow = (1.0 - smoothstep(0.0, 0.78, abs(mandegarRevealField)))
    * smoothstep(0.015, 0.16, uModelRevealProgress)
    * (1.0 - smoothstep(0.88, 1.0, uModelRevealProgress));
`;

export function createModelRevealUniforms(center: THREE.Vector3, extent: number): ModelRevealUniforms {
  return {
    uModelRevealProgress: { value: 0 },
    uModelRevealTime: { value: 0 },
    uModelRevealCenter: { value: center.clone() },
    uModelRevealExtent: { value: extent },
  };
}

export function applyModelRevealShader(material: THREE.Material, uniforms: ModelRevealUniforms) {
  const previousCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${modelRevealVertexPars}`)
      .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${modelRevealVertexPosition}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${modelRevealFragmentPars}`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n${modelRevealFragmentMask}`)
      .replace(
        "#include <opaque_fragment>",
        "outgoingLight += vec3(0.18, 0.58, 1.0) * mandegarRevealEdgeGlow * 1.65;\n#include <opaque_fragment>",
      );
  };
  material.customProgramCacheKey = () => `${previousCacheKey()}|mandegar-center-reveal-v1`;
  material.needsUpdate = true;
}
