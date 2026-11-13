// The potter's corner behind the wheel: a worn wooden bench with a water bowl, a sponge and a
// wooden rib, and a soft-focus studio wall with shelves of drying pots. Purely cosmetic.
import {
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  type Texture,
} from 'three';

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) return null;
  draw(g);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Seeded noise so the props look the same every visit. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Old oak with clay smears. */
function woodTexture(): Texture | null {
  return canvasTex(512, 256, (g) => {
    const r = rng(11);
    g.fillStyle = '#4a2c1c';
    g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 140; i++) {
      const y = r() * 256;
      g.strokeStyle = `rgba(${20 + r() * 30}, ${10 + r() * 14}, 6, ${0.12 + r() * 0.22})`;
      g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.012 + i) * (2 + r() * 4));
      g.stroke();
    }
    // Plank joints.
    g.fillStyle = 'rgba(10, 5, 3, 0.7)';
    for (const y of [84, 170]) g.fillRect(0, y, 512, 2);
    // Dried slip smears.
    for (let i = 0; i < 9; i++) {
      g.fillStyle = `rgba(180, 130, 100, ${0.08 + r() * 0.12})`;
      g.beginPath();
      g.ellipse(r() * 512, r() * 256, 10 + r() * 40, 4 + r() * 10, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** The studio wall, already out of focus: lime plaster, a lamp pool, shelves of drying pots. */
function wallTexture(): Texture | null {
  return canvasTex(1024, 512, (g) => {
    const r = rng(23);
    const bg = g.createLinearGradient(0, 0, 0, 512);
    bg.addColorStop(0, '#120807');
    bg.addColorStop(0.6, '#1d0e0b');
    bg.addColorStop(1, '#0d0605');
    g.fillStyle = bg;
    g.fillRect(0, 0, 1024, 512);
    const lamp = g.createRadialGradient(300, 120, 10, 300, 120, 420);
    lamp.addColorStop(0, 'rgba(255, 170, 90, 0.32)');
    lamp.addColorStop(1, 'rgba(255, 120, 60, 0)');
    g.fillStyle = lamp;
    g.fillRect(0, 0, 1024, 512);
    g.filter = 'blur(7px)';
    // Two shelves of bisque and glazed pots.
    for (const sy of [190, 340]) {
      g.fillStyle = 'rgba(70, 40, 26, 0.9)';
      g.fillRect(60, sy, 904, 12);
      let x = 90;
      while (x < 940) {
        const w = 26 + r() * 46;
        const h = 30 + r() * 60;
        const hue = r();
        g.fillStyle = hue < 0.5 ? `rgba(${150 + r() * 50}, ${95 + r() * 40}, ${70 + r() * 30}, 0.75)` : hue < 0.7 ? 'rgba(70, 95, 110, 0.7)' : hue < 0.85 ? 'rgba(120, 40, 30, 0.75)' : 'rgba(220, 210, 190, 0.6)';
        g.beginPath();
        g.moveTo(x, sy);
        g.bezierCurveTo(x - w * 0.15, sy - h * 0.5, x + w * 0.05, sy - h, x + w * 0.3, sy - h);
        g.lineTo(x + w * 0.7, sy - h);
        g.bezierCurveTo(x + w * 0.95, sy - h, x + w * 1.15, sy - h * 0.5, x + w, sy);
        g.closePath();
        g.fill();
        x += w + 10 + r() * 30;
      }
    }
    g.filter = 'none';
    // Vignette.
    const v = g.createRadialGradient(512, 256, 120, 512, 256, 620);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.75)');
    g.fillStyle = v;
    g.fillRect(0, 0, 1024, 512);
  });
}

export type StudioProps = { root: Group; dispose(): void };

export function createStudioProps(): StudioProps {
  const root = new Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => (disposables.push(x), x);

  // Back wall (soft focus).
  const wallTex = wallTexture();
  if (wallTex) keep(wallTex);
  const wall = new Mesh(keep(new PlaneGeometry(150, 75)), keep(new MeshBasicMaterial({ map: wallTex, color: 0xb0a0a0, depthWrite: false })));
  wall.position.set(0, 14, -62);
  wall.renderOrder = -30;
  root.add(wall);

  // Bench behind the wheel.
  const woodTex = woodTexture();
  if (woodTex) {
    keep(woodTex);
    woodTex.wrapS = woodTex.wrapT = RepeatWrapping;
    woodTex.repeat.set(2, 1);
  }
  const bench = new Mesh(keep(new PlaneGeometry(110, 26)), keep(new MeshStandardMaterial({ map: woodTex, color: 0xd8c0b0, roughness: 0.78, metalness: 0 })));
  bench.rotation.x = -Math.PI / 2;
  bench.position.set(0, -2.4, -36);
  root.add(bench);
  const lip = new Mesh(keep(new PlaneGeometry(110, 3.2)), keep(new MeshStandardMaterial({ map: woodTex, color: 0x9a8070, roughness: 0.85 })));
  lip.position.set(0, -4, -23);
  root.add(lip);

  // Water bowl: glazed outside, raw foot, water inside.
  const bowlPts: Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    bowlPts.push(new Vector2(2.2 + Math.sin(t * Math.PI * 0.5) * 3.6, t * 3.6));
  }
  for (let i = 16; i >= 0; i--) {
    const t = i / 16;
    bowlPts.push(new Vector2(Math.max(0.01, 1.8 + Math.sin(t * Math.PI * 0.5) * 3.4), 0.35 + t * 3.15));
  }
  const bowl = new Mesh(
    keep(new LatheGeometry(bowlPts, 48)),
    keep(new MeshPhysicalMaterial({ color: new Color('#2f4f5c'), roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2, side: DoubleSide })),
  );
  bowl.position.set(-10.5, -2.4, -37);
  root.add(bowl);
  const water = new Mesh(
    keep(new CylinderGeometry(4.9, 4.9, 0.05, 40)),
    keep(new MeshPhysicalMaterial({ color: new Color('#3a2a22'), roughness: 0.04, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.88 })),
  );
  water.position.set(-10.5, -2.4 + 2.9, -37);
  root.add(water);

  // Sponge: squashed, porous-looking.
  const sponge = new Mesh(keep(new SphereGeometry(2.2, 18, 12)), keep(new MeshStandardMaterial({ color: new Color('#c99a52'), roughness: 1 })));
  sponge.scale.set(1.35, 0.55, 0.95);
  sponge.position.set(-3.5, -1.4, -36);
  sponge.rotation.y = 0.5;
  root.add(sponge);

  // Wooden rib (a kidney-shaped shaping tool).
  const rib = new Shape();
  rib.moveTo(-3, 0);
  rib.bezierCurveTo(-3, 1.8, -1, 2.2, 0, 1.4);
  rib.bezierCurveTo(1, 2.2, 3, 1.8, 3, 0);
  rib.bezierCurveTo(3, -1.6, -3, -1.6, -3, 0);
  const ribMesh = new Mesh(keep(new ExtrudeGeometry(rib, { depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.06, bevelSegments: 2 })), keep(new MeshStandardMaterial({ color: new Color('#a66d3c'), roughness: 0.6 })));
  ribMesh.rotation.set(-Math.PI / 2, 0, 0.4);
  ribMesh.position.set(7, -2.3, -35);
  root.add(ribMesh);

  // A finished pot drying on the bench.
  const dryPts: Vector2[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    dryPts.push(new Vector2(1.6 + Math.sin(t * Math.PI) * 1.9 - t * 0.6, t * 6.5));
  }
  const dry = new Mesh(keep(new LatheGeometry(dryPts, 40)), keep(new MeshStandardMaterial({ color: new Color('#b98a6a'), roughness: 0.95, side: DoubleSide })));
  dry.position.set(13, -2.4, -40);
  root.add(dry);

  return {
    root,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
