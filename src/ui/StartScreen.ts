const CONTROLS: ReadonlyArray<readonly [string, string]> = [
  ['WASD', 'Move'],
  ['MOUSE', 'Aim'],
  ['LMB', 'Fire'],
  ['RMB', 'Aim down sights'],
  ['R', 'Reload'],
  ['B', 'Toggle fire mode'],
  ['1 - 4', 'M4A1 / AK-47 / M60 / L96'],
  ['5 - 7', 'MP5 / MP7 / UMP45'],
  ['T', 'Reset targets and stats'],
  ['ESC', 'Release pointer lock'],
];

/** Title card, and the pause card shown whenever pointer lock is lost. */
export class StartScreen {
  private readonly root = document.createElement('div');
  private readonly title = document.createElement('h1');
  private readonly cta = document.createElement('div');

  constructor(container: HTMLElement, onStart: () => void) {
    this.root.className = 'start';
    this.title.className = 'start__title';
    this.title.textContent = 'THREE.JS SHOOTING RANGE';
    this.cta.className = 'start__cta';
    this.cta.textContent = 'CLICK TO START';

    const controls = document.createElement('div');
    controls.className = 'start__controls';
    for (const [key, action] of CONTROLS) {
      const keyNode = document.createElement('span');
      keyNode.className = 'start__key';
      keyNode.textContent = key;
      const actionNode = document.createElement('span');
      actionNode.textContent = action;
      controls.append(keyNode, actionNode);
    }

    const note = document.createElement('p');
    note.className = 'start__note';
    note.textContent =
      'Rounds travel: they take time to arrive and drop over distance. Hold over the target at 100 m and beyond.';

    this.root.append(this.title, this.cta, controls, note);
    this.root.addEventListener('click', onStart);
    container.append(this.root);
  }

  show(paused: boolean): void {
    this.title.textContent = paused ? 'PAUSED' : 'THREE.JS SHOOTING RANGE';
    this.cta.textContent = paused ? 'CLICK TO RESUME' : 'CLICK TO START';
    this.root.classList.remove('start--hidden');
  }

  hide(): void {
    this.root.classList.add('start--hidden');
  }

  dispose(): void {
    this.root.remove();
  }
}
