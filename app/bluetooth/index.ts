import "babel-polyfill"; // Prevent `regeneratorRuntime is not defined` error. https://github.com/babel/babel/issues/5085

import {algToString, invert, parse, Sequence} from "../../alg";
import {BluetoothPuzzle, connect, debugKeyboardConnect, KeyboardPuzzle, MoveEvent} from "../../bluetooth";
import {Twisty} from "../../twisty";

async function asyncSetup(twisty: Twisty): Promise<void> {
  console.log("asyncSetup");
  const keyboard = await debugKeyboardConnect((twisty as any).player.cube3DView.element);
  console.log("keyboard", twisty, keyboard);
  keyboard.addMoveListener((e: MoveEvent) => {
    console.log("listener", e);
    twisty.experimentalAddMove(e.latestMove);
  });
}

declare global {
  interface Window {
    puzzle: BluetoothPuzzle | null;
  }
}

window.puzzle = null;

console.log(algToString(invert(parse("R U R' F D"))));
window.addEventListener("load", async () => {
  const twistyElem = document.createElement("twisty");
  const twisty = new Twisty(twistyElem, {alg: new Sequence([])});
  document.body.appendChild(twisty.element);

  asyncSetup(twisty);

  // latestMove: BlockMove;
  // timeStamp: number;
  // debug?: object;
  // state?: PuzzleState;
  // quaternion?: any;
  document.querySelector("#connect").addEventListener("click", async () => {
    window.puzzle = await connect();
    window.puzzle.addMoveListener((e: MoveEvent) => {
      console.log("listener", e);
      twisty.experimentalAddMove(e.latestMove);
    });
  });
});