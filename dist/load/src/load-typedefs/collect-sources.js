import { isDocumentString, parseGraphQLSDL, asArray, printSchemaWithDirectives } from '@graphql-tools/utils';
import { isSchema, Kind, parse } from 'graphql';
import isGlob from 'is-glob';
import { loadFile, loadFileSync } from './load-file';
import { stringToHash, useStack } from '../utils/helpers';
import { useCustomLoader, useCustomLoaderSync } from '../utils/custom-loader';
import { useQueue, useSyncQueue } from '../utils/queue';
import unixify from 'unixify';
import globby, { sync as globbySync } from 'globby';
const CONCURRENCY_LIMIT = 50;
export async function collectSources({ pointerOptionMap, options, }) {
    var _a;
    const sources = [];
    const globs = [];
    const globOptions = {};
    const queue = useQueue({ concurrency: CONCURRENCY_LIMIT });
    const { addSource, addGlob, collect } = createHelpers({
        sources,
        globs,
        options,
        globOptions,
        stack: [collectDocumentString, collectGlob, collectCustomLoader, collectFallback],
    });
    for (const pointer in pointerOptionMap) {
        const pointerOptions = {
            ...((_a = pointerOptionMap[pointer]) !== null && _a !== void 0 ? _a : {}),
            unixify,
        };
        collect({
            pointer,
            pointerOptions,
            pointerOptionMap,
            options,
            addSource,
            addGlob,
            queue: queue.add,
        });
    }
    if (globs.length) {
        includeIgnored({
            options,
            globs,
        });
        const paths = await globby(globs, createGlobbyOptions(options));
        collectSourcesFromGlobals({
            filepaths: paths,
            options,
            globOptions,
            pointerOptionMap,
            addSource,
            queue: queue.add,
        });
    }
    await queue.runAll();
    return sources;
}
export function collectSourcesSync({ pointerOptionMap, options, }) {
    var _a;
    const sources = [];
    const globs = [];
    const globOptions = {};
    const queue = useSyncQueue();
    const { addSource, addGlob, collect } = createHelpers({
        sources,
        globs,
        options,
        globOptions,
        stack: [collectDocumentString, collectGlob, collectCustomLoaderSync, collectFallbackSync],
    });
    for (const pointer in pointerOptionMap) {
        const pointerOptions = {
            ...((_a = pointerOptionMap[pointer]) !== null && _a !== void 0 ? _a : {}),
            unixify,
        };
        collect({
            pointer,
            pointerOptions,
            pointerOptionMap,
            options,
            addSource,
            addGlob,
            queue: queue.add,
        });
    }
    if (globs.length) {
        includeIgnored({
            options,
            globs,
        });
        const paths = globbySync(globs, createGlobbyOptions(options));
        collectSourcesFromGlobalsSync({
            filepaths: paths,
            options,
            globOptions,
            pointerOptionMap,
            addSource,
            queue: queue.add,
        });
    }
    queue.runAll();
    return sources;
}
//
function createHelpers({ sources, globs, options, globOptions, stack, }) {
    const addSource = ({ pointer, source, noCache, }) => {
        sources.push(source);
        if (!noCache) {
            options.cache[pointer] = source;
        }
    };
    const collect = useStack(...stack);
    const addGlob = ({ pointerOptions, pointer }) => {
        globs.push(pointer);
        Object.assign(globOptions, pointerOptions);
    };
    return {
        addSource,
        collect,
        addGlob,
    };
}
function includeIgnored({ options, globs }) {
    if (options.ignore) {
        const ignoreList = asArray(options.ignore)
            .map(g => `!(${g})`)
            .map(unixify);
        if (ignoreList.length > 0) {
            globs.push(...ignoreList);
        }
    }
}
function createGlobbyOptions(options) {
    return { absolute: true, ...options, ignore: [] };
}
function collectSourcesFromGlobals({ filepaths, options, globOptions, pointerOptionMap, addSource, queue, }) {
    const collectFromGlobs = useStack(collectCustomLoader, collectFallback);
    for (let i = 0; i < filepaths.length; i++) {
        const pointer = filepaths[i];
        collectFromGlobs({
            pointer,
            pointerOptions: globOptions,
            pointerOptionMap,
            options,
            addSource,
            addGlob: () => {
                throw new Error(`I don't accept any new globs!`);
            },
            queue,
        });
    }
}
function collectSourcesFromGlobalsSync({ filepaths, options, globOptions, pointerOptionMap, addSource, queue, }) {
    const collectFromGlobs = useStack(collectCustomLoaderSync, collectFallbackSync);
    for (let i = 0; i < filepaths.length; i++) {
        const pointer = filepaths[i];
        collectFromGlobs({
            pointer,
            pointerOptions: globOptions,
            pointerOptionMap,
            options,
            addSource,
            addGlob: () => {
                throw new Error(`I don't accept any new globs!`);
            },
            queue,
        });
    }
}
function addResultOfCustomLoader({ pointer, result, addSource, }) {
    if (isSchema(result)) {
        addSource({
            source: {
                location: pointer,
                schema: result,
                document: parse(printSchemaWithDirectives(result)),
            },
            pointer,
            noCache: true,
        });
    }
    else if (result.kind && result.kind === Kind.DOCUMENT) {
        addSource({
            source: {
                document: result,
                location: pointer,
            },
            pointer,
        });
    }
    else if (result.document) {
        addSource({
            source: {
                location: pointer,
                ...result,
            },
            pointer,
        });
    }
}
function collectDocumentString({ pointer, pointerOptions, options, addSource, queue }, next) {
    if (isDocumentString(pointer)) {
        return queue(() => {
            const source = parseGraphQLSDL(`${stringToHash(pointer)}.graphql`, pointer, {
                ...options,
                ...pointerOptions,
            });
            addSource({
                source,
                pointer,
            });
        });
    }
    next();
}
function collectGlob({ pointer, pointerOptions, addGlob }, next) {
    if (isGlob(pointerOptions.unixify(pointer))) {
        return addGlob({
            pointer: pointerOptions.unixify(pointer),
            pointerOptions,
        });
    }
    next();
}
function collectCustomLoader({ pointer, pointerOptions, queue, addSource, options, pointerOptionMap }, next) {
    if (pointerOptions.loader) {
        return queue(async () => {
            const loader = await useCustomLoader(pointerOptions.loader, options.cwd);
            const result = await loader(pointer, { ...options, ...pointerOptions }, pointerOptionMap);
            if (!result) {
                return;
            }
            addResultOfCustomLoader({ pointer, result, addSource });
        });
    }
    next();
}
function collectCustomLoaderSync({ pointer, pointerOptions, queue, addSource, options, pointerOptionMap }, next) {
    if (pointerOptions.loader) {
        return queue(() => {
            const loader = useCustomLoaderSync(pointerOptions.loader, options.cwd);
            const result = loader(pointer, { ...options, ...pointerOptions }, pointerOptionMap);
            if (result) {
                addResultOfCustomLoader({ pointer, result, addSource });
            }
        });
    }
    next();
}
function collectFallback({ queue, pointer, options, pointerOptions, addSource }) {
    return queue(async () => {
        const source = await loadFile(pointer, {
            ...options,
            ...pointerOptions,
        });
        if (source) {
            addSource({ source, pointer });
        }
    });
}
function collectFallbackSync({ queue, pointer, options, pointerOptions, addSource }) {
    return queue(() => {
        const source = loadFileSync(pointer, {
            ...options,
            ...pointerOptions,
        });
        if (source) {
            addSource({ source, pointer });
        }
    });
}
//# sourceMappingURL=collect-sources.js.map