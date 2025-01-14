# Contributing

Pull requests are welcome for any part of this project. Please feel free to send PRs directly for typos, bug fixes, and any [open issues](https://github.com/cubing/cubing.js/issues).

If you have any thoughts about bigger contributions, please consider [filing an issue](https://github.com/cubing/cubing.js/issues/new) to discuss it before sending a pull request. (Since we're still [below version 1.0](https://semver.org/#spec-item-4), some relevant design choices are still not settled or written down yet.)

## Development

Please see the [development instruction in `README.md`](./README.md#development) for how to work on `cubing.js`.

## Code of Conduct

Please see [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## Goals and Principles

The goal of `cubing.js` to make it easier to write _any_ cubing application. `cubing.js` should make it easy to do the right thing, and it should be reasonably compatible with any use case out of the box.

This means the library and the UI must be:

- Easy: It has to be as easy as possible to use, even for people who have done almost no programming. This also means it should be hard to "hold it wrong" and write unsafe/super slow apps by accident.
- Fast: It has to compute and draw puzzle states efficiently on low-power devices, slow internet, and/or large screens.
- Compatible: It has to work for browsers, commandline scripts, servers.

Some examples of what this means:

- ` cubing.js` must work out of the box with minimal dependencies. We need to maintain a common API that works with `node`, directly in browsers, and with bundlers. (Easy & Compatible)
- We need good documentation before we do a "full" release.
- We make `cubing.js` [available under `cdn.cubing.net`](https://github.com/cubing/cdn.cubing.net) so that people can use the most efficient version of the code on their websites even if they don't know how to use bundlers, but we also provide builds that make it possible to host the code directly.
- We should use native APIs where possible, e.g. web components.
- If we one of the goals requires a choice between doing work ourselves, or making a developer do it, we prefer doing the work so the developer doesn't have to. As an important example, `cubing/search` and `cubing/scramble` automatically use web workers so that it's easy and fast to generate scrambles without slowing down an app.
- The library should load as little code as possible. In order to support lots of puzzles and environments, the "full" library will probably be fairly large. But we can split up the build (using dynamic imports) so that an app will not ["pay for" code it does not need](https://www.stroustrup.com/masterminds_chapter_1.pdf). For example:
  - `<twisty-player>` should draw a player on the screen as fast as possible, so the user can tell that it's loading (and not just broken/missing).
  - If you're only drawing 2D puzzles, you shouldn't have to load the (fairly sizable) 3D code.
  - If you just need to draw freeze frames (like VisualCube), you should be able to use `<twisty-player>` without worrying about the "extra work" it does to prepare for animation.
- For speed or simplicity, it is often valuable to require features that are only available in modern browsers/environments. In general, we are willing to require the most recent version of a modern browser, as long as the relevant feature is available across Chromium-based browsers (including Edge), Firefox, and Safari. We don't support Internet Explorer or Edge Spartan.

In addition, it's valuable to apply some of these principles to the codebase itself. For example, we try to make it as easy as possible to get started, and generally use more verbose names to avoid any ambiguity when a shorter name could be ambiguous.
