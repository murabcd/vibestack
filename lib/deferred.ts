export class Deferred<T> {
	private resolveFn: (value: T | PromiseLike<T>) => void = () => {};
	private rejectFn: (reason?: unknown) => void = () => {};
	private _promise: Promise<T>;

	constructor() {
		this._promise = new Promise<T>((resolve, reject) => {
			this.resolveFn = resolve;
			this.rejectFn = reject;
		});
	}

	get promise() {
		return this._promise;
	}

	resolve(value: T | PromiseLike<T>): void {
		this.resolveFn(value);
	}

	reject(reason?: unknown): void {
		this.rejectFn(reason);
	}
}
