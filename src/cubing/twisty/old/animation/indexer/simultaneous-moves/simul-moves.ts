import {
  LineComment,
  Commutator,
  Conjugate,
  Pause,
  TraversalUp,
  Move,
  Alg,
  Grouping,
  Newline,
} from "../../../../../alg";
import type { MillisecondTimestamp } from "../../cursor/CursorTypes";
import { defaultDurationForAmount } from "../AlgDuration";

export type AnimatedLeafUnit = Move | Pause;
export interface LocalAnimLeavesWithRange {
  animLeafUnit: AnimatedLeafUnit;
  msUntilNext: MillisecondTimestamp;
  duration: MillisecondTimestamp;
}

export interface AnimLeafWithRange {
  animLeaf: AnimatedLeafUnit;
  start: MillisecondTimestamp;
  end: MillisecondTimestamp;
}

const axisLookup: Record<string, "x" | "y" | "z"> = {
  u: "y",
  l: "x",
  f: "z",
  r: "x",
  b: "z",
  d: "y",
  m: "x",
  e: "y",
  s: "z",
  x: "x",
  y: "y",
  z: "z",
};

function isSameAxis(move1: Move, move2: Move): boolean {
  return (
    axisLookup[move1.family[0].toLowerCase()] ===
    axisLookup[move2.family[0].toLowerCase()]
  );
}

// TODO: Replace this with an optimized implementation.
// TODO: Consider `(x U)` and `(U x F)` to be simultaneous.
export class LocalSimulMoves extends TraversalUp<LocalAnimLeavesWithRange[]> {
  public traverseAlg(alg: Alg): LocalAnimLeavesWithRange[] {
    const processed: LocalAnimLeavesWithRange[][] = [];
    for (const nestedUnit of alg.units()) {
      processed.push(this.traverseUnit(nestedUnit));
    }
    return Array.prototype.concat(...processed);
  }

  public traverseGroupingOnce(alg: Alg): LocalAnimLeavesWithRange[] {
    if (alg.experimentalIsEmpty()) {
      return [];
    }

    for (const unit of alg.units()) {
      if (!unit.is(Move))
        // TODO: define the type statically on the class?
        return this.traverseAlg(alg);
    }

    const moves = Array.from(alg.units()) as Move[];
    let maxSimulDur = defaultDurationForAmount(moves[0].amount);
    for (let i = 0; i < moves.length - 1; i++) {
      for (let j = 1; j < moves.length; j++) {
        if (!isSameAxis(moves[i], moves[j])) {
          return this.traverseAlg(alg);
        }
      }
      maxSimulDur = Math.max(
        maxSimulDur,
        defaultDurationForAmount(moves[i].amount),
      );
    }

    const localMovesWithRange: LocalAnimLeavesWithRange[] = moves.map(
      (blockMove): LocalAnimLeavesWithRange => {
        return {
          animLeafUnit: blockMove,
          msUntilNext: 0,
          duration: maxSimulDur,
        };
      },
    );
    localMovesWithRange[localMovesWithRange.length - 1].msUntilNext =
      maxSimulDur;
    return localMovesWithRange;
  }

  public traverseGrouping(grouping: Grouping): LocalAnimLeavesWithRange[] {
    const processed: LocalAnimLeavesWithRange[][] = [];

    const segmentOnce: Alg =
      grouping.amount > 0 ? grouping.alg : grouping.alg.invert();
    for (let i = 0; i < Math.abs(grouping.amount); i++) {
      processed.push(this.traverseGroupingOnce(segmentOnce));
    }
    return Array.prototype.concat(...processed);
  }

  public traverseMove(move: Move): LocalAnimLeavesWithRange[] {
    const duration = defaultDurationForAmount(move.amount);
    return [
      {
        animLeafUnit: move,
        msUntilNext: duration,
        duration,
      },
    ];
  }

  public traverseCommutator(
    commutator: Commutator,
  ): LocalAnimLeavesWithRange[] {
    const processed: LocalAnimLeavesWithRange[][] = [];
    const segmentsOnce: Alg[] = [
      commutator.A,
      commutator.B,
      commutator.A.invert(),
      commutator.B.invert(),
    ];
    for (const segment of segmentsOnce) {
      processed.push(this.traverseGroupingOnce(segment));
    }
    return Array.prototype.concat(...processed);
  }

  public traverseConjugate(conjugate: Conjugate): LocalAnimLeavesWithRange[] {
    const processed: LocalAnimLeavesWithRange[][] = [];
    const segmentsOnce: Alg[] = [
      conjugate.A,
      conjugate.B,
      conjugate.A.invert(),
    ];
    for (const segment of segmentsOnce) {
      processed.push(this.traverseGroupingOnce(segment));
    }
    return Array.prototype.concat(...processed);
  }

  public traversePause(pause: Pause): LocalAnimLeavesWithRange[] {
    const duration = defaultDurationForAmount(1);
    return [
      {
        animLeafUnit: pause,
        msUntilNext: duration, // TODO
        duration,
      },
    ];
  }

  public traverseNewline(_newline: Newline): LocalAnimLeavesWithRange[] {
    return [];
  }

  public traverseLineComment(
    _comment: LineComment,
  ): LocalAnimLeavesWithRange[] {
    return [];
  }
}

const localSimulMovesInstance = new LocalSimulMoves();

const localSimulMoves = localSimulMovesInstance.traverseAlg.bind(
  localSimulMovesInstance,
) as (a: Alg) => LocalAnimLeavesWithRange[];

export function simulMoves(a: Alg): AnimLeafWithRange[] {
  let timestamp = 0;
  const l = localSimulMoves(a).map(
    (localSimulMove: LocalAnimLeavesWithRange): AnimLeafWithRange => {
      const leafWithRange = {
        animLeaf: localSimulMove.animLeafUnit,
        start: timestamp,
        end: timestamp + localSimulMove.duration,
      };
      timestamp += localSimulMove.msUntilNext;
      return leafWithRange;
    },
  );
  return l;
}
