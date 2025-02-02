// TODO: implement URL listener.

import { Alg } from "../../../cubing/alg";

export interface PartialURLParamValues {
  alg?: Alg;
  puzzle?: string;
  puzzlegeometry?: string;
  debugShowRenderStats?: boolean;
  tempo?: string;
}
export type ParamName = keyof typeof paramDefaults;

interface CompleteURLParamValues extends PartialURLParamValues {
  alg: Alg;
  puzzle: string;
  puzzlegeometry?: string;
  debugShowRenderStats?: boolean;
  tempo?: string;
}

const paramDefaults: CompleteURLParamValues = {
  alg: new Alg(),
  puzzle: "",
  puzzlegeometry: "",
  debugShowRenderStats: false,
  tempo: "1",
};

// TODO: Encapsulate and deduplicate this.
const paramDefaultStrings: { [s: string]: string } = {
  alg: "",
  puzzle: "",
  puzzlegeometry: "",
  debugShowRenderStats: "",
  tempo: "1",
};

export function getURLParam<K extends ParamName>(
  paramName: K,
): CompleteURLParamValues[K] {
  const str: string | null = new URLSearchParams(window.location.search).get(
    paramName,
  );
  if (!str) {
    return paramDefaults[paramName];
  }
  switch (paramName) {
    case "alg":
      // TODO: can we avoid the `as` cast?
      return Alg.fromString(str) as CompleteURLParamValues[K];
    case "puzzle":
    case "puzzlegeometry":
      // TODO: can we avoid the `as` cast?
      return str as CompleteURLParamValues[K];
    case "debugShowRenderStats":
      // TODO: can we avoid the `as` cast?
      return (str === "true") as CompleteURLParamValues[K];
    case "tempo":
      return str as CompleteURLParamValues[K];
    default:
      // TODO: can we avoid the `as` cast?
      return str as CompleteURLParamValues[K];
  }
}

export function setURLParams(newParams: PartialURLParamValues): void {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  function setParam(key: ParamName, s: string): void {
    if (s === paramDefaultStrings[key]) {
      params.delete(key);
    } else {
      params.set(key, s);
    }
  }

  for (const [key, value] of Object.entries(newParams)) {
    switch (key) {
      case "alg":
        setParam(key, value.toString());
        break;
      case "puzzle":
      case "puzzlegeometry":
        setParam(key, value);
        break;
      case "debugShowRenderStats":
        setParam(key, value ? "true" : "");
        break;
      case "tempo":
        setParam(key, value);
        break;
      default:
        console.warn("Unknown param", key, value);
    }
  }
  window.history.replaceState("", "", url.toString());
}
