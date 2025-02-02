// This file was created because:
//
// - Safari and Firefox don't support `module` workers yet.
// - `esbuild` and `snowpack` don't automatically handle transpilation to
//   `classic` web workers.
// - Parcel has too many show-stopping bugs for us to use.
//
// Once Safari and Firefox support module workers, we can hopefully revert to
// short commandline commands. But maybe this file will stick around because it
// turns out to be too useful.

import * as esbuild from "esbuild";
import { writeFile } from "fs";
import { join } from "path";
import * as snowpack from "snowpack";
import { promisify } from "util";
import {
  experimentsSnowpackConfig,
  sitesSnowpackConfig,
  twizzleSnowpackConfig,
} from "../../snowpack.config.mjs";
import { execPromise } from "../lib/execPromise.js";
import { writeSyncUsingTempFile } from "./temp.js";

const PARALLEL = false;

const externalNode = ["crypto", "worker_threads"];
const external = ["three", "comlink", ...externalNode];

async function writeVersionJSON(siteFolder) {
  // https://git-scm.com/docs/git-describe
  const gitDescribeVersion = (
    await execPromise("git describe --tags || echo v0.0.0")
  ).trim();
  const gitBranch = (
    await execPromise("git rev-parse --abbrev-ref HEAD")
  ).trim();
  const date = (await execPromise("date")).trim();
  const commitHash = (await execPromise("git rev-parse HEAD")).trim();
  const commitGitHubURL = `https://github.com/cubing/cubing.js/commit/${commitHash}`;

  await promisify(writeFile)(
    join(siteFolder, "version.json"),
    JSON.stringify(
      { gitDescribeVersion, gitBranch, date, commitHash, commitGitHubURL },
      null,
      "  ",
    ),
  );
}

export async function build(target, dev) {
  const startDeps = Date.now();
  const depPromises = [];
  for (const dependency of target.dependencies) {
    const depPromise = build(dependency, dev);
    depPromises.push(depPromise);
    if (!PARALLEL) {
      await depPromise;
    }
  }
  await Promise.all(depPromises);
  if (!target.builtYet) {
    const startSelf = Date.now();
    console.log("Building target:", target.name);
    await target.buildSelf(dev);
    const doneTimestamp = Date.now();
    const durTotalSeconds = Math.floor(doneTimestamp - startDeps) / 1000;
    const durDepsSeconds = Math.floor(startSelf - startDeps) / 1000;
    console.log(
      `Successfully built target in ${durTotalSeconds} seconds (${durDepsSeconds} spent in dependencies):`,
      target.name,
    );
    target.builtYet = true;
  }
}

let latestBuildSymbol = null;
const SEARCH_WORKER_PATH =
  "./src/cubing/search/worker-inside-generated-string.js";
export const searchWorkerTarget = {
  name: "search-worker",
  builtYet: false,
  dependencies: [],
  buildSelf: async (dev) => {
    const buildSymbol = Symbol("esbuild");
    latestBuildSymbol = buildSymbol;

    const writeFile = async (buildResult) => {
      if (latestBuildSymbol !== buildSymbol) {
        console.warn("Stale `esbuild`?!");
        return;
      }
      const { contents } = buildResult.outputFiles[0];
      const contentsString = new TextDecoder("utf-8").decode(contents);
      if (typeof contentsString !== "string") {
        throw new Error(
          "Unexpected non-string for the decoded search worker source.",
        );
      }
      const workerContents = `export const workerSource = ${JSON.stringify(
        contentsString,
      )};`;
      console.log("Writing:", SEARCH_WORKER_PATH);
      writeSyncUsingTempFile(
        "worker-inside-generated-string.js",
        SEARCH_WORKER_PATH,
        workerContents,
      );
    };

    let watch = dev;
    if (dev) {
      watch = {
        onRebuild(error, result) {
          if (error) {
            console.error("Watch build failed:", error);
          } else {
            writeFile(result);
          }
        },
      };
    }

    const initialBuildResult = await esbuild.build({
      entryPoints: ["./src/cubing/search/inside/entry.js"],
      format: "cjs",
      target: "es2015",
      bundle: true,
      watch,
      write: false,
      logLevel: "info",
      external: externalNode,
      minify: !dev,
    });
    // Note that we finish writing the initial built file before we return.
    // This means that the file is in place before any dependent steps(like Snowpack) start.
    await writeFile(initialBuildResult);
  },
};

export const bundleGlobalTarget = {
  name: "bundle-global",
  builtYet: false,
  dependencies: [searchWorkerTarget],
  buildSelf: (dev) => {
    return esbuild.build({
      entryPoints: ["src/cubing/cubing.bundle-global.ts"],
      outfile: "dist/bundle-global/cubing.bundle-global.js",
      format: "cjs",
      target: "es2020",
      bundle: true,
      minify: true,
      watch: dev,
      logLevel: "info",
      external: externalNode,
    });
  },
};

export const esmTarget = {
  name: "esm",
  builtYet: false,
  dependencies: [searchWorkerTarget],
  buildSelf: async (dev) => {
    await esbuild.build({
      entryPoints: [
        "src/cubing/alg/index.ts",
        "src/cubing/bluetooth/index.ts",
        "src/cubing/kpuzzle/index.ts",
        "src/cubing/notation/index.ts",
        "src/cubing/protocol/index.ts",
        "src/cubing/puzzle-geometry/index.ts",
        "src/cubing/puzzles/index.ts",
        "src/cubing/scramble/index.ts",
        "src/cubing/stream/index.ts",
        "src/cubing/search/index.ts",
        "src/cubing/twisty/index.ts",
        "src/cubing/esm-test-worker.js",
      ],
      outdir: "dist/esm",
      format: "esm",
      target: "es2020",
      bundle: true,
      splitting: true,
      watch: dev,
      logLevel: "info",
      sourcemap: true,
      //
      external,
    });
    await execPromise("cp -R src/static/* ./");
  },
};

export const binTarget = {
  name: "bin",
  builtYet: false,
  dependencies: [searchWorkerTarget],
  buildSelf: async (dev) => {
    await esbuild.build({
      entryPoints: ["src/bin/puzzle-geometry-bin.ts"],
      outfile: "dist/bin/puzzle-geometry-bin.js",
      format: "esm",
      target: "es2020",
      bundle: true,
      watch: dev,
      logLevel: "info",
      sourcemap: true,
      //
      external,
    });
  },
};

export const sitesTarget = {
  name: "sites",
  builtYet: false,
  dependencies: [searchWorkerTarget],
  buildSelf: async (dev) => {
    const config = snowpack.createConfiguration(sitesSnowpackConfig);

    const snowpackPromise = dev
      ? snowpack.startServer({ config }, { isDev: dev })
      : snowpack.build({ config });
    await snowpackPromise;
  },
};

export const twizzleTarget = {
  name: "twizzle",
  builtYet: false,
  dependencies: [searchWorkerTarget],
  buildSelf: async (dev) => {
    const config = snowpack.createConfiguration(twizzleSnowpackConfig);

    const snowpackPromise = dev
      ? snowpack.startServer({ config }, { isDev: dev })
      : snowpack.build({ config });
    await snowpackPromise;

    if (!dev) {
      await writeVersionJSON(config.buildOptions.out);
    }
  },
};

export const experimentsTarget = {
  name: "experiments",
  builtYet: false,
  dependencies: [searchWorkerTarget],
  buildSelf: async (dev) => {
    const config = snowpack.createConfiguration(experimentsSnowpackConfig);

    const snowpackPromise = dev
      ? snowpack.startServer({ config }, { isDev: dev })
      : snowpack.build({ config });
    await snowpackPromise;

    if (!dev) {
      await writeVersionJSON(config.buildOptions.out);
    }
  },
};

export const typesTarget = {
  name: "types",
  builtYet: false,
  dependencies: [searchWorkerTarget],
  buildSelf: async (dev) => {
    console.warn(
      "Note: The `types` target uses `tsc`, which is slow. Expect ≈10 seconds or more.",
    );
    if (dev) {
      throw new Error("Cannot build `types` target in dev mode.");
    }
    await execPromise("npx tsc --build ./tsconfig-types.json");
  },
};

export const allTarget = {
  name: "all",
  builtYet: false,
  dependencies: [esmTarget, bundleGlobalTarget, typesTarget, binTarget],
  buildSelf: async (dev) => {
    if (dev) {
      throw new Error("Cannot build `types` target in dev mode.");
    }
  },
};

const targetName = process.argv[2];
if (!targetName) {
  console.error("not a target:", targetName);
  process.exit(1);
}

const dev = process.argv[3] === "dev";

const targets /*: Record<String, SolverWorker>*/ = {
  "search-worker": searchWorkerTarget,
  "sites": sitesTarget,
  "twizzle": twizzleTarget,
  "experiments": experimentsTarget,
  "bundle-global": bundleGlobalTarget,
  "esm": esmTarget,
  "types": typesTarget,
  "bin": binTarget,
  "all": allTarget,
};

(async () => {
  const target = targets[targetName];
  if (!target) {
    console.error("Unknown target:", targetName);
    process.exit(1);
  }
  await build(target, dev);
  console.log("Finished building!");
  // TODO: Why does this script hang (non-deterministically?) if we don't exit here?
  if (!dev) {
    process.exit(0);
  }
})();
