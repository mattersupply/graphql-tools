import { extendSchema, parse } from 'graphql';
import { addResolversToSchema } from '@graphql-tools/schema';
import { defaultMergedResolver } from '@graphql-tools/delegate';
import MapFields from './MapFields';
export default class ExtendSchema {
    constructor({ typeDefs, resolvers = {}, defaultFieldResolver, fieldNodeTransformerMap, }) {
        this.typeDefs = typeDefs;
        this.resolvers = resolvers;
        this.defaultFieldResolver = defaultFieldResolver != null ? defaultFieldResolver : defaultMergedResolver;
        this.transformer = new MapFields(fieldNodeTransformerMap != null ? fieldNodeTransformerMap : {});
    }
    transformSchema(schema) {
        // MapFields's transformSchema function does not actually modify the schema --
        // it saves the current schema state, to be used later to transform requests.
        this.transformer.transformSchema(schema);
        return addResolversToSchema({
            schema: this.typeDefs ? extendSchema(schema, parse(this.typeDefs)) : schema,
            resolvers: this.resolvers != null ? this.resolvers : {},
            defaultFieldResolver: this.defaultFieldResolver,
        });
    }
    transformRequest(originalRequest) {
        return this.transformer.transformRequest(originalRequest);
    }
}
//# sourceMappingURL=ExtendSchema.js.map