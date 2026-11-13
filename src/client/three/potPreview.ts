// Live, slowly turning 3D pot for the decorating table. Drag to spin it; heightAt() maps a tap
// on the canvas to a height on the pot (0 = foot, 1 = rim) so paint lands where you tap.
import { Color, DirectionalLight, Mesh, Scene, Vector3, type MeshPhysicalMaterial, type Texture, type WebGLRenderer } from 'three';
import { decodeProfile } from '../../shared/core/profile';
import { type Decor, isEmptyDecor } from '../../shared/core/decor';
import type { GlazeLook } from '../app/glazeLook';
import { CameraRig } from './cameraRig';
import { displayFromProfile } from './displayProfile';
import { createStudioEnvironment } from './environment';
import { createGlazeMaterial, setGlazeDecor, setGlazeHeight } from './glazeMaterial';
import { decorTexture } from './decorTexture';
import { PotGeometry } from './potMesh';
import { createRenderer } from './renderer';

export type PotPreview = {
  setDecor(d: Decor | null): void;
  /** Height fraction (0 foot .. 1 rim) under a screen y, or null if off the pot. */
  heightAt(clientY: number): number | null;
  /** PNG of the pot as it looks now (for the result card). */
  snapshot(): string | null;
  dispose(): void;
};

export function createPotPreview(canvas: HTMLCanvasElement, profile: readonly number[], look: GlazeLook, reducedMotion: boolean): PotPreview | null {
  let renderer: WebGLRenderer;
  try {
    renderer = createRenderer(canvas, { antialias: true, preserve: true });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  const env = createStudioEnvironment(renderer);
  const scene = new Scene();
  scene.environment = env.texture;
  const key = new DirectionalLight(new Color(1.0, 0.92, 0.82), 1.6);
  key.position.set(-12, 20, 18);
  const rim = new DirectionalLight(new Color(1.0, 0.25, 0.1), 1.4);
  rim.position.set(10, 6, -18);
  const fill = new DirectionalLight(new Color(0.8, 0.85, 1.0), 0.45);
  fill.position.set(16, 4, 10);
  scene.add(key, rim, fill);

  const disp = displayFromProfile(decodeProfile(profile));
  const geo = new PotGeometry();
  geo.update(disp, { time: 0, reducedMotion: true });
  const mat: MeshPhysicalMaterial = createGlazeMaterial(look, 7);
  setGlazeHeight(mat, disp.height);
  const mesh = new Mesh(geo.geometry, mat);
  scene.add(mesh);
  const rig = new CameraRig();
  const aspect = (2 * Math.PI * disp.maxOuter()) / Math.max(1, disp.height);
  let tex: Texture | null = null;

  let w = 0;
  let h = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    const nw = Math.max(1, Math.round(r.width));
    const nh = Math.max(1, Math.round(r.height));
    if (nw === w && nh === h) return;
    w = nw;
    h = nh;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    rig.setViewport(w, h);
    rig.update(0, disp.height, disp.maxOuter(), false, true, 0);
    rig.camera.zoom = 1.25;
    rig.camera.updateProjectionMatrix();
  }

  // Spin: slow by itself; drag sideways to turn it by hand.
  let spin = 0.5;
  let drag: { x: number; t: number } | null = null;
  const onDown = (e: PointerEvent) => {
    drag = { x: e.clientX, t: performance.now() };
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    mesh.rotation.y += dx * 0.012;
    const dt = Math.max(1, performance.now() - drag.t);
    spin = Math.max(-4, Math.min(4, (dx * 0.012 * 1000) / dt));
    drag = { x: e.clientX, t: performance.now() };
  };
  const onUp = () => {
    drag = null;
  };
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  let raf = 0;
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    resize();
    if (!drag && !reducedMotion) {
      mesh.rotation.y += spin * dt;
      spin += (0.5 - spin) * Math.min(1, dt * 1.5);
    }
    renderer.render(scene, rig.camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  const tmp = new Vector3();
  function screenY(yCm: number): number {
    tmp.set(0, yCm, 0);
    mesh.localToWorld(tmp);
    tmp.project(rig.camera);
    const r = canvas.getBoundingClientRect();
    return r.top + ((1 - tmp.y) / 2) * r.height;
  }

  return {
    setDecor(d) {
      tex?.dispose();
      tex = d && !isEmptyDecor(d) ? decorTexture(d, aspect) : null;
      setGlazeDecor(mat, tex);
    },
    heightAt(clientY) {
      const foot = screenY(0);
      const top = screenY(disp.height);
      const f = (foot - clientY) / Math.max(1, foot - top);
      return f < -0.05 || f > 1.08 ? null : Math.max(0.02, Math.min(0.98, f));
    },
    snapshot() {
      renderer.render(scene, rig.camera);
      return canvas.toDataURL('image/png');
    },
    dispose() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      tex?.dispose();
      mat.dispose();
      geo.dispose();
      env.dispose();
      renderer.dispose();
    },
  };
}
