import { buildSchema } from 'graphql';
import { delegateToSchema } from '@graphql-tools/delegate';
import { wrapSchema } from './wrapSchema';
export function makeRemoteExecutableSchema({ schema: schemaOrTypeDefs, executor, subscriber, createResolver = defaultCreateRemoteResolver, buildSchemaOptions, }) {
    const targetSchema = typeof schemaOrTypeDefs === 'string' ? buildSchema(schemaOrTypeDefs, buildSchemaOptions) : schemaOrTypeDefs;
    return wrapSchema({
        schema: targetSchema,
        createProxyingResolver: () => createResolver(executor, subscriber),
    });
}
export function defaultCreateRemoteResolver(executor, subscriber) {
    return (_parent, _args, context, info) => delegateToSchema({
        schema: { schema: info.schema, executor, subscriber },
        context,
        info,
    });
}
//# sourceMappingURL=makeRemoteExecutableSchema.js.map