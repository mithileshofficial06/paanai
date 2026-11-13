// Offscreen 3D renders of glazed pots for the UI (shelf, kiln, reveal, starter).
// One small WebGL renderer for the whole app; results are cached PNG data URLs.

import { Color, DirectionalLight, Mesh, Scene, type MeshPhysicalMaterial, type WebGLRenderer } from 'three';
import { decodeProfile } from '../../shared/core/profile';
import type { GlazeLook } from '../app/glazeLook';
import { CameraRig } from './cameraRig';
import { displayFromProfile } from './displayProfile';
import { createStudioEnvironment } from './environment';
import { createGlazeMaterial, setGlazeDecor, setGlazeHeight } from './glazeMaterial';
import { decorTexture } from './decorTexture';
import { type Decor, decorKey, isEmptyDecor } from '../../shared/core/decor';
import { PotGeometry } from './potMesh';
import { createRenderer } from './renderer';

type Ctx = { renderer: WebGLRenderer; scene: Scene; rig: CameraRig; geo: PotGeometry; mesh: Mesh };
let ctx: Ctx | null = null;
let failed = false;
const cache = new Map<string, string>();
const queue: (() => void)[] = [];
let busy = false;

function init(): Ctx | null {
  if (ctx || failed) return ctx;
  try {
    const canvas = document.createElement('canvas');
    const renderer = createRenderer(canvas, { antialias: true, preserve: true });
    renderer.setClearColor(0x000000, 0);
    const env = createStudioEnvironment(renderer);
    const scene = new Scene();
    scene.environment = env.texture;
    const key = new DirectionalLight(new Color(1.0, 0.92, 0.82), 1.6);
    key.position.set(-12, 20, 18);
    const rim = new DirectionalLight(new Color(1.0, 0.2, 0.08), 1.8);
    rim.position.set(10, 6, -18);
    const fill = new DirectionalLight(new Color(0.8, 0.85, 1.0), 0.35);
    fill.position.set(16, 4, 10);
    scene.add(key, rim, fill);
    const geo = new PotGeometry();
    const mesh = new Mesh(geo.geometry);
    scene.add(mesh);
    ctx = { renderer, scene, rig: new CameraRig(), geo, mesh };
  } catch {
    failed = true;
  }
  return ctx;
}

function renderNow(profile: readonly number[], look: GlazeLook, size: number, seed: number, decor: Decor | null): string | null {
  const c = init();
  if (!c) return null;
  const p = decodeProfile(profile);
  const d = displayFromProfile(p);
  c.geo.update(d, { time: 0, reducedMotion: true });
  const mat: MeshPhysicalMaterial = createGlazeMaterial(look, seed);
  setGlazeHeight(mat, d.height);
  const tex = decor && !isEmptyDecor(decor) ? decorTexture(decor, (2 * Math.PI * d.maxOuter()) / Math.max(1, d.height)) : null;
  setGlazeDecor(mat, tex);
  const old = c.mesh.material as MeshPhysicalMaterial | MeshPhysicalMaterial[];
  c.mesh.material = mat;
  if (!Array.isArray(old) && old !== mat && 'dispose' in old) old.dispose();
  c.mesh.rotation.y = (seed % 360) * (Math.PI / 180);
  c.renderer.setPixelRatio(1);
  c.renderer.setSize(size, size, false);
  c.rig.setViewport(size, size);
  c.rig.update(0, d.height, d.maxOuter(), false, true, 0);
  c.rig.camera.zoom = 1.85;
  c.rig.camera.updateProjectionMatrix();
  c.renderer.render(c.scene, c.rig.camera);
  tex?.dispose();
  return c.renderer.domElement.toDataURL('image/png');
}

/** Render (or fetch from cache) a pot image. Resolves null if WebGL is unavailable. */
export function renderPotImage(key: string, profile: readonly number[], look: GlazeLook, size = 256, seed = 1, decor: Decor | null = null): Promise<string | null> {
  const k = `${key}|${size}|${decorKey(decor)}`;
  const hit = cache.get(k);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    queue.push(() => {
      const url = renderNow(profile, look, size, seed, decor);
      if (url) cache.set(k, url);
      resolve(url);
    });
    pump();
  });
}

function pump(): void {
  if (busy) return;
  busy = true;
  const next = (): void => {
    const job = queue.shift();
    if (!job) {
      busy = false;
      return;
    }
    job();
    // One render per frame keeps scrolling smooth.
    requestAnimationFrame(next);
  };
  requestAnimationFrame(next);
}
