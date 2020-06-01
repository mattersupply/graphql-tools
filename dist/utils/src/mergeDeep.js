/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { isScalarType } from 'graphql';
export function mergeDeep(target, ...sources) {
    if (isScalarType(target)) {
        return target;
    }
    const output = {
        ...target,
    };
    for (const source of sources) {
        if (isObject(target) && isObject(source)) {
            for (const key in source) {
                if (isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    }
                    else {
                        output[key] = mergeDeep(target[key], source[key]);
                    }
                }
                else {
                    Object.assign(output, { [key]: source[key] });
                }
            }
        }
    }
    return output;
}
function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}
//# sourceMappingURL=mergeDeep.js.map