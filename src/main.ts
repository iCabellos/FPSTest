import './style.css';
import { App } from './core/App';

const container = document.querySelector<HTMLElement>('#app');
if (!container) throw new Error('#app container is missing');

const app = new App(container);
app.start();

// Vite HMR would otherwise stack up renderers and event listeners.
if (import.meta.hot) {
  import.meta.hot.dispose(() => app.dispose());
}
