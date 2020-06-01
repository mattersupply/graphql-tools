import { printSchemaWithDirectives, fixSchemaAst } from '@graphql-tools/utils';
import { printWithComments, resetComments } from '@graphql-tools/merge';
import { parse, Source as GraphQLSource } from 'graphql';
import { filterKind } from '../filter-document-kind';
export function parseSource({ partialSource, options, globOptions, pointerOptionMap, addValidSource }) {
    if (partialSource) {
        const input = prepareInput({
            source: partialSource,
            options,
            globOptions,
            pointerOptionMap,
        });
        parseSchema(input);
        parseRawSDL(input);
        if (input.source.document) {
            useKindsFilter(input);
            useComments(input);
            collectValidSources(input, addValidSource);
        }
    }
}
//
function prepareInput({ source, options, globOptions, pointerOptionMap, }) {
    const specificOptions = {
        ...options,
        ...(source.location in pointerOptionMap ? globOptions : pointerOptionMap[source.location]),
    };
    return { source: { ...source }, options: specificOptions };
}
function parseSchema(input) {
    if (input.source.schema) {
        input.source.schema = fixSchemaAst(input.source.schema, input.options);
        input.source.rawSDL = printSchemaWithDirectives(input.source.schema, input.options);
    }
}
function parseRawSDL(input) {
    if (input.source.rawSDL) {
        input.source.document = parse(new GraphQLSource(input.source.rawSDL, input.source.location), input.options);
    }
}
function useKindsFilter(input) {
    if (input.options.filterKinds) {
        input.source.document = filterKind(input.source.document, input.options.filterKinds);
    }
}
function useComments(input) {
    if (!input.source.rawSDL) {
        input.source.rawSDL = printWithComments(input.source.document);
        resetComments();
    }
}
function collectValidSources(input, addValidSource) {
    if (input.source.document.definitions && input.source.document.definitions.length > 0) {
        addValidSource(input.source);
    }
}
//# sourceMappingURL=parse.js.map