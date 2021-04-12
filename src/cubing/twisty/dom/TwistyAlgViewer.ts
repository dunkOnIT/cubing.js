import {
  Alg,
  Grouping,
  LineComment,
  Commutator,
  Conjugate,
  Move,
  Newline,
  Pause,
  TraversalDownUp,
  Unit,
} from "../../alg";
import { experimentalDirect, ExperimentalIterationDirection } from "../../alg";
import { TwistyPlayer } from "../../twisty";
import { AlgCursor, TimeRange } from "../animation/cursor/AlgCursor";
import { MillisecondTimestamp } from "../animation/cursor/CursorTypes";
import {
  customElementsShim,
  HTMLElementShim,
} from "./element/node-custom-element-shims";
import {TreeAlgIndexer} from "../animation/indexer/tree/TreeAlgIndexer";
import { puzzles } from "../../puzzles";
import { KPuzzleWrapper } from "../3D/puzzles/KPuzzleWrapper";

class DataDown {
  earliestMoveIndex: number;
  twistyAlgViewer: ExperimentalTwistyAlgViewer;
  direction: ExperimentalIterationDirection;
}

class DataUp {
  moveCount: number;
  element: TwistyAlgWrapperElem | TwistyAlgLeafElem;
}

class TwistyAlgLeafElem extends HTMLElementShim {
  constructor(className: string, text: string, dataDown: DataDown, public algOrUnit: Alg | Unit) {
    super();
    this.textContent = text;
    this.classList.add(className);

    this.addEventListener("click", () => {
      dataDown.twistyAlgViewer.jumpToIndex(dataDown.earliestMoveIndex);
    });
  }

  pathToIndex(_index: number): (TwistyAlgWrapperElem | TwistyAlgLeafElem)[] {
    return [];
  }
}

customElementsShim.define("twisty-alg-leaf-elem", TwistyAlgLeafElem);

class TwistyAlgWrapperElem extends HTMLElementShim {
  private queue: (Element | Text)[] = [];

  constructor(className: string, public algOrUnit: Alg | Unit) {
    super();
    this.classList.add(className);
  }

  addString(str: string) {
    this.queue.push(document.createTextNode(str));
  }

  addElem(dataUp: DataUp): number {
    this.queue.push(dataUp.element);
    return dataUp.moveCount;
  }

  flushQueue(
    direction: ExperimentalIterationDirection = ExperimentalIterationDirection.Forwards,
  ): void {
    for (const node of maybeReverseList(this.queue, direction)) {
      this.append(node);
    }
    this.queue = [];
  }

  pathToIndex(_index: number): (TwistyAlgWrapperElem | TwistyAlgLeafElem)[] {
    return [];
  }
}

customElementsShim.define("twisty-alg-wrapper-elem", TwistyAlgWrapperElem);

function oppositeDirection(direction: ExperimentalIterationDirection): ExperimentalIterationDirection {
  return direction === ExperimentalIterationDirection.Forwards
    ? ExperimentalIterationDirection.Backwards
    : ExperimentalIterationDirection.Forwards;
}

function updateDirectionByAmount(
  currentDirection: ExperimentalIterationDirection,
  amount: number,
): ExperimentalIterationDirection {
  return amount < 0 ? oppositeDirection(currentDirection) : currentDirection;
}

function maybeReverseList<T>(l: T[], direction: ExperimentalIterationDirection): T[] {
  if (direction === ExperimentalIterationDirection.Forwards) {
    return l;
  }
  // console.log("rev", Array.from(l).reverse());
  // return Array.from(l).reverse();
  const copy = Array.from(l);
  copy.reverse();
  return copy;
}

class AlgToDOMTree extends TraversalDownUp<DataDown, DataUp, DataUp> {
  public traverseAlg(alg: Alg, dataDown: DataDown): DataUp {
    let moveCount = 0;
    const element = new TwistyAlgWrapperElem("twisty-alg-sequence", alg);
    let first = true;
    for (const unit of experimentalDirect(alg.units(), dataDown.direction)) {
      if (!first) {
        element.addString(" ");
      }
      first = false;
      moveCount += element.addElem(
        this.traverseUnit(unit, {
          earliestMoveIndex: dataDown.earliestMoveIndex + moveCount,
          twistyAlgViewer: dataDown.twistyAlgViewer,
          direction: dataDown.direction,
        }),
      );
    }
    element.flushQueue(dataDown.direction);
    return {
      moveCount: moveCount,
      element,
    };
  }

  public traverseGrouping(grouping: Grouping, dataDown: DataDown): DataUp {
    const direction = updateDirectionByAmount(
      dataDown.direction,
      grouping.experimentalEffectiveAmount,
    );
    let moveCount = 0;
    const element = new TwistyAlgWrapperElem("twisty-alg-grouping", grouping);
    element.addString("(");
    moveCount += element.addElem(
      this.traverseAlg(grouping.experimentalAlg, {
        earliestMoveIndex: dataDown.earliestMoveIndex + moveCount,
        twistyAlgViewer: dataDown.twistyAlgViewer,
        direction,
      }),
    );
    element.addString(")" + grouping.experimentalRepetitionSuffix);
    element.flushQueue();
    return {
      moveCount: moveCount * Math.abs(grouping.experimentalEffectiveAmount),
      element,
    };
  }

  public traverseMove(move: Move, dataDown: DataDown): DataUp {
    return {
      moveCount: 1,
      element: new TwistyAlgLeafElem(
        "twisty-alg-move",
        move.toString(),
        dataDown,
        move
      ),
    };
  }

  public traverseCommutator(
    commutator: Commutator,
    dataDown: DataDown,
  ): DataUp {
    let moveCount = 0;
    const element = new TwistyAlgWrapperElem("twisty-alg-commutator", commutator);
    element.addString("[");
    element.flushQueue();
    const direction = updateDirectionByAmount(
      dataDown.direction,
      commutator.experimentalEffectiveAmount,
    );
    const [first, second]: Alg[] = maybeReverseList(
      [commutator.A, commutator.B],
      direction,
    );
    moveCount += element.addElem(
      this.traverseAlg(first, {
        earliestMoveIndex: dataDown.earliestMoveIndex + moveCount,
        twistyAlgViewer: dataDown.twistyAlgViewer,
        direction,
      }),
    );
    element.addString(", ");
    moveCount += element.addElem(
      this.traverseAlg(second, {
        earliestMoveIndex: dataDown.earliestMoveIndex + moveCount,
        twistyAlgViewer: dataDown.twistyAlgViewer,
        direction,
      }),
    );
    element.flushQueue(direction);
    element.addString("]" + commutator.experimentalRepetitionSuffix);
    element.flushQueue();
    return {
      moveCount:
        moveCount * 2 * Math.abs(commutator.experimentalEffectiveAmount),
      element,
    };
  }

  public traverseConjugate(conjugate: Conjugate, dataDown: DataDown): DataUp {
    let moveCount = 0;
    const element = new TwistyAlgWrapperElem("twisty-alg-conjugate", conjugate);
    element.addString("[");
    const direction = updateDirectionByAmount(
      dataDown.direction,
      conjugate.experimentalEffectiveAmount,
    );
    const aLen = element.addElem(
      this.traverseAlg(conjugate.A, {
        earliestMoveIndex: dataDown.earliestMoveIndex + moveCount,
        twistyAlgViewer: dataDown.twistyAlgViewer,
        direction,
      }),
    );
    moveCount += aLen;
    element.addString(": ");
    moveCount += element.addElem(
      this.traverseAlg(conjugate.B, {
        earliestMoveIndex: dataDown.earliestMoveIndex + moveCount,
        twistyAlgViewer: dataDown.twistyAlgViewer,
        direction,
      }),
    );
    element.addString("]" + conjugate.experimentalRepetitionSuffix);
    element.flushQueue();
    return {
      moveCount:
        (moveCount + aLen) * Math.abs(conjugate.experimentalEffectiveAmount),
      element,
    };
  }

  public traversePause(pause: Pause, dataDown: DataDown): DataUp {
    return {
      moveCount: 1,
      element: new TwistyAlgLeafElem("twisty-alg-pause", ".", dataDown, pause),
    };
  }

  public traverseNewline(newline: Newline, _dataDown: DataDown): DataUp {
    const element = new TwistyAlgWrapperElem("twisty-alg-newLine", newline);
    element.append(document.createElement("br"));
    return {
      moveCount: 0,
      element,
    };
  }

  public traverseLineComment(lineComment: LineComment, dataDown: DataDown): DataUp {
    return {
      moveCount: 0,
      element: new TwistyAlgLeafElem(
        "twisty-alg-comment",
        `//${lineComment.text}`,
        dataDown,
        lineComment
      ),
    };
  }
}

const algToDOMTreeInstance = new AlgToDOMTree();
const algToDOMTree = algToDOMTreeInstance.traverseAlg.bind(
  algToDOMTreeInstance,
) as (alg: Alg, dataDown: DataDown) => DataUp;

export class ExperimentalTwistyAlgViewer extends HTMLElementShim {
  #domTree: TwistyAlgWrapperElem | TwistyAlgLeafElem;
  twistyPlayer: TwistyPlayer | null = null;
  lastClickTimestamp: number | null = null;
  constructor(options?: { twistyPlayer?: TwistyPlayer }) {
    super();
    if (options?.twistyPlayer) {
      this.setTwistyPlayer(options?.twistyPlayer);
    }
  }

  protected connectedCallback(): void {
    // nothing to do?
  }

  private setAlg(alg: Alg): void {
    this.#domTree = algToDOMTree(alg, {
      earliestMoveIndex: 0,
      twistyAlgViewer: this,
      direction: ExperimentalIterationDirection.Forwards,
    }).element;
    this.textContent = "";
    this.appendChild(this.#domTree);
  }

  setTwistyPlayer(twistyPlayer: TwistyPlayer): void {
    if (this.twistyPlayer) {
      console.warn("twisty-player reassignment is not supported");
      return;
    }
    this.twistyPlayer = twistyPlayer;
    const alg = this.twistyPlayer.alg;
    this.setAlg(alg);
    (async () => {
      console.log(alg)
      const wrapper = new KPuzzleWrapper(await puzzles[twistyPlayer!.puzzle].def());
      const indexer = new TreeAlgIndexer(wrapper, alg);
      console.log(indexer)
      console.log(indexer.getMove(0))
      twistyPlayer.timeline.addTimestampListener({
        onTimelineTimestampChange(timestamp: MillisecondTimestamp): void {
          console.log(indexer.getMove(indexer.timestampToIndex(timestamp)))
        },
        onTimeRangeChange(_timeRange: TimeRange): void {}
      })
    })();
    twistyPlayer.timeline.addTimestampListener({
      onTimelineTimestampChange: (timestamp: MillisecondTimestamp) => {
        if (timestamp !== this.lastClickTimestamp) {
          this.lastClickTimestamp = null;
        }
        const index =
          this.twistyPlayer?.cursor?.experimentalIndexFromTimestamp(
            timestamp,
          ) ?? null;
        if (index !== null) {
          // console.log(index);
          // console.log(this.#domTree.pathToIndex(index));
        }
      },
      onTimeRangeChange: (_timeRange: TimeRange) => {
        // TODO
      },
    });
  }

  jumpToIndex(index: number): void {
    if (this.twistyPlayer && this.twistyPlayer.cursor) {
      const timestamp =
        (this.twistyPlayer.cursor.experimentalTimestampFromIndex(index) ??
          -250) + 250;
      this.twistyPlayer?.timeline.setTimestamp(timestamp);
      if (this.lastClickTimestamp === timestamp) {
        this.twistyPlayer.timeline.play();
        this.lastClickTimestamp = null;
      } else {
        this.lastClickTimestamp = timestamp;
      }
    }
  }

  protected attributeChangedCallback(
    attributeName: string,
    _oldValue: string,
    newValue: string,
  ): void {
    if (attributeName === "for") {
      const elem = document.getElementById(newValue);
      if (!elem) {
        console.warn("for= elem does not exist");
        return;
      }
      if (!(elem instanceof TwistyPlayer)) {
        console.warn("for= elem is not a twisty-player");
        return;
      }
      this.setTwistyPlayer(elem);
    }
  }

  static get observedAttributes(): string[] {
    return ["for"];
  }
}

customElementsShim.define(
  "experimental-twisty-alg-viewer",
  ExperimentalTwistyAlgViewer,
);
