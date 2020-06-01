import { visit, visitWithTypeInfo, Kind, getNamedType, isAbstractType, TypeInfo, isObjectType, isInterfaceType, TypeNameMetaFieldDef, getNullableType, isLeafType, isCompositeType, isListType, typeFromAST, isSchema, getOperationAST, validate, execute, subscribe, defaultFieldResolver, parse } from 'graphql';
import { implementsAbstractType, CombinedError, getErrorsByPathSegment, ERROR_SYMBOL, relocatedError, mergeDeep, getErrors, setErrors, slicedError, collectFields, getResponseKeyFromInfo, updateArgument, serializeInputValue, applyRequestTransforms, applyResultTransforms, mapAsyncIterator, concatInlineFragments } from '@graphql-tools/utils';

class ExpandAbstractTypes {
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

// For motivation, see https://github.com/ardatan/graphql-tools/issues/751
class WrapConcreteTypes {
    constructor(returnType, targetSchema) {
        this.returnType = returnType;
        this.targetSchema = targetSchema;
    }
    transformRequest(originalRequest) {
        const document = wrapConcreteTypes(this.returnType, this.targetSchema, originalRequest.document);
        return {
            ...originalRequest,
            document,
        };
    }
}
function wrapConcreteTypes(returnType, targetSchema, document) {
    const namedType = getNamedType(returnType);
    if (!isObjectType(namedType)) {
        return document;
    }
    const queryRootType = targetSchema.getQueryType();
    const mutationRootType = targetSchema.getMutationType();
    const subscriptionRootType = targetSchema.getSubscriptionType();
    const typeInfo = new TypeInfo(targetSchema);
    const newDocument = visit(document, visitWithTypeInfo(typeInfo, {
        [Kind.FIELD](node) {
            const maybeType = typeInfo.getParentType();
            if (maybeType == null) {
                return false;
            }
            const parentType = getNamedType(maybeType);
            if (parentType !== queryRootType && parentType !== mutationRootType && parentType !== subscriptionRootType) {
                return false;
            }
            if (!isAbstractType(getNamedType(typeInfo.getType()))) {
                return false;
            }
            return {
                ...node,
                selectionSet: {
                    kind: Kind.SELECTION_SET,
                    selections: [
                        {
                            kind: Kind.INLINE_FRAGMENT,
                            typeCondition: {
                                kind: Kind.NAMED_TYPE,
                                name: {
                                    kind: Kind.NAME,
                                    value: namedType.name,
                                },
                            },
                            selectionSet: node.selectionSet,
                        },
                    ],
                },
            };
        },
    }));
    return newDocument;
}

class FilterToSchema {
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

class AddFragmentsByField {
    constructor(targetSchema, mapping) {
        this.targetSchema = targetSchema;
        this.mapping = mapping;
    }
    transformRequest(originalRequest) {
        const document = addFragmentsByField(this.targetSchema, originalRequest.document, this.mapping);
        return {
            ...originalRequest,
            document,
        };
    }
}
function addFragmentsByField(targetSchema, document, mapping) {
    const typeInfo = new TypeInfo(targetSchema);
    return visit(document, visitWithTypeInfo(typeInfo, {
        [Kind.SELECTION_SET](node) {
            const parentType = typeInfo.getParentType();
            if (parentType != null) {
                const parentTypeName = parentType.name;
                let selections = node.selections;
                if (parentTypeName in mapping) {
                    node.selections.forEach(selection => {
                        if (selection.kind === Kind.FIELD) {
                            const name = selection.name.value;
                            const fragment = mapping[parentTypeName][name];
                            if (fragment != null) {
                                selections = selections.concat(fragment);
                            }
                        }
                    });
                }
                if (selections !== node.selections) {
                    return {
                        ...node,
                        selections,
                    };
                }
            }
        },
    }));
}

class AddSelectionSetsByField {
    constructor(schema, mapping) {
        this.schema = schema;
        this.mapping = mapping;
    }
    transformRequest(originalRequest) {
        const document = addSelectionSetsByField(this.schema, originalRequest.document, this.mapping);
        return {
            ...originalRequest,
            document,
        };
    }
}
function addSelectionSetsByField(schema, document, mapping) {
    const typeInfo = new TypeInfo(schema);
    return visit(document, visitWithTypeInfo(typeInfo, {
        [Kind.SELECTION_SET](node) {
            const parentType = typeInfo.getParentType();
            if (parentType != null) {
                const parentTypeName = parentType.name;
                let selections = node.selections;
                if (parentTypeName in mapping) {
                    node.selections.forEach(selection => {
                        if (selection.kind === Kind.FIELD) {
                            const name = selection.name.value;
                            const selectionSet = mapping[parentTypeName][name];
                            if (selectionSet != null) {
                                selections = selections.concat(selectionSet.selections);
                            }
                        }
                    });
                }
                if (selections !== node.selections) {
                    return {
                        ...node,
                        selections,
                    };
                }
            }
        },
    }));
}

class AddSelectionSetsByType {
    constructor(targetSchema, mapping) {
        this.targetSchema = targetSchema;
        this.mapping = mapping;
    }
    transformRequest(originalRequest) {
        const document = addSelectionSetsByType(this.targetSchema, originalRequest.document, this.mapping);
        return {
            ...originalRequest,
            document,
        };
    }
}
function addSelectionSetsByType(targetSchema, document, mapping) {
    const typeInfo = new TypeInfo(targetSchema);
    return visit(document, visitWithTypeInfo(typeInfo, {
        [Kind.SELECTION_SET](node) {
            const parentType = typeInfo.getParentType();
            if (parentType != null) {
                const parentTypeName = parentType.name;
                let selections = node.selections;
                if (parentTypeName in mapping) {
                    const selectionSet = mapping[parentTypeName];
                    if (selectionSet != null) {
                        selections = selections.concat(selectionSet.selections);
                    }
                }
                if (selections !== node.selections) {
                    return {
                        ...node,
                        selections,
                    };
                }
            }
        },
    }));
}

class AddTypenameToAbstract {
    constructor(targetSchema) {
        this.targetSchema = targetSchema;
    }
    transformRequest(originalRequest) {
        const document = addTypenameToAbstract(this.targetSchema, originalRequest.document);
        return {
            ...originalRequest,
            document,
        };
    }
}
function addTypenameToAbstract(targetSchema, document) {
    const typeInfo = new TypeInfo(targetSchema);
    return visit(document, visitWithTypeInfo(typeInfo, {
        [Kind.SELECTION_SET](node) {
            const parentType = typeInfo.getParentType();
            let selections = node.selections;
            if (parentType != null && isAbstractType(parentType)) {
                selections = selections.concat({
                    kind: Kind.FIELD,
                    name: {
                        kind: Kind.NAME,
                        value: '__typename',
                    },
                });
            }
            if (selections !== node.selections) {
                return {
                    ...node,
                    selections,
                };
            }
        },
    }));
}

function handleNull(errors) {
    if (errors.length) {
        if (errors.some(error => !error.path || error.path.length < 2)) {
            if (errors.length > 1) {
                const combinedError = new CombinedError(errors);
                return combinedError;
            }
            const error = errors[0];
            return error.originalError || error;
        }
        else if (errors.some(error => typeof error.path[1] === 'string')) {
            const childErrors = getErrorsByPathSegment(errors);
            const result = {};
            Object.keys(childErrors).forEach(pathSegment => {
                result[pathSegment] = handleNull(childErrors[pathSegment]);
            });
            return result;
        }
        const childErrors = getErrorsByPathSegment(errors);
        const result = [];
        Object.keys(childErrors).forEach(pathSegment => {
            result.push(handleNull(childErrors[pathSegment]));
        });
        return result;
    }
    return null;
}

const OBJECT_SUBSCHEMA_SYMBOL = Symbol('initialSubschema');
const FIELD_SUBSCHEMA_MAP_SYMBOL = Symbol('subschemaMap');

function getSubschema(result, responseKey) {
    const subschema = result[FIELD_SUBSCHEMA_MAP_SYMBOL] && result[FIELD_SUBSCHEMA_MAP_SYMBOL][responseKey];
    return subschema || result[OBJECT_SUBSCHEMA_SYMBOL];
}
function setObjectSubschema(result, subschema) {
    result[OBJECT_SUBSCHEMA_SYMBOL] = subschema;
}

function unwrapResult(parent, path) {
    let newParent = parent;
    const pathLength = path.length;
    for (let i = 0; i < pathLength; i++) {
        const responseKey = path[i];
        const errors = getErrors(newParent, responseKey);
        const subschema = getSubschema(newParent, responseKey);
        const object = newParent[responseKey];
        if (object == null) {
            return handleNull(errors);
        }
        setErrors(object, errors.map(error => relocatedError(error, error.path != null ? error.path.slice(1) : undefined)));
        setObjectSubschema(object, subschema);
        newParent = object;
    }
    return newParent;
}
function dehoistResult(parent, delimeter = '__gqltf__') {
    const result = Object.create(null);
    Object.keys(parent).forEach(alias => {
        let obj = result;
        const fieldNames = alias.split(delimeter);
        const fieldName = fieldNames.pop();
        fieldNames.forEach(key => {
            obj = obj[key] = obj[key] || Object.create(null);
        });
        obj[fieldName] = parent[alias];
    });
    result[ERROR_SYMBOL] = parent[ERROR_SYMBOL].map((error) => {
        if (error.path != null) {
            const path = error.path.slice();
            const pathSegment = path.shift();
            const expandedPathSegment = pathSegment.split(delimeter);
            return relocatedError(error, expandedPathSegment.concat(path));
        }
        return error;
    });
    result[OBJECT_SUBSCHEMA_SYMBOL] = parent[OBJECT_SUBSCHEMA_SYMBOL];
    return result;
}
function mergeProxiedResults(target, ...sources) {
    const errors = target[ERROR_SYMBOL].concat(sources.map((source) => source[ERROR_SYMBOL]));
    const fieldSubschemaMap = sources.reduce((acc, source) => {
        const subschema = source[OBJECT_SUBSCHEMA_SYMBOL];
        Object.keys(source).forEach(key => {
            acc[key] = subschema;
        });
        return acc;
    }, {});
    const result = sources.reduce(mergeDeep, target);
    result[ERROR_SYMBOL] = errors;
    result[FIELD_SUBSCHEMA_MAP_SYMBOL] = target[FIELD_SUBSCHEMA_MAP_SYMBOL]
        ? mergeDeep(target[FIELD_SUBSCHEMA_MAP_SYMBOL], fieldSubschemaMap)
        : fieldSubschemaMap;
    return result;
}

function buildDelegationPlan(mergedTypeInfo, originalSelections, sourceSubschemas, targetSubschemas) {
    // 1.  calculate if possible to delegate to given subschema
    //    TODO: change logic so that required selection set can be spread across multiple subschemas?
    const proxiableSubschemas = [];
    const nonProxiableSubschemas = [];
    targetSubschemas.forEach(t => {
        if (sourceSubschemas.some(s => {
            const selectionSet = mergedTypeInfo.selectionSets.get(t);
            return mergedTypeInfo.containsSelectionSet.get(s).get(selectionSet);
        })) {
            proxiableSubschemas.push(t);
        }
        else {
            nonProxiableSubschemas.push(t);
        }
    });
    const { uniqueFields, nonUniqueFields } = mergedTypeInfo;
    const unproxiableSelections = [];
    // 2. for each selection:
    const delegationMap = new Map();
    originalSelections.forEach(selection => {
        // 2a. use uniqueFields map to assign fields to subschema if one of possible subschemas
        const uniqueSubschema = uniqueFields[selection.name.value];
        if (uniqueSubschema != null) {
            if (proxiableSubschemas.includes(uniqueSubschema)) {
                const existingSubschema = delegationMap.get(uniqueSubschema);
                if (existingSubschema != null) {
                    existingSubschema.push(selection);
                }
                else {
                    delegationMap.set(uniqueSubschema, [selection]);
                }
            }
            else {
                unproxiableSelections.push(selection);
            }
        }
        else {
            // 2b. use nonUniqueFields to assign to a possible subschema,
            //     preferring one of the subschemas already targets of delegation
            let nonUniqueSubschemas = nonUniqueFields[selection.name.value];
            nonUniqueSubschemas = nonUniqueSubschemas.filter(s => proxiableSubschemas.includes(s));
            if (nonUniqueSubschemas != null) {
                const subschemas = Array.from(delegationMap.keys());
                const existingSubschema = nonUniqueSubschemas.find(s => subschemas.includes(s));
                if (existingSubschema != null) {
                    delegationMap.get(existingSubschema).push(selection);
                }
                else {
                    delegationMap.set(nonUniqueSubschemas[0], [selection]);
                }
            }
            else {
                unproxiableSelections.push(selection);
            }
        }
    });
    return {
        delegationMap,
        unproxiableSelections,
        proxiableSubschemas,
        nonProxiableSubschemas,
    };
}
function mergeFields(mergedTypeInfo, typeName, object, originalSelections, sourceSubschemas, targetSubschemas, context, info) {
    if (!originalSelections.length) {
        return object;
    }
    const { delegationMap, unproxiableSelections, proxiableSubschemas, nonProxiableSubschemas } = buildDelegationPlan(mergedTypeInfo, originalSelections, sourceSubschemas, targetSubschemas);
    if (!delegationMap.size) {
        return object;
    }
    const maybePromises = [];
    delegationMap.forEach((selections, s) => {
        const maybePromise = s.merge[typeName].resolve(object, context, info, s, {
            kind: Kind.SELECTION_SET,
            selections,
        });
        maybePromises.push(maybePromise);
    });
    let containsPromises = false;
    for (const maybePromise of maybePromises) {
        if (maybePromise instanceof Promise) {
            containsPromises = true;
            break;
        }
    }
    return containsPromises
        ? Promise.all(maybePromises).then(results => mergeFields(mergedTypeInfo, typeName, mergeProxiedResults(object, ...results), unproxiableSelections, sourceSubschemas.concat(proxiableSubschemas), nonProxiableSubschemas, context, info))
        : mergeFields(mergedTypeInfo, typeName, mergeProxiedResults(object, ...maybePromises), unproxiableSelections, sourceSubschemas.concat(proxiableSubschemas), nonProxiableSubschemas, context, info);
}

function isSubschemaConfig(value) {
    return Boolean(value.schema);
}

function handleObject(type, object, errors, subschema, context, info, skipTypeMerging) {
    var _a;
    const stitchingInfo = (_a = info === null || info === void 0 ? void 0 : info.schema.extensions) === null || _a === void 0 ? void 0 : _a.stitchingInfo;
    setErrors(object, errors.map(error => slicedError(error)));
    setObjectSubschema(object, subschema);
    if (skipTypeMerging || !stitchingInfo) {
        return object;
    }
    const typeName = isAbstractType(type) ? info.schema.getTypeMap()[object.__typename].name : type.name;
    const mergedTypeInfo = stitchingInfo.mergedTypes[typeName];
    let targetSubschemas;
    if (mergedTypeInfo != null) {
        targetSubschemas = mergedTypeInfo.subschemas;
    }
    if (!targetSubschemas) {
        return object;
    }
    targetSubschemas = targetSubschemas.filter(s => s !== subschema);
    if (!targetSubschemas.length) {
        return object;
    }
    const subFields = collectSubFields(info, object.__typename);
    const selections = getFieldsNotInSubschema(subFields, subschema, mergedTypeInfo, object.__typename);
    return mergeFields(mergedTypeInfo, typeName, object, selections, [subschema], targetSubschemas, context, info);
}
function collectSubFields(info, typeName) {
    let subFieldNodes = Object.create(null);
    const visitedFragmentNames = Object.create(null);
    info.fieldNodes.forEach(fieldNode => {
        subFieldNodes = collectFields({
            schema: info.schema,
            variableValues: info.variableValues,
            fragments: info.fragments,
        }, info.schema.getType(typeName), fieldNode.selectionSet, subFieldNodes, visitedFragmentNames);
    });
    return subFieldNodes;
}
function getFieldsNotInSubschema(subFieldNodes, subschema, mergedTypeInfo, typeName) {
    const typeMap = isSubschemaConfig(subschema) ? mergedTypeInfo.typeMaps.get(subschema) : subschema.getTypeMap();
    const fields = typeMap[typeName].getFields();
    const fieldsNotInSchema = [];
    Object.keys(subFieldNodes).forEach(responseName => {
        subFieldNodes[responseName].forEach(subFieldNode => {
            if (!(subFieldNode.name.value in fields)) {
                fieldsNotInSchema.push(subFieldNode);
            }
        });
    });
    return fieldsNotInSchema;
}

function handleList(type, list, errors, subschema, context, info, skipTypeMerging) {
    const childErrors = getErrorsByPathSegment(errors);
    return list.map((listMember, index) => handleListMember(getNullableType(type.ofType), listMember, index in childErrors ? childErrors[index] : [], subschema, context, info, skipTypeMerging));
}
function handleListMember(type, listMember, errors, subschema, context, info, skipTypeMerging) {
    if (listMember == null) {
        return handleNull(errors);
    }
    if (isLeafType(type)) {
        return type.parseValue(listMember);
    }
    else if (isCompositeType(type)) {
        return handleObject(type, listMember, errors, subschema, context, info, skipTypeMerging);
    }
    else if (isListType(type)) {
        return handleList(type, listMember, errors, subschema, context, info, skipTypeMerging);
    }
}

function handleResult(result, errors, subschema, context, info, returnType = info.returnType, skipTypeMerging) {
    const type = getNullableType(returnType);
    if (result == null) {
        return handleNull(errors);
    }
    if (isLeafType(type)) {
        return type.parseValue(result);
    }
    else if (isCompositeType(type)) {
        return handleObject(type, result, errors, subschema, context, info, skipTypeMerging);
    }
    else if (isListType(type)) {
        return handleList(type, result, errors, subschema, context, info, skipTypeMerging);
    }
}

class CheckResultAndHandleErrors {
    constructor(info, fieldName, subschema, context, returnType = info.returnType, typeMerge) {
        this.context = context;
        this.info = info;
        this.fieldName = fieldName;
        this.subschema = subschema;
        this.returnType = returnType;
        this.typeMerge = typeMerge;
    }
    transformResult(result) {
        return checkResultAndHandleErrors(result, this.context != null ? this.context : {}, this.info, this.fieldName, this.subschema, this.returnType, this.typeMerge);
    }
}
function checkResultAndHandleErrors(result, context, info, responseKey = getResponseKeyFromInfo(info), subschema, returnType = info.returnType, skipTypeMerging) {
    const errors = result.errors != null ? result.errors : [];
    const data = result.data != null ? result.data[responseKey] : undefined;
    return handleResult(data, errors, subschema, context, info, returnType, skipTypeMerging);
}

class AddArgumentsAsVariables {
    constructor(targetSchema, args) {
        this.targetSchema = targetSchema;
        this.args = Object.entries(args).reduce((prev, [key, val]) => ({
            ...prev,
            [key]: val,
        }), {});
    }
    transformRequest(originalRequest) {
        const { document, newVariables } = addVariablesToRootField(this.targetSchema, originalRequest, this.args);
        return {
            document,
            variables: newVariables,
        };
    }
}
function addVariablesToRootField(targetSchema, originalRequest, args) {
    const document = originalRequest.document;
    const variableValues = originalRequest.variables;
    const operations = document.definitions.filter(def => def.kind === Kind.OPERATION_DEFINITION);
    const fragments = document.definitions.filter(def => def.kind === Kind.FRAGMENT_DEFINITION);
    const newOperations = operations.map((operation) => {
        const variableDefinitionMap = operation.variableDefinitions.reduce((prev, def) => ({
            ...prev,
            [def.variable.name.value]: def,
        }), {});
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
        const newSelectionSet = [];
        operation.selectionSet.selections.forEach((selection) => {
            if (selection.kind === Kind.FIELD) {
                const argumentNodes = selection.arguments;
                const argumentNodeMap = argumentNodes.reduce((prev, argument) => ({
                    ...prev,
                    [argument.name.value]: argument,
                }), {});
                const targetField = type.getFields()[selection.name.value];
                // excludes __typename
                if (targetField != null) {
                    updateArguments(targetField, argumentNodeMap, variableDefinitionMap, variableValues, args);
                }
                newSelectionSet.push({
                    ...selection,
                    arguments: Object.keys(argumentNodeMap).map(argName => argumentNodeMap[argName]),
                });
            }
            else {
                newSelectionSet.push(selection);
            }
        });
        return {
            ...operation,
            variableDefinitions: Object.keys(variableDefinitionMap).map(varName => variableDefinitionMap[varName]),
            selectionSet: {
                kind: Kind.SELECTION_SET,
                selections: newSelectionSet,
            },
        };
    });
    return {
        document: {
            ...document,
            definitions: [...newOperations, ...fragments],
        },
        newVariables: variableValues,
    };
}
function updateArguments(targetField, argumentNodeMap, variableDefinitionMap, variableValues, newArgs) {
    targetField.args.forEach((argument) => {
        const argName = argument.name;
        const argType = argument.type;
        if (argName in newArgs) {
            updateArgument(argName, argType, argumentNodeMap, variableDefinitionMap, variableValues, serializeInputValue(argType, newArgs[argName]));
        }
    });
}

function getDelegatingOperation(parentType, schema) {
    if (parentType === schema.getMutationType()) {
        return 'mutation';
    }
    else if (parentType === schema.getSubscriptionType()) {
        return 'subscription';
    }
    return 'query';
}
function createRequestFromInfo({ info, operation = getDelegatingOperation(info.parentType, info.schema), fieldName = info.fieldName, selectionSet, fieldNodes = info.fieldNodes, }) {
    return createRequest({
        sourceSchema: info.schema,
        sourceParentType: info.parentType,
        sourceFieldName: info.fieldName,
        fragments: info.fragments,
        variableDefinitions: info.operation.variableDefinitions,
        variableValues: info.variableValues,
        targetOperation: operation,
        targetFieldName: fieldName,
        selectionSet,
        fieldNodes,
    });
}
function createRequest({ sourceSchema, sourceParentType, sourceFieldName, fragments, variableDefinitions, variableValues, targetOperation, targetFieldName, selectionSet, fieldNodes, }) {
    var _a;
    let newSelectionSet = selectionSet;
    let argumentNodeMap;
    if (fieldNodes == null) {
        argumentNodeMap = Object.create(null);
    }
    else {
        const selections = fieldNodes.reduce((acc, fieldNode) => (fieldNode.selectionSet != null ? acc.concat(fieldNode.selectionSet.selections) : acc), []);
        newSelectionSet = selections.length
            ? {
                kind: Kind.SELECTION_SET,
                selections,
            }
            : undefined;
        argumentNodeMap = {};
        const args = (_a = fieldNodes[0]) === null || _a === void 0 ? void 0 : _a.arguments;
        if (args) {
            argumentNodeMap = args.reduce((prev, curr) => ({
                ...prev,
                [curr.name.value]: curr,
            }), argumentNodeMap);
        }
    }
    const newVariables = Object.create(null);
    const variableDefinitionMap = Object.create(null);
    if (sourceSchema != null && variableDefinitions != null) {
        variableDefinitions.forEach(def => {
            const varName = def.variable.name.value;
            variableDefinitionMap[varName] = def;
            const varType = typeFromAST(sourceSchema, def.type);
            const serializedValue = serializeInputValue(varType, variableValues[varName]);
            if (serializedValue !== undefined) {
                newVariables[varName] = serializedValue;
            }
        });
    }
    if (sourceParentType != null) {
        updateArgumentsWithDefaults(sourceParentType, sourceFieldName, argumentNodeMap, variableDefinitionMap, newVariables);
    }
    const rootfieldNode = {
        kind: Kind.FIELD,
        arguments: Object.keys(argumentNodeMap).map(argName => argumentNodeMap[argName]),
        name: {
            kind: Kind.NAME,
            value: targetFieldName || fieldNodes[0].name.value,
        },
        selectionSet: newSelectionSet,
    };
    const operationDefinition = {
        kind: Kind.OPERATION_DEFINITION,
        operation: targetOperation,
        variableDefinitions: Object.keys(variableDefinitionMap).map(varName => variableDefinitionMap[varName]),
        selectionSet: {
            kind: Kind.SELECTION_SET,
            selections: [rootfieldNode],
        },
    };
    let definitions = [operationDefinition];
    if (fragments != null) {
        definitions = definitions.concat(Object.keys(fragments).map(fragmentName => fragments[fragmentName]));
    }
    const document = {
        kind: Kind.DOCUMENT,
        definitions,
    };
    return {
        document,
        variables: newVariables,
    };
}
function updateArgumentsWithDefaults(sourceParentType, sourceFieldName, argumentNodeMap, variableDefinitionMap, variableValues) {
    const sourceField = sourceParentType.getFields()[sourceFieldName];
    sourceField.args.forEach((argument) => {
        const argName = argument.name;
        const sourceArgType = argument.type;
        if (argumentNodeMap[argName] === undefined) {
            const defaultValue = argument.defaultValue;
            if (defaultValue !== undefined) {
                updateArgument(argName, sourceArgType, argumentNodeMap, variableDefinitionMap, variableValues, serializeInputValue(sourceArgType, defaultValue));
            }
        }
    });
}

function delegateToSchema(options) {
    if (isSchema(options)) {
        throw new Error('Passing positional arguments to delegateToSchema is deprecated. ' + 'Please pass named parameters instead.');
    }
    const { info, operation = getDelegatingOperation(info.parentType, info.schema), fieldName = info.fieldName, returnType = info.returnType, selectionSet, fieldNodes, } = options;
    const request = createRequestFromInfo({
        info,
        operation,
        fieldName,
        selectionSet,
        fieldNodes,
    });
    return delegateRequest({
        ...options,
        request,
        operation,
        fieldName,
        returnType,
    });
}
function getDelegationReturnType(info, targetSchema, operation, fieldName) {
    if (info != null) {
        return info.returnType;
    }
    let rootType;
    if (operation === 'query') {
        rootType = targetSchema.getQueryType();
    }
    else if (operation === 'mutation') {
        rootType = targetSchema.getMutationType();
    }
    else {
        rootType = targetSchema.getSubscriptionType();
    }
    return rootType.getFields()[fieldName].type;
}
function buildDelegationTransforms(subschemaOrSubschemaConfig, info, context, targetSchema, fieldName, args, returnType, transforms, transformedSchema, skipTypeMerging) {
    var _a, _b;
    const stitchingInfo = (_a = info === null || info === void 0 ? void 0 : info.schema.extensions) === null || _a === void 0 ? void 0 : _a.stitchingInfo;
    let delegationTransforms = [
        new CheckResultAndHandleErrors(info, fieldName, subschemaOrSubschemaConfig, context, returnType, skipTypeMerging),
    ];
    if (stitchingInfo != null) {
        delegationTransforms.push(new AddSelectionSetsByField(info.schema, stitchingInfo.selectionSetsByField), new AddSelectionSetsByType(info.schema, stitchingInfo.selectionSetsByType));
    }
    const transformedTargetSchema = stitchingInfo == null
        ? transformedSchema !== null && transformedSchema !== void 0 ? transformedSchema : targetSchema : (_b = transformedSchema !== null && transformedSchema !== void 0 ? transformedSchema : stitchingInfo.transformedSchemas.get(subschemaOrSubschemaConfig)) !== null && _b !== void 0 ? _b : targetSchema;
    delegationTransforms.push(new WrapConcreteTypes(returnType, transformedTargetSchema));
    if (info != null) {
        delegationTransforms.push(new ExpandAbstractTypes(info.schema, transformedTargetSchema));
    }
    delegationTransforms = delegationTransforms.concat(transforms);
    if (stitchingInfo != null) {
        delegationTransforms.push(new AddFragmentsByField(targetSchema, stitchingInfo.fragmentsByField));
    }
    if (args != null) {
        delegationTransforms.push(new AddArgumentsAsVariables(targetSchema, args));
    }
    delegationTransforms.push(new FilterToSchema(targetSchema), new AddTypenameToAbstract(targetSchema));
    return delegationTransforms;
}
function delegateRequest({ request, schema: subschemaOrSubschemaConfig, rootValue, info, operation, fieldName, args, returnType, context, transforms = [], transformedSchema, skipValidation, skipTypeMerging, }) {
    var _a;
    let operationDefinition;
    let targetOperation;
    let targetFieldName;
    if (operation == null) {
        operationDefinition = getOperationAST(request.document, undefined);
        targetOperation = operationDefinition.operation;
    }
    else {
        targetOperation = operation;
    }
    if (fieldName == null) {
        operationDefinition = operationDefinition !== null && operationDefinition !== void 0 ? operationDefinition : getOperationAST(request.document, undefined);
        targetFieldName = operationDefinition.selectionSet.selections[0].name.value;
    }
    else {
        targetFieldName = fieldName;
    }
    let targetSchema;
    let targetRootValue;
    let requestTransforms = transforms.slice();
    let subschemaConfig;
    if (isSubschemaConfig(subschemaOrSubschemaConfig)) {
        subschemaConfig = subschemaOrSubschemaConfig;
        targetSchema = subschemaConfig.schema;
        targetRootValue = (_a = rootValue !== null && rootValue !== void 0 ? rootValue : subschemaConfig === null || subschemaConfig === void 0 ? void 0 : subschemaConfig.rootValue) !== null && _a !== void 0 ? _a : info === null || info === void 0 ? void 0 : info.rootValue;
        if (subschemaConfig.transforms != null) {
            requestTransforms = requestTransforms.concat(subschemaConfig.transforms);
        }
    }
    else {
        targetSchema = subschemaOrSubschemaConfig;
        targetRootValue = rootValue !== null && rootValue !== void 0 ? rootValue : info === null || info === void 0 ? void 0 : info.rootValue;
    }
    const delegationTransforms = buildDelegationTransforms(subschemaOrSubschemaConfig, info, context, targetSchema, targetFieldName, args, returnType !== null && returnType !== void 0 ? returnType : getDelegationReturnType(info, targetSchema, targetOperation, targetFieldName), requestTransforms.reverse(), transformedSchema, skipTypeMerging);
    const processedRequest = applyRequestTransforms(request, delegationTransforms);
    if (!skipValidation) {
        const errors = validate(targetSchema, processedRequest.document);
        if (errors.length > 0) {
            if (errors.length > 1) {
                const combinedError = new CombinedError(errors);
                throw combinedError;
            }
            const error = errors[0];
            throw error.originalError || error;
        }
    }
    if (targetOperation === 'query' || targetOperation === 'mutation') {
        const executor = (subschemaConfig === null || subschemaConfig === void 0 ? void 0 : subschemaConfig.executor) || createDefaultExecutor(targetSchema, (subschemaConfig === null || subschemaConfig === void 0 ? void 0 : subschemaConfig.rootValue) || targetRootValue);
        const executionResult = executor({
            document: processedRequest.document,
            variables: processedRequest.variables,
            context,
            info,
        });
        if (executionResult instanceof Promise) {
            return executionResult.then((originalResult) => applyResultTransforms(originalResult, delegationTransforms));
        }
        return applyResultTransforms(executionResult, delegationTransforms);
    }
    const subscriber = (subschemaConfig === null || subschemaConfig === void 0 ? void 0 : subschemaConfig.subscriber) || createDefaultSubscriber(targetSchema, (subschemaConfig === null || subschemaConfig === void 0 ? void 0 : subschemaConfig.rootValue) || targetRootValue);
    return subscriber({
        document: processedRequest.document,
        variables: processedRequest.variables,
        context,
        info,
    }).then((subscriptionResult) => {
        if (Symbol.asyncIterator in subscriptionResult) {
            // "subscribe" to the subscription result and map the result through the transforms
            return mapAsyncIterator(subscriptionResult, result => {
                const transformedResult = applyResultTransforms(result, delegationTransforms);
                // wrap with fieldName to return for an additional round of resolutioon
                // with payload as rootValue
                return {
                    [targetFieldName]: transformedResult,
                };
            });
        }
        return applyResultTransforms(subscriptionResult, delegationTransforms);
    });
}
function createDefaultExecutor(schema, rootValue) {
    return ({ document, context, variables, info }) => execute({
        schema,
        document,
        contextValue: context,
        variableValues: variables,
        rootValue: rootValue !== null && rootValue !== void 0 ? rootValue : info === null || info === void 0 ? void 0 : info.rootValue,
    });
}
function createDefaultSubscriber(schema, rootValue) {
    return ({ document, context, variables, info }) => subscribe({
        schema,
        document,
        contextValue: context,
        variableValues: variables,
        rootValue: rootValue !== null && rootValue !== void 0 ? rootValue : info === null || info === void 0 ? void 0 : info.rootValue,
    });
}

/**
 * Resolver that knows how to:
 * a) handle aliases for proxied schemas
 * b) handle errors from proxied schemas
 * c) handle external to internal enum coversion
 */
function defaultMergedResolver(parent, args, context, info) {
    if (!parent) {
        return null;
    }
    const responseKey = getResponseKeyFromInfo(info);
    const errors = getErrors(parent, responseKey);
    // check to see if parent is not a proxied result, i.e. if parent resolver was manually overwritten
    // See https://github.com/apollographql/graphql-tools/issues/967
    if (!errors) {
        return defaultFieldResolver(parent, args, context, info);
    }
    const result = parent[responseKey];
    const subschema = getSubschema(parent, responseKey);
    return handleResult(result, errors, subschema, context, info);
}

function createMergedResolver({ fromPath, dehoist, delimeter = '__gqltf__', }) {
    const parentErrorResolver = (parent, args, context, info) => parent instanceof Error ? parent : defaultMergedResolver(parent, args, context, info);
    const unwrappingResolver = fromPath != null
        ? (parent, args, context, info) => parentErrorResolver(unwrapResult(parent, fromPath), args, context, info)
        : parentErrorResolver;
    const dehoistingResolver = dehoist
        ? (parent, args, context, info) => unwrappingResolver(dehoistResult(parent, delimeter), args, context, info)
        : unwrappingResolver;
    const noParentResolver = (parent, args, context, info) => parent ? dehoistingResolver(parent, args, context, info) : {};
    return noParentResolver;
}

class ReplaceFieldWithFragment {
    constructor(targetSchema, fragments) {
        this.targetSchema = targetSchema;
        this.mapping = {};
        for (const { field, fragment } of fragments) {
            const parsedFragment = parseFragmentToInlineFragment(fragment);
            const actualTypeName = parsedFragment.typeCondition.name.value;
            if (!(actualTypeName in this.mapping)) {
                this.mapping[actualTypeName] = Object.create(null);
            }
            const typeMapping = this.mapping[actualTypeName];
            if (!(field in typeMapping)) {
                typeMapping[field] = [parsedFragment];
            }
            else {
                typeMapping[field].push(parsedFragment);
            }
        }
    }
    transformRequest(originalRequest) {
        const document = replaceFieldsWithFragments(this.targetSchema, originalRequest.document, this.mapping);
        return {
            ...originalRequest,
            document,
        };
    }
}
function replaceFieldsWithFragments(targetSchema, document, mapping) {
    const typeInfo = new TypeInfo(targetSchema);
    return visit(document, visitWithTypeInfo(typeInfo, {
        [Kind.SELECTION_SET](node) {
            const parentType = typeInfo.getParentType();
            if (parentType != null) {
                const parentTypeName = parentType.name;
                let selections = node.selections;
                if (parentTypeName in mapping) {
                    node.selections.forEach(selection => {
                        if (selection.kind === Kind.FIELD) {
                            const name = selection.name.value;
                            const fragments = mapping[parentTypeName][name];
                            if (fragments != null && fragments.length > 0) {
                                const fragment = concatInlineFragments(parentTypeName, fragments);
                                selections = selections.concat(fragment);
                            }
                        }
                    });
                }
                if (selections !== node.selections) {
                    return {
                        ...node,
                        selections,
                    };
                }
            }
        },
    }));
}
function parseFragmentToInlineFragment(definitions) {
    if (definitions.trim().startsWith('fragment')) {
        const document = parse(definitions);
        for (const definition of document.definitions) {
            if (definition.kind === Kind.FRAGMENT_DEFINITION) {
                return {
                    kind: Kind.INLINE_FRAGMENT,
                    typeCondition: definition.typeCondition,
                    selectionSet: definition.selectionSet,
                };
            }
        }
    }
    const query = parse(`{${definitions}}`).definitions[0];
    for (const selection of query.selectionSet.selections) {
        if (selection.kind === Kind.INLINE_FRAGMENT) {
            return selection;
        }
    }
    throw new Error('Could not parse fragment');
}

export { AddArgumentsAsVariables, AddFragmentsByField, AddSelectionSetsByType as AddMergedTypeSelectionSets, AddSelectionSetsByField, AddTypenameToAbstract, CheckResultAndHandleErrors, ExpandAbstractTypes, FilterToSchema, ReplaceFieldWithFragment, checkResultAndHandleErrors, createMergedResolver, createRequest, createRequestFromInfo, defaultMergedResolver, delegateRequest, delegateToSchema, getSubschema, handleResult, isSubschemaConfig };
//# sourceMappingURL=index.esm.js.map