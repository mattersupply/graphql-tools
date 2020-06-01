import { compareStrings } from '@graphql-tools/utils';
import { normalizePointers } from './utils/pointers';
import { applyDefaultOptions } from './load-typedefs/options';
import { collectSources, collectSourcesSync } from './load-typedefs/collect-sources';
import { parseSource } from './load-typedefs/parse';
import { useLimit } from './utils/helpers';
const CONCURRENCY_LIMIT = 100;
export async function loadTypedefs(pointerOrPointers, options) {
    const pointerOptionMap = normalizePointers(pointerOrPointers);
    const globOptions = {};
    applyDefaultOptions(options);
    const sources = await collectSources({
        pointerOptionMap,
        options,
    });
    const validSources = [];
    // If we have few k of files it may be an issue
    const limit = useLimit(CONCURRENCY_LIMIT);
    await Promise.all(sources.map(partialSource => limit(() => parseSource({
        partialSource,
        options,
        globOptions,
        pointerOptionMap,
        addValidSource(source) {
            validSources.push(source);
        },
    }))));
    return prepareResult({ options, pointerOptionMap, validSources });
}
export function loadTypedefsSync(pointerOrPointers, options) {
    const pointerOptionMap = normalizePointers(pointerOrPointers);
    const globOptions = {};
    applyDefaultOptions(options);
    const sources = collectSourcesSync({
        pointerOptionMap,
        options,
    });
    const validSources = [];
    sources.forEach(partialSource => {
        parseSource({
            partialSource,
            options,
            globOptions,
            pointerOptionMap,
            addValidSource(source) {
                validSources.push(source);
            },
        });
    });
    return prepareResult({ options, pointerOptionMap, validSources });
}
//
function prepareResult({ options, pointerOptionMap, validSources, }) {
    const pointerList = Object.keys(pointerOptionMap);
    if (pointerList.length > 0 && validSources.length === 0) {
        throw new Error(`
      Unable to find any GraphQL type definitions for the following pointers:
        ${pointerList.map(p => `
          - ${p}
          `)}`);
    }
    return options.sort
        ? validSources.sort((left, right) => compareStrings(left.location, right.location))
        : validSources;
}
//# sourceMappingURL=load-typedefs.js.map