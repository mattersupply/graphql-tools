import { Source, SingleFileOptions, Loader } from '@graphql-tools/utils';
export declare type LoadTypedefsOptions<ExtraConfig = {
    [key: string]: any;
}> = SingleFileOptions & ExtraConfig & {
    cache?: {
        [key: string]: Source;
    };
    loaders: Loader[];
    filterKinds?: string[];
    ignore?: string | string[];
    sort?: boolean;
    skipGraphQLImport?: boolean;
    forceGraphQLImport?: boolean;
};
export declare type UnnormalizedTypeDefPointer = {
    [key: string]: any;
} | string;
export declare function loadTypedefs<AdditionalConfig = Record<string, unknown>>(pointerOrPointers: UnnormalizedTypeDefPointer | UnnormalizedTypeDefPointer[], options: LoadTypedefsOptions<Partial<AdditionalConfig>>): Promise<Source[]>;
export declare function loadTypedefsSync<AdditionalConfig = Record<string, unknown>>(pointerOrPointers: UnnormalizedTypeDefPointer | UnnormalizedTypeDefPointer[], options: LoadTypedefsOptions<Partial<AdditionalConfig>>): Source[];
