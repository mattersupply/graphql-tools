import { SchemaPointerSingle, DocumentPointerSingle, SingleFileOptions, Source, UniversalLoader } from '@graphql-tools/utils';
import { GraphQLTagPluckOptions } from '@graphql-tools/graphql-tag-pluck';
export declare type CodeFileLoaderOptions = {
    require?: string | string[];
    pluckConfig?: GraphQLTagPluckOptions;
    noPluck?: boolean;
} & SingleFileOptions;
export declare class CodeFileLoader implements UniversalLoader<CodeFileLoaderOptions> {
    loaderId(): string;
    canLoad(pointer: SchemaPointerSingle | DocumentPointerSingle, options: CodeFileLoaderOptions): Promise<boolean>;
    canLoadSync(pointer: SchemaPointerSingle | DocumentPointerSingle, options: CodeFileLoaderOptions): boolean;
    load(pointer: SchemaPointerSingle | DocumentPointerSingle, options: CodeFileLoaderOptions): Promise<Source>;
    loadSync(pointer: SchemaPointerSingle | DocumentPointerSingle, options: CodeFileLoaderOptions): Source;
}
