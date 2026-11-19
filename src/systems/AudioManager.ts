// Procedural Web Audio API synthesizer + Dynamic Region Ambient System for ESCAPE 1942
import type { MapId, RegionId } from '../types/game';

const BGM_MELODY = [
  57, 0, 60, 0, 64, 0, 60, 0, 57, 0, 60, 0, 64, 0, 67, 0,
  69, 0, 67, 0, 64, 0, 60, 0, 57, 0, 64, 0, 60, 0, 57, 0,
  62, 0, 65, 0, 69, 0, 65, 0, 62, 0, 60, 0, 59, 0, 57, 0,
  60, 0, 64, 0, 67, 0, 64, 0, 60, 0, 57, 0, 55, 0, 57, 0,
];

const BGM_BASS = [
  33, 0, 0, 0, 40, 0, 0, 0, 33, 0, 0, 0, 36, 0, 0, 0,
  38, 0, 0, 0, 40, 0, 0, 0, 33, 0, 0, 0, 28, 0, 0, 0,
  38, 0, 0, 0, 41, 0, 0, 0, 40, 0, 0, 0, 33, 0, 0, 0,
  36, 0, 0, 0, 40, 0, 0, 0, 33, 0, 0, 0, 28, 0, 0, 0,
];

export type SoundEffectName =
  | 'key'
  | 'correct'
  | 'wrong'
  | 'guardAlert'
  | 'encounter'
  | 'dodge'
  | 'trapWarn'
  | 'trapActive'
  | 'trapHit'
  | 'doorOpen'
  | 'victory'
  | 'gameOver'
  | 'step';

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private longNoiseBuffer: AudioBuffer | null = null;
  private bgmTimer: number | null = null;
  private ambientTimer: number | null = null;
  private bgmPlaying = false;
  private ambientPlaying = false;
  private currentRegion: RegionId = 'depot';
  private currentMap: MapId = 'gudang';
  private ambientTickCount = 0;
  private stepIdx = 0;
  private nextTime = 0;

  public supported = true;
  public musicVolume = 0.3;
  public sfxVolume = 0.65;
  public muted = false;

  init(): boolean {
    if (this.ctx) return true;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) {
        this.supported = false;
        return false;
      }
      const ctx = new AC();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 1;
      master.connect(ctx.destination);

      const bgmGain = ctx.createGain();
      bgmGain.gain.value = this.musicVolume;
      bgmGain.connect(master);

      const sfxGain = ctx.createGain();
      sfxGain.gain.value = this.sfxVolume;
      sfxGain.connect(master);

      const ambientGain = ctx.createGain();
      ambientGain.gain.value = Math.max(0.08, this.sfxVolume * 0.55);
      ambientGain.connect(master);

      this.master = master;
      this.bgmGain = bgmGain;
      this.sfxGain = sfxGain;
      this.ambientGain = ambientGain;

      // Short noise buffer for footsteps & percussion
      const len = Math.max(1, Math.floor(ctx.sampleRate * 0.4));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;

      // Longer pink-ish filtered noise buffer (2.5s) for smooth wind/room air
      const longLen = Math.max(1, Math.floor(ctx.sampleRate * 2.5));
      const lBuf = ctx.createBuffer(1, longLen, ctx.sampleRate);
      const lData = lBuf.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < longLen; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.95 * b2 + white * 0.048;
        lData[i] = (b0 + b1 + b2) * 0.5;
      }
      this.longNoiseBuffer = lBuf;

      return true;
    } catch {
      this.supported = false;
      return false;
    }
  }

  ensure(): boolean {
    const ok = this.init();
    if (ok && this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return ok;
  }

  setVolumes(musicVolume: number, sfxVolume: number, muted: boolean): void {
    this.musicVolume = Math.max(0, Math.min(1, musicVolume));
    this.sfxVolume = Math.max(0, Math.min(1, sfxVolume));
    this.muted = muted;

    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.bgmGain?.gain.setTargetAtTime(this.musicVolume, t, 0.02);
      this.sfxGain?.gain.setTargetAtTime(this.sfxVolume, t, 0.02);
      this.ambientGain?.gain.setTargetAtTime(
        Math.max(0.05, this.sfxVolume * 0.55),
        t,
        0.05
      );
      if (this.master) {
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.02);
      }
    }
  }

  setAmbientRegion(region: RegionId): void {
    this.currentRegion = region;
  }

  setMapTheme(mapId: MapId): void {
    this.currentMap = mapId;
  }

  startAmbient(): void {
    if (!this.ctx || this.ambientPlaying) return;
    this.ambientPlaying = true;
    this.ambientTickCount = 0;
    this.scheduleAmbientTick();
    this.ambientTimer = window.setInterval(() => this.scheduleAmbientTick(), 850);
  }

  stopAmbient(): void {
    this.ambientPlaying = false;
    if (this.ambientTimer !== null) {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  startBGM(): void {
    if (!this.ctx || this.bgmPlaying) return;
    this.bgmPlaying = true;
    this.stepIdx = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.schedule();
    this.bgmTimer = window.setInterval(() => this.schedule(), 110);
    this.startAmbient();
  }

  stopBGM(): void {
    this.bgmPlaying = false;
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.stopAmbient();
  }

  private midiToFreq(n: number): number {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  private createPannerDestination(pan: number, fallback: GainNode): AudioNode {
    if (!this.ctx || typeof this.ctx.createStereoPanner !== 'function') {
      return fallback;
    }
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-0.9, Math.min(0.9, pan));
    panner.connect(fallback);
    return panner;
  }

  private scheduleAmbientTick(): void {
    if (!this.ambientPlaying || !this.ctx || !this.ambientGain || this.muted) return;
    this.ambientTickCount += 1;
    const t = this.ctx.currentTime + 0.04;
    const region = this.currentRegion;
    const mapId = this.currentMap;

    // 1. Subtle continuous atmospheric bed (every ~2.5s)
    if (this.ambientTickCount % 3 === 1 && this.longNoiseBuffer) {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.longNoiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        const isWindy = mapId === 'hutan' || mapId === 'pedesaan' || region === 'outer';
        filter.type = isWindy ? 'bandpass' : 'lowpass';
        const baseFreq = isWindy
          ? 410 + Math.random() * 240
          : region === 'service'
          ? 180
          : region === 'admin'
          ? 310
          : 230;
        filter.frequency.setValueAtTime(baseFreq, t);
        if (isWindy) {
          filter.Q.value = 1.4;
          filter.frequency.linearRampToValueAtTime(baseFreq * 1.45, t + 1.2);
          filter.frequency.linearRampToValueAtTime(baseFreq * 0.85, t + 2.4);
        }

        const gain = this.ctx.createGain();
        const peak = isWindy ? 0.072 : region === 'service' ? 0.058 : 0.042;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(peak, t + 0.8);
        gain.gain.linearRampToValueAtTime(0.0001, t + 2.45);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.ambientGain);
        src.start(t);
        src.stop(t + 2.5);
      } catch {
        // ignore closed context
      }
    }

    // 2. Map & Region-specific subtle environmental cues
    const pan = (Math.random() * 2 - 1) * 0.75;
    const dest = this.createPannerDestination(pan, this.ambientGain);

    if (mapId === 'hutan') {
      const r = Math.random();
      if (r < 0.34) {
        const f = 2500 + Math.random() * 350;
        this.tone(f, t, 0.04, 'sine', 0.01, dest);
        this.tone(f, t + 0.09, 0.04, 'sine', 0.009, dest);
      } else if (r < 0.56) {
        // Distant night owl / wind hollow
        this.tone(330, t, 0.32, 'sine', 0.015, dest, 265);
      } else if (r < 0.8) {
        // Soft footsteps on forest leaves
        this.noiseBand(t, 0.07, 0.025, 1100, 'bandpass', dest);
        this.noiseBand(t + 0.45, 0.07, 0.02, 980, 'bandpass', dest);
      }
      return;
    }

    if (mapId === 'pedesaan') {
      const r = Math.random();
      if (r < 0.3) {
        // Distant wooden night watch (kentongan knock)
        this.tone(420, t, 0.09, 'triangle', 0.018, dest, 380);
        this.tone(420, t + 0.24, 0.09, 'triangle', 0.015, dest, 380);
      } else if (r < 0.62) {
        // Gravel patrol steps
        this.noiseBand(t, 0.06, 0.026, 860, 'bandpass', dest);
        this.noiseBand(t + 0.44, 0.06, 0.022, 820, 'bandpass', dest);
      }
      return;
    }

    if (region === 'depot') {
      // Distant timber creak or echoing booted patrol steps in wooden warehouse
      const r = Math.random();
      if (r < 0.35) {
        this.tone(110 + Math.random() * 35, t, 0.36, 'triangle', 0.028, dest, 78);
      } else if (r < 0.68) {
        this.noiseBand(t, 0.06, 0.032, 340, 'lowpass', dest);
        this.noiseBand(t + 0.42, 0.06, 0.026, 320, 'lowpass', dest);
      }
    } else if (region === 'admin') {
      // Distant muffled officer chatter (formant bursts) or faint mechanical typewriter clack
      const r = Math.random();
      if (r < 0.45) {
        // 3-4 soft muffled syllables like distant corridor conversation
        const syllables = 3 + Math.floor(Math.random() * 3);
        for (let s = 0; s < syllables; s++) {
          const pitch = 185 + Math.random() * 95;
          this.tone(pitch, t + s * 0.14, 0.09, 'sawtooth', 0.012, dest, pitch * 0.92);
          this.noiseBand(t + s * 0.14, 0.08, 0.018, 520, 'bandpass', dest);
        }
      } else if (r < 0.75) {
        // Faint distant typewriter / paper shuffle
        const taps = 2 + Math.floor(Math.random() * 3);
        for (let k = 0; k < taps; k++) {
          this.noiseBand(t + k * 0.11, 0.022, 0.022, 1800, 'highpass', dest);
        }
      }
    } else if (region === 'service') {
      // Pipe hum / metallic drip / distant echoing steps
      const r = Math.random();
      if (r < 0.4) {
        // Metallic water drip
        const f = 1150 + Math.random() * 450;
        this.tone(f, t, 0.08, 'sine', 0.024, dest, f * 1.38);
      } else if (r < 0.72) {
        // Low machinery thrum
        this.tone(64, t, 0.7, 'sine', 0.035, this.ambientGain);
      } else {
        // Distant hollow footsteps
        this.noiseBand(t, 0.05, 0.026, 720, 'bandpass', dest);
        this.noiseBand(t + 0.45, 0.05, 0.021, 700, 'bandpass', dest);
      }
    } else {
      // Outer complex: night wind gusts + distant patrol footsteps on gravel
      const r = Math.random();
      if (r < 0.4) {
        // Faint distant night cricket chirp or wind whistle
        const f = 2600 + Math.random() * 200;
        this.tone(f, t, 0.04, 'sine', 0.009, dest);
        this.tone(f, t + 0.09, 0.04, 'sine', 0.008, dest);
      } else if (r < 0.72) {
        this.noiseBand(t, 0.07, 0.028, 950, 'bandpass', dest);
        this.noiseBand(t + 0.44, 0.07, 0.024, 900, 'bandpass', dest);
      }
    }
  }

  private noiseBand(
    when: number,
    dur: number,
    vol: number,
    freqHz: number,
    filterType: BiquadFilterType,
    dest: AudioNode | null
  ): void {
    if (!this.ctx || !this.noiseBuffer || !dest) return;
    try {
      const t = Math.max(this.ctx.currentTime, when);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freqHz;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      src.start(t);
      src.stop(t + dur + 0.03);
    } catch {
      // ignore
    }
  }

  private tone(
    freq: number,
    when: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    dest: AudioNode | null,
    slideTo?: number
  ): void {
    if (!this.ctx || !dest) return;
    try {
      const t = Math.max(this.ctx.currentTime, when);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      }
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    } catch {
      // ignore closed context
    }
  }

  private noise(
    when: number,
    dur: number,
    vol: number,
    highpassHz: number,
    dest: AudioNode | null
  ): void {
    this.noiseBand(when, dur, vol, highpassHz, 'highpass', dest);
  }

  private schedule(): void {
    if (!this.bgmPlaying || !this.ctx) return;
    const ahead = this.ctx.currentTime + 0.35;
    while (this.nextTime < ahead) {
      const i = this.stepIdx % BGM_MELODY.length;
      const m = BGM_MELODY[i];
      const b = BGM_BASS[i];
      if (m) {
        this.tone(this.midiToFreq(m), this.nextTime, 0.14, 'triangle', 0.06, this.bgmGain);
      }
      if (b) {
        this.tone(this.midiToFreq(b), this.nextTime, 0.28, 'sine', 0.09, this.bgmGain);
      }
      if (i % 4 === 0) {
        this.noise(this.nextTime, 0.025, 0.015, 320, this.bgmGain);
      }
      this.nextTime += 60 / 96 / 2;
      this.stepIdx++;
    }
  }

  play(name: SoundEffectName): void {
    if (!this.ctx || this.muted || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const jitter = 0.94 + Math.random() * 0.12;

    switch (name) {
      case 'step':
        this.noise(t, 0.04, 0.035, 650 * jitter, this.sfxGain);
        break;
      case 'dodge':
        this.noise(t, 0.16, 0.13, 420, this.sfxGain);
        this.tone(240 * jitter, t, 0.14, 'triangle', 0.1, this.sfxGain, 110);
        break;
      case 'key':
        [659, 880, 1175].forEach((f, idx) =>
          this.tone(f, t + idx * 0.055, 0.12, 'triangle', 0.16, this.sfxGain)
        );
        break;
      case 'correct':
        [523, 659, 784, 1046].forEach((f, idx) =>
          this.tone(f, t + idx * 0.055, 0.14, 'triangle', 0.15, this.sfxGain)
        );
        break;
      case 'wrong':
        this.tone(196, t, 0.18, 'sawtooth', 0.12, this.sfxGain, 130);
        this.tone(147, t + 0.12, 0.24, 'sawtooth', 0.12, this.sfxGain, 98);
        break;
      case 'guardAlert':
        this.tone(540, t, 0.09, 'square', 0.1, this.sfxGain, 760);
        break;
      case 'encounter':
        this.noise(t, 0.22, 0.16, 220, this.sfxGain);
        this.tone(180, t, 0.22, 'sawtooth', 0.14, this.sfxGain, 72);
        break;
      case 'trapWarn':
        this.tone(880, t, 0.06, 'square', 0.08, this.sfxGain);
        break;
      case 'trapActive':
        this.noise(t, 0.12, 0.12, 700, this.sfxGain);
        break;
      case 'trapHit':
        this.noise(t, 0.14, 0.18, 900, this.sfxGain);
        this.tone(145, t, 0.2, 'sawtooth', 0.15, this.sfxGain, 68);
        break;
      case 'doorOpen':
        this.tone(150, t, 0.28, 'sawtooth', 0.1, this.sfxGain, 92);
        this.tone(240, t + 0.08, 0.24, 'triangle', 0.12, this.sfxGain, 180);
        break;
      case 'victory':
        [523, 659, 784, 1046, 1318].forEach((f, idx) =>
          this.tone(f, t + idx * 0.11, 0.24, 'triangle', 0.16, this.sfxGain)
        );
        break;
      case 'gameOver':
        [392, 330, 262, 196, 131].forEach((f, idx) =>
          this.tone(f, t + idx * 0.17, 0.28, 'sawtooth', 0.13, this.sfxGain)
        );
        break;
    }
  }
}

export const AudioManager = new AudioManagerImpl();
