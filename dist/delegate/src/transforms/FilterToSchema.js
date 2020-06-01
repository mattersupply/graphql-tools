import { Kind, TypeNameMetaFieldDef, visit, TypeInfo, visitWithTypeInfo, getNamedType, isObjectType, isInterfaceType, } from 'graphql';
import { implementsAbstractType } from '@graphql-tools/utils';
export default class FilterToSchema {
    constructor(targetSchema) {
        this.targetSchema = targetSchema;
    }
    transformRequest(originalRequest) {
        return {
            ...originalRequest,
            ...filterToSchema(this.targetSchema, originalRequest.document, originalRequest.variables),
        };
    }
}
function filterToSchema(targetSchema, document, variables) {
    const operations = document.definitions.filter(def => def.kind === Kind.OPERATION_DEFINITION);
    const fragments = document.definitions.filter(def => def.kind === Kind.FRAGMENT_DEFINITION);
    let usedVariables = [];
    let usedFragments = [];
    const newOperations = [];
    let newFragments = [];
    const validFragments = fragments.filter((fragment) => {
        const typeName = fragment.typeCondition.name.value;
        return Boolean(targetSchema.getType(typeName));
    });
    const validFragmentsWithType = validFragments.reduce((prev, fragment) => ({
        ...prev,
        [fragment.name.value]: targetSchema.getType(fragment.typeCondition.name.value),
    }), {});
    let fragmentSet = Object.create(null);
    operations.forEach((operation) => {
        let type;
        if (operation.operation === 'subscription') {
            type = targetSchema.getSubscriptionType();
        }
        else if (operation.operation === 'mutation') {
            type = targetSchema.getMutationType();
        }
        else {
            type = targetSchema.getQueryType();
        }
        const { selectionSet, usedFragments: operationUsedFragments, usedVariables: operationUsedVariables, } = filterSelectionSet(targetSchema, type, validFragmentsWithType, operation.selectionSet);
        usedFragments = union(usedFragments, operationUsedFragments);
        const { usedVariables: collectedUsedVariables, newFragments: collectedNewFragments, fragmentSet: collectedFragmentSet, } = collectFragmentVariables(targetSchema, fragmentSet, validFragments, validFragmentsWithType, usedFragments);
        const operationOrFragmentVariables = union(operationUsedVariables, collectedUsedVariables);
        usedVariables = union(usedVariables, operationOrFragmentVariables);
        newFragments = collectedNewFragments;
        fragmentSet = collectedFragmentSet;
        const variableDefinitions = operation.variableDefinitions.filter((variable) => operationOrFragmentVariables.indexOf(variable.variable.name.value) !== -1);
        newOperations.push({
            kind: Kind.OPERATION_DEFINITION,
            operation: operation.operation,
            name: operation.name,
            directives: operation.directives,
            variableDefinitions,
            selectionSet,
        });
    });
    const newVariables = usedVariables.reduce((acc, variableName) => {
        const variableValue = variables[variableName];
        if (variableValue !== undefined) {
            acc[variableName] = variableValue;
        }
        return acc;
    }, {});
    return {
        document: {
            kind: Kind.DOCUMENT,
            definitions: [...newOperations, ...newFragments],
        },
        variables: newVariables,
    };
}
function collectFragmentVariables(targetSchema, fragmentSet, validFragments, validFragmentsWithType, usedFragments) {
    let remainingFragments = usedFragments.slice();
    let usedVariables = [];
    const newFragments = [];
    while (remainingFragments.length !== 0) {
        const nextFragmentName = remainingFragments.pop();
        const fragment = validFragments.find(fr => fr.name.value === nextFragmentName);
        if (fragment != null) {
            const name = nextFragmentName;
            const typeName = fragment.typeCondition.name.value;
            const type = targetSchema.getType(typeName);
            const { selectionSet, usedFragments: fragmentUsedFragments, usedVariables: fragmentUsedVariables, } = filterSelectionSet(targetSchema, type, validFragmentsWithType, fragment.selectionSet);
            remainingFragments = union(remainingFragments, fragmentUsedFragments);
            usedVariables = union(usedVariables, fragmentUsedVariables);
            if (!(name in fragmentSet)) {
                fragmentSet[name] = true;
                newFragments.push({
                    kind: Kind.FRAGMENT_DEFINITION,
                    name: {
                        kind: Kind.NAME,
                        value: name,
                    },
                    typeCondition: fragment.typeCondition,
                    selectionSet,
                });
            }
        }
    }
    return {
        usedVariables,
        newFragments,
        fragmentSet,
    };
}
function filterSelectionSet(schema, type, validFragments, selectionSet) {
    const usedFragments = [];
    const usedVariables = [];
    const typeInfo = new TypeInfo(schema, undefined, type);
    const filteredSelectionSet = visit(selectionSet, visitWithTypeInfo(typeInfo, {
        [Kind.FIELD]: {
            enter(node) {
                const parentType = typeInfo.getParentType();
                if (isObjectType(parentType) || isInterfaceType(parentType)) {
                    const fields = parentType.getFields();
                    const field = node.name.value === '__typename' ? TypeNameMetaFieldDef : fields[node.name.value];
                    if (!field) {
                        return null;
                    }
                    const argNames = (field.args != null ? field.args : []).map(arg => arg.name);
                    if (node.arguments != null) {
                        const args = node.arguments.filter((arg) => argNames.indexOf(arg.name.value) !== -1);
                        if (args.length !== node.arguments.length) {
                            return {
                                ...node,
                                arguments: args,
                            };
                        }
                    }
                }
            },
            leave(node) {
                const resolvedType = getNamedType(typeInfo.getType());
                if (isObjectType(resolvedType) || isInterfaceType(resolvedType)) {
                    const selections = node.selectionSet != null ? node.selectionSet.selections : null;
                    if (selections == null || selections.length === 0) {
                        // need to remove any added variables. Is there a better way to do this?
                        visit(node, {
                            [Kind.VARIABLE](variableNode) {
                                const index = usedVariables.indexOf(variableNode.name.value);
                                if (index !== -1) {
                                    usedVariables.splice(index, 1);
                                }
                            },
                        });
                        return null;
                    }
                }
            },
        },
        [Kind.FRAGMENT_SPREAD](node) {
            if (node.name.value in validFragments) {
                const parentType = typeInfo.getParentType();
                const innerType = validFragments[node.name.value];
                if (!implementsAbstractType(schema, parentType, innerType)) {
                    return null;
                }
                usedFragments.push(node.name.value);
                return;
            }
            return null;
        },
        [Kind.INLINE_FRAGMENT]: {
            enter(node) {
                if (node.typeCondition != null) {
                    const parentType = typeInfo.getParentType();
                    const innerType = schema.getType(node.typeCondition.name.value);
                    if (!implementsAbstractType(schema, parentType, innerType)) {
                        return null;
                    }
                }
            },
        },
        [Kind.VARIABLE](node) {
            usedVariables.push(node.name.value);
        },
    }));
    return {
        selectionSet: filteredSelectionSet,
        usedFragments,
        usedVariables,
    };
}
function union(...arrays) {
    const cache = Object.create(null);
    const result = [];
    arrays.forEach(array => {
        array.forEach(item => {
            if (!(item in cache)) {
                cache[item] = true;
                result.push(item);
            }
        });
    });
    return result;
}
//# sourceMappingURL=FilterToSchema.js.map