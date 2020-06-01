import { buildASTSchema, buildSchema } from 'graphql';
import { addResolversToSchema, addErrorLoggingToSchema } from '@graphql-tools/schema';
import { mergeTypeDefs } from './typedefs-mergers/merge-typedefs';
import { mergeResolvers } from './merge-resolvers';
import { SchemaDirectiveVisitor, asArray, getResolversFromSchema, } from '@graphql-tools/utils';
import { mergeExtensions, extractExtensionsFromSchema, applyExtensions } from './extensions';
const defaultResolverValidationOptions = {
    requireResolversForArgs: false,
    requireResolversForNonScalar: false,
    requireResolversForAllFields: false,
    requireResolversForResolveType: false,
    allowResolversNotInSchema: true,
};
export function mergeSchemas(config) {
    const typeDefs = mergeTypes(config);
    const extractedResolvers = [];
    const extractedExtensions = [];
    for (const schema of config.schemas) {
        extractedResolvers.push(getResolversFromSchema(schema));
        extractedExtensions.push(extractExtensionsFromSchema(schema));
    }
    extractedResolvers.push(...ensureResolvers(config));
    const resolvers = mergeResolvers(extractedResolvers, config);
    const extensions = mergeExtensions(extractedExtensions);
    return makeSchema({ resolvers, typeDefs, extensions }, config);
}
export async function mergeSchemasAsync(config) {
    const [typeDefs, resolvers, extensions] = await Promise.all([
        mergeTypes(config),
        Promise.all(config.schemas.map(async (schema) => getResolversFromSchema(schema))).then(extractedResolvers => mergeResolvers([...extractedResolvers, ...ensureResolvers(config)], config)),
        Promise.all(config.schemas.map(async (schema) => extractExtensionsFromSchema(schema))).then(extractedExtensions => mergeExtensions(extractedExtensions)),
    ]);
    return makeSchema({ resolvers, typeDefs, extensions }, config);
}
function mergeTypes({ schemas, typeDefs, ...config }) {
    return mergeTypeDefs([...schemas, ...(typeDefs ? asArray(typeDefs) : [])], config);
}
function ensureResolvers(config) {
    return config.resolvers ? asArray(config.resolvers) : [];
}
function makeSchema({ resolvers, typeDefs, extensions, }, config) {
    let schema = typeof typeDefs === 'string' ? buildSchema(typeDefs, config) : buildASTSchema(typeDefs, config);
    // add resolvers
    if (resolvers) {
        schema = addResolversToSchema({
            schema,
            resolvers,
            resolverValidationOptions: {
                ...defaultResolverValidationOptions,
                ...(config.resolverValidationOptions || {}),
            },
        });
    }
    // use logger
    if (config.logger) {
        schema = addErrorLoggingToSchema(schema, config.logger);
    }
    // use schema directives
    if (config.schemaDirectives) {
        SchemaDirectiveVisitor.visitSchemaDirectives(schema, config.schemaDirectives);
    }
    // extensions
    applyExtensions(schema, extensions);
    return schema;
}
//# sourceMappingURL=merge-schemas.js.map