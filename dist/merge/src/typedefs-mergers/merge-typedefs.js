import { parse, Kind, isSchema } from 'graphql';
import { isSourceTypes, isStringTypes, isSchemaDefinition } from './utils';
import { mergeGraphQLNodes } from './merge-nodes';
import { resetComments, printWithComments } from './comments';
import { createSchemaDefinition, printSchemaWithDirectives } from '@graphql-tools/utils';
export function mergeGraphQLSchemas(types, config) {
    // tslint:disable-next-line: no-console
    console.info(`
    GraphQL tools/Epoxy
    Deprecation Notice;
    'mergeGraphQLSchemas' is deprecated and will be removed in the next version.
    Please use 'mergeTypeDefs' instead!
  `);
    return mergeGraphQLTypes(types, config);
}
export function mergeTypeDefs(types, config) {
    resetComments();
    const doc = {
        kind: Kind.DOCUMENT,
        definitions: mergeGraphQLTypes(types, {
            useSchemaDefinition: true,
            forceSchemaDefinition: false,
            throwOnConflict: false,
            commentDescriptions: false,
            ...config,
        }),
    };
    let result;
    if (config && config.commentDescriptions) {
        result = printWithComments(doc);
    }
    else {
        result = doc;
    }
    resetComments();
    return result;
}
export function mergeGraphQLTypes(types, config) {
    resetComments();
    const allNodes = types
        .map(type => {
        if (isSchema(type)) {
            return parse(printSchemaWithDirectives(type));
        }
        else if (isStringTypes(type) || isSourceTypes(type)) {
            return parse(type);
        }
        return type;
    })
        .map(ast => ast.definitions)
        .reduce((defs, newDef = []) => [...defs, ...newDef], []);
    // XXX: right now we don't handle multiple schema definitions
    let schemaDef = allNodes.filter(isSchemaDefinition).reduce((def, node) => {
        node.operationTypes
            .filter(op => op.type.name.value)
            .forEach(op => {
            def[op.operation] = op.type.name.value;
        });
        return def;
    }, {
        query: null,
        mutation: null,
        subscription: null,
    });
    const mergedNodes = mergeGraphQLNodes(allNodes, config);
    const allTypes = Object.keys(mergedNodes);
    if (config && config.sort) {
        allTypes.sort(typeof config.sort === 'function' ? config.sort : undefined);
    }
    if (config && config.useSchemaDefinition) {
        const queryType = schemaDef.query ? schemaDef.query : allTypes.find(t => t === 'Query');
        const mutationType = schemaDef.mutation ? schemaDef.mutation : allTypes.find(t => t === 'Mutation');
        const subscriptionType = schemaDef.subscription ? schemaDef.subscription : allTypes.find(t => t === 'Subscription');
        schemaDef = {
            query: queryType,
            mutation: mutationType,
            subscription: subscriptionType,
        };
    }
    const schemaDefinition = createSchemaDefinition(schemaDef, {
        force: config.forceSchemaDefinition,
    });
    if (!schemaDefinition) {
        return Object.values(mergedNodes);
    }
    return [...Object.values(mergedNodes), parse(schemaDefinition).definitions[0]];
}
//# sourceMappingURL=merge-typedefs.js.map