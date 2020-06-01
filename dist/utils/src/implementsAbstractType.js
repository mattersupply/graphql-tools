import { doTypesOverlap, isCompositeType } from 'graphql';
export function implementsAbstractType(schema, typeA, typeB) {
    if (typeA === typeB) {
        return true;
    }
    else if (isCompositeType(typeA) && isCompositeType(typeB)) {
        return doTypesOverlap(schema, typeA, typeB);
    }
    return false;
}
//# sourceMappingURL=implementsAbstractType.js.map