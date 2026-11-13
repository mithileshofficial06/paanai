// Procedural studio sound: every sound is synthesised with Web Audio, so there are no audio
// files to download or license. Unlocked on the first user gesture. Mute is remembered in
// localStorage (cleared on app updates, which is fine for a convenience setting).

type Voice = { stop(): void };

const MUTE_KEY = 'paanai.muted';

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private hum: { osc: OscillatorNode; osc2: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  /** Call from a user gesture (pointerdown/click). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      // Brown-ish noise: warmer than white.
      b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = b * 3.5;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  private ready(): { ctx: AudioContext; out: GainNode } | null {
    if (!this.ctx || !this.master || this.muted) return null;
    return { ctx: this.ctx, out: this.master };
  }

  /** Continuous wheel hum; speed 0..1 changes pitch and level. */
  wheel(speed: number): void {
    const r = this.ready();
    if (!r) {
      if (this.hum && this.ctx) this.hum.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    const { ctx, out } = r;
    if (!this.hum) {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc2.type = 'sine';
      filter.type = 'lowpass';
      filter.frequency.value = 280;
      filter.Q.value = 0.7;
      gain.gain.value = 0;
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain).connect(out);
      osc.start();
      osc2.start();
      this.hum = { osc, osc2, gain, filter };
    }
    const t = ctx.currentTime;
    const s = Math.max(0, Math.min(1, speed));
    this.hum.osc.frequency.setTargetAtTime(38 + s * 26, t, 0.2);
    this.hum.osc2.frequency.setTargetAtTime(76 + s * 52, t, 0.2);
    this.hum.filter.frequency.setTargetAtTime(180 + s * 260, t, 0.2);
    this.hum.gain.gain.setTargetAtTime(s > 0 ? 0.035 + s * 0.05 : 0, t, 0.25);
  }

  private noiseBurst(dur: number, freq: number, q: number, level: number, attack = 0.01): Voice | null {
    const r = this.ready();
    if (!r || !this.noise) return null;
    const { ctx, out } = r;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
    return { stop: () => src.stop() };
  }

  /** Wet clay under the finger; intensity 0..1 from finger speed. */
  squelch(intensity: number): void {
    const i = Math.max(0, Math.min(1, intensity));
    if (i < 0.05) return;
    this.noiseBurst(0.12 + i * 0.1, 420 + Math.random() * 500, 1.6, 0.05 + i * 0.12, 0.02);
  }

  /** Water poured on the clay: a bright splash plus a soft trickle. */
  splash(): void {
    this.noiseBurst(0.3, 2200, 0.8, 0.1, 0.004);
    this.noiseBurst(0.7, 900, 1.4, 0.05, 0.05);
  }

  /** Opening the clay: a soft thump. */
  thump(): void {
    const r = this.ready();
    if (!r) return;
    const { ctx, out } = r;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.25);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.35);
    this.noiseBurst(0.18, 300, 0.8, 0.12);
  }

  /** The pot slumps. */
  flop(): void {
    this.noiseBurst(0.45, 180, 0.9, 0.3, 0.03);
    this.thump();
  }

  /** Kiln door / fire whoosh. */
  whoosh(): void {
    const r = this.ready();
    if (!r || !this.noise) return;
    const { ctx, out } = r;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    const g = ctx.createGain();
    const t = ctx.currentTime;
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.6);
    f.frequency.exponentialRampToValueAtTime(300, t + 1.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + 1.8);
  }

  /** Fired ceramic "tink": an inharmonic bell (FM). */
  tink(pitch = 1): void {
    const r = this.ready();
    if (!r) return;
    const { ctx, out } = r;
    const t = ctx.currentTime;
    const partials = [1, 2.76, 5.4, 8.93];
    partials.forEach((m, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 1180 * pitch * m;
      const level = 0.12 / (i + 1);
      g.gain.setValueAtTime(level, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2 / (i + 1));
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 1.3);
    });
  }

  /** Soft UI click. */
  click(): void {
    const r = this.ready();
    if (!r) return;
    const { ctx, out } = r;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    o.type = 'triangle';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.04);
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.08);
  }

  /** Rubber stamp landing on paper: a short, damped thud with a papery slap. */
  stamp(): void {
    const r = this.ready();
    if (!r) return;
    const { ctx, out } = r;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.2);
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.06), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    n.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    const ng = ctx.createGain();
    ng.gain.value = 0.18;
    n.connect(f).connect(ng).connect(out);
    n.start(t);
  }

  /** Score reveal / success chord. */
  chime(): void {
    [1, 1.25, 1.5].forEach((m, i) => setTimeout(() => this.tink(0.5 * m), i * 90));
  }
}

export const sfx = new Sfx();
