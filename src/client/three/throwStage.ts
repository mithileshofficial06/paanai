// The throw: wheel, wet clay, fingers, and the fixed-rate deterministic simulation.
//
// Determinism contract: the sim runs at exactly 30 Hz from an accumulator. From the first touch,
// every tick calls recorder.record(inputOrNull) and then step() or idle(), exactly like replay().
// Everything else here (wetness sheen, finger lag, marks, particles, centering wobble, wheel speed,
// haptics, sound) is cosmetic and never feeds back into the core, except one thing: dryness scales
// the finger's dr BEFORE it is quantised and recorded, so the recorded log still replays exactly.

import {
  AdditiveBlending,
  MeshBasicMaterial,
  FrontSide,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshPhysicalMaterial,
  Points,
  PointsMaterial,
  Scene,
  Sprite,
  SpriteMaterial,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { MAX_TICKS, RINGS, TICK_HZ } from '../../shared/core/fixed';
import { capacityMl, createLump, maxOuter, minWall, type Profile } from '../../shared/core/profile';
import { idle, replay, step, type StrokeLog } from '../../shared/core/shape';
import { StrokeRecorder } from '../../shared/core/strokes';
import { silhouetteMatch } from '../../shared/core/score';
import { PointerMapper, type PotScreenFrame, type ThrowToolId } from '../input/pointerMapper';
import { sfx } from '../app/audio';
import { CameraRig } from './cameraRig';
import { createClayMaterial, MARK_ROWS, type ClayUniforms } from './clayMaterial';
import { DisplayProfile, displayFromProfile } from './displayProfile';
import { createStudioEnvironment, type StudioEnvironment } from './environment';
import { ContactMarker, OpenRing, TargetOutline } from './overlays';
import { PotGeometry } from './potMesh';
import { createRenderer, QualityScaler } from './renderer';
import { makeRadialTexture } from './textures';
import { createWheel, type Wheel } from './wheel';

export type ThrowState = {
  heightMm: number;
  capacityMl: number;
  minWallMm: number;
  maxDiameterMm: number;
  opened: boolean;
  unsafe: boolean;
  wobble: number;
  slumped: boolean;
  strokes: number;
  ticks: number;
  secondsLeft: number;
  matchPreview: number | null;
  wetness: number;
  phase: 'centering' | 'throwing';
};

export type ThrowEvent = 'centred' | 'opened' | 'wobble-start' | 'slumped' | 'stroke-start' | 'stroke-end' | 'limit' | 'water';

export type ThrowStageOptions = {
  canvas: HTMLCanvasElement;
  target?: Profile | null;
  reducedMotion?: boolean;
  /** Skip the centering intro (e.g. replays, second throws). */
  skipCentering?: boolean;
  onChange?: (s: ThrowState) => void;
  onEvent?: (e: ThrowEvent) => void;
};

export type ThrowStage = {
  setTool(t: ThrowToolId): void;
  open(): void;
  addWater(): void;
  skipCentering(): void;
  /** Put an untouched lump back off-centre (used by the guided tour before it demonstrates centring). */
  recenter(): void;
  undo(): boolean;
  reset(): void;
  finish(): StrokeLog;
  getProfile(): Profile;
  setInputEnabled(on: boolean): void;
  setPaused(p: boolean): void;
  setTarget(p: Profile | null): void;
  /** Show the commissioner's throw forming alongside yours (null hides it). Replays from your first touch. */
  setGhost(log: StrokeLog | null): void;
  renderThumbnail(p: Profile, size: number): Promise<string>;
  /** Where the pot is on screen (CSS px), for hint placement and tests. */
  getScreenFrame(): PotScreenFrame;
  dispose(): void;
};

const TICK = 1 / TICK_HZ;
/** Seconds of active shaping that take clay from soaking wet to dry. */
const DRY_SHAPING_S = 38;
/** Seconds of idling that take clay from wet to dry. */
const DRY_IDLE_S = 150;
const PARTICLES = 160;

const hasVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
function buzz(p: number | number[]): void {
  if (!hasVibrate) return;
  try {
    navigator.vibrate(p);
  } catch {
    /* blocked */
  }
}

/** Window key light, warm fill, and the red brand rim light from behind. */
function addLights(scene: Scene): void {
  const key = new DirectionalLight(new Color(1.0, 0.9, 0.78), 1.15);
  key.position.set(-14, 22, 16);
  const fill = new DirectionalLight(new Color(1.0, 0.62, 0.42), 0.25);
  fill.position.set(16, 6, 12);
  const rim = new DirectionalLight(new Color(1.0, 0.12, 0.05), 2.2);
  rim.position.set(9, 4, -20);
  const rim2 = new DirectionalLight(new Color(1.0, 0.2, 0.06), 1.2);
  rim2.position.set(-12, 3, -16);
  scene.add(key, fill, rim, rim2);
}

export function createThrowStage(opts: ThrowStageOptions): ThrowStage {
  const canvas = opts.canvas;
  const reduced = !!opts.reducedMotion;
  const renderer: WebGLRenderer = createRenderer(canvas, { antialias: true });
  renderer.setClearColor(0x000000, 0); // the page's black-red glass background shows through
  const env: StudioEnvironment = createStudioEnvironment(renderer);
  const scene = new Scene();
  scene.environment = env.texture;
  addLights(scene);

  const rig = new CameraRig();
  const glow: Texture = makeRadialTexture(128, [
    [0, 1],
    [0.35, 0.5],
    [1, 0],
  ]);

  // Ember glow behind the wheel.
  const emberMat = new SpriteMaterial({ map: glow, color: 0xff2a0c, blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.32 });
  const ember = new Sprite(emberMat);
  ember.position.set(0, 6, -34);
  ember.scale.set(90, 60, 1);
  ember.renderOrder = -20;
  scene.add(ember);

  const wheel: Wheel = createWheel();
  scene.add(wheel.root, wheel.spinner);

  // The pot. It sits in the wheel's spinner so every object-space pattern turns with the wheel.
  const potGeo = new PotGeometry();
  const clay = createClayMaterial({ wet: 1 });
  const u: ClayUniforms = clay.uniforms;
  const pot = new Mesh(potGeo.geometry, clay.material);
  wheel.spinner.add(pot);

  // Overlays (world space; the pot is rotationally symmetric so they do not need to spin).
  const targetOutline = new TargetOutline();
  const contact = new ContactMarker(glow);
  const openRing = new OpenRing(glow);
  for (const m of [...targetOutline.meshes, ...contact.meshes, ...openRing.meshes]) scene.add(m);

  // Fingertips: outer finger presses the wall, inner finger appears for a pull.
  const skin = new MeshPhysicalMaterial({
    color: new Color('#b98169'),
    roughness: 0.42,
    clearcoat: 0.7,
    clearcoatRoughness: 0.25,
    sheen: 0.6,
    sheenColor: new Color('#ff9a7a'),
    transparent: true,
    opacity: 0,
  });
  const fingerGeo = new CapsuleGeometry(0.78, 3.2, 6, 14);
  const fingerOut = new Mesh(fingerGeo, skin);
  const fingerIn = new Mesh(fingerGeo, skin);
  scene.add(fingerOut, fingerIn);

  // Slip droplets flung off the wheel.
  const pPos = new Float32Array(PARTICLES * 3);
  const pVel = new Float32Array(PARTICLES * 3);
  const pLife = new Float32Array(PARTICLES);
  const pGeo = new BufferGeometry();
  pGeo.setAttribute('position', new BufferAttribute(pPos, 3));
  const pMat = new PointsMaterial({ color: new Color('#8d5a44'), size: 0.32, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false });
  const particles = new Points(pGeo, pMat);
  particles.frustumCulled = false;
  scene.add(particles);
  let pNext = 0;
  for (let i = 0; i < PARTICLES; i++) pPos[i * 3 + 1] = -100;

  // Ghost: the commissioner's own throw, replayed tick for tick from the player's first touch.
  const ghostGeo = new PotGeometry();
  const ghostMat = new MeshBasicMaterial({ color: 0xff6a3a, transparent: true, opacity: 0.16, depthWrite: false, side: FrontSide, blending: AdditiveBlending });
  const ghostMesh = new Mesh(ghostGeo.geometry, ghostMat);
  ghostMesh.visible = false;
  ghostMesh.renderOrder = 5;
  scene.add(ghostMesh);
  let ghost: { log: StrokeLog; p: Profile; d: DisplayProfile; i: number; t: number; wait: number } | null = null;
  function ghostTick(): void {
    const g = ghost;
    if (!g) return;
    g.t++;
    const e = g.log.entries[g.i];
    if (!e) {
      idle(g.p);
      return;
    }
    if (g.wait <= 1) {
      step(g.p, e);
      g.i++;
      g.wait = g.log.entries[g.i]?.dt ?? 0;
    } else {
      idle(g.p);
      g.wait--;
    }
    g.d.setTarget(g.p);
  }

  // ---- Simulation state ----
  let profile: Profile = createLump();
  let recorder = new StrokeRecorder();
  let started = false;
  let strokes = 0;
  let tool: ThrowToolId = 'hands';
  let inputEnabled = true;
  let paused = false;
  let target: Profile | null = opts.target ?? null;
  let match: number | null = null;
  let matchDirty = true;
  let limitHit = false;
  let wasWobbling = false;
  let wasOpened = false;
  let wasSlumped = false;
  let wasUnsafe = false;
  let inStroke = false;

  // ---- Cosmetic state ----
  const display: DisplayProfile = displayFromProfile(profile);
  let phase: 'centering' | 'throwing' = opts.skipCentering || reduced ? 'throwing' : 'centering';
  let centerWobble = phase === 'centering' ? 1 : 0;
  let centerAge = 0;
  let wet = 1;
  let wheelSpeed = 0.35;
  let wheelAngle = 0;
  const marks = u.uMarks.value.image.data as Float32Array;
  let marksDirty = false;
  let lastMarksUpload = 0;
  let fingerY = 0;
  let fingerR = 0;
  let fingerA = 0;
  let fingerSide = 1;
  let fingerThin = false;
  let lastContact: { ring: number; side: number; strength: number; thin: boolean } | null = null;
  let lastSquelch = 0;
  let lastBuzz = 0;
  let time = 0;

  const mapper = new PointerMapper(canvas);
  mapper.onRelease = () => {
    if (inStroke) {
      inStroke = false;
      recorder.endStroke();
      opts.onEvent?.('stroke-end');
    }
  };
  const frame: PotScreenFrame = { axisX: 0, baseY: 0, rimY: 0, topY: 0, pxPerUnit: 1, topRadiusPx: 1, maxRadiusPx: 1 };

  targetOutline.setTarget(target);
  display.setTarget(profile);
  if (target) u.uRidgeAmp.value = 0.022;

  // ---- Sizing ----
  const scaler = new QualityScaler(Math.min(window.devicePixelRatio || 1, 2));
  let cssW = 1;
  let cssH = 1;
  function resize(): void {
    const r = canvas.getBoundingClientRect();
    cssW = Math.max(1, Math.round(r.width));
    cssH = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(scaler.dpr);
    renderer.setSize(cssW, cssH, false);
    rig.setViewport(cssW, cssH);
    const dpr = scaler.dpr;
    targetOutline.setResolution(cssW, cssH, dpr);
    contact.setResolution(cssW, cssH, dpr);
    openRing.setResolution(cssW, cssH, dpr);
    scaler.restart();
  }
  scaler.onChange = () => resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // ---- State reporting ----
  let lastEmit = 0;
  let lastKey = '';
  function state(): ThrowState {
    const ticks = recorder.tick;
    return {
      heightMm: Math.round(profile.height / 10),
      capacityMl: capacityMl(profile),
      minWallMm: profile.opened ? Math.round(minWall(profile)) / 10 : 0,
      maxDiameterMm: Math.round((maxOuter(profile) * 2) / 10),
      opened: profile.opened,
      unsafe: profile.unsafe,
      wobble: profile.wobble,
      slumped: profile.slumped,
      strokes,
      ticks,
      secondsLeft: Math.max(0, Math.ceil((MAX_TICKS - ticks) / TICK_HZ)),
      matchPreview: match,
      wetness: Math.round(wet * 100) / 100,
      phase,
    };
  }
  function emit(force: boolean): void {
    if (!opts.onChange) return;
    const now = performance.now();
    if (!force && now - lastEmit < 100) return;
    const s = state();
    const key = `${s.heightMm}|${s.capacityMl}|${s.minWallMm}|${s.maxDiameterMm}|${s.opened}|${s.unsafe}|${s.wobble}|${s.slumped}|${s.strokes}|${s.secondsLeft}|${s.matchPreview}|${Math.round(wet * 20)}|${s.phase}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    lastEmit = now;
    opts.onChange(s);
  }

  function afterProfileChange(): void {
    display.setTarget(profile);
    matchDirty = true;
    if (profile.opened && !wasOpened) {
      opts.onEvent?.('opened');
      sfx.thump();
      buzz(35);
    }
    if (profile.wobble > 0 && !wasWobbling) opts.onEvent?.('wobble-start');
    if (profile.unsafe && !wasUnsafe) buzz([25, 40, 25]);
    if (profile.slumped && !wasSlumped) {
      opts.onEvent?.('slumped');
      sfx.flop();
      rig.kick(1);
      buzz([60, 30, 90]);
    }
    wasOpened = profile.opened;
    wasWobbling = profile.wobble > 0;
    wasUnsafe = profile.unsafe;
    wasSlumped = profile.slumped;
  }

  // ---- One fixed 30 Hz tick ----
  function tick(): void {
    const canRecord = inputEnabled && !recorder.full && !profile.slumped && phase === 'throwing';
    const s = mapper.sample(frame, {
      opened: profile.opened,
      slumped: profile.slumped,
      tool,
      canRecord,
      resistance: 0.45 + 0.55 * wet,
    });
    if (s.needsOpen) openRing.nudge();
    const input = canRecord ? s.input : null;
    if (input && !started) started = true;
    if (!started) {
      lastContact = null;
      return;
    }
    if (recorder.full) {
      if (!limitHit) {
        limitHit = true;
        opts.onEvent?.('limit');
        mapper.cancel();
      }
      return;
    }
    const entry = recorder.record(input);
    if (entry) {
      if (entry.start && input && input.mode !== 2) {
        strokes++;
        inStroke = true;
        opts.onEvent?.('stroke-start');
      }
      step(profile, entry);
    } else {
      idle(profile);
    }
    ghostTick();
    // Wetness (cosmetic + resistance for future input only).
    wet = Math.max(0, wet - TICK / (s.contact ? DRY_SHAPING_S : DRY_IDLE_S));
    if (s.contact) {
      lastContact = { ring: s.contact.ring, side: s.contact.side, strength: s.contact.strength, thin: s.contact.mode === 1 };
    } else lastContact = null;
    afterProfileChange();
  }

  // ---- Render loop ----
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  function frameLoop(now: number): void {
    raf = requestAnimationFrame(frameLoop);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    if (paused) return;
    time += dt;
    scaler.sample(dt);

    // Where the pot is on screen (input mapping uses the same frame the player sees).
    rig.potFrame(display, frame);

    // Centering intro: an off-centre lump that the player holds steady.
    if (phase === 'centering') {
      centerAge += dt;
      const holding = mapper.pressed;
      centerWobble *= Math.exp(-dt * (holding ? 2.6 : 0.15));
      if (holding && Math.random() < dt * 12) sfx.squelch(0.35);
      if (holding && now - lastBuzz > 120) {
        buzz(8);
        lastBuzz = now;
      }
      if (centerWobble < 0.06) finishCentering(true);
    }

    // Fixed-rate simulation.
    acc += dt;
    let n = 0;
    while (acc >= TICK && n < 8) {
      acc -= TICK;
      n++;
      tick();
    }
    if (n === 8) acc = 0;

    // Wheel: speeds up while the hands are on the clay, coasts down after.
    const wantSpeed = mapper.pressed ? 1 : started ? 0.55 : 0.4;
    wheelSpeed += (wantSpeed - wheelSpeed) * (1 - Math.exp(-dt / (mapper.pressed ? 0.6 : 1.8)));
    wheelAngle += dt * Math.PI * 2 * (0.55 + 1.5 * wheelSpeed) * (reduced ? 0.4 : 1);
    wheel.spinner.rotation.y = wheelAngle;

    // Centering offset (the lump runs off-axis until centred).
    const cw = centerWobble * (0.9 + 0.1 * Math.sin(time * 9));
    pot.position.set(cw * 0.75, 0, cw * 0.25);
    pot.rotation.z = cw * 0.05;

    // Finger: lags the contact point (spring-damper feel).
    const H = Math.max(0.5, display.height);
    const c = lastContact;
    const fingerTarget = c && mapper.shaping ? 1 : 0;
    fingerA += (fingerTarget - fingerA) * (1 - Math.exp(-dt / (fingerTarget ? 0.06 : 0.16)));
    if (c) {
      const y = ((c.ring + 0.5) / RINGS) * H;
      const k = 1 - Math.exp(-dt / 0.07);
      fingerY += (y - fingerY) * k;
      fingerR += (display.outerAt(fingerY) - fingerR) * k;
      fingerSide = c.side;
      fingerThin = c.thin;
      // Your marks: deepen the throwing rings where the finger passed.
      const row = Math.max(0, Math.min(MARK_ROWS - 1, Math.round((fingerY / H) * (MARK_ROWS - 1))));
      for (let d = -3; d <= 3; d++) {
        const r = row + d;
        if (r < 0 || r >= MARK_ROWS) continue;
        const w = Math.exp(-(d * d) / 3) * (0.25 + c.strength) * dt * 2.2;
        marks[r] = Math.min(1, (marks[r] ?? 0) + w);
      }
      marksDirty = true;
      // Sound, haptics, slip spray.
      if (c.strength > 0.08 && now - lastSquelch > 110) {
        sfx.squelch(c.strength);
        lastSquelch = now;
      }
      if (c.strength > 0.2 && now - lastBuzz > 90) {
        buzz(Math.round(6 + 16 * c.strength));
        lastBuzz = now;
      }
      if (!reduced && c.strength > 0.25 && wet > 0.15) {
        const count = Math.random() < c.strength * wet ? 2 : 0;
        for (let i = 0; i < count; i++) spawnDrop(fingerSide * fingerR, fingerY, c.strength);
      }
    }
    // Marks relax slowly (the clay keeps them, but fresh water softens them).
    if (marksDirty && now - lastMarksUpload > 70) {
      for (let r = 0; r < MARK_ROWS; r++) marks[r] = (marks[r] ?? 0) * Math.exp(-dt * 0.01);
      u.uMarks.value.needsUpdate = true;
      lastMarksUpload = now;
      marksDirty = false;
    }

    const fa = fingerA * (reduced ? 0.9 : 1);
    skin.opacity = Math.min(1, fa * 1.4);
    fingerOut.visible = fa > 0.02;
    const press = 0.55 * (c?.strength ?? 0);
    // The finger meets the wall a little in front of the silhouette so it reads clearly.
    const fa0 = fingerSide > 0 ? 0.55 : Math.PI - 0.55;
    const fr = fingerR + 2.38 - press;
    fingerOut.position.set(Math.cos(fa0) * fr, fingerY + 0.6, Math.sin(fa0) * fr);
    fingerOut.rotation.set(0, -fa0, Math.PI / 2 - 0.28, 'YXZ');
    const rIn = display.innerAt(fingerY);
    fingerIn.visible = fa > 0.02 && fingerThin && rIn > 1.2;
    fingerIn.position.set(fingerSide * Math.max(0.2, rIn - 0.78 - 1.2), fingerY + 0.9, -0.2);
    fingerIn.rotation.set(0, 0, fingerSide * (Math.PI / 2 + 0.55));

    updateParticles(dt);

    // Display shape, clay look, wheel.
    if (display.update(dt, reduced) || display.dirty || centerWobble > 0) {
      potGeo.update(display, { time, reducedMotion: reduced });
      display.dirty = false;
    }
    u.uTime.value = time;
    u.uWet.value = 0.22 + 0.78 * wet;
    u.uSlip.value = 0.35 + 0.65 * wet;
    u.uContact.value = fa * (0.4 + 0.6 * (c?.strength ?? 0));
    u.uContactY.value = fingerY;
    u.uMarkH.value = H;
    u.uFloorY.value = display.floorY;
    u.uFloorR.value = display.innerAt(display.floorY + 0.05);
    u.uPuddle.value = display.opened ? 0.35 + 0.65 * wet : 0;
    wheel.uniforms.uBaseR.value = display.outerAt(0);
    wheel.uniforms.uOpenT.value = display.openT;
    wheel.uniforms.uSlurry.value = 0.35 + 0.65 * wet;

    // Overlays.
    const pxPerCm = rig.pxPerCmAt(0, H * 0.5, 0);
    contact.update(dt, fa > 0.02, fingerY, fingerR, rIn, fingerSide, (c?.strength ?? 0) * 0.6, fingerThin, pxPerCm);
    openRing.update(dt, time, phase === 'throwing' && !profile.opened && !profile.slumped && !mapper.pressed, H, display.outerAt(H), pxPerCm, reduced);
    if (target && matchDirty && recorder.tick % 15 === 0) {
      match = silhouetteMatch(profile, target);
      matchDirty = false;
      targetOutline.setIntensity(match);
    }

    if (ghost) {
      ghostMesh.visible = started;
      if (ghost.d.update(dt, reduced) || ghost.d.dirty) {
        ghostGeo.update(ghost.d, { time, reducedMotion: true });
        ghost.d.dirty = false;
      }
      ghostMesh.rotation.y = wheelAngle * 0.98;
    }
    rig.update(dt, display.height, display.maxOuter(), mapper.pressed, false, time);
    sfx.wheel(phase === 'throwing' || mapper.pressed ? wheelSpeed : 0.25);
    renderer.render(scene, rig.camera);
    emit(false);
  }

  function spawnDrop(x: number, y: number, strength: number): void {
    const i = pNext;
    pNext = (pNext + 1) % PARTICLES;
    const omega = Math.PI * 2 * (0.55 + 1.5 * wheelSpeed);
    pPos[i * 3] = x;
    pPos[i * 3 + 1] = y;
    pPos[i * 3 + 2] = 0;
    // Tangential fling (the wheel turns +y, so the right silhouette moves away from the camera).
    const tang = -Math.sign(x || 1) * Math.abs(x) * omega * 0.6;
    pVel[i * 3] = Math.sign(x || 1) * (4 + Math.random() * 6) * strength;
    pVel[i * 3 + 1] = 2 + Math.random() * 4;
    pVel[i * 3 + 2] = tang * (0.6 + Math.random() * 0.6);
    pLife[i] = 0.5 + Math.random() * 0.5;
  }

  function updateParticles(dt: number): void {
    let any = false;
    for (let i = 0; i < PARTICLES; i++) {
      if ((pLife[i] ?? 0) <= 0) continue;
      any = true;
      pLife[i] = (pLife[i] ?? 0) - dt;
      pVel[i * 3 + 1] = (pVel[i * 3 + 1] ?? 0) - 60 * dt;
      pPos[i * 3] = (pPos[i * 3] ?? 0) + (pVel[i * 3] ?? 0) * dt;
      pPos[i * 3 + 1] = (pPos[i * 3 + 1] ?? 0) + (pVel[i * 3 + 1] ?? 0) * dt;
      pPos[i * 3 + 2] = (pPos[i * 3 + 2] ?? 0) + (pVel[i * 3 + 2] ?? 0) * dt;
      if ((pLife[i] ?? 0) <= 0 || (pPos[i * 3 + 1] ?? 0) < -6) {
        pLife[i] = 0;
        pPos[i * 3 + 1] = -100;
      }
    }
    if (any) (pGeo.getAttribute('position') as BufferAttribute).needsUpdate = true;
  }

  function finishCentering(chime: boolean): void {
    if (phase !== 'centering') return;
    phase = 'throwing';
    centerWobble = 0;
    mapper.cancel();
    if (chime) {
      sfx.tink(1.3);
      buzz(20);
    }
    opts.onEvent?.('centred');
    emit(true);
  }

  raf = requestAnimationFrame(frameLoop);
  emit(true);
  if (location.search.includes('debug')) (window as unknown as Record<string, unknown>).__paanai = { scene, renderer, rig, targetOutline };

  // ---- Thumbnails (lazy, separate small renderer that keeps its buffer) ----
  let thumb: { renderer: WebGLRenderer; scene: Scene; rig: CameraRig; geo: PotGeometry; env: StudioEnvironment } | null = null;
  async function renderThumbnail(p: Profile, size: number): Promise<string> {
    if (!thumb) {
      const c = document.createElement('canvas');
      const r = createRenderer(c, { antialias: true, preserve: true });
      r.setClearColor(0x000000, 0);
      const e = createStudioEnvironment(r);
      const s = new Scene();
      s.environment = e.texture;
      addLights(s);
      const geo = new PotGeometry();
      const mat = createClayMaterial({ wet: 0.5 });
      s.add(new Mesh(geo.geometry, mat.material));
      thumb = { renderer: r, scene: s, rig: new CameraRig(), geo, env: e };
    }
    const t = thumb;
    t.renderer.setPixelRatio(1);
    t.renderer.setSize(size, size, false);
    t.rig.setViewport(size, size);
    const d = displayFromProfile(p);
    t.geo.update(d, { time: 0, reducedMotion: true });
    t.rig.update(0, d.height, d.maxOuter(), false, true, 0);
    // Fill the thumbnail with the pot (the live framing leaves room for the HUD).
    t.rig.camera.zoom = 1.9;
    t.rig.camera.updateProjectionMatrix();
    t.renderer.render(t.scene, t.rig.camera);
    return t.renderer.domElement.toDataURL('image/png');
  }

  function resetAll(): void {
    mapper.cancel();
    profile = createLump();
    recorder = new StrokeRecorder();
    started = false;
    strokes = 0;
    limitHit = false;
    wasOpened = wasWobbling = wasSlumped = wasUnsafe = false;
    wet = 1;
    marks.fill(0);
    u.uMarks.value.needsUpdate = true;
    display.markDiscontinuity();
    display.setTarget(profile);
    matchDirty = true;
    match = null;
    if (ghost) api.setGhost(ghost.log);
    emit(true);
  }

  const api: ThrowStage = {
    setTool(t) {
      tool = t;
    },
    open() {
      if (phase === 'centering') finishCentering(false);
      mapper.queueOpen();
    },
    addWater() {
      wet = 1;
      sfx.splash();
      buzz(15);
      if (!reduced) {
        const H = Math.max(1, display.height);
        for (let i = 0; i < 26; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = display.outerAt(H) * Math.random();
          spawnDrop(Math.cos(a) * r, H + 0.5, 0.2);
        }
      }
      for (let r = 0; r < MARK_ROWS; r++) marks[r] = (marks[r] ?? 0) * 0.8;
      u.uMarks.value.needsUpdate = true;
      opts.onEvent?.('water');
      emit(true);
    },
    recenter() {
      if (reduced || recorder.entries.length > 0) return;
      phase = 'centering';
      centerWobble = 1;
      centerAge = 0;
      emit(true);
    },
    skipCentering() {
      finishCentering(false);
    },
    undo() {
      mapper.cancel();
      if (!recorder.undo()) return false;
      profile = replay(recorder.toLog());
      strokes = 0;
      for (const e of recorder.entries) if (e.start && e.mode !== 2) strokes++;
      limitHit = false;
      started = recorder.entries.length > 0;
      wasOpened = profile.opened;
      wasWobbling = profile.wobble > 0;
      wasSlumped = profile.slumped;
      wasUnsafe = profile.unsafe;
      display.markDiscontinuity();
      display.setTarget(profile);
      matchDirty = true;
      if (ghost) api.setGhost(ghost.log);
      emit(true);
      return true;
    },
    reset: resetAll,
    finish() {
      mapper.cancel();
      return recorder.toLog();
    },
    getProfile() {
      return profile;
    },
    setInputEnabled(on) {
      inputEnabled = on;
      mapper.setEnabled(on);
    },
    setPaused(p) {
      paused = p;
      if (p) {
        mapper.cancel();
        sfx.wheel(0);
      } else {
        last = performance.now();
        scaler.restart();
      }
    },
    setTarget(p) {
      target = p;
      targetOutline.setTarget(p);
      match = null;
      matchDirty = true;
    },
    setGhost(log) {
      if (!log) {
        ghost = null;
        ghostMesh.visible = false;
        return;
      }
      const p = createLump();
      // Fast-forward to the player's current tick so the two throws stay in step.
      const g = { log, p, d: displayFromProfile(p), i: 0, t: 0, wait: log.entries[0]?.dt ?? 0 };
      ghost = g;
      for (let k = 0; k < recorder.tick; k++) ghostTick();
      g.d.snap();
    },
    renderThumbnail,
    getScreenFrame() {
      return { ...frame };
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mapper.dispose();
      sfx.wheel(0);
      potGeo.dispose();
      clay.material.dispose();
      u.uMarks.value.dispose();
      targetOutline.dispose();
      contact.dispose();
      openRing.dispose();
      wheel.dispose();
      fingerGeo.dispose();
      skin.dispose();
      pGeo.dispose();
      ghostGeo.dispose();
      ghostMat.dispose();
      pMat.dispose();
      emberMat.dispose();
      glow.dispose();
      env.dispose();
      renderer.dispose();
      if (thumb) {
        thumb.geo.dispose();
        thumb.env.dispose();
        thumb.renderer.dispose();
      }
    },
  };
  return api;
}

// Re-export for screens that only need the type of a display profile.
export type { DisplayProfile };
