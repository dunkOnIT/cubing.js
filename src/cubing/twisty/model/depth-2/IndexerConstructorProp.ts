import { countMoves } from "../../../notation";
import type { IndexerConstructor } from "../../old/animation/cursor/AlgCursor";
import { SimpleAlgIndexer } from "../../old/animation/indexer/SimpleAlgIndexer";
import { SimultaneousMoveIndexerV2 } from "../../old/animation/indexer/simultaneous-moves/SimultaneousMoveIndexerV2";
import { TreeAlgIndexer } from "../../old/animation/indexer/tree/TreeAlgIndexer";
import type { PuzzleID } from "../../old/dom/TwistyPlayerConfig";
import type { AlgWithIssues } from "../depth-0/AlgProp";
import type { IndexerStrategyName } from "../depth-0/IndexerConstructorRequestProp";
import type { VisualizationStrategy } from "../depth-1/VisualizationStrategyProp";
import { TwistyPropDerived } from "../TwistyProp";

interface IndexerConstructorPropInputs {
  puzzle: PuzzleID;
  alg: AlgWithIssues;
  visualizationStrategy: VisualizationStrategy;
  indexerConstructorRequest: IndexerStrategyName;
}

// TODO: Also handle PG3D vs. 3D
export class IndexerConstructorProp extends TwistyPropDerived<
  IndexerConstructorPropInputs,
  IndexerConstructor
> {
  derive(inputs: IndexerConstructorPropInputs): IndexerConstructor {
    switch (inputs.indexerConstructorRequest) {
      case "auto":
        if (
          countMoves(inputs.alg.alg) < 100 &&
          inputs.puzzle === "3x3x3" &&
          inputs.visualizationStrategy === "Cube3D"
        ) {
          return SimultaneousMoveIndexerV2;
        } else {
          return TreeAlgIndexer;
        }
      case "tree":
        return TreeAlgIndexer;
      case "simple":
        return SimpleAlgIndexer;
      case "simultaneous":
        return SimultaneousMoveIndexerV2;
      default:
        throw new Error("Invalid indexer request!");
    }
  }
}
