export function debugLog(...args) {
    if (process && process.env && process.env.DEBUG && !process.env.GQL_tools_NODEBUG) {
        // tslint:disable-next-line: no-console
        console.log(...args);
    }
}
//# sourceMappingURL=debug-log.js.map