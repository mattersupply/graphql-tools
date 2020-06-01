import { asArray } from '@graphql-tools/utils';
export function normalizePointers(unnormalizedPointerOrPointers) {
    return asArray(unnormalizedPointerOrPointers).reduce((normalizedPointers, unnormalizedPointer) => {
        if (typeof unnormalizedPointer === 'string') {
            normalizedPointers[unnormalizedPointer] = {};
        }
        else if (typeof unnormalizedPointer === 'object') {
            Object.assign(normalizedPointers, unnormalizedPointer);
        }
        else {
            throw new Error(`Invalid pointer ${unnormalizedPointer}`);
        }
        return normalizedPointers;
    }, {});
}
//# sourceMappingURL=pointers.js.map