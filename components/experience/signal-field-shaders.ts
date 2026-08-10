import { sceneTokens } from "./scene-config";

export const signalFieldVertexShader = `
  attribute vec3 color;
  attribute vec3 aSurface;
  attribute vec3 aPathFrom;
  attribute vec3 aPathControl;
  attribute vec3 aPathTo;
  attribute vec3 aRing;
  attribute vec3 aEnergyColor;
  attribute float aSeed;
  attribute float aLayer;
  attribute float aWake;
  attribute float aPointScale;
  uniform float uTime;
  uniform float uProgress;
  uniform float uReset;
  uniform float uSignalAmount;
  uniform float uRingAmount;
  uniform float uActivation;
  uniform float uEnergyAmount;
  uniform float uCelebration;
  uniform float uPeak;
  uniform float uIntroVisibility;
  uniform float uResponse;
  uniform vec3 uPointer;
  uniform vec3 uPointerNormal;
  uniform float uPointerPulse;
  uniform float uModelScale;
  uniform float uModelYOffset;
  uniform float uPointSize;
  uniform float uMaximumPointSize;
  uniform float uViewportHeight;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vActivity;
  varying float vVisibility;
  varying float vBreath;

  void main() {
    float phase = aSeed * 31.4159;
    float dustMask = 1.0 - step(0.5, aLayer);
    float surfaceMask = step(0.5, aLayer) * (1.0 - step(1.5, aLayer));
    float signalMask = step(1.5, aLayer);
    float driftAmount = ${sceneTokens.particles.motion.drift.toFixed(4)};
    vec3 drift = vec3(
      sin(uTime * 0.31 + phase),
      cos(uTime * 0.27 + phase * 1.37),
      sin(uTime * 0.23 + phase * 0.73)
    ) * driftAmount;
    vec3 modelOffset = vec3(0.0, uModelYOffset, 0.0);
    vec3 surfaceTarget = aSurface * uModelScale + modelOffset + drift * 0.1;
    vec3 routeFrom = aPathFrom * uModelScale + modelOffset;
    vec3 routeControl = aPathControl * uModelScale + modelOffset;
    vec3 routeTo = aPathTo * uModelScale + modelOffset;
    vec3 ringTarget = aRing * uModelScale + modelOffset;
    float travel = fract(aSeed + uTime * ${sceneTokens.particles.motion.signalSpeed.toFixed(4)});
    vec3 routeA = mix(routeFrom, routeControl, travel);
    vec3 routeB = mix(routeControl, routeTo, travel);
    vec3 signalTarget = mix(routeA, routeB, travel);
    signalTarget += vec3(
      sin(phase + travel * 6.2831),
      cos(phase * 0.7 + travel * 6.2831) * 0.3,
      cos(phase + travel * 6.2831)
    ) * 0.028;
    signalTarget = mix(signalTarget, ringTarget + drift * 0.08, uRingAmount);
    vec3 dustPosition = position + drift * (0.72 + aPointScale * 0.28);
    vec3 worldPosition = dustPosition * dustMask + surfaceTarget * surfaceMask + signalTarget * signalMask;

    float surfaceReveal = smoothstep(aWake, aWake + 0.06, uProgress) * (1.0 - uReset);
    float signalVisibility = uActivation * (0.24 + uSignalAmount * 0.76) * (1.0 - uReset);
    float particlePopulation = mix(
      ${sceneTokens.visualStory.particles.quietPopulation.toFixed(3)},
      ${sceneTokens.visualStory.particles.livingPopulation.toFixed(3)},
      uCelebration
    );
    particlePopulation = mix(
      particlePopulation,
      ${sceneTokens.visualStory.particles.peakPopulation.toFixed(3)},
      uPeak
    );
    float dustPopulation = step(1.0 - particlePopulation, aSeed);
    vVisibility = dustMask * dustPopulation
      + surfaceMask * surfaceReveal * (0.4 + uEnergyAmount * 0.6)
      + signalMask * signalVisibility;
    vVisibility *= uIntroVisibility;

    vec3 pointerDelta = worldPosition - uPointer;
    float pointerDistance = max(length(pointerDelta), 0.001);
    float pointerLayerScale = dustMask + surfaceMask * 0.08 + signalMask * 0.35;
    float influence = (1.0 - smoothstep(0.0, ${sceneTokens.particles.motion.pointerRadius.toFixed(4)}, pointerDistance)) * uResponse * pointerLayerScale;
    vec3 radial = pointerDelta / pointerDistance;
    vec3 curl = normalize(cross(uPointerNormal, radial) + vec3(0.0001));
    worldPosition += curl * influence * ${sceneTokens.particles.motion.pointerCurl.toFixed(4)};
    worldPosition += radial * influence * ${sceneTokens.particles.motion.pointerPush.toFixed(4)};
    float ripple = sin(pointerDistance * 5.2 - (1.0 - uPointerPulse) * 16.0)
      * uPointerPulse * exp(-pointerDistance * 0.42);
    worldPosition += radial * ripple * ${sceneTokens.particles.motion.pressRipple.toFixed(4)};

    vec4 viewPosition = modelViewMatrix * vec4(worldPosition, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float pulseSize = 1.0 + uPointerPulse * 0.45;
    float layerSize = aPointScale * (dustMask * 0.78 + surfaceMask * 0.96 + signalMask * 1.06);
    float storySize = mix(1.0, ${sceneTokens.visualStory.particles.livingScale.toFixed(3)}, uCelebration);
    storySize = mix(storySize, ${sceneTokens.visualStory.particles.peakScale.toFixed(3)}, uPeak);
    gl_PointSize = clamp(
      uPointSize * layerSize * pulseSize * storySize * uViewportHeight * uPixelRatio * 0.5 / max(1.0, -viewPosition.z),
      ${sceneTokens.particles.screenSize.minimum.toFixed(2)},
      uMaximumPointSize
    );
    vActivity = dustMask * (0.08 + uActivation * 0.12 + uCelebration * 0.28 + uPeak * 0.24)
      + surfaceMask * surfaceReveal * (0.55 + uEnergyAmount * 0.45)
      + signalMask * signalVisibility * (0.72 + uSignalAmount * 0.28);
    float colorMix = dustMask * (0.035 + uActivation * 0.08 + uCelebration * 0.44)
      + surfaceMask * surfaceReveal * (0.5 + uEnergyAmount * 0.5)
      + signalMask * (0.68 + uSignalAmount * 0.32);
    vColor = mix(color, aEnergyColor, colorMix);
    vColor *= mix(1.0, ${sceneTokens.visualStory.particles.livingBrightness.toFixed(3)}, uCelebration);
    vColor *= mix(1.0, ${sceneTokens.visualStory.particles.peakBrightness.toFixed(3)}, uPeak);
    vBreath = 0.86 + sin(uTime * (0.8 + aSeed * 0.5) + phase) * 0.14;
  }
`;

export const signalFieldFragmentShader = `
  uniform float uCoreRatio;
  uniform float uCoreOpacityIdle;
  uniform float uCoreOpacityActive;
  uniform float uGlowOpacityIdle;
  uniform float uGlowOpacityActive;
  varying vec3 vColor;
  varying float vActivity;
  varying float vVisibility;
  varying float vBreath;

  void main() {
    vec2 centered = gl_PointCoord * 2.0 - 1.0;
    float radius = length(centered);
    if (radius > 1.0) discard;
    float core = 1.0 - smoothstep(uCoreRatio * 0.12, uCoreRatio, radius);
    float glow = pow(1.0 - radius, 2.6);
    float coreOpacity = mix(uCoreOpacityIdle, uCoreOpacityActive, vActivity);
    float glowOpacity = mix(uGlowOpacityIdle, uGlowOpacityActive, vActivity);
    float alpha = (core * coreOpacity + glow * glowOpacity) * vBreath * vVisibility;
    gl_FragColor = vec4(vColor * (0.72 + core * 0.58), alpha);
  }
`;
