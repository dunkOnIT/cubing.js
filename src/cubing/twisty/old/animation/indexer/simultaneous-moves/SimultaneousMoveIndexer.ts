import { Alg, Move } from "../../../../../alg";
import type {
  PuzzleWrapper,
  State,
} from "../../../../views/3D/puzzles/KPuzzleWrapper";
import {
  Direction,
  Duration,
  PuzzlePosition,
  Timestamp,
} from "../../cursor/CursorTypes";
import type { AlgIndexer } from "../AlgIndexer";
import { AnimatedLeafUnit, AnimLeafWithRange, simulMoves } from "./simul-moves";

const demos: Record<string, AnimLeafWithRange[]> = {
  "y' y' U' E D R2 r2 F2 B2 U E D' R2 L2' z2 S2 U U D D S2 F2' B2": [
    { animLeaf: new Move("y", -1), start: 0, end: 1000 },
    { animLeaf: new Move("y", -1), start: 1000, end: 2000 },
    { animLeaf: new Move("U", -1), start: 1000, end: 1600 },
    { animLeaf: new Move("E", 1), start: 1200, end: 1800 },
    { animLeaf: new Move("D"), start: 1400, end: 2000 },
    { animLeaf: new Move("R", 2), start: 2000, end: 3500 },
    { animLeaf: new Move("r", 2), start: 2000, end: 3500 },
    { animLeaf: new Move("F", 2), start: 3500, end: 4200 },
    { animLeaf: new Move("B", 2), start: 3800, end: 4500 },
    { animLeaf: new Move("U", 1), start: 4500, end: 5500 },
    { animLeaf: new Move("E", 1), start: 4500, end: 5500 },
    { animLeaf: new Move("D", -1), start: 4500, end: 5500 },
    { animLeaf: new Move("R", 2), start: 5500, end: 6500 },
    { animLeaf: new Move("L", -2), start: 5500, end: 6500 },
    { animLeaf: new Move("z", 2), start: 5500, end: 6500 },
    { animLeaf: new Move("S", 2), start: 6500, end: 7500 },
    { animLeaf: new Move("U"), start: 7500, end: 8000 },
    { animLeaf: new Move("U"), start: 8000, end: 8500 },
    { animLeaf: new Move("D"), start: 7750, end: 8250 },
    { animLeaf: new Move("D"), start: 8250, end: 8750 },
    { animLeaf: new Move("S", 2), start: 8750, end: 9250 },
    { animLeaf: new Move("F", -2), start: 8750, end: 10000 },
    { animLeaf: new Move("B", 2), start: 8750, end: 10000 },
  ],
  "M' R' U' D' M R": [
    { animLeaf: new Move("M", -1), start: 0, end: 1000 },
    { animLeaf: new Move("R", -1), start: 0, end: 1000 },
    { animLeaf: new Move("U", -1), start: 1000, end: 2000 },
    { animLeaf: new Move("D", -1), start: 1000, end: 2000 },
    { animLeaf: new Move("M"), start: 2000, end: 3000 },
    { animLeaf: new Move("R"), start: 2000, end: 3000 },
  ],
  "U' E' r E r2' E r U E": [
    { animLeaf: new Move("U", -1), start: 0, end: 1000 },
    { animLeaf: new Move("E", -1), start: 0, end: 1000 },
    { animLeaf: new Move("r"), start: 1000, end: 2500 },
    { animLeaf: new Move("E"), start: 2500, end: 3500 },
    { animLeaf: new Move("r", -2), start: 3500, end: 5000 },
    { animLeaf: new Move("E"), start: 5000, end: 6000 },
    { animLeaf: new Move("r"), start: 6000, end: 7000 },
    { animLeaf: new Move("U"), start: 7000, end: 8000 },
    { animLeaf: new Move("E"), start: 7000, end: 8000 },
  ],
};

export class SimultaneousMoveIndexer<P extends PuzzleWrapper>
  implements AlgIndexer<P>
{
  private animLeaves: AnimLeafWithRange[];
  // TODO: Allow custom `durationFn`.

  constructor(private puzzle: P, alg: Alg) {
    this.animLeaves = demos[alg.toString()] ?? simulMoves(alg);
    // TODO: Avoid assuming all base moves are block moves.
  }

  public getAnimLeaf(index: number): AnimatedLeafUnit {
    return this.animLeaves[Math.min(index, this.animLeaves.length - 1)]
      .animLeaf;
  }

  private getAnimLeafWithRange(index: number): AnimLeafWithRange {
    return this.animLeaves[Math.min(index, this.animLeaves.length - 1)];
  }

  public indexToMoveStartTimestamp(index: number): Timestamp {
    let start = 0;
    if (this.animLeaves.length > 0) {
      start =
        this.animLeaves[Math.min(index, this.animLeaves.length - 1)].start;
    }
    return start;
  }

  public timestampToIndex(timestamp: Timestamp): number {
    let i = 0;
    for (i = 0; i < this.animLeaves.length; i++) {
      if (this.animLeaves[i].start >= timestamp) {
        return Math.max(0, i - 1);
      }
    }
    return Math.max(0, i - 1);
  }

  public timestampToPosition(
    timestamp: Timestamp,
    startTransformation?: State<P>,
  ): PuzzlePosition {
    const position: PuzzlePosition = {
      state: startTransformation ?? (this.puzzle.identity() as any),
      movesInProgress: [],
    };
    for (const leafWithRange of this.animLeaves) {
      if (leafWithRange.end <= timestamp) {
        const move = leafWithRange.animLeaf.as(Move);
        if (move !== null) {
          position.state = this.puzzle.combine(
            position.state,
            this.puzzle.stateFromMove(move),
          ) as any;
        }
      } else if (
        leafWithRange.start < timestamp &&
        timestamp < leafWithRange.end
      ) {
        const move = leafWithRange.animLeaf.as(Move);
        if (move !== null) {
          position.movesInProgress.push({
            move: move,
            direction: Direction.Forwards,
            fraction:
              (timestamp - leafWithRange.start) /
              (leafWithRange.end - leafWithRange.start),
          });
        }
      } else if (timestamp < leafWithRange.start) {
        continue;
      }
    }
    return position;
  }

  public stateAtIndex(index: number, startTransformation?: State<P>): State<P> {
    let state = startTransformation ?? this.puzzle.startState();
    for (let i = 0; i < this.animLeaves.length && i < index; i++) {
      const leafWithRange = this.animLeaves[i];
      const move = leafWithRange.animLeaf.as(Move);
      if (move !== null) {
        state = this.puzzle.combine(state, this.puzzle.stateFromMove(move));
      }
    }
    return state;
  }

  public transformAtIndex(index: number): State<P> {
    let state = this.puzzle.identity();
    for (const leafWithRange of this.animLeaves.slice(0, index)) {
      const move = leafWithRange.animLeaf.as(Move);
      if (move !== null) {
        state = this.puzzle.combine(state, this.puzzle.stateFromMove(move));
      }
    }
    return state;
  }

  public algDuration(): Duration {
    let max = 0;
    for (const leafWithRange of this.animLeaves) {
      max = Math.max(max, leafWithRange.end);
    }
    return max;
  }

  public numAnimatedLeaves(): number {
    // TODO: Cache internally once performance matters.
    return this.animLeaves.length;
  }

  public moveDuration(index: number): number {
    const move = this.getAnimLeafWithRange(index);
    return move.end - move.start;
  }
}
