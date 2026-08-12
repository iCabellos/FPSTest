/** Shot counters for the HUD. Hits are only counted on targets. */
export class SessionStats {
  private shots = 0;
  private hits = 0;
  private longestHit = 0;

  get shotsFired(): number {
    return this.shots;
  }

  get hitCount(): number {
    return this.hits;
  }

  get longestHitDistance(): number {
    return this.longestHit;
  }

  /** Hit ratio in 0..1; zero until the first shot is fired. */
  get accuracy(): number {
    return this.shots === 0 ? 0 : this.hits / this.shots;
  }

  recordShot(): void {
    this.shots++;
  }

  recordHit(distance: number): void {
    this.hits++;
    if (distance > this.longestHit) this.longestHit = distance;
  }

  reset(): void {
    this.shots = 0;
    this.hits = 0;
    this.longestHit = 0;
  }
}
