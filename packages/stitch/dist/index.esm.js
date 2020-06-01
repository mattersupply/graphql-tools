import { Kind, GraphQLDirective, valueFromASTUntyped, GraphQLInputObjectType, GraphQLScalarType, GraphQLUnionType, GraphQLEnumType, GraphQLInterfaceType, GraphQLObjectType, DirectiveLocation, TokenKind, getDirectiveValues, GraphQLDeprecatedDirective, isSchema, isNamedType, getNamedType, isScalarType, isObjectType, isInterfaceType, isUnionType, isEnumType, GraphQLSchema, specifiedDirectives, extendSchema } from 'graphql';
import { createStub, createNamedStub, parseSelectionSet, typeContainsSelectionSet, parseFragmentToInlineFragment, concatInlineFragments, rewireTypes, cloneDirective, mergeDeep, SchemaDirectiveVisitor } from '@graphql-tools/utils';
import { buildDocumentFromTypeDefinitions, extendResolversFromInterfaces, addResolversToSchema, assertResolversPresent, addCatchUndefinedToSchema, addErrorLoggingToSchema, addSchemaLevelResolver, attachDirectiveResolvers } from '@graphql-tools/schema';
import { wrapSchema } from '@graphql-tools/wrap';
import { isSubschemaConfig, delegateToSchema } from '@graphql-tools/delegate';

function extractTypeDefinitions(ast) {
    const typeDefs = ast.definitions.filter((def) => def.kind === Kind.OBJECT_TYPE_DEFINITION ||
        def.kind === Kind.INTERFACE_TYPE_DEFINITION ||
        def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
        def.kind === Kind.UNION_TYPE_DEFINITION ||
        def.kind === Kind.ENUM_TYPE_DEFINITION ||
        def.kind === Kind.SCALAR_TYPE_DEFINITION);
    return {
        ...ast,
        definitions: typeDefs,
    };
}
function extractDirectiveDefinitions(ast) {
    const directiveDefs = ast.definitions.filter((def) => def.kind === Kind.DIRECTIVE_DEFINITION);
    return {
        ...ast,
        definitions: directiveDefs,
    };
}
function extractSchemaDefinition(ast) {
    const schemaDefs = ast.definitions.filter((def) => def.kind === Kind.SCHEMA_DEFINITION);
    return schemaDefs.length ? schemaDefs[schemaDefs.length - 1] : null;
}
function extractSchemaExtensions(ast) {
    const schemaExtensions = ast.definitions.filter((def) => def.kind === Kind.SCHEMA_EXTENSION);
    return schemaExtensions;
}
function extractTypeExtensionDefinitions(ast) {
    const extensionDefs = ast.definitions.filter((def) => def.kind === Kind.OBJECT_TYPE_EXTENSION ||
        def.kind === Kind.INTERFACE_TYPE_EXTENSION ||
        def.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION ||
        def.kind === Kind.UNION_TYPE_EXTENSION ||
        def.kind === Kind.ENUM_TYPE_EXTENSION ||
        def.kind === Kind.SCALAR_TYPE_EXTENSION);
    return {
        ...ast,
        definitions: extensionDefs,
    };
}

const backcompatOptions = { commentDescriptions: true };
function typeFromAST(node) {
    switch (node.kind) {
        case Kind.OBJECT_TYPE_DEFINITION:
            return makeObjectType(node);
        case Kind.INTERFACE_TYPE_DEFINITION:
            return makeInterfaceType(node);
        case Kind.ENUM_TYPE_DEFINITION:
            return makeEnumType(node);
        case Kind.UNION_TYPE_DEFINITION:
            return makeUnionType(node);
        case Kind.SCALAR_TYPE_DEFINITION:
            return makeScalarType(node);
        case Kind.INPUT_OBJECT_TYPE_DEFINITION:
            return makeInputObjectType(node);
        case Kind.DIRECTIVE_DEFINITION:
            return makeDirective(node);
        default:
            return null;
    }
}
function makeObjectType(node) {
    const config = {
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        interfaces: () => node.interfaces.map(iface => createNamedStub(iface.name.value, 'interface')),
        fields: () => makeFields(node.fields),
        astNode: node,
    };
    return new GraphQLObjectType(config);
}
function makeInterfaceType(node) {
    var _a;
    const config = {
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        interfaces: (_a = node.interfaces) === null || _a === void 0 ? void 0 : _a.map(iface => createNamedStub(iface.name.value, 'interface')),
        fields: () => makeFields(node.fields),
        astNode: node,
    };
    return new GraphQLInterfaceType(config);
}
function makeEnumType(node) {
    const values = node.values.reduce((prev, value) => ({
        ...prev,
        [value.name.value]: {
            description: getDescription(value, backcompatOptions),
            deprecationReason: getDeprecationReason(value),
            astNode: value,
        },
    }), {});
    return new GraphQLEnumType({
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        values,
        astNode: node,
    });
}
function makeUnionType(node) {
    return new GraphQLUnionType({
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        types: () => node.types.map(type => createNamedStub(type.name.value, 'object')),
        astNode: node,
    });
}
function makeScalarType(node) {
    return new GraphQLScalarType({
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        astNode: node,
        // TODO: serialize default property setting can be dropped once
        // upstream graphql-js TypeScript typings are updated, likely in v16
        serialize: value => value,
    });
}
function makeInputObjectType(node) {
    return new GraphQLInputObjectType({
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        fields: () => makeValues(node.fields),
        astNode: node,
    });
}
function makeFields(nodes) {
    return nodes.reduce((prev, node) => ({
        ...prev,
        [node.name.value]: {
            type: createStub(node.type, 'output'),
            description: getDescription(node, backcompatOptions),
            args: makeValues(node.arguments),
            deprecationReason: getDeprecationReason(node),
            astNode: node,
        },
    }), {});
}
function makeValues(nodes) {
    return nodes.reduce((prev, node) => ({
        ...prev,
        [node.name.value]: {
            type: createStub(node.type, 'input'),
            defaultValue: node.defaultValue !== undefined ? valueFromASTUntyped(node.defaultValue) : undefined,
            description: getDescription(node, backcompatOptions),
            astNode: node,
        },
    }), {});
}
function makeDirective(node) {
    const locations = [];
    node.locations.forEach(location => {
        if (location.value in DirectiveLocation) {
            locations.push(location.value);
        }
    });
    return new GraphQLDirective({
        name: node.name.value,
        description: node.description != null ? node.description.value : null,
        locations,
        isRepeatable: node.repeatable,
        args: makeValues(node.arguments),
        astNode: node,
    });
}
// graphql < v13 does not export getDescription
function getDescription(node, options) {
    if (node.description != null) {
        return node.description.value;
    }
    if (options.commentDescriptions) {
        const rawValue = getLeadingCommentBlock(node);
        if (rawValue !== undefined) {
            return dedentBlockStringValue(`\n${rawValue}`);
        }
    }
}
function getLeadingCommentBlock(node) {
    const loc = node.loc;
    if (!loc) {
        return;
    }
    const comments = [];
    let token = loc.startToken.prev;
    while (token != null &&
        token.kind === TokenKind.COMMENT &&
        token.next != null &&
        token.prev != null &&
        token.line + 1 === token.next.line &&
        token.line !== token.prev.line) {
        const value = String(token.value);
        comments.push(value);
        token = token.prev;
    }
    return comments.length > 0 ? comments.reverse().join('\n') : undefined;
}
function dedentBlockStringValue(rawString) {
    // Expand a block string's raw value into independent lines.
    const lines = rawString.split(/\r\n|[\n\r]/g);
    // Remove common indentation from all lines but first.
    const commonIndent = getBlockStringIndentation(lines);
    if (commonIndent !== 0) {
        for (let i = 1; i < lines.length; i++) {
            lines[i] = lines[i].slice(commonIndent);
        }
    }
    // Remove leading and trailing blank lines.
    while (lines.length > 0 && isBlank(lines[0])) {
        lines.shift();
    }
    while (lines.length > 0 && isBlank(lines[lines.length - 1])) {
        lines.pop();
    }
    // Return a string of the lines joined with U+000A.
    return lines.join('\n');
}
/**
 * @internal
 */
function getBlockStringIndentation(lines) {
    let commonIndent = null;
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const indent = leadingWhitespace(line);
        if (indent === line.length) {
            continue; // skip empty lines
        }
        if (commonIndent === null || indent < commonIndent) {
            commonIndent = indent;
            if (commonIndent === 0) {
                break;
            }
        }
    }
    return commonIndent === null ? 0 : commonIndent;
}
function leadingWhitespace(str) {
    let i = 0;
    while (i < str.length && (str[i] === ' ' || str[i] === '\t')) {
        i++;
    }
    return i;
}
function isBlank(str) {
    return leadingWhitespace(str) === str.length;
}
function getDeprecationReason(node) {
    const deprecated = getDirectiveValues(GraphQLDeprecatedDirective, node);
    return deprecated === null || deprecated === void 0 ? void 0 : deprecated.reason;
}

function isDocumentNode(schemaLikeObject) {
    return schemaLikeObject.kind !== undefined;
}
function buildTypeCandidates({ schemaLikeObjects, transformedSchemas, typeCandidates, extensions, directives, schemaDefs, operationTypeNames, mergeDirectives, }) {
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
function buildTypeMap({ typeCandidates, mergeTypes, stitchingInfo, onTypeConflict, operationTypeNames, }) {
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

function createStitchingInfo(transformedSchemas, typeCandidates, mergeTypes) {
    const mergedTypes = createMergedTypes(typeCandidates, mergeTypes);
    const selectionSetsByType = Object.entries(mergedTypes).reduce((acc, [typeName, mergedTypeInfo]) => {
        if (mergedTypeInfo.requiredSelections != null) {
            acc[typeName] = {
                kind: Kind.SELECTION_SET,
                selections: mergedTypeInfo.requiredSelections,
            };
        }
        return acc;
    }, {});
    return {
        transformedSchemas,
        fragmentsByField: undefined,
        selectionSetsByField: undefined,
        selectionSetsByType,
        mergedTypes,
    };
}
function createMergedTypes(typeCandidates, mergeTypes) {
    const mergedTypes = Object.create(null);
    Object.keys(typeCandidates).forEach(typeName => {
        if (isObjectType(typeCandidates[typeName][0].type)) {
            const mergedTypeCandidates = typeCandidates[typeName].filter(typeCandidate => typeCandidate.subschema != null &&
                isSubschemaConfig(typeCandidate.subschema) &&
                typeCandidate.subschema.merge != null &&
                typeName in typeCandidate.subschema.merge);
            if (mergeTypes === true ||
                (typeof mergeTypes === 'function' && mergeTypes(typeCandidates[typeName], typeName)) ||
                (Array.isArray(mergeTypes) && mergeTypes.includes(typeName)) ||
                mergedTypeCandidates.length) {
                const subschemas = [];
                let requiredSelections = [parseSelectionSet('{ __typename }').selections[0]];
                const fields = Object.create({});
                const typeMaps = new Map();
                const selectionSets = new Map();
                mergedTypeCandidates.forEach(typeCandidate => {
                    const subschemaConfig = typeCandidate.subschema;
                    const transformedSubschema = typeCandidate.transformedSubschema;
                    typeMaps.set(subschemaConfig, transformedSubschema.getTypeMap());
                    const type = transformedSubschema.getType(typeName);
                    const fieldMap = type.getFields();
                    Object.keys(fieldMap).forEach(fieldName => {
                        if (!(fieldName in fields)) {
                            fields[fieldName] = [];
                        }
                        fields[fieldName].push(subschemaConfig);
                    });
                    const mergedTypeConfig = subschemaConfig.merge[typeName];
                    if (mergedTypeConfig.selectionSet) {
                        const selectionSet = parseSelectionSet(mergedTypeConfig.selectionSet);
                        requiredSelections = requiredSelections.concat(selectionSet.selections);
                        selectionSets.set(subschemaConfig, selectionSet);
                    }
                    if (!mergedTypeConfig.resolve) {
                        mergedTypeConfig.resolve = (originalResult, context, info, subschema, selectionSet) => delegateToSchema({
                            schema: subschema,
                            operation: 'query',
                            fieldName: mergedTypeConfig.fieldName,
                            args: mergedTypeConfig.args(originalResult),
                            selectionSet,
                            context,
                            info,
                            skipTypeMerging: true,
                        });
                    }
                    subschemas.push(subschemaConfig);
                });
                mergedTypes[typeName] = {
                    subschemas,
                    typeMaps,
                    requiredSelections,
                    selectionSets,
                    containsSelectionSet: new Map(),
                    uniqueFields: Object.create({}),
                    nonUniqueFields: Object.create({}),
                };
                subschemas.forEach(subschema => {
                    const type = typeMaps.get(subschema)[typeName];
                    const subschemaMap = new Map();
                    subschemas
                        .filter(s => s !== subschema)
                        .forEach(s => {
                        const selectionSet = selectionSets.get(s);
                        if (selectionSet != null && typeContainsSelectionSet(type, selectionSet)) {
                            subschemaMap.set(selectionSet, true);
                        }
                    });
                    mergedTypes[typeName].containsSelectionSet.set(subschema, subschemaMap);
                });
                Object.keys(fields).forEach(fieldName => {
                    const supportedBySubschemas = fields[fieldName];
                    if (supportedBySubschemas.length === 1) {
                        mergedTypes[typeName].uniqueFields[fieldName] = supportedBySubschemas[0];
                    }
                    else {
                        mergedTypes[typeName].nonUniqueFields[fieldName] = supportedBySubschemas;
                    }
                });
            }
        }
    });
    return mergedTypes;
}
function completeStitchingInfo(stitchingInfo, resolvers) {
    const selectionSetsByField = Object.create(null);
    const rawFragments = [];
    Object.keys(resolvers).forEach(typeName => {
        const type = resolvers[typeName];
        if (isScalarType(type)) {
            return;
        }
        Object.keys(type).forEach(fieldName => {
            const field = type[fieldName];
            if (field.selectionSet) {
                const selectionSet = parseSelectionSet(field.selectionSet);
                if (!(typeName in selectionSetsByField)) {
                    selectionSetsByField[typeName] = Object.create(null);
                }
                if (!(fieldName in selectionSetsByField[typeName])) {
                    selectionSetsByField[typeName][fieldName] = {
                        kind: Kind.SELECTION_SET,
                        selections: [],
                    };
                }
                selectionSetsByField[typeName][fieldName].selections = selectionSetsByField[typeName][fieldName].selections.concat(selectionSet.selections);
            }
            if (field.fragment) {
                rawFragments.push({
                    field: fieldName,
                    fragment: field.fragment,
                });
            }
        });
    });
    const parsedFragments = Object.create(null);
    rawFragments.forEach(({ field, fragment }) => {
        const parsedFragment = parseFragmentToInlineFragment(fragment);
        const actualTypeName = parsedFragment.typeCondition.name.value;
        if (!(actualTypeName in parsedFragments)) {
            parsedFragments[actualTypeName] = Object.create(null);
        }
        if (!(field in parsedFragments[actualTypeName])) {
            parsedFragments[actualTypeName][field] = [];
        }
        parsedFragments[actualTypeName][field].push(parsedFragment);
    });
    const fragmentsByField = Object.create(null);
    Object.keys(parsedFragments).forEach(typeName => {
        Object.keys(parsedFragments[typeName]).forEach(field => {
            if (!(typeName in fragmentsByField)) {
                fragmentsByField[typeName] = Object.create(null);
            }
            fragmentsByField[typeName][field] = concatInlineFragments(typeName, parsedFragments[typeName][field]);
        });
    });
    stitchingInfo.selectionSetsByField = selectionSetsByField;
    stitchingInfo.fragmentsByField = fragmentsByField;
    return stitchingInfo;
}
function addStitchingInfo(stitchedSchema, stitchingInfo) {
    return new GraphQLSchema({
        ...stitchedSchema.toConfig(),
        extensions: {
            ...stitchedSchema.extensions,
            stitchingInfo,
        },
    });
}

function stitchSchemas({ subschemas = [], types = [], typeDefs, schemas = [], onTypeConflict, resolvers = {}, schemaDirectives, inheritResolversFromInterfaces = false, mergeTypes = false, mergeDirectives, logger, allowUndefinedInResolve = true, resolverValidationOptions = {}, directiveResolvers, schemaTransforms = [], parseOptions = {}, }) {
    if (typeof resolverValidationOptions !== 'object') {
        throw new Error('Expected `resolverValidationOptions` to be an object');
    }
    let schemaLikeObjects = [...subschemas];
    if (typeDefs) {
        schemaLikeObjects.push(buildDocumentFromTypeDefinitions(typeDefs, parseOptions));
    }
    if (types != null) {
        schemaLikeObjects = schemaLikeObjects.concat(types);
    }
    schemas.forEach(schemaLikeObject => {
        if (isSchema(schemaLikeObject) || isSubschemaConfig(schemaLikeObject)) {
            schemaLikeObjects.push(schemaLikeObject);
        }
        else if (typeof schemaLikeObject === 'string' || isDocumentNode$1(schemaLikeObject)) {
            schemaLikeObjects.push(buildDocumentFromTypeDefinitions(schemaLikeObject, parseOptions));
        }
        else if (Array.isArray(schemaLikeObject)) {
            schemaLikeObjects = schemaLikeObjects.concat(schemaLikeObject);
        }
        else {
            throw new Error('Invalid schema passed');
        }
    });
    const transformedSchemas = new Map();
    const typeCandidates = Object.create(null);
    const extensions = [];
    const directives = [];
    const schemaDefs = Object.create(null);
    const operationTypeNames = {
        query: 'Query',
        mutation: 'Mutation',
        subscription: 'Subscription',
    };
    buildTypeCandidates({
        schemaLikeObjects,
        transformedSchemas,
        typeCandidates,
        extensions,
        directives,
        schemaDefs,
        operationTypeNames,
        mergeDirectives,
    });
    let stitchingInfo;
    stitchingInfo = createStitchingInfo(transformedSchemas, typeCandidates, mergeTypes);
    const typeMap = buildTypeMap({
        typeCandidates,
        mergeTypes,
        stitchingInfo,
        onTypeConflict,
        operationTypeNames,
    });
    const { typeMap: newTypeMap, directives: newDirectives } = rewireTypes(typeMap, directives, { skipPruning: true });
    let schema = new GraphQLSchema({
        query: newTypeMap[operationTypeNames.query],
        mutation: newTypeMap[operationTypeNames.mutation],
        subscription: newTypeMap[operationTypeNames.subscription],
        types: Object.keys(newTypeMap).map(key => newTypeMap[key]),
        directives: newDirectives.length
            ? specifiedDirectives.slice().concat(newDirectives.map(directive => cloneDirective(directive)))
            : undefined,
        astNode: schemaDefs.schemaDef,
        extensionASTNodes: schemaDefs.schemaExtensions,
        extensions: null,
    });
    extensions.forEach(extension => {
        schema = extendSchema(schema, extension, {
            commentDescriptions: true,
        });
    });
    // We allow passing in an array of resolver maps, in which case we merge them
    const resolverMap = Array.isArray(resolvers) ? resolvers.reduce(mergeDeep, {}) : resolvers;
    const finalResolvers = inheritResolversFromInterfaces
        ? extendResolversFromInterfaces(schema, resolverMap)
        : resolverMap;
    stitchingInfo = completeStitchingInfo(stitchingInfo, finalResolvers);
    schema = addResolversToSchema({
        schema,
        resolvers: finalResolvers,
        resolverValidationOptions,
        inheritResolversFromInterfaces: false,
    });
    assertResolversPresent(schema, resolverValidationOptions);
    schema = addStitchingInfo(schema, stitchingInfo);
    if (!allowUndefinedInResolve) {
        schema = addCatchUndefinedToSchema(schema);
    }
    if (logger != null) {
        schema = addErrorLoggingToSchema(schema, logger);
    }
    if (typeof finalResolvers['__schema'] === 'function') {
        // TODO a bit of a hack now, better rewrite generateSchema to attach it there.
        // not doing that now, because I'd have to rewrite a lot of tests.
        schema = addSchemaLevelResolver(schema, finalResolvers['__schema']);
    }
    schemaTransforms.forEach(schemaTransform => {
        schema = schemaTransform(schema);
    });
    if (directiveResolvers != null) {
        schema = attachDirectiveResolvers(schema, directiveResolvers);
    }
    if (schemaDirectives != null) {
        SchemaDirectiveVisitor.visitSchemaDirectives(schema, schemaDirectives);
    }
    return schema;
}
function isDocumentNode$1(object) {
    return object.kind !== undefined;
}

export { stitchSchemas };
//# sourceMappingURL=index.esm.js.map
