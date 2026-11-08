/** A minimal observable store. */
export class Store<T extends object> {
  #state: T
  #subs = new Set<(state: T, prev: T) => void>()

  constructor(initial: T) {
    this.#state = initial
  }

  get(): T {
    return this.#state
  }

  set(patch: Partial<T> | ((s: T) => Partial<T>)): void {
    const prev = this.#state
    const p = typeof patch === 'function' ? patch(prev) : patch
    this.#state = { ...prev, ...p }
    for (const fn of this.#subs) fn(this.#state, prev)
  }

  subscribe(fn: (state: T, prev: T) => void): () => void {
    this.#subs.add(fn)
    return () => this.#subs.delete(fn)
  }
}
