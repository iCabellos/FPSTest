import { MAX_DELTA } from './constants';

/** requestAnimationFrame driver with a clamped delta and a smoothed FPS readout. */
export class GameLoop {
  private handle = 0;
  private lastTime = 0;
  private running = false;
  private smoothedFps = 60;

  constructor(private readonly onFrame: (dt: number) => void) {}

  get fps(): number {
    return this.smoothedFps;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.handle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.handle);
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.handle = requestAnimationFrame(this.tick);

    const rawDelta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (rawDelta > 0) this.smoothedFps += (1 / rawDelta - this.smoothedFps) * 0.08;

    this.onFrame(Math.min(rawDelta, MAX_DELTA));
  };
}
