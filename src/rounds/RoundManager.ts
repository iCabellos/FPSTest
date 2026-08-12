export type RoundPhase = 'idle' | 'spawning' | 'clearing' | 'intermission' | 'complete';

export interface RoundState {
  roundNumber: number;
  /** Total zombies belonging to this round. */
  zombiesToKill: number;
  zombiesKilled: number;
  zombiesAlive: number;
  zombiesRemainingToSpawn: number;
  phase: RoundPhase;
}

export interface RoundTuning {
  /** Zombies in round 1 for a single player. */
  baseCount: number;
  /** Extra zombies per round, compounded. */
  growth: number;
  /** Extra zombies per additional player, as a fraction. */
  perPlayer: number;
  /** Seconds between rounds. */
  intermission: number;
  /** Seconds between spawns; falls with the round number. */
  spawnInterval: number;
  minSpawnInterval: number;
  /** Live zombies allowed at once. */
  maxAlive: number;
}

export const DEFAULT_TUNING: RoundTuning = {
  baseCount: 6,
  growth: 1.28,
  perPlayer: 0.5,
  intermission: 6,
  spawnInterval: 1.6,
  minSpawnInterval: 0.35,
  maxAlive: 24,
};

/**
 * Authoritative round state.
 *
 * A round is only finished once every zombie that belongs to it has both
 * spawned and died — clearing the ones currently on the map is not enough
 * while the round still has walkers queued.
 */
export class RoundManager {
  private state: RoundState = {
    roundNumber: 0,
    zombiesToKill: 0,
    zombiesKilled: 0,
    zombiesAlive: 0,
    zombiesRemainingToSpawn: 0,
    phase: 'idle',
  };

  private timer = 0;
  private spawnTimer = 0;

  /** Fired when a new round starts, after its budget is set. */
  onRoundStart: ((round: number) => void) | null = null;

  constructor(
    private readonly tuning: RoundTuning = DEFAULT_TUNING,
    private playerCount = 1,
  ) {}

  get snapshot(): Readonly<RoundState> {
    return this.state;
  }

  get round(): number {
    return this.state.roundNumber;
  }

  get phase(): RoundPhase {
    return this.state.phase;
  }

  setPlayerCount(count: number): void {
    this.playerCount = Math.max(1, count);
  }

  /** Zombies in a given round, before the live cap is applied. */
  budgetFor(round: number): number {
    const scale = 1 + (this.playerCount - 1) * this.tuning.perPlayer;
    return Math.max(1, Math.round(this.tuning.baseCount * this.tuning.growth ** (round - 1) * scale));
  }

  begin(): void {
    this.startRound(1);
  }

  /** True when a zombie may be spawned right now. */
  shouldSpawn(dt: number): boolean {
    if (this.state.phase !== 'spawning') return false;
    if (this.state.zombiesRemainingToSpawn <= 0) return false;
    if (this.state.zombiesAlive >= this.tuning.maxAlive) return false;

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return false;

    const interval = Math.max(
      this.tuning.minSpawnInterval,
      this.tuning.spawnInterval - (this.state.roundNumber - 1) * 0.08,
    );
    this.spawnTimer = interval;
    return true;
  }

  /** Records that one queued zombie has entered the map. */
  registerSpawn(): void {
    if (this.state.zombiesRemainingToSpawn <= 0) return;
    this.state.zombiesRemainingToSpawn--;
    this.state.zombiesAlive++;
    if (this.state.zombiesRemainingToSpawn === 0) this.state.phase = 'clearing';
  }

  /** Records a kill belonging to the current round. */
  registerKill(): void {
    if (this.state.zombiesKilled >= this.state.zombiesToKill) return;
    this.state.zombiesKilled++;
    this.state.zombiesAlive = Math.max(0, this.state.zombiesAlive - 1);
  }

  /**
   * Clears every zombie left in this round, spawned or not, and completes it.
   * Used by the nuclear jackpot so no walkers are left pending.
   */
  completeRoundEarly(): void {
    if (this.state.phase === 'idle' || this.state.phase === 'intermission') return;
    this.state.zombiesKilled = this.state.zombiesToKill;
    this.state.zombiesAlive = 0;
    this.state.zombiesRemainingToSpawn = 0;
    this.finishRound();
  }

  update(dt: number): void {
    if (this.state.phase === 'intermission') {
      this.timer -= dt;
      if (this.timer <= 0) this.startRound(this.state.roundNumber + 1);
      return;
    }

    if (this.state.phase !== 'clearing') return;
    // Every zombie has spawned; the round ends when the last one falls.
    if (this.state.zombiesKilled >= this.state.zombiesToKill) this.finishRound();
  }

  private startRound(round: number): void {
    const budget = this.budgetFor(round);
    this.state = {
      roundNumber: round,
      zombiesToKill: budget,
      zombiesKilled: 0,
      zombiesAlive: 0,
      zombiesRemainingToSpawn: budget,
      phase: 'spawning',
    };
    this.spawnTimer = 1.2;
    this.onRoundStart?.(round);
  }

  private finishRound(): void {
    this.state.phase = 'intermission';
    this.timer = this.tuning.intermission;
  }
}
