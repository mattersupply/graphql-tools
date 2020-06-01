import { loadTypedefs, loadTypedefsSync } from './load-typedefs';
import { Source as GraphQLSource, print } from 'graphql';
import { OPERATION_KINDS } from './documents';
import { mergeSchemasAsync, mergeSchemas } from '@graphql-tools/merge';
export async function loadSchema(schemaPointers, options) {
    const sources = await loadTypedefs(schemaPointers, {
        filterKinds: OPERATION_KINDS,
        ...options,
    });
    const { schemas, typeDefs } = collectSchemasAndTypeDefs(sources);
    const mergeSchemasOptions = {
        schemas,
        typeDefs,
        ...options,
    };
    const schema = await mergeSchemasAsync(mergeSchemasOptions);
    if (options.includeSources) {
        includeSources(schema, sources);
    }
    return schema;
}
export function loadSchemaSync(schemaPointers, options) {
    const sources = loadTypedefsSync(schemaPointers, {
        filterKinds: OPERATION_KINDS,
        ...options,
    });
    const { schemas, typeDefs } = collectSchemasAndTypeDefs(sources);
    const mergeSchemasOptions = {
        schemas,
        typeDefs,
        ...options,
    };
    const schema = mergeSchemas(mergeSchemasOptions);
    if (options.includeSources) {
        includeSources(schema, sources);
    }
    return schema;
}
function includeSources(schema, sources) {
    schema.extensions = {
        ...schema.extensions,
        sources: sources
            .filter(source => source.rawSDL || source.document)
            .map(source => new GraphQLSource(source.rawSDL || print(source.document), source.location)),
    };
}
function collectSchemasAndTypeDefs(sources) {
    const schemas = [];
    const typeDefs = [];
    sources.forEach(source => {
        if (source.schema) {
            schemas.push(source.schema);
        }
        else {
            typeDefs.push(source.document);
        }
    });
    return {
        schemas,
        typeDefs,
    };
}
//# sourceMappingURL=schema.js.map