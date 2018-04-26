/** Lazily initializes a read-only value from a callback function. */
export class Lazy<T> {
    private _value: T | null = null;

    constructor(private readonly init: () => T) {}

    public get value() {
        if (!this._value) {
            this._value = this.init();
        }

        return this._value;
    }
}