import { Kind, TypeInfo, getNamedType, isAbstractType, visit, visitWithTypeInfo, } from 'graphql';
import { implementsAbstractType } from '@graphql-tools/utils';
export default class ExpandAbstractTypes {
    constructor(sourceSchema, targetSchema) {
        this.targetSchema = targetSchema;
        this.mapping = extractPossibleTypes(sourceSchema, targetSchema);
        this.reverseMapping = flipMapping(this.mapping);
    }
    transformRequest(originalRequest) {
        const document = expandAbstractTypes(this.targetSchema, this.mapping, this.reverseMapping, originalRequest.document);
        return {
            ...originalRequest,
            document,
        };
    }
}
function extractPossibleTypes(sourceSchema, targetSchema) {
    const typeMap = sourceSchema.getTypeMap();
    const mapping = Object.create(null);
    Object.keys(typeMap).forEach(typeName => {
        const type = typeMap[typeName];
        if (isAbstractType(type)) {
            const targetType = targetSchema.getType(typeName);
            if (!isAbstractType(targetType)) {
                const implementations = sourceSchema.getPossibleTypes(type);
                mapping[typeName] = implementations.filter(impl => targetSchema.getType(impl.name)).map(impl => impl.name);
            }
        }
    });
    return mapping;
}
function flipMapping(mapping) {
    const result = Object.create(null);
    Object.keys(mapping).forEach(typeName => {
        const toTypeNames = mapping[typeName];
        toTypeNames.forEach(toTypeName => {
            if (!(toTypeName in result)) {
                result[toTypeName] = [];
            }
            result[toTypeName].push(typeName);
        });
    });
    return result;
}
function expandAbstractTypes(targetSchema, mapping, reverseMapping, document) {
    const operations = document.definitions.filter(def => def.kind === Kind.OPERATION_DEFINITION);
    const fragments = document.definitions.filter(def => def.kind === Kind.FRAGMENT_DEFINITION);
    const existingFragmentNames = fragments.map(fragment => fragment.name.value);
    let fragmentCounter = 0;
    const generateFragmentName = (typeName) => {
        let fragmentName;
        do {
            fragmentName = `_${typeName}_Fragment${fragmentCounter.toString()}`;
            fragmentCounter++;
        } while (existingFragmentNames.indexOf(fragmentName) !== -1);
        return fragmentName;
    };
    const newFragments = [];
    const fragmentReplacements = Object.create(null);
    fragments.forEach((fragment) => {
        newFragments.push(fragment);
        const possibleTypes = mapping[fragment.typeCondition.name.value];
        if (possibleTypes != null) {
            fragmentReplacements[fragment.name.value] = [];
            possibleTypes.forEach(possibleTypeName => {
                const name = generateFragmentName(possibleTypeName);
                existingFragmentNames.push(name);
                const newFragment = {
                    kind: Kind.FRAGMENT_DEFINITION,
                    name: {
                        kind: Kind.NAME,
                        value: name,
                    },
                    typeCondition: {
                        kind: Kind.NAMED_TYPE,
                        name: {
                            kind: Kind.NAME,
                            value: possibleTypeName,
                        },
                    },
                    selectionSet: fragment.selectionSet,
                };
                newFragments.push(newFragment);
                fragmentReplacements[fragment.name.value].push({
                    fragmentName: name,
                    typeName: possibleTypeName,
                });
            });
        }
    });
    const newDocument = {
        ...document,
        definitions: [...operations, ...newFragments],
    };
    const typeInfo = new TypeInfo(targetSchema);
    return visit(newDocument, visitWithTypeInfo(typeInfo, {
        [Kind.SELECTION_SET](node) {
            const newSelections = [...node.selections];
            const maybeType = typeInfo.getParentType();
            if (maybeType != null) {
                const parentType = getNamedType(maybeType);
                node.selections.forEach((selection) => {
                    if (selection.kind === Kind.INLINE_FRAGMENT) {
                        if (selection.typeCondition != null) {
                            const possibleTypes = mapping[selection.typeCondition.name.value];
                            if (possibleTypes != null) {
                                possibleTypes.forEach(possibleType => {
                                    const maybePossibleType = targetSchema.getType(possibleType);
                                    if (maybePossibleType != null &&
                                        implementsAbstractType(targetSchema, parentType, maybePossibleType)) {
                                        newSelections.push({
                                            kind: Kind.INLINE_FRAGMENT,
                                            typeCondition: {
                                                kind: Kind.NAMED_TYPE,
                                                name: {
                                                    kind: Kind.NAME,
                                                    value: possibleType,
                                                },
                                            },
                                            selectionSet: selection.selectionSet,
                                        });
                                    }
                                });
                            }
                        }
                    }
                    else if (selection.kind === Kind.FRAGMENT_SPREAD) {
                        const fragmentName = selection.name.value;
                        if (fragmentName in fragmentReplacements) {
                            fragmentReplacements[fragmentName].forEach(replacement => {
                                const typeName = replacement.typeName;
                                const maybeReplacementType = targetSchema.getType(typeName);
                                if (maybeReplacementType != null && implementsAbstractType(targetSchema, parentType, maybeType)) {
                                    newSelections.push({
                                        kind: Kind.FRAGMENT_SPREAD,
                                        name: {
                                            kind: Kind.NAME,
                                            value: replacement.fragmentName,
                                        },
                                    });
                                }
                            });
                        }
                    }
                });
                if (parentType.name in reverseMapping) {
                    newSelections.push({
                        kind: Kind.FIELD,
                        name: {
                            kind: Kind.NAME,
                            value: '__typename',
                        },
                    });
                }
            }
            if (newSelections.length !== node.selections.length) {
                return {
                    ...node,
                    selections: newSelections,
                };
            }
        },
    }));
}
//# sourceMappingURL=ExpandAbstractTypes.js.map