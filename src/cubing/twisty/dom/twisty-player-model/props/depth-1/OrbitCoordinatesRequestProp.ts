import { TwistyPropSource } from "../TwistyProp";

export type CoordinateDegrees = number;

export interface OrbitCoordinatesV2 {
  latitude: CoordinateDegrees;
  longitude: CoordinateDegrees;
  distance: number;
}

export function orbitCoordinatesEqual(
  c1: OrbitCoordinatesV2,
  c2: OrbitCoordinatesV2,
): boolean {
  return (
    c1.latitude === c2.latitude &&
    c1.longitude === c2.longitude &&
    c1.distance === c2.distance
  );
}

// TOOD: Check if freezing affects perf.
const DEFAULT_COORDINATES = Object.freeze({
  latitude: 35,
  longitude: 30,
  distance: 6,
});

// TODO: Built-in latitude locking.
export class OrbitCoordinatesRequestProp extends TwistyPropSource<
  OrbitCoordinatesV2,
  Partial<OrbitCoordinatesV2>
> {
  getDefaultValue(): OrbitCoordinatesV2 {
    return DEFAULT_COORDINATES;
  }

  canReuseValue(v1: OrbitCoordinatesV2, v2: OrbitCoordinatesV2) {
    return orbitCoordinatesEqual(v1, v2);
  }

  async derive(
    newCoordinates: Partial<OrbitCoordinatesV2>,
    oldValuePromise: Promise<OrbitCoordinatesV2>,
  ): Promise<OrbitCoordinatesV2> {
    const oldValue = await oldValuePromise;
    const newValue: OrbitCoordinatesV2 = Object.assign({}, oldValue);
    Object.assign(newValue, newCoordinates);
    return newValue;
  }
}
