import { from } from "../../vendor/p-lazy/p-lazy";
import { StaleDropper } from "./PromiseFreshener";

export type InputProps<T extends Object> = {
  [s in keyof T]: TwistyPropParent<T[s]>;
};

type InputPromises<T extends Object> = {
  [s in keyof T]: Promise<T[s]>;
};

interface SourceEventDetail<OutputType> {
  sourceProp: TwistyPropSource<OutputType, any>;
  value: Promise<OutputType>; // TODO: remove?
  generation: number;
}

type SourceEvent<T> = CustomEvent<SourceEventDetail<T>>;

type PromiseOrValue<T> = T | Promise<T>;

// Values of T must be immutable.
let globalSourceGeneration = 0; // This is incremented before being used, so 1 will be the first active value.
export abstract class TwistyPropParent<T> {
  public abstract get(): Promise<T>;

  // Don't overwrite this. Overwrite `canReuseValue` instead.
  canReuse(v1: T, v2: T): boolean {
    return v1 === v2 || this.canReuseValue(v1, v2);
  }

  // Overwrite with a cheap semantic comparison when possible.
  // Note that this is not called if `v1 === v2` (in which case the value is automatically reused).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars-experimental
  canReuseValue(v1: T, v2: T): boolean {
    return false;
  }

  debugGetChildren(): Array<TwistyPropDerived<any, any>> {
    return Array.from(this.#children.values());
  }

  // Propagation

  #children: Set<TwistyPropDerived<any, any>> = new Set();
  protected addChild(child: TwistyPropDerived<any, any>): void {
    this.#children.add(child);
  }

  protected removeChild(child: TwistyPropDerived<any, any>): void {
    this.#children.delete(child);
  }

  protected lastSourceGeneration: number = 0;
  // Synchronously marks all descendants as stale. This doesn't actually
  // literally mark as stale, but it updates the last source generation, which
  // is used to tell if a cahced result is stale.
  protected markStale(sourceEvent: SourceEvent<any>): void {
    if (sourceEvent.detail.generation !== globalSourceGeneration) {
      // The full stale propagation is synchronous, so there should not be a new one yet.
      throw new Error("A TwistyProp was marked stale too late!");
    }
    if (this.lastSourceGeneration === sourceEvent.detail.generation) {
      // Already propagated.
      return;
    }
    this.lastSourceGeneration = sourceEvent.detail.generation;
    for (const child of this.#children) {
      child.markStale(sourceEvent);
    }
    // We schedule sending out events *after* the (synchronous) propagation has happened, in
    // case one of the listeners updates a source again.
    this.#scheduleRawDispatch();
  }

  #rawListeners: Set<() => void> = new Set();
  /** @deprecated */
  addRawListener(listener: () => void, options?: { initial: boolean }): void {
    this.#rawListeners.add(listener);
    if (options?.initial) {
      listener(); // TODO: wrap in a try?
    }
  }

  /** @deprecated */
  removeRawListener(listener: () => void): void {
    this.#rawListeners.delete(listener);
  }

  /** @deprecated */
  #scheduleRawDispatch(): void {
    if (!this.#rawDispatchPending) {
      this.#rawDispatchPending = true;
      setTimeout(() => this.#dispatchRawListeners(), 0);
    }
  }

  #rawDispatchPending: boolean = false;
  #dispatchRawListeners(): void {
    if (!this.#rawDispatchPending) {
      throw new Error("Invalid dispatch state!");
    }
    for (const listener of this.#rawListeners) {
      listener(); // TODO: wrap in a try?
    }
    this.#rawDispatchPending = false;
  }

  #freshListeners: Map<(value: T) => void, () => void> = new Map();
  // TODO: Pick a better name.
  addFreshListener(listener: (value: T) => void): void {
    const staleDropper: StaleDropper<T> = new StaleDropper<T>();
    let lastResult: T | null = null;
    const callback = async () => {
      const result = await staleDropper.queue(this.get());
      if (lastResult !== null && this.canReuse(lastResult, result)) {
        return;
      }
      lastResult = result;
      listener(result);
    };
    this.#freshListeners.set(listener, callback);
    this.addRawListener(callback, { initial: true });
  }

  removeFreshListener(listener: (value: T) => void): void {
    this.removeRawListener(this.#freshListeners.get(listener)!); // TODO: throw a custom error?
    this.#freshListeners.delete(listener);
  }
}

export abstract class TwistyPropSource<
  OutputType,
  InputType = OutputType,
> extends TwistyPropParent<OutputType> {
  #value: Promise<OutputType>;

  public abstract getDefaultValue(): PromiseOrValue<OutputType>;

  constructor(initialValue?: PromiseOrValue<InputType>) {
    super();
    this.#value = from(() => this.getDefaultValue());
    if (initialValue) {
      this.#value = this.deriveFromPromiseOrValue(initialValue, this.#value);
    }
  }

  set(input: PromiseOrValue<InputType>): void {
    this.#value = this.deriveFromPromiseOrValue(input, this.#value);

    const sourceEventDetail: SourceEventDetail<OutputType> = {
      sourceProp: this,
      value: this.#value,
      generation: ++globalSourceGeneration,
    };
    this.markStale(
      new CustomEvent<SourceEventDetail<OutputType>>("stale", {
        detail: sourceEventDetail,
      }),
    );
  }

  async get(): Promise<OutputType> {
    return this.#value;
  }

  async deriveFromPromiseOrValue(
    input: PromiseOrValue<InputType>,
    oldValuePromise: Promise<OutputType>,
  ): Promise<OutputType> {
    return this.derive(await input, oldValuePromise);
  }

  // TODO: add an indirect layer to cache the derivation?
  protected abstract derive(
    input: InputType,
    oldValuePromise: Promise<OutputType>,
  ): PromiseOrValue<OutputType>;
}

export abstract class SimpleTwistyPropSource<
  SimpleType,
> extends TwistyPropSource<SimpleType> {
  derive(input: SimpleType): PromiseOrValue<SimpleType> {
    return input;
  }
}

// TODO: Can / should we support `null` as a valid output value?
export abstract class TwistyPropDerived<
  InputTypes extends Object,
  OutputType,
> extends TwistyPropParent<OutputType> {
  // cachedInputs:
  #parents: InputProps<InputTypes>;

  constructor(parents: InputProps<InputTypes>) {
    super();
    this.#parents = parents;
    for (const parent of Object.values(parents)) {
      parent.addChild(this);
    }
  }

  #cachedLastSuccessfulCalculation: {
    inputs: InputTypes;
    output: Promise<OutputType>;
    generation: number;
  } | null = null;

  #cachedLatestGenerationCalculation: {
    output: Promise<OutputType>;
    generation: number;
  } | null = null;

  public async get(): Promise<OutputType> {
    const generation = this.lastSourceGeneration;

    if (this.#cachedLatestGenerationCalculation?.generation === generation) {
      return this.#cachedLatestGenerationCalculation.output;
    }

    const latestGenerationCalculation = {
      generation,
      output: this.#cacheDerive(
        this.#getParents(),
        generation,
        this.#cachedLastSuccessfulCalculation,
      ),
    };
    this.#cachedLatestGenerationCalculation = latestGenerationCalculation;

    return latestGenerationCalculation.output;
  }

  async #getParents(): Promise<InputTypes> {
    const inputValuePromises: InputPromises<InputTypes> = {} as any; // TODO
    for (const key in this.#parents) {
      inputValuePromises[key] = this.#parents[key].get();
    }

    const inputs: InputTypes = {} as any; // TODO
    for (const key in this.#parents) {
      inputs[key] = await inputValuePromises[key];
    }
    return inputs;
  }

  async #cacheDerive(
    inputsPromise: PromiseOrValue<InputTypes>,
    generation: number,
    cachedLatestGenerationCalculation: {
      inputs: InputTypes;
      output: Promise<OutputType>;
      generation: number;
    } | null = null,
  ): Promise<OutputType> {
    const inputs = await inputsPromise;

    const cache = (output: OutputType): OutputType => {
      this.#cachedLastSuccessfulCalculation = {
        inputs,
        output: Promise.resolve(output),
        generation,
      };
      return output;
    };

    if (!cachedLatestGenerationCalculation) {
      return cache(await this.derive(inputs));
    }

    const cachedInputs = cachedLatestGenerationCalculation.inputs;
    for (const key in this.#parents) {
      const parent = this.#parents[key];
      if (!parent.canReuse(inputs[key], cachedInputs[key])) {
        return cache(await this.derive(inputs));
      }
    }

    return cachedLatestGenerationCalculation.output;
  }

  protected abstract derive(input: InputTypes): PromiseOrValue<OutputType>;
}

export class FreshListenerManager {
  #disconnectionFunctions: Function[] = [];

  addListener<T>(
    prop: TwistyPropParent<T>,
    listener: (value: T) => void,
  ): void {
    let disconnected = false;
    const wrappedListener = (value: T) => {
      if (disconnected) {
        console.warn("Should be disconnected!");
        return;
      }
      listener(value);
    };

    prop.addFreshListener(wrappedListener);

    this.#disconnectionFunctions.push(() => {
      prop.removeFreshListener(wrappedListener);
      disconnected = true;
    });
  }

  addMultiListener<U, V>(
    props: [TwistyPropParent<U>, TwistyPropParent<V>],
    listener: (values: [U, V]) => void,
  ) {
    let disconnected = false;
    const wrappedListener = async (_: any) => {
      if (disconnected) {
        console.warn("Should be disconnected!");
        return;
      }
      // We rely on `TwistyProp` caching to give us the full set of latest
      // values efficiently.
      const values = (await Promise.all(
        props.map((prop) => prop.get() as Promise<U | V>),
      )) as [U, V];
      listener(values);
    };

    for (const prop of props) {
      prop.addFreshListener(wrappedListener);
    }

    this.#disconnectionFunctions.push(() => {
      for (const prop of props) {
        prop.removeFreshListener(wrappedListener);
      }
      disconnected = true;
    });
  }

  disconnect(): void {
    for (const disconnectionFunction of this.#disconnectionFunctions) {
      disconnectionFunction();
    }
  }
}
