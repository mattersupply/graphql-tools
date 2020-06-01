import { GraphQLSchema } from 'graphql';
import { SubschemaConfig } from './types';
export declare function getSubschema(result: any, responseKey: string): GraphQLSchema | SubschemaConfig;
export declare function setObjectSubschema(result: any, subschema: GraphQLSchema | SubschemaConfig): void;
