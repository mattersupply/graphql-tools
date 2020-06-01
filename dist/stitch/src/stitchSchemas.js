import { GraphQLSchema, specifiedDirectives, extendSchema, isSchema, } from 'graphql';
import { SchemaDirectiveVisitor, cloneDirective, mergeDeep, rewireTypes } from '@graphql-tools/utils';
import { addResolversToSchema, addSchemaLevelResolver, addErrorLoggingToSchema, addCatchUndefinedToSchema, assertResolversPresent, attachDirectiveResolvers, buildDocumentFromTypeDefinitions, extendResolversFromInterfaces, } from '@graphql-tools/schema';
import { buildTypeCandidates, buildTypeMap } from './typeCandidates';
import { createStitchingInfo, completeStitchingInfo, addStitchingInfo } from './stitchingInfo';
import { isSubschemaConfig } from '@graphql-tools/delegate';
export function stitchSchemas({ subschemas = [], types = [], typeDefs, schemas = [], onTypeConflict, resolvers = {}, schemaDirectives, inheritResolversFromInterfaces = false, mergeTypes = false, mergeDirectives, logger, allowUndefinedInResolve = true, resolverValidationOptions = {}, directiveResolvers, schemaTransforms = [], parseOptions = {}, }) {
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
        else if (typeof schemaLikeObject === 'string' || isDocumentNode(schemaLikeObject)) {
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
export function isDocumentNode(object) {
    return object.kind !== undefined;
}
//# sourceMappingURL=stitchSchemas.js.map