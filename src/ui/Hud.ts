export interface HudState {
  ammo: number;
  magazineSize: number;
  fireMode: string;
  /** Metres to whatever sits under the crosshair, or null when nothing does. */
  aimDistance: number | null;
  accuracy: number;
  hits: number;
  shots: number;
  /** Longest confirmed hit this session, in metres. */
  bestHit: number;
  /** Crosshair radius in pixels, derived from the current cone. */
  crosshairRadius: number;
  hideCrosshair: boolean;
  reloading: boolean;
  empty: boolean;
  fps: number;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * DOM based HUD. Every field caches its last value so a frame that changes
 * nothing performs no DOM work at all.
 */
export class Hud {
  private readonly root = element('div', 'overlay hud');
  private readonly weaponName = element('div', 'hud__weapon-name', '');
  private readonly caliber = element('div', 'hud__label', '');
  private readonly ammo = element('div', 'hud__ammo', '');
  private readonly fireMode = element('span', '', '');
  private readonly accuracy = element('span', '', '');
  private readonly hits = element('span', '', '');
  private readonly best = element('span', '', '');
  private readonly range = element('div', 'hud__range', '');
  private readonly fps = element('div', 'hud__fps', '');
  private readonly hint = element('div', 'hud__hint', 'RELOAD [R]');
  private readonly crosshair = element('div', 'crosshair');
  private readonly hitmarker = element('div', 'hitmarker');

  private lastAmmo = -1;
  private lastRadius = -1;
  private lastAccuracy = -1;
  private lastHits = -1;
  private lastShots = -1;
  private lastDistance = -1;
  private lastBest = -1;
  private lastFps = -1;
  private lastFireMode = '';
  private lastHideCrosshair: boolean | null = null;
  private lastHint: boolean | null = null;
  private lastLowAmmo: boolean | null = null;

  constructor(container: HTMLElement) {
    const weaponPanel = element('div', 'hud__panel hud__panel--weapon');
    weaponPanel.append(
      this.weaponName,
      this.caliber,
      this.ammo,
      this.labelledRow('MODE', this.fireMode),
    );

    const statsPanel = element('div', 'hud__panel hud__panel--stats');
    statsPanel.append(
      this.labelledRow('ACCURACY', this.accuracy),
      this.labelledRow('HITS', this.hits),
      this.labelledRow('BEST', this.best),
    );

    for (const modifier of ['up', 'down', 'left', 'right']) {
      this.crosshair.append(element('div', `crosshair__bar crosshair__bar--${modifier}`));
    }
    this.crosshair.append(element('div', 'crosshair__dot'));

    this.root.append(
      weaponPanel,
      statsPanel,
      this.range,
      this.fps,
      this.hint,
      this.crosshair,
      this.hitmarker,
    );
    container.append(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hud--visible', visible);
  }

  /** Restarts the hit marker animation; centre hits read differently. */
  flashHit(bullseye: boolean): void {
    this.hitmarker.classList.remove('hitmarker--hit');
    // Force a reflow so the animation can replay on consecutive hits.
    void this.hitmarker.offsetWidth;
    this.hitmarker.classList.toggle('hitmarker--bullseye', bullseye);
    this.hitmarker.classList.add('hitmarker--hit');
  }

  setWeapon(name: string, caliber: string): void {
    this.weaponName.textContent = name;
    this.caliber.textContent = caliber;
  }

  update(state: HudState): void {
    if (state.ammo !== this.lastAmmo) {
      this.ammo.textContent = `${state.ammo} / ∞`;
      this.lastAmmo = state.ammo;
    }

    const lowAmmo = state.ammo <= Math.max(1, Math.floor(state.magazineSize * 0.2));
    if (lowAmmo !== this.lastLowAmmo) {
      this.ammo.classList.toggle('hud__ammo--low', lowAmmo);
      this.lastLowAmmo = lowAmmo;
    }

    if (state.fireMode !== this.lastFireMode) {
      this.fireMode.textContent = state.fireMode;
      this.lastFireMode = state.fireMode;
    }

    const accuracyPercent = Math.round(state.accuracy * 100);
    if (accuracyPercent !== this.lastAccuracy) {
      this.accuracy.textContent = `${accuracyPercent} %`;
      this.lastAccuracy = accuracyPercent;
    }

    if (state.hits !== this.lastHits || state.shots !== this.lastShots) {
      this.hits.textContent = `${state.hits} / ${state.shots}`;
      this.lastHits = state.hits;
      this.lastShots = state.shots;
    }

    const best = Math.round(state.bestHit);
    if (best !== this.lastBest) {
      this.best.textContent = best === 0 ? '-' : `${best} m`;
      this.lastBest = best;
    }

    const distance = state.aimDistance === null ? -1 : Math.round(state.aimDistance);
    if (distance !== this.lastDistance) {
      this.range.textContent = distance < 0 ? '' : `${distance} m`;
      this.lastDistance = distance;
    }

    const radius = Math.round(state.crosshairRadius);
    if (radius !== this.lastRadius) {
      this.crosshair.style.setProperty('--crosshair-gap', `${radius}px`);
      this.lastRadius = radius;
    }

    if (state.hideCrosshair !== this.lastHideCrosshair) {
      this.crosshair.style.opacity = state.hideCrosshair ? '0' : '1';
      this.lastHideCrosshair = state.hideCrosshair;
    }

    const showHint = state.empty && !state.reloading;
    if (showHint !== this.lastHint) {
      this.hint.classList.toggle('hud__hint--visible', showHint);
      this.lastHint = showHint;
    }

    const fps = Math.round(state.fps);
    if (fps !== this.lastFps) {
      this.fps.textContent = `${fps} FPS`;
      this.lastFps = fps;
    }
  }

  dispose(): void {
    this.root.remove();
  }

  private labelledRow(label: string, value: HTMLElement): HTMLElement {
    const row = element('div', 'hud__row');
    row.append(element('span', 'hud__label', label), value);
    return row;
  }
}
