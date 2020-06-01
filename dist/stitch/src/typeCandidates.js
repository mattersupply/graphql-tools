import { GraphQLObjectType, getNamedType, isNamedType, GraphQLInterfaceType, GraphQLUnionType, GraphQLEnumType, isSchema, isScalarType, isObjectType, isInterfaceType, isUnionType, isEnumType, } from 'graphql';
import { wrapSchema } from '@graphql-tools/wrap';
import { isSubschemaConfig } from '@graphql-tools/delegate';
import { extractTypeDefinitions, extractTypeExtensionDefinitions, extractDirectiveDefinitions, extractSchemaDefinition, extractSchemaExtensions, } from './definitions';
import typeFromAST from './typeFromAST';
function isDocumentNode(schemaLikeObject) {
    return schemaLikeObject.kind !== undefined;
}
export function buildTypeCandidates({ schemaLikeObjects, transformedSchemas, typeCandidates, extensions, directives, schemaDefs, operationTypeNames, mergeDirectives, }) {
    let schemaDef;
    let schemaExtensions = [];
    schemaLikeObjects.forEach(schemaLikeObject => {
        if (isDocumentNode(schemaLikeObject)) {
            schemaDef = extractSchemaDefinition(schemaLikeObject);
            schemaExtensions = schemaExtensions.concat(extractSchemaExtensions(schemaLikeObject));
        }
    });
    schemaDefs.schemaDef = schemaDef;
    schemaDefs.schemaExtensions = schemaExtensions;
    setOperationTypeNames(schemaDefs, operationTypeNames);
    schemaLikeObjects.forEach(schemaLikeObject => {
        if (isSchema(schemaLikeObject) || isSubschemaConfig(schemaLikeObject)) {
            const schema = wrapSchema(schemaLikeObject);
            transformedSchemas.set(schemaLikeObject, schema);
            const operationTypes = {
                query: schema.getQueryType(),
                mutation: schema.getMutationType(),
                subscription: schema.getSubscriptionType(),
            };
            Object.keys(operationTypes).forEach(operationType => {
                if (operationTypes[operationType] != null) {
                    addTypeCandidate(typeCandidates, operationTypeNames[operationType], {
                        schema,
                        type: operationTypes[operationType],
                        subschema: schemaLikeObject,
                        transformedSubschema: schema,
                    });
                }
            });
            if (mergeDirectives) {
                schema.getDirectives().forEach(directive => {
                    directives.push(directive);
                });
            }
            const originalTypeMap = schema.getTypeMap();
            Object.keys(originalTypeMap).forEach(typeName => {
                const type = originalTypeMap[typeName];
                if (isNamedType(type) &&
                    getNamedType(type).name.slice(0, 2) !== '__' &&
                    type !== operationTypes.query &&
                    type !== operationTypes.mutation &&
                    type !== operationTypes.subscription) {
                    addTypeCandidate(typeCandidates, type.name, {
                        schema,
                        type,
                        subschema: schemaLikeObject,
                        transformedSubschema: schema,
                    });
                }
            });
        }
        else if (isDocumentNode(schemaLikeObject)) {
            const typesDocument = extractTypeDefinitions(schemaLikeObject);
            typesDocument.definitions.forEach(def => {
                const type = typeFromAST(def);
                if (type != null) {
                    addTypeCandidate(typeCandidates, type.name, {
                        type,
                    });
                }
            });
            const directivesDocument = extractDirectiveDefinitions(schemaLikeObject);
            directivesDocument.definitions.forEach(def => {
                directives.push(typeFromAST(def));
            });
            const extensionsDocument = extractTypeExtensionDefinitions(schemaLikeObject);
            if (extensionsDocument.definitions.length > 0) {
                extensions.push(extensionsDocument);
            }
        }
        else if (isNamedType(schemaLikeObject)) {
            addTypeCandidate(typeCandidates, schemaLikeObject.name, {
                type: schemaLikeObject,
            });
        }
        else {
            throw new Error(`Invalid object ${schemaLikeObject}`);
        }
    });
}
function setOperationTypeNames({ schemaDef, schemaExtensions, }, operationTypeNames) {
    const allNodes = schemaExtensions.slice();
    if (schemaDef != null) {
        allNodes.unshift(schemaDef);
    }
    allNodes.forEach(node => {
        if (node.operationTypes != null) {
            node.operationTypes.forEach(operationType => {
                operationTypeNames[operationType.operation] = operationType.type.name.value;
            });
        }
    });
}
function addTypeCandidate(typeCandidates, name, typeCandidate) {
    if (!(name in typeCandidates)) {
        typeCandidates[name] = [];
    }
    typeCandidates[name].push(typeCandidate);
}
export function buildTypeMap({ typeCandidates, mergeTypes, stitchingInfo, onTypeConflict, operationTypeNames, }) {
    const typeMap = Object.create(null);
    Object.keys(typeCandidates).forEach(typeName => {
        if (typeName === operationTypeNames.query ||
            typeName === operationTypeNames.mutation ||
            typeName === operationTypeNames.subscription ||
            (mergeTypes === true && !isScalarType(typeCandidates[typeName][0].type)) ||
            (typeof mergeTypes === 'function' && mergeTypes(typeCandidates[typeName], typeName)) ||
            (Array.isArray(mergeTypes) && mergeTypes.includes(typeName)) ||
            (stitchingInfo != null && typeName in stitchingInfo.mergedTypes)) {
            typeMap[typeName] = merge(typeName, typeCandidates[typeName]);
        }
        else {
            const candidateSelector = onTypeConflict != null
                ? onTypeConflictToCandidateSelector(onTypeConflict)
                : (cands) => cands[cands.length - 1];
            typeMap[typeName] = candidateSelector(typeCandidates[typeName]).type;
        }
    });
    return typeMap;
}
function onTypeConflictToCandidateSelector(onTypeConflict) {
    return cands => cands.reduce((prev, next) => {
        const type = onTypeConflict(prev.type, next.type, {
            left: {
                schema: prev.schema,
            },
            right: {
                schema: next.schema,
            },
        });
        if (prev.type === type) {
            return prev;
        }
        else if (next.type === type) {
            return next;
        }
        return {
            schemaName: 'unknown',
            type,
        };
    });
}
function merge(typeName, candidates) {
    const initialCandidateType = candidates[0].type;
    if (candidates.some(candidate => candidate.type.constructor !== initialCandidateType.constructor)) {
        throw new Error(`Cannot merge different type categories into common type ${typeName}.`);
    }
    if (isObjectType(initialCandidateType)) {
        const config = {
            name: typeName,
            fields: candidates.reduce((acc, candidate) => ({
                ...acc,
                ...candidate.type.toConfig().fields,
            }), {}),
            interfaces: candidates.reduce((acc, candidate) => {
                const interfaces = candidate.type.toConfig().interfaces;
                return interfaces != null ? acc.concat(interfaces) : acc;
            }, []),
            description: initialCandidateType.description,
            extensions: initialCandidateType.extensions,
            astNode: initialCandidateType.astNode,
            extensionASTNodes: initialCandidateType.extensionASTNodes,
        };
        return new GraphQLObjectType(config);
    }
    else if (isInterfaceType(initialCandidateType)) {
        const config = {
            name: typeName,
            fields: candidates.reduce((acc, candidate) => ({
                ...acc,
                ...candidate.type.toConfig().fields,
            }), {}),
            interfaces: candidates.reduce((acc, candidate) => {
                const candidateConfig = candidate.type.toConfig();
                if ('interfaces' in candidateConfig) {
                    return acc.concat(candidateConfig.interfaces);
                }
                return acc;
            }, []),
            description: initialCandidateType.description,
            extensions: initialCandidateType.extensions,
            astNode: initialCandidateType.astNode,
            extensionASTNodes: initialCandidateType.extensionASTNodes,
        };
        return new GraphQLInterfaceType(config);
    }
    else if (isUnionType(initialCandidateType)) {
        return new GraphQLUnionType({
            name: typeName,
            types: candidates.reduce((acc, candidate) => acc.concat(candidate.type.toConfig().types), []),
            description: initialCandidateType.description,
            extensions: initialCandidateType.extensions,
            astNode: initialCandidateType.astNode,
            extensionASTNodes: initialCandidateType.extensionASTNodes,
        });
    }
    else if (isEnumType(initialCandidateType)) {
        return new GraphQLEnumType({
            name: typeName,
            values: candidates.reduce((acc, candidate) => ({
                ...acc,
                ...candidate.type.toConfig().values,
            }), {}),
            description: initialCandidateType.description,
            extensions: initialCandidateType.extensions,
            astNode: initialCandidateType.astNode,
            extensionASTNodes: initialCandidateType.extensionASTNodes,
        });
    }
    else if (isScalarType(initialCandidateType)) {
        throw new Error(`Cannot merge type ${typeName}. Merging not supported for GraphQLScalarType.`);
    }
    else {
        // not reachable.
        throw new Error(`Type ${typeName} has unknown GraphQL type.`);
    }
}
//# sourceMappingURL=typeCandidates.js.map