import type * as THREE from 'three';

export interface NavNode {
  readonly id: number;
  readonly position: THREE.Vector3;
  /** Zone this node belongs to, used for spawn selection. */
  readonly zone: string;
}

interface NavEdge {
  readonly to: number;
  readonly cost: number;
  /** When set, the edge is only passable once that barrier is open. */
  readonly barrier: string | null;
}

export type BarrierPredicate = (barrierId: string) => boolean;

/**
 * Waypoint graph used for zombie navigation. A graph rather than a grid keeps
 * three floors, stairs and gated doorways cheap and exact: a doorway is one
 * edge, so closing it genuinely removes the route instead of relying on
 * collision to stop anyone walking through.
 */
export class NavGraph {
  private readonly nodes: NavNode[] = [];
  private readonly edges: NavEdge[][] = [];

  /** Scratch state for the search, reused so pathfinding never allocates. */
  private readonly cameFrom: Int32Array;
  private readonly costSoFar: Float64Array;
  private readonly visited: Uint8Array;
  private readonly queue: number[] = [];

  constructor(capacity = 256) {
    this.cameFrom = new Int32Array(capacity);
    this.costSoFar = new Float64Array(capacity);
    this.visited = new Uint8Array(capacity);
  }

  addNode(position: THREE.Vector3, zone: string): number {
    const id = this.nodes.length;
    this.nodes.push({ id, position: position.clone(), zone });
    this.edges.push([]);
    return id;
  }

  /** Two way link. `barrier` gates passage in both directions. */
  connect(a: number, b: number, barrier: string | null = null): void {
    const cost = this.nodes[a].position.distanceTo(this.nodes[b].position);
    this.edges[a].push({ to: b, cost, barrier });
    this.edges[b].push({ to: a, cost, barrier });
  }

  get nodeCount(): number {
    return this.nodes.length;
  }

  node(id: number): NavNode {
    return this.nodes[id];
  }

  nodesInZone(zone: string): NavNode[] {
    return this.nodes.filter((candidate) => candidate.zone === zone);
  }

  /** Nearest node by straight line distance, ignoring walls. */
  nearest(position: THREE.Vector3): number {
    let best = 0;
    let bestDistance = Infinity;
    for (const candidate of this.nodes) {
      const distance = candidate.position.distanceToSquared(position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate.id;
      }
    }
    return best;
  }

  /**
   * Dijkstra over the open subgraph. Paths are short (tens of nodes), so the
   * simple queue beats the bookkeeping of a binary heap here.
   *
   * @returns node ids from `from` to `to`, or null when no open route exists.
   */
  findPath(from: number, to: number, isOpen: BarrierPredicate): number[] | null {
    if (from === to) return [to];

    const count = this.nodes.length;
    this.cameFrom.fill(-1, 0, count);
    this.costSoFar.fill(Infinity, 0, count);
    this.visited.fill(0, 0, count);
    this.queue.length = 0;

    this.costSoFar[from] = 0;
    this.queue.push(from);

    while (this.queue.length > 0) {
      // Pick the cheapest frontier node.
      let bestIndex = 0;
      for (let i = 1; i < this.queue.length; i++) {
        if (this.costSoFar[this.queue[i]] < this.costSoFar[this.queue[bestIndex]]) bestIndex = i;
      }
      const current = this.queue.splice(bestIndex, 1)[0];
      if (current === to) return this.rebuild(from, to);
      if (this.visited[current]) continue;
      this.visited[current] = 1;

      for (const edge of this.edges[current]) {
        if (edge.barrier !== null && !isOpen(edge.barrier)) continue;
        const next = this.costSoFar[current] + edge.cost;
        if (next >= this.costSoFar[edge.to]) continue;
        this.costSoFar[edge.to] = next;
        this.cameFrom[edge.to] = current;
        if (!this.visited[edge.to]) this.queue.push(edge.to);
      }
    }
    return null;
  }

  private rebuild(from: number, to: number): number[] {
    const path: number[] = [to];
    let cursor = to;
    while (cursor !== from) {
      cursor = this.cameFrom[cursor];
      if (cursor < 0) return path;
      path.push(cursor);
    }
    path.reverse();
    return path;
  }
}
