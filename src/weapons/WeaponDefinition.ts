export type WeaponId =
  | 'm4a1'
  | 'ak47'
  | 'scar'
  | 'g36'
  | 'fal'
  | 'm60'
  | 'l96'
  | 'mp5'
  | 'mp7'
  | 'ump45'
  | 'uzi'
  | 'r870'
  | 'spas12'
  | 'm9'
  | 'm1911'
  | 'deagle'
  | 'revolver'
  | 'slotmachine';

/**
 * How a weapon is refilled.
 *
 * - `magazine`: a detachable box, drum or belt comes off and a fresh one goes
 *   on. One reload, all the rounds at once.
 * - `shells`: loaded one at a time, so the reload can be broken off part way
 *   and the weapon fired with whatever went in. Pump and tube fed shotguns.
 * - `internal`: a fixed cylinder or magazine refilled in place. One reload, but
 *   nothing detaches, so there is no part for the animation to swap.
 */
export type ReloadStyle = 'magazine' | 'shells' | 'internal';
export type FireMode = 'semi' | 'auto';

export interface RecoilConfig {
  /** Upward kick per shot, in radians. */
  vertical: number;
  /** Amplitude of the sideways component, in radians. */
  horizontal: number;
  /** Extra kick per consecutive shot, as a fraction of the base. */
  climbPerShot: number;
  /** Ceiling for the climb multiplier. */
  maxClimb: number;
  /** Fraction of the kick that is random rather than pattern driven (0..1). */
  randomness: number;
  /** How fast the view catches up with the kick. */
  snappiness: number;
  /** How fast the transient part recovers. */
  recoverySpeed: number;
  /** Share of each kick that recovers on its own; the rest the player corrects. */
  recoveryFraction: number;
  /** Weapon travel along the view axis, in metres. */
  kickback: number;
  /** Weapon muzzle rise, in radians. */
  punch: number;
  /** Camera shake intensity (0..1). */
  shake: number;
}

export interface SpreadConfig {
  /** Cone half angle while standing still and hip firing, in radians. */
  base: number;
  /** Multiplier applied at full ADS. */
  adsMultiplier: number;
  /** Bloom added per shot. */
  perShot: number;
  /** Bloom ceiling. */
  max: number;
  /** Bloom recovery in radians per second. */
  recovery: number;
  /** Extra spread at full running speed. */
  movePenalty: number;
}

export interface ScopeConfig {
  /** ADS progress at which the weapon is swapped for the scope overlay. */
  hideViewModelAt: number;
  magnificationLabel: string;
}

export interface AdsConfig {
  /** Seconds from hip to fully aimed. */
  time: number;
  fov: number;
  sensitivityMultiplier: number;
  recoilMultiplier: number;
  scope?: ScopeConfig;
}

export interface ProjectileConfig {
  /** Muzzle velocity in m/s. */
  velocity: number;
  gravityMultiplier: number;
  /** Quadratic drag factor: dv/dt = -drag * v². */
  drag: number;
  maxDistance: number;
  /** Drives target knockback and impact effects. */
  damage: number;
  /**
   * Projectiles launched per trigger pull. Shotguns fire a whole pattern, each
   * pellet sampled independently from the cone, which is what makes a shotgun
   * a shotgun rather than a slow rifle.
   */
  pellets?: number;
}

export interface ViewModelConfig {
  hipPosition: readonly [number, number, number];
  hipRotation: readonly [number, number, number];
  /** Distance from the eye to the sight when aimed. */
  adsDistance: number;
  swayAmount: number;
  bobAmount: number;
  /** Higher values follow the camera more slowly, reading as weight. */
  weight: number;
}

export interface WeaponAudioConfig {
  gain: number;
  /** Low frequency body of the shot: the thump you feel. */
  bodyFrequency: number;
  /** Bandpass centre of the crack: the tone of the report. */
  crackFrequency: number;
  /** Length of the crack, in seconds. */
  decay: number;
  /** Length of the close tail, in seconds. */
  tailDecay: number;
  /** Level of the mechanical action clack layered on top (0..1). */
  mechanical: number;
}

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  caliber: string;
  fireModes: readonly FireMode[];
  rpm: number;
  magazineSize: number;
  /**
   * Spare rounds carried outside the magazine. The shooting range ignores it
   * and reloads for free; zombies treats it as the real limit, which is what
   * makes the ammo boxes on the mansion walls worth buying.
   */
  reserveAmmo: number;
  reloadTime: number;
  equipTime: number;
  /** Defaults to `magazine`. */
  reloadStyle?: ReloadStyle;
  /** Present on bolt action weapons; blocks firing after each shot. */
  boltCycleTime?: number;
  recoil: RecoilConfig;
  spread: SpreadConfig;
  ads: AdsConfig;
  projectile: ProjectileConfig;
  /** Walk speed multiplier while hip firing. */
  movementMultiplier: number;
  /** Walk speed multiplier while aimed. */
  adsMovementMultiplier: number;
  viewModel: ViewModelConfig;
  audio: WeaponAudioConfig;
}
