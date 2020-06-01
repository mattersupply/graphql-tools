import { GraphQLSchema } from 'graphql';
import { IDelegateToSchemaOptions, IDelegateRequestOptions } from './types';
export declare function delegateToSchema(options: IDelegateToSchemaOptions | GraphQLSchema): any;
export declare function delegateRequest({ request, schema: subschemaOrSubschemaConfig, rootValue, info, operation, fieldName, args, returnType, context, transforms, transformedSchema, skipValidation, skipTypeMerging, }: IDelegateRequestOptions): any;