import { getResponseKeyFromInfo, getErrors, applySchemaTransforms } from '@graphql-tools/utils';
import { delegateToSchema, getSubschema, handleResult, isSubschemaConfig, } from '@graphql-tools/delegate';
export function generateProxyingResolvers(subschemaOrSubschemaConfig, transforms) {
    var _a;
    let targetSchema;
    let schemaTransforms = [];
    let createProxyingResolver;
    if (isSubschemaConfig(subschemaOrSubschemaConfig)) {
        targetSchema = subschemaOrSubschemaConfig.schema;
        createProxyingResolver = (_a = subschemaOrSubschemaConfig.createProxyingResolver) !== null && _a !== void 0 ? _a : defaultCreateProxyingResolver;
        if (subschemaOrSubschemaConfig.transforms != null) {
            schemaTransforms = schemaTransforms.concat(subschemaOrSubschemaConfig.transforms);
        }
    }
    else {
        targetSchema = subschemaOrSubschemaConfig;
        createProxyingResolver = defaultCreateProxyingResolver;
    }
    if (transforms != null) {
        schemaTransforms = schemaTransforms.concat(transforms);
    }
    const transformedSchema = applySchemaTransforms(targetSchema, schemaTransforms);
    const operationTypes = {
        query: targetSchema.getQueryType(),
        mutation: targetSchema.getMutationType(),
        subscription: targetSchema.getSubscriptionType(),
    };
    const resolvers = {};
    Object.keys(operationTypes).forEach((operation) => {
        const rootType = operationTypes[operation];
        if (rootType != null) {
            const typeName = rootType.name;
            const fields = rootType.getFields();
            resolvers[typeName] = {};
            Object.keys(fields).forEach(fieldName => {
                const proxyingResolver = createProxyingResolver({
                    schema: subschemaOrSubschemaConfig,
                    transforms,
                    transformedSchema,
                    operation,
                    fieldName,
                });
                const finalResolver = createPossiblyNestedProxyingResolver(subschemaOrSubschemaConfig, proxyingResolver);
                if (operation === 'subscription') {
                    resolvers[typeName][fieldName] = {
                        subscribe: finalResolver,
                        resolve: (payload, _, __, { fieldName: targetFieldName }) => payload[targetFieldName],
                    };
                }
                else {
                    resolvers[typeName][fieldName] = {
                        resolve: finalResolver,
                    };
                }
            });
        }
    });
    return resolvers;
}
function createPossiblyNestedProxyingResolver(subschemaOrSubschemaConfig, proxyingResolver) {
    return (parent, args, context, info) => {
        if (parent != null) {
            const responseKey = getResponseKeyFromInfo(info);
            const errors = getErrors(parent, responseKey);
            // Check to see if the parent contains a proxied result
            if (errors != null) {
                const subschema = getSubschema(parent, responseKey);
                // If there is a proxied result from this subschema, return it
                // This can happen even for a root field when the root type ia
                // also nested as a field within a different type.
                if (subschemaOrSubschemaConfig === subschema && parent[responseKey] !== undefined) {
                    return handleResult(parent[responseKey], errors, subschema, context, info);
                }
            }
        }
        return proxyingResolver(parent, args, context, info);
    };
}
export function defaultCreateProxyingResolver({ schema, transforms, transformedSchema, }) {
    return (_parent, _args, context, info) => delegateToSchema({
        schema,
        context,
        info,
        transforms,
        transformedSchema,
    });
}
//# sourceMappingURL=generateProxyingResolvers.js.map