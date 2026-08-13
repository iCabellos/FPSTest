export interface ZombiesHudState {
  round: number;
  points: number;
  health: number;
  maxHealth: number;
  weaponName: string;
  ammo: number;
  /** Spare rounds left; Infinity where ammo is free. */
  reserve: number;
  magazineSize: number;
  zombiesLeft: number;
  /** Prompt shown when standing at a buyable barrier, or null. */
  prompt: string | null;
  /** Affordable prompts read differently from ones you cannot pay for. */
  promptAffordable: boolean;
  /** Banner text for round changes and death, or null. */
  banner: string | null;
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
 * Zombies HUD. Like the range HUD, every field caches its last value so a
 * frame that changes nothing performs no DOM work.
 */
export class ZombiesHud {
  private readonly root = element('div', 'overlay hud zhud');
  private readonly round = element('div', 'zhud__round', 'ROUND 1');
  private readonly points = element('div', 'zhud__points', '0');
  private readonly healthFill = element('div', 'zhud__health-fill');
  private readonly weapon = element('div', 'hud__weapon-name', '');
  private readonly ammo = element('div', 'hud__ammo', '');
  private readonly zombies = element('span', '', '0');
  private readonly prompt = element('div', 'zhud__prompt', '');
  private readonly banner = element('div', 'zhud__banner', '');
  private readonly fps = element('div', 'hud__fps', '');
  private readonly crosshair = element('div', 'crosshair');
  private readonly hitmarker = element('div', 'hitmarker');

  private last: Partial<ZombiesHudState> = {};

  constructor(container: HTMLElement) {
    const left = element('div', 'hud__panel zhud__panel--left');
    const health = element('div', 'zhud__health');
    health.append(this.healthFill);
    left.append(this.round, element('div', 'hud__label', 'POINTS'), this.points, health);

    const right = element('div', 'hud__panel hud__panel--weapon');
    const zombieRow = element('div', 'hud__row');
    zombieRow.append(element('span', 'hud__label', 'ZOMBIES'), this.zombies);
    right.append(this.weapon, this.ammo, zombieRow);

    for (const modifier of ['up', 'down', 'left', 'right']) {
      this.crosshair.append(element('div', `crosshair__bar crosshair__bar--${modifier}`));
    }
    this.crosshair.append(element('div', 'crosshair__dot'));

    this.root.append(left, right, this.prompt, this.banner, this.fps, this.crosshair, this.hitmarker);
    container.append(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hud--visible', visible);
  }

  flashHit(): void {
    this.hitmarker.classList.remove('hitmarker--hit');
    void this.hitmarker.offsetWidth;
    this.hitmarker.classList.add('hitmarker--hit');
  }

  update(state: ZombiesHudState): void {
    if (state.round !== this.last.round) {
      this.round.textContent = `ROUND ${state.round}`;
      this.last.round = state.round;
    }
    if (state.points !== this.last.points) {
      this.points.textContent = state.points.toLocaleString('en-US');
      this.last.points = state.points;
    }
    if (state.health !== this.last.health) {
      const fraction = Math.max(0, state.health) / state.maxHealth;
      this.healthFill.style.width = `${(fraction * 100).toFixed(1)}%`;
      this.healthFill.classList.toggle('zhud__health-fill--low', fraction < 0.34);
      this.last.health = state.health;
    }
    if (state.weaponName !== this.last.weaponName) {
      this.weapon.textContent = state.weaponName;
      this.last.weaponName = state.weaponName;
    }
    if (state.ammo !== this.last.ammo || state.reserve !== this.last.reserve) {
      // Magazine over spare: what matters in the mansion is what is left to
      // load, not the size of the magazine you already know.
      const reserve = Number.isFinite(state.reserve) ? `${state.reserve}` : '\u221e';
      this.ammo.textContent = `${state.ammo} / ${reserve}`;
      this.ammo.classList.toggle(
        'hud__ammo--low',
        state.ammo <= state.magazineSize * 0.25 || state.reserve === 0,
      );
      this.last.ammo = state.ammo;
      this.last.reserve = state.reserve;
    }
    if (state.zombiesLeft !== this.last.zombiesLeft) {
      this.zombies.textContent = `${state.zombiesLeft}`;
      this.last.zombiesLeft = state.zombiesLeft;
    }
    if (state.prompt !== this.last.prompt || state.promptAffordable !== this.last.promptAffordable) {
      this.prompt.textContent = state.prompt ?? '';
      this.prompt.classList.toggle('zhud__prompt--visible', state.prompt !== null);
      this.prompt.classList.toggle('zhud__prompt--poor', !state.promptAffordable);
      this.last.prompt = state.prompt;
      this.last.promptAffordable = state.promptAffordable;
    }
    if (state.banner !== this.last.banner) {
      this.banner.textContent = state.banner ?? '';
      this.banner.classList.toggle('zhud__banner--visible', state.banner !== null);
      this.last.banner = state.banner;
    }
    const fps = Math.round(state.fps);
    if (fps !== this.last.fps) {
      this.fps.textContent = `${fps} FPS`;
      this.last.fps = fps;
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
