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
  | 'boardTear'
  // The special weapon's arcade cabinet.
  | 'slotLever'
  | 'slotReel'
  | 'slotWin'
  | 'slotJackpot'
  | 'slotSiren'
  | 'coin';

const NOISE_SECONDS = 1;

/**
 * Procedural gunshots via the Web Audio API. Every shot is four layers — a
 * transient snap, a filtered crack, a low body thump and the mechanical clack
 * of the action — soft clipped for punch.
 *
 * There is deliberately no reverb. An earlier version fed every shot into a
 * convolution tail meant to stand in for range walls; with no early energy to
 * anchor it, that tail was all anyone heard, and the guns came out sounding
 * airy and distant, more like arrows than rifles. Everything is dry now, and
 * the weight comes from a doubled low body instead.
 *
 * No audio assets are required, but any sound can be replaced by a real
 * sample through {@link loadSample}.
 */
export class AudioSystem {
  private context: AudioContext | null = null;
  /** Everything routes through here for the soft clip that gives shots weight. */
  private shaper: WaveShaperNode | null = null;
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

    // 1. Transient: the initial snap that makes a shot read as sharp.
    this.noiseBurst({
      start: now,
      duration: 0.018,
      gain: config.gain * 1.15,
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

    // 3. Body: two oscillators sweeping down together. Doubling the low end
    // is what replaces the reverb tail — the shot gets its size from weight
    // underneath it rather than from a room ringing after it.
    for (const [wave, multiplier, level, length] of [
      ['sine', 2.6, 1.35, 0.18],
      ['triangle', 1.15, 0.7, 0.24],
    ] as const) {
      const body = context.createOscillator();
      body.type = wave;
      body.frequency.setValueAtTime(config.bodyFrequency * multiplier, now);
      body.frequency.exponentialRampToValueAtTime(config.bodyFrequency * 0.5, now + length * 0.72);
      const bodyGain = context.createGain();
      bodyGain.gain.setValueAtTime(config.gain * level, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + length);
      body.connect(bodyGain).connect(dry);
      body.start(now);
      body.stop(now + length + 0.02);
    }

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

    // 5. Close tail: short, low and dry. Capped hard, because a long filtered
    // noise tail is exactly what made these sound like arrows in flight.
    this.noiseBurst({
      start: now + 0.014,
      duration: Math.min(config.tailDecay, 0.2),
      gain: config.gain * 0.34,
      filter: 'lowpass',
      frequency: 520,
      q: 0.7,
      rate: 1,
      destination: dry,
    });
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

    const tones = TONE_PRESETS[id];
    if (tones) this.playTones(tones, start, volume);
  }

  /**
   * A run of oscillator notes. This is what the slot machine is built out of:
   * fat detuned square waves in bright intervals, which is the sound an arcade
   * cabinet makes and nothing else in the game does.
   */
  private playTones(spec: ToneSpec, start: number, volume: number): void {
    const context = this.context;
    if (!context || !this.shaper) return;

    spec.notes.forEach((semitones, index) => {
      const at = start + index * spec.step;
      const frequency = spec.root * Math.pow(2, semitones / 12);
      // A detuned pair per note, which is what makes it read as a cabinet
      // rather than a test tone.
      for (const detune of spec.detune ? [-spec.detune, spec.detune] : [0]) {
        const osc = context.createOscillator();
        osc.type = spec.wave;
        osc.detune.value = detune;
        osc.frequency.setValueAtTime(frequency, at);
        if (spec.bend) {
          osc.frequency.exponentialRampToValueAtTime(
            frequency * spec.bend,
            at + spec.duration,
          );
        }
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(spec.gain * volume, at + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + spec.duration);
        osc.connect(gain).connect(this.shaper!);
        osc.start(at);
        osc.stop(at + spec.duration + 0.02);
      }
    });
  }

  dispose(): void {
    void this.context?.close();
    this.context = null;
    this.shaper = null;
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

interface ClickPreset {
  frequency: number;
  q: number;
  gain: number;
  decay: number;
  rate: number;
  /** Low frequency knock layered under the click. */
  thump: number;
}

/** A run of notes, for the arcade sounds the special weapon makes. */
interface ToneSpec {
  wave: OscillatorType;
  /** Semitone offsets from the root, played in order. */
  notes: readonly number[];
  root: number;
  /** Seconds between note starts. */
  step: number;
  /** Seconds each note rings for. */
  duration: number;
  gain: number;
  /** Cents of detune on a doubled pair, for a fat cabinet sound. */
  detune?: number;
  /** Ratio each note bends toward over its life. */
  bend?: number;
}

const CLICK_PRESETS: Record<SoundId, ClickPreset> = {
  magOut: { frequency: 1700, q: 1.4, gain: 0.26, decay: 0.11, rate: 0.95, thump: 150 },
  magIn: { frequency: 1200, q: 1.1, gain: 0.34, decay: 0.14, rate: 0.85, thump: 110 },
  charge: { frequency: 2900, q: 1.8, gain: 0.3, decay: 0.13, rate: 1, thump: 90 },
  bolt: { frequency: 3200, q: 2, gain: 0.3, decay: 0.12, rate: 1.1, thump: 120 },
  dryFire: { frequency: 4200, q: 3, gain: 0.22, decay: 0.05, rate: 1.2, thump: 0 },
  impact: { frequency: 5200, q: 1.6, gain: 0.2, decay: 0.07, rate: 1.3, thump: 0 },
  switch: { frequency: 1800, q: 1.4, gain: 0.2, decay: 0.1, rate: 1, thump: 0 },
  // Long and very low: the grenade and the nuke.
  explosion: { frequency: 220, q: 0.7, gain: 0.85, decay: 0.9, rate: 0.6, thump: 48 },
  // A dry splintering crack as a plank comes off a window.
  boardTear: { frequency: 900, q: 0.9, gain: 0.3, decay: 0.22, rate: 0.8, thump: 70 },
  // The cabinet: a lever ratchet, a reel stopping, and the payouts.
  slotLever: { frequency: 1400, q: 1.2, gain: 0.3, decay: 0.16, rate: 0.7, thump: 90 },
  slotReel: { frequency: 2200, q: 2.4, gain: 0.26, decay: 0.08, rate: 1, thump: 140 },
  slotWin: { frequency: 3200, q: 1.4, gain: 0.12, decay: 0.1, rate: 1.2, thump: 0 },
  slotJackpot: { frequency: 2600, q: 1, gain: 0.16, decay: 0.3, rate: 0.9, thump: 60 },
  slotSiren: { frequency: 1800, q: 3, gain: 0.1, decay: 0.4, rate: 0.8, thump: 0 },
  coin: { frequency: 5200, q: 3.2, gain: 0.16, decay: 0.07, rate: 1.4, thump: 0 },
};

/**
 * The arcade layer. Deliberately the brightest, cheapest, most tonal thing in
 * the whole mix: nothing else in the game plays a note, so the moment the slot
 * machine does anything it is unmistakable.
 */
const TONE_PRESETS: Partial<Record<SoundId, ToneSpec>> = {
  // Lever thrown: two notes falling, like a mechanism being dragged over.
  slotLever: { wave: 'square', notes: [0, -5], root: 330, step: 0.055, duration: 0.11, gain: 0.16 },
  // One reel biting. Rises a touch, so five in a row climb.
  slotReel: { wave: 'square', notes: [0], root: 494, step: 0, duration: 0.09, gain: 0.14, bend: 1.16 },
  // A win: a bright major arpeggio.
  slotWin: {
    wave: 'square',
    notes: [0, 4, 7, 12],
    root: 523,
    step: 0.07,
    duration: 0.18,
    gain: 0.15,
    detune: 9,
  },
  // The jackpot: a long run all the way up two octaves, fat and obnoxious.
  slotJackpot: {
    wave: 'sawtooth',
    notes: [0, 4, 7, 12, 16, 19, 24, 28, 31],
    root: 392,
    step: 0.08,
    duration: 0.36,
    gain: 0.16,
    detune: 14,
  },
  // A two tone siren over the top of it.
  slotSiren: {
    wave: 'square',
    notes: [0, 5, 0, 5],
    root: 740,
    step: 0.22,
    duration: 0.2,
    gain: 0.1,
    detune: 6,
  },
  coin: { wave: 'square', notes: [12, 19], root: 988, step: 0.05, duration: 0.13, gain: 0.11 },
};
