import * as THREE from "three";

export type BakedMaterialUniforms = {
  uQuietMap: { value: THREE.Texture };
  uPeakMap: { value: THREE.Texture };
  uPeakMix: { value: number };
  uRevealProgress: { value: number };
  uRevealOrigin: { value: THREE.Vector3 };
  uRevealExtent: { value: number };
  uTime: { value: number };
  uEdgeWidth: { value: number };
  uTurbulence: { value: number };
  uEdgeColor: { value: THREE.Color };
  uEdgeStrength: { value: number };
  uOpacity: { value: number };
  uCrowdFalloffStrength: { value: number };
  uCrowdFalloffPower: { value: number };
  uPersonFocus: { value: number };
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  #ifdef CROWD_FALLOFF
    varying vec3 vViewNormal;
    varying vec3 vViewDirection;
  #endif

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    #ifdef CROWD_FALLOFF
      vViewNormal = normalize(normalMatrix * normal);
      vViewDirection = -(viewMatrix * worldPosition).xyz;
    #endif
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uQuietMap;
  uniform sampler2D uPeakMap;
  uniform float uPeakMix;
  uniform float uRevealProgress;
  uniform vec3 uRevealOrigin;
  uniform float uRevealExtent;
  uniform float uTime;
  uniform float uEdgeWidth;
  uniform float uTurbulence;
  uniform vec3 uEdgeColor;
  uniform float uEdgeStrength;
  uniform float uOpacity;
  #ifdef CROWD_FALLOFF
    uniform float uCrowdFalloffStrength;
    uniform float uCrowdFalloffPower;
    uniform float uPersonFocus;
    varying vec3 vViewNormal;
    varying vec3 vViewDirection;
  #endif

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  float hash12(vec2 value) {
    vec3 point = fract(vec3(value.xyx) * 0.1031);
    point += dot(point, point.yzx + 33.33);
    return fract((point.x + point.y) * point.z);
  }

  float revealNoise(vec3 point) {
    vec3 samplePoint = point * 1.37;
    float first = sin(samplePoint.x + sin(samplePoint.z * 1.7 + uTime * 0.31));
    float second = sin(samplePoint.y * 1.43 - uTime * 0.22 + samplePoint.x * 0.63);
    float third = sin(samplePoint.z * 2.11 + samplePoint.y * 0.71 + uTime * 0.17);
    return (first + second + third) / 3.0;
  }

  void main() {
    vec4 quietSample = texture2D(uQuietMap, vUv);
    vec4 peakSample = texture2D(uPeakMap, vUv);
    float peakMix = clamp(uPeakMix, 0.0, 1.0);
    vec3 bakedColor = mix(quietSample.rgb, peakSample.rgb, peakMix);
    float authoredHighlight = smoothstep(
      0.62,
      0.96,
      max(peakSample.r, max(peakSample.g, peakSample.b))
    ) * peakMix;
    bakedColor *= 1.0 + authoredHighlight * 0.08;
    #ifdef CROWD_FALLOFF
      // The authored colour texture controls the glow: shaded texels stay quiet.
      float textureBrightness = dot(peakSample.rgb, vec3(0.2126, 0.7152, 0.0722));
      float brightnessMask = smoothstep(0.025, 0.36, textureBrightness);
      float facing = abs(dot(normalize(vViewNormal), normalize(vViewDirection)));
      float falloff = pow(1.0 - clamp(facing, 0.0, 1.0), uCrowdFalloffPower);
      bakedColor += peakSample.rgb * brightnessMask * peakMix
        * uCrowdFalloffStrength * (0.4 + falloff * 0.6);
      // Focus remains a separate, reversible response to exploring a person.
      // A small light lift makes the selected silhouette readable even in shade.
      vec3 focusLift = vec3(0.05, 0.065, 0.075) * (0.6 + brightnessMask * 0.4)
        + vec3(0.14, 0.18, 0.2) * falloff;
      bakedColor += clamp(uPersonFocus, 0.0, 1.0) * peakMix
        * (bakedColor * 1.4 + focusLift);
    #endif

    float safeExtent = max(0.001, uRevealExtent);
    float distanceField = length(vWorldPosition - uRevealOrigin) / safeExtent;
    float turbulence = revealNoise(vWorldPosition / safeExtent * 7.0)
      * mix(0.012, 0.11, uTurbulence);
    float revealFront = clamp(uRevealProgress, 0.0, 1.0) * 1.16;
    float edgeWidth = mix(0.012, 0.09, uEdgeWidth);
    float revealMask = smoothstep(
      distanceField + turbulence - edgeWidth,
      distanceField + turbulence + edgeWidth,
      revealFront
    );
    revealMask *= smoothstep(0.001, 0.035, uRevealProgress);
    float coverage = clamp(revealMask * uOpacity, 0.0, 1.0);
    if (hash12(gl_FragCoord.xy) > coverage) discard;

    float edge = 1.0 - smoothstep(
      edgeWidth * 0.25,
      edgeWidth * 1.45,
      abs(revealFront - distanceField - turbulence)
    );
    edge *= smoothstep(0.01, 0.08, uRevealProgress)
      * (1.0 - smoothstep(0.9, 1.0, uRevealProgress));

    vec3 finalColor = bakedColor
      + uEdgeColor * edge * uEdgeStrength;
    gl_FragColor = vec4(finalColor, 1.0);
    #include <colorspace_fragment>
  }
`;

export function prepareBakedTexture(texture: THREE.Texture, anisotropy = 1) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = (texture.mipmaps?.length ?? 0) === 0
    && !(texture instanceof THREE.CompressedTexture);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createBakedSceneMaterial({
  name,
  quietMap,
  peakMap,
  edgeColor,
  crowdFalloff = false,
}: {
  name: string;
  quietMap: THREE.Texture;
  peakMap: THREE.Texture;
  edgeColor: THREE.ColorRepresentation;
  crowdFalloff?: boolean;
}) {
  const uniforms: BakedMaterialUniforms = {
    uQuietMap: { value: quietMap },
    uPeakMap: { value: peakMap },
    uPeakMix: { value: 0 },
    uRevealProgress: { value: 0 },
    uRevealOrigin: { value: new THREE.Vector3() },
    uRevealExtent: { value: 1 },
    uTime: { value: 0 },
    uEdgeWidth: { value: 0.42 },
    uTurbulence: { value: 0.4 },
    uEdgeColor: { value: new THREE.Color(edgeColor) },
    uEdgeStrength: { value: 0.2 },
    uOpacity: { value: 1 },
    uCrowdFalloffStrength: { value: 0.6 },
    uCrowdFalloffPower: { value: 2 },
    uPersonFocus: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    name,
    uniforms,
    vertexShader,
    fragmentShader,
    defines: crowdFalloff ? { CROWD_FALLOFF: 1 } : {},
    depthTest: true,
    depthWrite: true,
    transparent: false,
    side: THREE.FrontSide,
    toneMapped: false,
  });
  return { material, uniforms };
}
