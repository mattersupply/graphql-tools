import { GraphQLSchema } from 'graphql';
import nock from 'nock';
declare type PromiseOf<T extends (...args: any[]) => any> = T extends (...args: any[]) => Promise<infer R> ? R : ReturnType<T>;
export declare function runTests<TSync extends (...args: any[]) => TResult, TAsync extends (...args: any[]) => Promise<TResult>, TResult = ReturnType<TSync>>({ sync: executeSync, async: executeAsync }: {
    sync?: TSync;
    async?: TAsync;
}): (testRunner: (executeFn: (...args: Parameters<TSync | TAsync>) => Promise<PromiseOf<TSync | TAsync>>, mode: 'sync' | 'async') => void) => void;
export declare function useMonorepo({ dirname }: {
    dirname: string;
}): {
    correctCWD(): void;
};
export declare function mockGraphQLServer({ schema, host, path, intercept, }: {
    schema: GraphQLSchema;
    host: string;
    path: string;
    intercept?: (obj: nock.ReplyFnContext) => void;
}): nock.Scope;
export {};
