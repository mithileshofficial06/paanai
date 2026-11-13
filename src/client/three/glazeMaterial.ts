// Fired glaze on a PotGeometry, driven by a GlazeLook (app/glazeLook.ts).
// Object-space patterns (the pot geometry carries aShade/aKind like the wet clay):
// - base colour breaking to the secondary on the rim and over the throwing rings
// - drips running down from the rim, vertical streaks, speckle, oil spots, pinholes
// - crackle network, crawled patches showing the clay body, glossy pools on the inner floor
// - luster (metallic) and a structural crack line for kiln failures

import { Color, MeshPhysicalMaterial, type Texture } from 'three';
import type { GlazeLook } from '../app/glazeLook';

const PARS = /* glsl */ `
attribute vec2 aShade;
attribute float aKind;
varying vec2 vShade;
varying float vKind;
varying vec3 vObjPos;
`;
const MAIN = /* glsl */ `
vShade = aShade;
vKind = aKind;
vObjPos = position;
`;

const FRAG_PARS = /* glsl */ `
uniform vec3 gBase;
uniform vec3 gSecond;
uniform vec3 gBody;
uniform sampler2D gDecor;
uniform float gHasDecor;
uniform float gOpacity, gGloss, gDrips, gCrackle, gSpeckle, gOil, gStreaks, gCrawl, gPool, gLuster, gBreak, gPin, gCracked, gHeight, gSeed;
varying vec2 vShade;
varying float vKind;
varying vec3 vObjPos;
float gHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float gNoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gHash(i), gHash(i + vec3(1,0,0)), u.x), mix(gHash(i + vec3(0,1,0)), gHash(i + vec3(1,1,0)), u.x), u.y),
             mix(mix(gHash(i + vec3(0,0,1)), gHash(i + vec3(1,0,1)), u.x), mix(gHash(i + vec3(0,1,1)), gHash(i + vec3(1,1,1)), u.x), u.y), u.z);
}
// Cellular distance-to-edge for the crackle network.
float gCell(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = vec3(gHash(i + g), gHash(i + g + 17.0), gHash(i + g + 41.0));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return d2 - d1;
}
`;

const FRAG_COLOR = /* glsl */ `
float gAng = atan(vObjPos.z, vObjPos.x);
float gY = vObjPos.y / max(0.1, gHeight);
float gFloor = smoothstep(1.35, 1.9, vKind);
float gInner = step(0.75, vKind);
vec3 gP = vObjPos + gSeed;
// Breaking: glaze thins (and shows the secondary) on the rim and the ridges.
float gRim = smoothstep(0.86, 1.0, gY) * (1.0 - gFloor);
float gRidge = sin(6.2831853 * (vObjPos.y / 0.78 + gNoise(gP * 0.42) * 1.4));
float gBreakAmt = clamp(gRim * 0.8 + max(0.0, gRidge) * 0.35, 0.0, 1.0) * (0.35 + gBreak);
vec3 gc = mix(gBase, gSecond, gBreakAmt * 0.7);
// Translucent glazes let the body through where thin.
gc = mix(gc, gc * 0.55 + gBody * 0.45, (1.0 - gOpacity) * (0.4 + 0.6 * gBreakAmt));
// Vertical streaks.
float gStr = smoothstep(0.55, 0.9, gNoise(vec3(cos(gAng) * 6.0, vObjPos.y * 0.35, sin(gAng) * 6.0) + gSeed)) * gStreaks;
gc = mix(gc, gSecond, gStr * 0.6);
// Drips from the rim: angular lanes with random lengths.
float gLane = gNoise(vec3(cos(gAng) * 9.0, 0.0, sin(gAng) * 9.0) + gSeed * 2.0);
float gLen = 0.25 + 0.6 * gNoise(vec3(cos(gAng) * 3.0, 5.0, sin(gAng) * 3.0) + gSeed);
float gDrip = gDrips * smoothstep(0.55, 0.75, gLane) * smoothstep(1.0 - gLen - 0.05, 1.0 - gLen + 0.05, gY) * (1.0 - gInner);
gc = mix(gc, mix(gSecond, gBase * 0.6, 0.4), gDrip * 0.8);
// Speckle, oil spots, pinholes.
float gSpk = smoothstep(0.78, 0.92, gNoise(gP * 14.0)) * gSpeckle;
gc = mix(gc, gSecond * 0.6, gSpk);
float gOilS = smoothstep(0.82, 0.9, gNoise(gP * 4.5 + 3.0)) * gOil;
gc = mix(gc, vec3(0.72, 0.68, 0.62), gOilS * 0.75);
float gPinS = smoothstep(0.9, 0.96, gNoise(gP * 26.0 + 9.0)) * gPin;
gc = mix(gc, gc * 0.25, gPinS);
// Crackle lines.
float gCr = (1.0 - smoothstep(0.0, 0.05, gCell(gP * 2.2))) * gCrackle;
gc = mix(gc, gc * 0.45, gCr * 0.8);
// Crawl: bare patches of fired clay.
float gCrw = smoothstep(0.68, 0.74, gNoise(gP * 1.7 + 7.0)) * gCrawl;
gc = mix(gc, gBody, gCrw);
// Pools on the inner floor.
gc = mix(gc, gSecond * 0.75, gFloor * gPool * 0.8);
// Structural crack.
float gCrack = gCracked * (1.0 - smoothstep(0.0, 0.035, abs(sin(gAng * 1.0 + 0.6) - 0.3 * gNoise(vec3(0.0, vObjPos.y * 1.8, 0.0)) ))) * smoothstep(0.35, 0.95, gY);
gc = mix(gc, vec3(0.03, 0.02, 0.02), gCrack);
// Foot ring: unglazed body at the very base.
float gFoot = (1.0 - smoothstep(0.015, 0.05, gY)) * (1.0 - gInner);
gc = mix(gc, gBody, gFoot);
// Painted decoration (over the glaze, outside only, not on the unglazed foot).
float gPaint = 0.0;
if (gHasDecor > 0.5) {
  vec4 gDc = texture2D(gDecor, vec2(gAng / 6.2831853 + 0.5, clamp(gY, 0.0, 1.0)));
  gPaint = gDc.a * (1.0 - gInner) * (1.0 - gFloor) * (1.0 - gFoot);
  gc = mix(gc, gDc.rgb, gPaint);
}
diffuseColor.rgb = gc;
float gMatte = max(max(gCrw, gFoot), gCrack);
`;

const FRAG_ROUGH = /* glsl */ `
roughnessFactor = mix(mix(0.9, 0.08, gGloss), 0.92, gMatte);
roughnessFactor = mix(roughnessFactor, 0.05, gFloor * gPool);
roughnessFactor = mix(roughnessFactor, 0.35, gOilS);
`;
const FRAG_METAL = /* glsl */ `
metalnessFactor = gLuster * (1.0 - gMatte) * (0.6 + 0.4 * gBreakAmt) + gOilS * 0.5;
`;
const FRAG_SHADE = /* glsl */ `
{
  float occ = vShade.x;
  float dl = vShade.y;
  reflectedLight.indirectDiffuse *= occ;
  reflectedLight.indirectSpecular *= occ * occ;
  reflectedLight.directDiffuse *= dl;
  reflectedLight.directSpecular *= dl;
  #ifdef USE_CLEARCOAT
    clearcoatSpecularIndirect *= occ * occ;
    clearcoatSpecularDirect *= dl;
  #endif
}
`;

let seedCounter = 0;

export function createGlazeMaterial(look: GlazeLook, seed = ++seedCounter): MeshPhysicalMaterial {
  const u = {
    gBase: { value: new Color(look.base) },
    gSecond: { value: new Color(look.secondary) },
    gBody: { value: new Color(look.body) },
    gOpacity: { value: look.opacity },
    gGloss: { value: look.gloss },
    gDrips: { value: look.drips },
    gCrackle: { value: look.crackle },
    gSpeckle: { value: look.speckle },
    gOil: { value: look.oilSpots },
    gStreaks: { value: look.streaks },
    gCrawl: { value: look.crawl },
    gPool: { value: look.pool },
    gLuster: { value: look.luster },
    gBreak: { value: look.breakEdges },
    gPin: { value: look.pinholes },
    gCracked: { value: look.cracked ? 1 : 0 },
    gHeight: { value: 10 },
    gSeed: { value: (seed % 97) * 1.37 },
    gDecor: { value: null as Texture | null },
    gHasDecor: { value: 0 },
  };
  const m = new MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0,
    clearcoat: Math.max(0, look.gloss - 0.2),
    clearcoatRoughness: 0.08,
    ior: 1.52,
    specularIntensity: 1,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${FRAG_ROUGH}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${FRAG_METAL}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>\n${FRAG_SHADE}`);
  };
  m.customProgramCacheKey = () => 'paanai-glaze-v2';
  m.userData.uniforms = u;
  return m;
}

/** Paint (or clear) the decoration texture on a glaze material. */
export function setGlazeDecor(m: MeshPhysicalMaterial, tex: Texture | null): void {
  const u = m.userData.uniforms as { gDecor: { value: Texture | null }; gHasDecor: { value: number } } | undefined;
  if (!u) return;
  u.gDecor.value = tex;
  u.gHasDecor.value = tex ? 1 : 0;
}

/** Update the pot height (cm) so rim/foot masks line up. */
export function setGlazeHeight(m: MeshPhysicalMaterial, heightCm: number): void {
  const u = m.userData.uniforms as { gHeight: { value: number } } | undefined;
  if (u) u.gHeight.value = heightCm;
}
