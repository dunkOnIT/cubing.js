/**
 * @jest-environment jsdom
 */

import { Timeline } from "../../animation/Timeline";
import { TwistyControlButton } from "./buttons";
import { ManagedCustomElement } from "../element/ManagedCustomElement";
import { customElementsShim } from "../element/node-custom-element-shims";

// function getButtonElem(
//   twistyControlButton: TwistyControlButton,
// ): HTMLButtonElement {
//   return (twistyControlButton as any).button as HTMLButtonElement;
// }

class MockFullscreenElement extends ManagedCustomElement {
  public fullscreenRequested: boolean = false;
  public async requestFullscreen(): Promise<void> {
    this.fullscreenRequested = true;
  }
}

customElementsShim.define("mock-fullscreen-element", MockFullscreenElement);

describe("TwistyControlButton", () => {
  it("requests fullscreen", () => {
    const timeline = new Timeline();
    const mockFullscreenElement = new MockFullscreenElement();
    const twistyControlButton = new TwistyControlButton(
      timeline,
      "fullscreen",
      { fullscreenElement: mockFullscreenElement },
    );
    twistyControlButton.click();
    expect(mockFullscreenElement.fullscreenRequested).toBe(true);
  });
});
