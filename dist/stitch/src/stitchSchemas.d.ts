import { DocumentNode, GraphQLSchema } from 'graphql';
import { IStitchSchemasOptions } from './types';
export declare function stitchSchemas({ subschemas, types, typeDefs, schemas, onTypeConflict, resolvers, schemaDirectives, inheritResolversFromInterfaces, mergeTypes, mergeDirectives, logger, allowUndefinedInResolve, resolverValidationOptions, directiveResolvers, schemaTransforms, parseOptions, }: IStitchSchemasOptions): GraphQLSchema;
export declare function isDocumentNode(object: any): object is DocumentNode;