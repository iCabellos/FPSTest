import type { WeaponAudioConfig } from '../weapons/WeaponDefinition';

export type SoundId =
  | 'magOut'
  | 'magIn'
  | 'charge'
  | 'bolt'
  | 'dryFire'
  | 'impact'
  | 'switch'
  | 'explosion'
  | 'boardTear';

const NOISE_SECONDS = 1;
/** Length of the generated range impulse response, in seconds. */
const REVERB_SECONDS = 2.4;

/**
 * Procedural gunshots via the Web Audio API. Every shot is four layers — a
 * transient click, a filtered crack, a low body thump and the mechanical
 * clack of the action — soft clipped for punch and fed into a convolution
 * reverb that stands in for the range walls and berms.
 *
 * No audio assets are required, but any sound can be replaced by a real
 * sample through {@link loadSample}.
 */
export class AudioSystem {
  private context: AudioContext | null = null;
  /** Everything routes through here for the soft clip that gives shots weight. */
  private shaper: WaveShaperNode | null = null;
  private reverbSend: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly samples = new Map<string, AudioBuffer>();

  /** Must be called from a user gesture; browsers block audio before that. */
  resume(): void {
    if (!this.context) this.build();
    if (this.context?.state === 'suspended') void this.context.resume();
  }

  /**
   * Optional hook for real assets. Registered samples take priority over the
   * synthesised fallback, so audio can be upgraded without touching gameplay.
   */
  async loadSample(id: string, url: string): Promise<void> {
    this.resume();
    if (!this.context) return;
    const response = await fetch(url);
    const data = await response.arrayBuffer();
    this.samples.set(id, await this.context.decodeAudioData(data));
  }

  playShot(weaponId: string, config: WeaponAudioConfig): void {
    const context = this.context;
    if (!context || !this.noise || !this.shaper) return;
    if (this.playSample(`shot:${weaponId}`, config.gain)) return;

    const now = context.currentTime;
    const dry = this.shaper;
    const wet = this.reverbSend;

    // 1. Transient: the initial snap that makes a shot read as sharp.
    this.noiseBurst({
      start: now,
      duration: 0.02,
      gain: config.gain * 0.9,
      filter: 'highpass',
      frequency: 3800,
      q: 0.6,
      rate: 1,
      destination: dry,
    });

    // 2. Crack: the tonal core, unique per weapon.
    this.noiseBurst({
      start: now,
      duration: config.decay,
      gain: config.gain,
      filter: 'bandpass',
      frequency: config.crackFrequency,
      q: 0.8,
      rate: 0.85 + Math.random() * 0.3,
      destination: dry,
    });

    // 3. Body: a short sine sweeping down for the low end punch.
    const body = context.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(config.bodyFrequency * 2.6, now);
    body.frequency.exponentialRampToValueAtTime(config.bodyFrequency * 0.55, now + 0.13);
    const bodyGain = context.createGain();
    bodyGain.gain.setValueAtTime(config.gain * 1.15, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    body.connect(bodyGain).connect(dry);
    body.start(now);
    body.stop(now + 0.2);

    // 4. Action: bolt and carrier noise, loudest on the open bolt weapons.
    if (config.mechanical > 0) {
      this.noiseBurst({
        start: now + 0.012,
        duration: 0.07,
        gain: config.gain * 0.3 * config.mechanical,
        filter: 'bandpass',
        frequency: 2600,
        q: 2.2,
        rate: 1.1,
        destination: dry,
      });
    }

    // 5. Close tail plus the send that becomes the echo off the berms.
    this.noiseBurst({
      start: now + 0.02,
      duration: config.tailDecay,
      gain: config.gain * 0.3,
      filter: 'lowpass',
      frequency: 850,
      q: 0.7,
      rate: 1,
      destination: dry,
    });

    if (wet && config.reverb > 0) {
      this.noiseBurst({
        start: now,
        duration: config.decay * 1.2,
        gain: config.gain * config.reverb,
        filter: 'bandpass',
        frequency: config.crackFrequency * 0.8,
        q: 0.7,
        rate: 1,
        destination: wet,
      });
    }
  }

  /** @param delay seconds to wait, used so distant impacts arrive late. */
  play(id: SoundId, volume = 1, delay = 0): void {
    const context = this.context;
    if (!context || !this.noise || !this.shaper) return;
    if (this.playSample(id, volume, delay)) return;

    const preset = CLICK_PRESETS[id];
    const start = context.currentTime + Math.min(delay, 2);

    this.noiseBurst({
      start,
      duration: preset.decay,
      gain: preset.gain * volume,
      filter: 'bandpass',
      frequency: preset.frequency,
      q: preset.q,
      rate: preset.rate,
      destination: this.shaper,
    });

    if (preset.thump > 0) {
      const body = context.createOscillator();
      body.type = 'triangle';
      body.frequency.setValueAtTime(preset.thump, start);
      body.frequency.exponentialRampToValueAtTime(preset.thump * 0.6, start + 0.08);
      const gain = context.createGain();
      gain.gain.setValueAtTime(preset.gain * volume * 0.8, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
      body.connect(gain).connect(this.shaper);
      body.start(start);
      body.stop(start + 0.12);
    }

    if (this.reverbSend && preset.reverb > 0) {
      this.noiseBurst({
        start,
        duration: preset.decay,
        gain: preset.gain * volume * preset.reverb,
        filter: 'bandpass',
        frequency: preset.frequency,
        q: preset.q,
        rate: preset.rate,
        destination: this.reverbSend,
      });
    }
  }

  dispose(): void {
    void this.context?.close();
    this.context = null;
    this.shaper = null;
    this.reverbSend = null;
    this.noise = null;
    this.samples.clear();
  }

  private build(): void {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const context = new Ctor();
    this.context = context;

    const master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);

    // Soft clipping keeps overlapping shots loud without turning to mush.
    this.shaper = context.createWaveShaper();
    this.shaper.curve = createSoftClipCurve();
    this.shaper.oversample = '2x';
    this.shaper.connect(master);

    const convolver = context.createConvolver();
    convolver.buffer = createRangeImpulse(context);
    const reverbGain = context.createGain();
    reverbGain.gain.value = 0.85;
    convolver.connect(reverbGain).connect(master);

    this.reverbSend = context.createGain();
    this.reverbSend.gain.value = 1;
    this.reverbSend.connect(convolver);

    this.noise = createNoiseBuffer(context);
  }

  /** One filtered, enveloped burst of the shared noise buffer. */
  private noiseBurst(options: {
    start: number;
    duration: number;
    gain: number;
    filter: BiquadFilterType;
    frequency: number;
    q: number;
    rate: number;
    destination: AudioNode;
  }): void {
    const context = this.context;
    if (!context || !this.noise) return;

    const source = context.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    source.playbackRate.value = options.rate;
    // Start from a random point so repeated shots never phase identically.
    const offset = Math.random() * (NOISE_SECONDS - 0.1);

    const filter = context.createBiquadFilter();
    filter.type = options.filter;
    filter.frequency.value = options.frequency;
    filter.Q.value = options.q;

    const gain = context.createGain();
    gain.gain.setValueAtTime(options.gain, options.start);
    gain.gain.exponentialRampToValueAtTime(0.0001, options.start + options.duration);

    source.connect(filter).connect(gain).connect(options.destination);
    source.start(options.start, offset);
    source.stop(options.start + options.duration + 0.02);
  }

  private playSample(id: string, volume: number, delay = 0): boolean {
    const buffer = this.samples.get(id);
    const context = this.context;
    if (!buffer || !context || !this.shaper) return false;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.shaper);
    if (this.reverbSend) gain.connect(this.reverbSend);
    source.start(context.currentTime + Math.min(delay, 2));
    return true;
  }
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * NOISE_SECONDS);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** tanh style curve: loud stays loud, peaks round off instead of clipping. */
function createSoftClipCurve(): Float32Array<ArrayBuffer> {
  const samples = 2048;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.8);
  }
  return curve;
}

/**
 * Impulse response for an open range: a couple of discrete slap backs off the
 * side walls and the backstop, over a decaying diffuse tail.
 */
function createRangeImpulse(context: AudioContext): AudioBuffer {
  const rate = context.sampleRate;
  const length = Math.floor(rate * REVERB_SECONDS);
  const buffer = context.createBuffer(2, length, rate);

  // Distinct early reflections: side walls first, then the far berm.
  const slaps: Array<[number, number]> = [
    [0.055, 0.5],
    [0.11, 0.34],
    [0.23, 0.26],
    [0.42, 0.18],
    [0.68, 0.1],
  ];

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Diffuse tail, quiet enough to sit under the discrete echoes.
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * 0.32;
    }
    for (const [time, amplitude] of slaps) {
      // Offset the channels slightly so the echo has some width.
      const jitter = channel === 0 ? 0 : 0.004;
      const index = Math.floor((time + jitter) * rate);
      if (index >= length) continue;
      const spread = Math.floor(rate * 0.012);
      for (let i = 0; i < spread && index + i < length; i++) {
        const fade = 1 - i / spread;
        data[index + i] += (Math.random() * 2 - 1) * amplitude * fade * fade;
      }
    }
  }
  return buffer;
}

interface ClickPreset {
  frequency: number;
  q: number;
  gain: number;
  decay: number;
  rate: number;
  /** Low frequency knock layered under the click. */
  thump: number;
  reverb: number;
}

const CLICK_PRESETS: Record<SoundId, ClickPreset> = {
  magOut: { frequency: 1700, q: 1.4, gain: 0.26, decay: 0.11, rate: 0.95, thump: 150, reverb: 0.2 },
  magIn: { frequency: 1200, q: 1.1, gain: 0.34, decay: 0.14, rate: 0.85, thump: 110, reverb: 0.25 },
  charge: { frequency: 2900, q: 1.8, gain: 0.3, decay: 0.13, rate: 1, thump: 90, reverb: 0.3 },
  bolt: { frequency: 3200, q: 2, gain: 0.3, decay: 0.12, rate: 1.1, thump: 120, reverb: 0.3 },
  dryFire: { frequency: 4200, q: 3, gain: 0.22, decay: 0.05, rate: 1.2, thump: 0, reverb: 0.1 },
  impact: { frequency: 5200, q: 1.6, gain: 0.2, decay: 0.07, rate: 1.3, thump: 0, reverb: 0.5 },
  switch: { frequency: 1800, q: 1.4, gain: 0.2, decay: 0.1, rate: 1, thump: 0, reverb: 0.15 },
  // Long, low and heavily reverberant: the grenade and the nuke.
  explosion: { frequency: 220, q: 0.7, gain: 0.85, decay: 0.9, rate: 0.6, thump: 48, reverb: 1 },
  // A dry splintering crack as a plank comes off a window.
  boardTear: { frequency: 900, q: 0.9, gain: 0.3, decay: 0.22, rate: 0.8, thump: 70, reverb: 0.35 },
};
