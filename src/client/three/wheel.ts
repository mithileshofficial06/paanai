// Potter's wheel: cast aluminium wheel head (lathe-turned, slightly worn, bat pins), a wet slurry
// ring around the pot base and a contact shadow (both procedural in the head's shader), a dark
// plastic splash pan with dried slip, and a baked radial shadow of the head on the pan floor.

import {
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector2,
  type Texture,
} from 'three';
import { makeRadialTexture, makeSplashPanTexture, makeWheelTextures } from './textures';

export const WHEEL_RADIUS = 17.5; // cm (14 inch head)
const TOP_R = 17.15;
const FILLET = 0.35;
const HEAD_THICK = 1.9;
const PAN_FLOOR_Y = -6.2;

export type WheelUniforms = {
  uBaseR: { value: number };
  uSlurry: { value: number };
  uOpenT: { value: number };
};

export type Wheel = {
  /** Rotates with the wheel; the pot is parented here. */
  spinner: Group;
  /** Static parts (splash pan, shadow). */
  root: Group;
  uniforms: WheelUniforms;
  dispose: () => void;
};

const WHEEL_PARS = /* glsl */ `
uniform float uBaseR;
uniform float uSlurry;
varying vec3 vHeadPos;
float whHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float whNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(whHash(i), whHash(i + vec3(1,0,0)), u.x), mix(whHash(i + vec3(0,1,0)), whHash(i + vec3(1,1,0)), u.x), u.y),
             mix(mix(whHash(i + vec3(0,0,1)), whHash(i + vec3(1,0,1)), u.x), mix(whHash(i + vec3(0,1,1)), whHash(i + vec3(1,1,1)), u.x), u.y), u.z);
}
`;

const WHEEL_FIELDS = /* glsl */ `
float whR = length(vHeadPos.xz);
float whTop = smoothstep(-0.08, -0.01, vHeadPos.y);
float whAng = atan(vHeadPos.z, vHeadPos.x);
// Irregular outer edge of the slurry, smeared around by the spin.
float whEdgeN = whNoise(vec3(cos(whAng) * 2.2, sin(whAng) * 2.2, 0.0) + 3.0) * 0.7
              + whNoise(vec3(cos(whAng) * 7.0, sin(whAng) * 7.0, 1.7)) * 0.3;
float whEdge = uBaseR + 0.5 + (1.0 + 2.6 * whEdgeN) * uSlurry;
float whSlurry = whTop * uSlurry * (1.0 - smoothstep(whEdge - 0.5, whEdge + 0.25, whR));
// Thin streaks of slip flung outward beyond the main ring.
float whStreak = whTop * uSlurry * smoothstep(0.78, 0.95, whNoise(vec3(whR * 1.4, cos(whAng) * 24.0, sin(whAng) * 24.0)))
               * (1.0 - smoothstep(whEdge, whEdge + 4.0, whR)) * step(whEdge - 0.3, whR) * 0.6;
float whWet = max(whSlurry, whStreak);
// Contact shadow right around the base of the pot.
float whShadow = whTop * exp(-max(0.0, whR - uBaseR) / 0.75) * step(uBaseR * 0.6, whR);
`;

const WHEEL_COLOR = /* glsl */ `
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.20, 0.085, 0.05) * (0.85 + 0.3 * whNoise(vHeadPos * 3.0)), whWet);
`;

const WHEEL_ROUGH = /* glsl */ `
roughnessFactor = mix(roughnessFactor, 0.12, whWet);
`;

const WHEEL_METAL = /* glsl */ `
metalnessFactor = mix(metalnessFactor, 0.0, whWet);
`;

const WHEEL_MATERIAL = /* glsl */ `
#ifdef USE_ANISOTROPY
  material.anisotropy *= 1.0 - whWet;
#endif
#ifdef USE_CLEARCOAT
  material.clearcoat = whWet;
  material.clearcoatRoughness = 0.06;
#endif
`;

const WHEEL_SHADE = /* glsl */ `
{
  float occ = 1.0 - 0.82 * whShadow;
  reflectedLight.indirectDiffuse *= occ;
  reflectedLight.indirectSpecular *= occ;
  reflectedLight.directDiffuse *= occ;
  reflectedLight.directSpecular *= occ;
  #ifdef USE_CLEARCOAT
    clearcoatSpecularIndirect *= occ;
    clearcoatSpecularDirect *= occ;
  #endif
}
`;

function headProfile(): { points: Vector2[]; vTopStart: number } {
  const pts: Vector2[] = [];
  // Underside chamfer -> side (going up) -> fillet -> top (going inward to the axis).
  pts.push(new Vector2(TOP_R - 0.2, -HEAD_THICK));
  pts.push(new Vector2(WHEEL_RADIUS, -HEAD_THICK + 0.3));
  pts.push(new Vector2(WHEEL_RADIUS, -FILLET));
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new Vector2(TOP_R + FILLET * Math.cos(a), -FILLET + FILLET * Math.sin(a)));
  }
  const topStart = pts.length - 1;
  const N = 64;
  for (let i = 1; i <= N; i++) pts.push(new Vector2(TOP_R * (1 - i / N), 0));
  return { points: pts, vTopStart: topStart / (pts.length - 1) };
}

function panProfile(): { points: Vector2[]; vInnerWall: number; vRim: number } {
  const pts: Vector2[] = [];
  // Outer skirt (up) -> rolled rim (over the top, outside to inside) -> inner wall (down) -> floor (inward).
  pts.push(new Vector2(26.9, -9.5));
  pts.push(new Vector2(26.4, -1.0));
  const rimC = new Vector2(25.85, -0.9);
  const rimR = 0.55;
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    pts.push(new Vector2(rimC.x + rimR * Math.cos(a), rimC.y + 0.2 + rimR * Math.sin(a)));
  }
  const vRimIdx = pts.length - 1;
  pts.push(new Vector2(24.9, -1.6));
  pts.push(new Vector2(23.3, -4.4));
  pts.push(new Vector2(22.0, -5.8));
  pts.push(new Vector2(20.8, PAN_FLOOR_Y));
  const wallIdx = pts.length - 1;
  for (let i = 1; i <= 6; i++) pts.push(new Vector2(20.8 - (i / 6) * 12.8, PAN_FLOOR_Y));
  const n = pts.length - 1;
  // v runs from the skirt (0) to the floor centre (1); the texture is authored top-down.
  return { points: pts, vInnerWall: wallIdx / n, vRim: vRimIdx / n };
}

export function createWheel(): Wheel {
  const spinner = new Group();
  const root = new Group();
  const disposables: { dispose: () => void }[] = [];

  const uniforms: WheelUniforms = {
    uBaseR: { value: 4 },
    uSlurry: { value: 0.6 },
    uOpenT: { value: 0 },
  };

  // --- Wheel head ---------------------------------------------------------------------------
  const head = headProfile();
  const headGeo = new LatheGeometry(head.points, 160);
  const tex = makeWheelTextures(head.vTopStart, TOP_R);
  const headMat = new MeshPhysicalMaterial({
    color: 0x5a5a62, // dark cast metal, not polished aluminium
    map: tex.color,
    roughnessMap: tex.orm,
    metalnessMap: tex.orm,
    roughness: 1,
    metalness: 1,
    anisotropy: 0.75,
    anisotropyMap: tex.aniso,
    // Lathe UVs: +u runs around the head. Rotate the stretch so highlights run radially.
    anisotropyRotation: Math.PI / 2,
    clearcoat: 0.0001,
    envMapIntensity: 0.5,
  });
  headMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHeadPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeadPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${WHEEL_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${WHEEL_FIELDS}\n${WHEEL_COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${WHEEL_ROUGH}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${WHEEL_METAL}`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>\n${WHEEL_MATERIAL}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>\n${WHEEL_SHADE}`);
  };
  headMat.customProgramCacheKey = () => 'paanai-wheel-v1';
  const headMesh = new Mesh(headGeo, headMat);
  spinner.add(headMesh);
  disposables.push(headGeo, headMat, tex.color, tex.orm, tex.aniso);

  // Bat pins: two short steel pins 10 inches apart. They make the spin readable.
  const pinGeo = new CylinderGeometry(0.32, 0.36, 0.9, 20);
  const pinMat = new MeshStandardMaterial({ color: 0x9a9da3, metalness: 1, roughness: 0.32 });
  for (const s of [-1, 1]) {
    const pin = new Mesh(pinGeo, pinMat);
    pin.position.set(s * 12.7, 0.45, 0);
    spinner.add(pin);
    const collarGeo = new CylinderGeometry(0.62, 0.62, 0.06, 24);
    const collar = new Mesh(collarGeo, pinMat);
    collar.position.set(s * 12.7, 0.03, 0);
    spinner.add(collar);
    disposables.push(collarGeo);
  }
  disposables.push(pinGeo, pinMat);

  // Hub under the head (barely visible in the gap to the pan).
  const hubGeo = new CylinderGeometry(5.5, 6.2, 4.5, 48, 1, true);
  const hubMat = new MeshStandardMaterial({ color: 0x1b1b1e, metalness: 0.6, roughness: 0.5 });
  const hub = new Mesh(hubGeo, hubMat);
  hub.position.y = -HEAD_THICK - 2.2;
  root.add(hub);
  disposables.push(hubGeo, hubMat);

  // --- Splash pan -----------------------------------------------------------------------------
  const pan = panProfile();
  const panGeo = new LatheGeometry(pan.points, 160);
  const panTex = makeSplashPanTexture(pan.vInnerWall, pan.vRim);
  const panMat = new MeshStandardMaterial({
    color: 0xffffff,
    map: panTex.color,
    roughnessMap: panTex.orm,
    roughness: 1,
    metalness: 0,
    side: DoubleSide,
    dithering: true,
  });
  const panMesh = new Mesh(panGeo, panMat);
  root.add(panMesh);
  disposables.push(panGeo, panMat, panTex.color, panTex.orm);

  // Baked contact shadow of the head on the pan floor.
  const shadowTex: Texture = makeRadialTexture(256, [
    [0, 0.92],
    [0.55, 0.85],
    [0.72, 0.45],
    [1, 0],
  ]);
  const shadowGeo = new PlaneGeometry(1, 1);
  const shadowMat = new MeshBasicMaterial({
    color: 0x000000,
    alphaMap: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.9,
  });
  const shadow = new Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = PAN_FLOOR_Y + 0.02;
  shadow.scale.set(WHEEL_RADIUS * 2.7, WHEEL_RADIUS * 2.7, 1);
  shadow.renderOrder = -10;
  root.add(shadow);
  disposables.push(shadowGeo, shadowMat, shadowTex);

  return {
    spinner,
    root,
    uniforms,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
