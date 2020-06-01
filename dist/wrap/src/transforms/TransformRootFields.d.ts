import { GraphQLSchema } from 'graphql';
import { Transform, Request } from '@graphql-tools/utils';
import { RootFieldTransformer, FieldNodeTransformer } from '../types';
export default class TransformRootFields implements Transform {
    private readonly transformer;
    constructor(rootFieldTransformer: RootFieldTransformer, fieldNodeTransformer?: FieldNodeTransformer);
    transformSchema(originalSchema: GraphQLSchema): GraphQLSchema;
    transformRequest(originalRequest: Request): Request;
}