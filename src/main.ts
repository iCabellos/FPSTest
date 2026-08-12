import './style.css';
import { Game } from './core/Game';

const container = document.querySelector<HTMLElement>('#app');
if (!container) throw new Error('#app container is missing');

const game = new Game(container);
game.start();

// Vite HMR would otherwise stack up renderers and event listeners.
if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
