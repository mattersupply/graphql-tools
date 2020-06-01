export function pick(obj, keys) {
    for (const key of keys) {
        if (obj[key]) {
            return obj[key];
        }
    }
    return obj;
}
// checkers
export function isSchemaText(obj) {
    return typeof obj === 'string';
}
export function isWrappedSchemaJson(obj) {
    const json = obj;
    return json.data !== undefined && json.data.__schema !== undefined;
}
export function isSchemaJson(obj) {
    const json = obj;
    return json !== undefined && json.__schema !== undefined;
}
export function isSchemaAst(obj) {
    return obj.kind !== undefined;
}
//# sourceMappingURL=helpers.js.map