/**
 * Scope illusion for the L96: the camera FOV does the zoom and this overlay
 * masks everything outside the ocular. No second render pass involved.
 */
export class ScopeOverlay {
  private readonly root = document.createElement('div');
  private visible = false;

  constructor(container: HTMLElement) {
    this.root.className = 'scope';

    const mask = document.createElement('div');
    mask.className = 'scope__mask';

    const glare = document.createElement('div');
    glare.className = 'scope__glare';

    const reticle = document.createElement('div');
    reticle.className = 'scope__reticle';
    const horizontal = document.createElement('div');
    horizontal.className = 'scope__line scope__line--h';
    const vertical = document.createElement('div');
    vertical.className = 'scope__line scope__line--v';
    reticle.append(horizontal, vertical);

    // Holdover marks below the centre, matching the drop of the .308 load.
    for (let i = 1; i <= 4; i++) {
      const mil = document.createElement('div');
      mil.className = 'scope__mil';
      mil.style.top = `${50 + i * 4}%`;
      mil.style.width = `${16 - i * 2}px`;
      mil.style.marginLeft = `${-(16 - i * 2) / 2}px`;
      reticle.append(mil);
    }

    const center = document.createElement('div');
    center.className = 'scope__center';

    this.root.append(glare, reticle, center, mask);
    container.append(this.root);
  }

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.root.classList.toggle('scope--visible', visible);
  }

  dispose(): void {
    this.root.remove();
  }
}
