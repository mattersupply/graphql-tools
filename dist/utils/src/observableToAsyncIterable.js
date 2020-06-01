export function observableToAsyncIterable(observable) {
    const pullQueue = [];
    const pushQueue = [];
    let listening = true;
    const pushValue = (value) => {
        if (pullQueue.length !== 0) {
            pullQueue.shift()({ value, done: false });
        }
        else {
            pushQueue.push({ value });
        }
    };
    const pushError = (error) => {
        if (pullQueue.length !== 0) {
            pullQueue.shift()({ value: { errors: [error] }, done: false });
        }
        else {
            pushQueue.push({ value: { errors: [error] } });
        }
    };
    const pullValue = () => new Promise(resolve => {
        if (pushQueue.length !== 0) {
            const element = pushQueue.shift();
            // either {value: {errors: [...]}} or {value: ...}
            resolve({
                ...element,
                done: false,
            });
        }
        else {
            pullQueue.push(resolve);
        }
    });
    const subscription = observable.subscribe({
        next(value) {
            pushValue(value);
        },
        error(err) {
            pushError(err);
        },
    });
    const emptyQueue = () => {
        if (listening) {
            listening = false;
            subscription.unsubscribe();
            pullQueue.forEach(resolve => resolve({ value: undefined, done: true }));
            pullQueue.length = 0;
            pushQueue.length = 0;
        }
    };
    return {
        next() {
            return listening ? pullValue() : this.return();
        },
        return() {
            emptyQueue();
            return Promise.resolve({ value: undefined, done: true });
        },
        throw(error) {
            emptyQueue();
            return Promise.reject(error);
        },
        [Symbol.asyncIterator]() {
            return this;
        },
    };
}
//# sourceMappingURL=observableToAsyncIterable.js.map