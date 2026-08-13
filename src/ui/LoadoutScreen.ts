import type { Loadout, WeaponChoice } from '../loadout/loadout';
import { RANGE_PRIMARIES, SIDEARMS, ZOMBIES_STARTERS } from '../loadout/loadout';
import type { WeaponId } from '../weapons/WeaponDefinition';

export type LoadoutKind = 'range' | 'zombies';

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
 * Between the menu and the match: pick what you carry in.
 *
 * The range lets you choose a primary and a sidearm. Zombies only lets you
 * choose the pistol you open with — everything else is earned in the mansion.
 */
export class LoadoutScreen {
  private readonly root = element('div', 'loadout loadout--hidden');
  private readonly primaryRow = element('div', 'loadout__row');
  private readonly secondaryRow = element('div', 'loadout__row');
  /** Which sidearm list this screen is showing; depends on the mode. */
  private sidearms: readonly WeaponChoice[] = SIDEARMS;
  private readonly primarySection = element('div', 'loadout__section');
  private readonly subtitle = element('div', 'loadout__subtitle', '');
  private readonly cards = new Map<string, HTMLElement>();

  private kind: LoadoutKind = 'range';
  private selection: Loadout = { primary: 'm4a1', secondary: 'm9' };

  constructor(
    container: HTMLElement,
    private readonly handlers: { onDeploy: (loadout: Loadout) => void; onBack: () => void },
  ) {
    const title = element('h2', 'loadout__title', 'LOADOUT');

    this.primarySection.append(element('div', 'loadout__label', 'PRIMARY'), this.primaryRow);
    const secondarySection = element('div', 'loadout__section');
    secondarySection.append(element('div', 'loadout__label', 'SIDEARM'), this.secondaryRow);

    const deploy = element('button', 'menu__button menu__button--primary', 'DEPLOY');
    deploy.type = 'button';
    deploy.addEventListener('click', () => this.handlers.onDeploy({ ...this.selection }));

    const back = element('button', 'menu__button menu__button--ghost', 'BACK');
    back.type = 'button';
    back.addEventListener('click', () => this.handlers.onBack());

    this.root.append(title, this.subtitle, this.primarySection, secondarySection, deploy, back);
    container.append(this.root);
  }

  open(kind: LoadoutKind, initial: Loadout): void {
    this.kind = kind;
    this.selection = { ...initial };
    this.cards.clear();

    const zombies = kind === 'zombies';
    this.primarySection.classList.toggle('loadout__section--hidden', zombies);
    this.subtitle.textContent = zombies
      ? 'You start the mansion with a sidearm. Everything else is bought inside.'
      : 'Carry a primary and a sidearm. Press Q in the match to swap.';

    if (!zombies) this.fill(this.primaryRow, RANGE_PRIMARIES, 'primary');
    // Zombies opens on a plain pistol; the range can take any sidearm.
    this.sidearms = zombies ? ZOMBIES_STARTERS : SIDEARMS;
    this.fill(this.secondaryRow, this.sidearms, 'secondary');

    this.root.classList.remove('loadout--hidden');
  }

  close(): void {
    this.root.classList.add('loadout--hidden');
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('loadout--hidden');
  }

  dispose(): void {
    this.root.remove();
  }

  private fill(row: HTMLElement, choices: readonly WeaponChoice[], slot: keyof Loadout): void {
    row.replaceChildren();
    for (const choice of choices) {
      const card = element('button', 'loadout__card');
      (card as HTMLButtonElement).type = 'button';
      card.append(
        element('div', 'loadout__name', choice.name),
        element('div', 'loadout__category', choice.category),
        element('div', 'loadout__summary', choice.summary),
      );
      card.addEventListener('click', () => this.select(slot, choice.id));
      this.cards.set(`${slot}:${choice.id}`, card);
      row.append(card);
    }
    this.refresh(slot, choices);
  }

  private select(slot: keyof Loadout, id: WeaponId): void {
    this.selection[slot] = id;
    // Zombies uses the same pistol in both slots: there is only one gun.
    if (this.kind === 'zombies' && slot === 'secondary') this.selection.primary = id;
    this.refresh(slot, slot === 'primary' ? RANGE_PRIMARIES : this.sidearms);
  }

  private refresh(slot: keyof Loadout, choices: readonly WeaponChoice[]): void {
    for (const choice of choices) {
      const card = this.cards.get(`${slot}:${choice.id}`);
      card?.classList.toggle('loadout__card--selected', this.selection[slot] === choice.id);
    }
  }
}
