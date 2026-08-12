export type MenuAction = { kind: 'range' } | { kind: 'zombies' };

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

const CONTROLS: ReadonlyArray<readonly [string, string]> = [
  ['WASD', 'Move'],
  ['MOUSE', 'Aim'],
  ['LMB', 'Fire'],
  ['RMB', 'Aim down sights'],
  ['R', 'Reload'],
  ['B', 'Fire mode'],
  ['F', 'Buy / interact'],
  ['Q', 'Swap weapon'],
  ['ESC', 'Pause'],
];

/**
 * Front end shell: mode selection and the pause card. Purely presentational —
 * every choice is reported through callbacks.
 */
export class MainMenu {
  private readonly root = element('div', 'menu');
  private readonly panels = new Map<string, HTMLElement>();
  private readonly title = element('h1', 'menu__title', 'MANSION PROTOCOL');
  private readonly subtitle = element('div', 'menu__subtitle', 'THREE.JS FPS');

  constructor(
    container: HTMLElement,
    private readonly handlers: {
      onAction: (action: MenuAction) => void;
      onResume: () => void;
      onQuit: () => void;
    },
  ) {
    this.root.append(this.title, this.subtitle);
    this.root.append(
      this.buildRootPanel(),
      this.buildPausePanel(),
      this.buildControls(),
    );
    container.append(this.root);
    this.show('root');
  }

  openRoot(): void {
    this.show('root');
    this.root.classList.remove('menu--hidden');
  }

  openPause(): void {
    this.show('pause');
    this.root.classList.remove('menu--hidden');
  }

  close(): void {
    this.root.classList.add('menu--hidden');
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('menu--hidden');
  }

  dispose(): void {
    this.root.remove();
  }

  private show(panel: string): void {
    for (const [name, node] of this.panels) {
      node.classList.toggle('menu__panel--active', name === panel);
    }
    this.title.classList.toggle('menu__title--small', panel === 'pause');
  }

  private button(label: string, onClick: () => void, variant = ''): HTMLButtonElement {
    const node = element('button', `menu__button ${variant}`.trim(), label);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  }

  private buildRootPanel(): HTMLElement {
    const panel = element('div', 'menu__panel');
    panel.append(
      element('div', 'menu__label', 'SELECT MODE'),
      this.button(
        'SHOOTING RANGE',
        () => this.handlers.onAction({ kind: 'range' }),
        'menu__button--primary',
      ),
      element('div', 'menu__hint', 'Zero your weapons on steel from 25 to 200 m.'),
      this.button('ZOMBIES', () => this.handlers.onAction({ kind: 'zombies' }), 'menu__button--primary'),
      element('div', 'menu__hint', 'Survive rounds through a three storey mansion. Solo.'),
    );
    this.panels.set('root', panel);
    return panel;
  }

  private buildPausePanel(): HTMLElement {
    const panel = element('div', 'menu__panel');
    panel.append(
      element('div', 'menu__label', 'PAUSED'),
      this.button('RESUME', () => this.handlers.onResume(), 'menu__button--primary'),
      this.button('QUIT TO MENU', () => this.handlers.onQuit(), 'menu__button--ghost'),
    );
    this.panels.set('pause', panel);
    return panel;
  }

  private buildControls(): HTMLElement {
    const grid = element('div', 'menu__controls');
    for (const [key, action] of CONTROLS) {
      grid.append(element('span', 'menu__key', key), element('span', '', action));
    }
    return grid;
  }
}
