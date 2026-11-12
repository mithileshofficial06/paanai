// Procedural studio environment for image-based lighting, baked once with PMREMGenerator.
// A near-black room with a few emissive softboxes: a large warm key (upper left, in front), a cool
// fill (right), two red strip lights behind the wheel (the brand rim) and a faint overhead panel.
// These panels are what the wet clay and the wheel head reflect, so they read as real studio
// highlights rather than a generic grey room. Zero bytes on the wire.

import {
  BackSide,
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  type Texture,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';

type Panel = { color: [number, number, number]; power: number; pos: [number, number, number]; size: [number, number] };

const PANELS: Panel[] = [
  // Key softbox: big, warm, upper left in front of the wheel.
  { color: [1.0, 0.84, 0.68], power: 7.5, pos: [-13, 13, 11], size: [11, 8] },
  // Small hot kicker next to the key for a crisp specular glint on the wet clay.
  { color: [1.0, 0.9, 0.8], power: 14, pos: [-6, 15, 13], size: [2.2, 1.4] },
  // Cool fill, right side, low.
  { color: [0.55, 0.66, 1.0], power: 1.1, pos: [17, 5, 7], size: [7, 9] },
  // Red rim strips behind.
  { color: [1.0, 0.1, 0.04], power: 9, pos: [-10, 7, -16], size: [1.6, 13] },
  { color: [1.0, 0.16, 0.05], power: 6.5, pos: [12, 6, -15], size: [1.4, 11] },
  // Ember bounce low behind the wheel.
  { color: [1.0, 0.22, 0.06], power: 1.2, pos: [0, -2, -14], size: [16, 3] },
  // Faint warm overhead.
  { color: [1.0, 0.88, 0.76], power: 0.55, pos: [0, 20, 0], size: [14, 14] },
];

export type StudioEnvironment = { texture: Texture; dispose: () => void };

export function createStudioEnvironment(renderer: WebGLRenderer): StudioEnvironment {
  const scene = new Scene();
  const disposables: { dispose: () => void }[] = [];

  // The room: almost black, slightly warm, so dark reflections are not dead flat.
  const roomGeo = new BoxGeometry(60, 44, 60);
  const roomMat = new MeshBasicMaterial({ color: new Color(0.012, 0.009, 0.009), side: BackSide });
  const room = new Mesh(roomGeo, roomMat);
  room.position.y = 10;
  scene.add(room);
  disposables.push(roomGeo, roomMat);

  // A dark floor plane a little below the wheel so the lower hemisphere is not pure black.
  const floorGeo = new PlaneGeometry(60, 60);
  const floorMat = new MeshBasicMaterial({ color: new Color(0.02, 0.012, 0.011) });
  const floor = new Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -8;
  scene.add(floor);
  disposables.push(floorGeo, floorMat);

  const panelGeo = new PlaneGeometry(1, 1);
  disposables.push(panelGeo);
  for (const p of PANELS) {
    const c = new Color(p.color[0] * p.power, p.color[1] * p.power, p.color[2] * p.power);
    const mat = new MeshBasicMaterial({ color: c });
    const m = new Mesh(panelGeo, mat);
    m.position.set(p.pos[0], p.pos[1], p.pos[2]);
    m.scale.set(p.size[0], p.size[1], 1);
    // PlaneGeometry faces +Z and Object3D.lookAt aims +Z at the target: the lit face looks at the wheel.
    m.lookAt(0, 2, 0);
    scene.add(m);
    disposables.push(mat);
  }

  const pmrem = new PMREMGenerator(renderer);
  const rt: WebGLRenderTarget = pmrem.fromScene(scene, 0.035, 0.1, 200);
  pmrem.dispose();
  for (const d of disposables) d.dispose();

  return {
    texture: rt.texture,
    dispose: () => rt.dispose(),
  };
}
