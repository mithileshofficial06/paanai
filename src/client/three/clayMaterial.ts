// Wet clay: MeshPhysicalMaterial + onBeforeCompile.
// - albedo: wet terracotta with low-frequency mottling, fine grog, and horizontal slip smears
// - throwing rings: noise-warped horizontal ridges on the walls, a spiral on the inner floor,
//   applied as a physically scaled surface-gradient bump (amplitude in cm, so it does not change
//   strength with zoom); band-limited with fwidth so it never shimmers
// - wet sheen: clearcoat whose normal follows the ridges, roughness drops where slip is wet and
//   around the finger's contact band; a flat water puddle on the inner floor
// - fake interior occlusion and shadowing from a per-vertex attribute (no shadow maps)
// The mesh rotates with the wheel, so every object-space pattern turns with it.

import { Color, MeshPhysicalMaterial } from 'three';

export type ClayUniforms = {
  uTime: { value: number };
  /** 0 = leather-hard, 1 = dripping wet. */
  uWet: { value: number };
  /** Object-space height (cm) of the finger contact band. */
  uContactY: { value: number };
  /** 0..1 contact band intensity. */
  uContact: { value: number };
  /** Amount of slip smears. */
  uSlip: { value: number };
  /** Throwing ring spacing (cm). */
  uRingSpacing: { value: number };
  /** Ridge amplitude (cm). */
  uRidgeAmp: { value: number };
  /** Inner floor puddle: radius (cm), height (cm), amount. */
  uPuddle: { value: number };
  uFloorR: { value: number };
  uFloorY: { value: number };
  uSlipColor: { value: Color };
};

export type ClayMaterialOptions = {
  color?: string;
  wet?: number;
};

const VERT_PARS = /* glsl */ `
attribute vec2 aShade;
attribute float aKind;
varying vec2 vShade;
varying float vKind;
varying vec3 vObjPos;
`;

const VERT_MAIN = /* glsl */ `
vShade = aShade;
vKind = aKind;
vObjPos = position;
`;

const FRAG_PARS = /* glsl */ `
uniform float uTime;
uniform float uWet;
uniform float uContactY;
uniform float uContact;
uniform float uSlip;
uniform float uRingSpacing;
uniform float uRidgeAmp;
uniform float uPuddle;
uniform float uFloorR;
uniform float uFloorY;
uniform vec3 uSlipColor;
varying vec2 vShade;
varying float vKind;
varying vec3 vObjPos;

float pnHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float pnNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = pnHash(i);
  float n100 = pnHash(i + vec3(1.0, 0.0, 0.0));
  float n010 = pnHash(i + vec3(0.0, 1.0, 0.0));
  float n110 = pnHash(i + vec3(1.0, 1.0, 0.0));
  float n001 = pnHash(i + vec3(0.0, 0.0, 1.0));
  float n101 = pnHash(i + vec3(1.0, 0.0, 1.0));
  float n011 = pnHash(i + vec3(0.0, 1.0, 1.0));
  float n111 = pnHash(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
`;

// Computed right after the base colour, so later chunks (roughness, normal, clearcoat) can use them.
const FRAG_FIELDS = /* glsl */ `
float pnRad = length(vObjPos.xz);
float pnFloor = smoothstep(1.35, 1.9, vKind);
float pnInner = step(0.75, vKind);
// Slip smears are stretched around the circumference (the wheel spreads them sideways).
float pnSlipN = pnNoise(vec3(vObjPos.x * 0.9, vObjPos.y * 5.5, vObjPos.z * 0.9) + 11.0)
              + 0.35 * pnNoise(vec3(vObjPos.x * 2.6, vObjPos.y * 14.0, vObjPos.z * 2.6) + 3.0);
float pnSlip = smoothstep(0.62, 1.05, pnSlipN) * uSlip;
// Throwing rings: height on the walls, radius plus a spiral on the floor. The spiral adds exactly
// one (or five) whole periods per turn so the atan seam is invisible; anti-aliasing uses the
// seam-free phase so fwidth never spikes along the seam.
float pnAng = atan(vObjPos.z, vObjPos.x) * 0.15915494;
float pnWarp = pnNoise(vObjPos * 0.42) * 1.4 + pnNoise(vObjPos * 1.6 + 5.0) * 0.45;
float pnBaseU = mix(vObjPos.y, pnRad, pnFloor);
float pnPhaseAA = pnBaseU / uRingSpacing + pnWarp * (1.0 - pnFloor);
float pnPhase = pnPhaseAA + pnAng * pnFloor;
float pnRidge = sin(6.2831853 * pnPhase);
pnRidge = sign(pnRidge) * pow(abs(pnRidge), 0.75);
float pnAmpMod = 0.45 + 0.55 * pnNoise(vec3(vObjPos.x * 0.8, vObjPos.y * 0.35, vObjPos.z * 0.8) + 7.0);
float pnAA1 = 1.0 - smoothstep(0.22, 0.6, fwidth(pnPhaseAA));
float pnFineAA = pnBaseU / (uRingSpacing * 0.2) + pnWarp * 2.7;
float pnFinePhase = pnFineAA + 5.0 * pnAng * pnFloor;
float pnAA2 = 1.0 - smoothstep(0.18, 0.5, fwidth(pnFineAA));
float pnFine = sin(6.2831853 * pnFinePhase);
// Water pooled on the inner floor: flat and glassy.
float pnPuddle = uPuddle * pnFloor * (1.0 - smoothstep(uFloorR * 0.55, uFloorR * 0.95, pnRad))
               * (1.0 - smoothstep(uFloorY + 0.05, uFloorY + 0.35, vObjPos.y));
float pnH = (pnRidge * pnAmpMod * pnAA1 + pnFine * 0.2 * pnAA2) * uRidgeAmp * (1.0 - pnPuddle);
// Fresh contact band: the finger just smoothed and wetted the clay here.
float pnBand = uContact * exp(-pow((vObjPos.y - uContactY) / 0.8, 2.0)) * (1.0 - pnFloor);
`;

const FRAG_COLOR = /* glsl */ `
{
  float tone = 0.84 + 0.2 * pnNoise(vObjPos * 1.9) + 0.07 * pnNoise(vObjPos * 6.5 + 2.0);
  float grog = smoothstep(0.82, 0.95, pnNoise(vObjPos * 26.0)) * pnAA2;
  vec3 c = diffuseColor.rgb * tone * (1.0 - 0.18 * grog);
  c *= 1.0 - 0.06 * pnRidge * pnAmpMod * pnAA1;
  c = mix(c, uSlipColor, pnSlip * 0.5);
  c = mix(c, c * 0.72, pnPuddle * 0.8);
  c *= mix(1.0, 0.86, pnInner);
  diffuseColor.rgb = c;
}
`;

const FRAG_ROUGHNESS = /* glsl */ `
float pnWetness = clamp(uWet * (0.6 + 0.4 * pnSlip + 0.25 * pnInner) + pnBand * 0.6, 0.0, 1.0);
roughnessFactor = mix(roughnessFactor, 0.24, pnWetness * 0.75);
roughnessFactor = mix(roughnessFactor, 0.06, pnPuddle);
`;

// Surface-gradient bump with the height in cm (Mikkelsen), not normalised by screen derivatives.
const FRAG_NORMAL = /* glsl */ `
{
  vec3 pnPos = -vViewPosition;
  vec3 pnDpx = dFdx(pnPos);
  vec3 pnDpy = dFdy(pnPos);
  float pnDhx = dFdx(pnH);
  float pnDhy = dFdy(pnH);
  vec3 pnR1 = cross(pnDpy, normal);
  vec3 pnR2 = cross(normal, pnDpx);
  float pnDet = dot(pnDpx, pnR1) * faceDirection;
  vec3 pnGrad = sign(pnDet) * (pnDhx * pnR1 + pnDhy * pnR2);
  normal = normalize(abs(pnDet) * normal - pnGrad);
}
`;

const FRAG_CLEARCOAT_NORMAL = /* glsl */ `
#ifdef USE_CLEARCOAT
  clearcoatNormal = normalize(mix(nonPerturbedNormal, normal, mix(0.9, 0.0, pnPuddle)));
#endif
`;

const FRAG_MATERIAL = /* glsl */ `
#ifdef USE_CLEARCOAT
  material.clearcoat = clamp(pnWetness * 0.85 + pnPuddle, 0.0, 1.0);
  material.clearcoatRoughness = mix(mix(0.32, 0.1, pnWetness), 0.03, pnPuddle);
#endif
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

export function createClayMaterial(opts: ClayMaterialOptions = {}): { material: MeshPhysicalMaterial; uniforms: ClayUniforms } {
  const uniforms: ClayUniforms = {
    uTime: { value: 0 },
    uWet: { value: opts.wet ?? 1 },
    uContactY: { value: -10 },
    uContact: { value: 0 },
    uSlip: { value: 1 },
    uRingSpacing: { value: 0.78 },
    uRidgeAmp: { value: 0.022 },
    uPuddle: { value: 0 },
    uFloorR: { value: 0 },
    uFloorY: { value: 0 },
    uSlipColor: { value: new Color('#b58468') },
  };

  const material = new MeshPhysicalMaterial({
    color: new Color(opts.color ?? '#8a4630'),
    roughness: 0.62,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.2,
    ior: 1.45,
    specularIntensity: 0.9,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_FIELDS}\n${FRAG_COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${FRAG_ROUGHNESS}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${FRAG_NORMAL}`)
      .replace(
        '#include <clearcoat_normal_fragment_maps>',
        `#include <clearcoat_normal_fragment_maps>\n${FRAG_CLEARCOAT_NORMAL}`
      )
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>\n${FRAG_MATERIAL}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>\n${FRAG_SHADE}`);
  };
  material.customProgramCacheKey = () => 'paanai-clay-v1';

  return { material, uniforms };
}
