import type { WeaponAudioConfig } from '../weapons/WeaponDefinition';

export type SoundId = 'reload' | 'reloadEnd' | 'bolt' | 'dryFire' | 'impact' | 'switch';

const NOISE_SECONDS = 1;

/**
 * Procedural gunshots via the Web Audio API: a filtered noise crack, a low
 * body thump and a decaying tail. No audio assets are required, but any sound
 * can be replaced by a real sample through {@link loadSample}.
 */
export class AudioSystem {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly samples = new Map<string, AudioBuffer>();

  /** Must be called from a user gesture; browsers block audio before that. */
  resume(): void {
    if (!this.context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.context.destination);
      this.noise = this.createNoiseBuffer(this.context);
    }
    if (this.context.state === 'suspended') void this.context.resume();
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
    if (!context || !this.master || !this.noise) return;
    if (this.playSample(`shot:${weaponId}`, config.gain)) return;

    const now = context.currentTime;

    // Crack: bandpassed noise burst.
    const crack = context.createBufferSource();
    crack.buffer = this.noise;
    crack.loop = true;
    crack.playbackRate.value = 0.85 + Math.random() * 0.3;

    const bandpass = context.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = config.crackFrequency;
    bandpass.Q.value = 0.7;

    const crackGain = context.createGain();
    crackGain.gain.setValueAtTime(config.gain, now);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, now + config.decay);

    crack.connect(bandpass).connect(crackGain).connect(this.master);
    crack.start(now);
    crack.stop(now + config.decay + 0.02);

    // Body: short sine sweeping down for the low end punch.
    const body = context.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(config.bodyFrequency * 2.2, now);
    body.frequency.exponentialRampToValueAtTime(config.bodyFrequency * 0.6, now + 0.12);

    const bodyGain = context.createGain();
    bodyGain.gain.setValueAtTime(config.gain * 0.85, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    body.connect(bodyGain).connect(this.master);
    body.start(now);
    body.stop(now + 0.18);

    // Tail: lowpassed noise standing in for the report bouncing off the berms.
    const tail = context.createBufferSource();
    tail.buffer = this.noise;
    tail.loop = true;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 900;
    const tailGain = context.createGain();
    tailGain.gain.setValueAtTime(config.gain * 0.28, now + 0.02);
    tailGain.gain.exponentialRampToValueAtTime(0.0001, now + config.tailDecay);
    tail.connect(lowpass).connect(tailGain).connect(this.master);
    tail.start(now);
    tail.stop(now + config.tailDecay + 0.05);
  }

  /** @param delay seconds to wait, used so distant impacts arrive late. */
  play(id: SoundId, volume = 1, delay = 0): void {
    const context = this.context;
    if (!context || !this.master || !this.noise) return;
    if (this.playSample(id, volume, delay)) return;

    const now = context.currentTime + Math.min(delay, 2);
    const preset = CLICK_PRESETS[id];

    const source = context.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    source.playbackRate.value = preset.rate;

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = preset.frequency;
    filter.Q.value = preset.q;

    const gain = context.createGain();
    gain.gain.setValueAtTime(preset.gain * volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.decay);

    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);
    source.stop(now + preset.decay + 0.02);
  }

  dispose(): void {
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.noise = null;
    this.samples.clear();
  }

  private playSample(id: string, volume: number, delay = 0): boolean {
    const buffer = this.samples.get(id);
    const context = this.context;
    if (!buffer || !context || !this.master) return false;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.master);
    source.start(context.currentTime + Math.min(delay, 2));
    return true;
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const length = Math.floor(context.sampleRate * NOISE_SECONDS);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}

interface ClickPreset {
  frequency: number;
  q: number;
  gain: number;
  decay: number;
  rate: number;
}

const CLICK_PRESETS: Record<SoundId, ClickPreset> = {
  reload: { frequency: 2400, q: 1.2, gain: 0.22, decay: 0.09, rate: 1 },
  reloadEnd: { frequency: 1500, q: 1, gain: 0.3, decay: 0.14, rate: 0.9 },
  bolt: { frequency: 3200, q: 2, gain: 0.26, decay: 0.11, rate: 1.1 },
  dryFire: { frequency: 4200, q: 3, gain: 0.2, decay: 0.05, rate: 1.2 },
  impact: { frequency: 5200, q: 1.6, gain: 0.16, decay: 0.07, rate: 1.3 },
  switch: { frequency: 1800, q: 1.4, gain: 0.2, decay: 0.1, rate: 1 },
};
