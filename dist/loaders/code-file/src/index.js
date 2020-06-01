import { Kind, isSchema, print } from 'graphql';
import { debugLog, asArray, isValidPath, parseGraphQLSDL, printSchemaWithDirectives, } from '@graphql-tools/utils';
import { gqlPluckFromCodeString, gqlPluckFromCodeStringSync, } from '@graphql-tools/graphql-tag-pluck';
import { tryToLoadFromExport, tryToLoadFromExportSync } from './load-from-module';
import { isAbsolute, resolve } from 'path';
import { exists, existsSync, readFileSync, readFile } from 'fs-extra';
import { cwd } from 'process';
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.vue'];
export class CodeFileLoader {
    loaderId() {
        return 'code-file';
    }
    async canLoad(pointer, options) {
        if (isValidPath(pointer)) {
            if (FILE_EXTENSIONS.find(extension => pointer.endsWith(extension))) {
                const normalizedFilePath = isAbsolute(pointer) ? pointer : resolve(options.cwd || cwd(), pointer);
                return new Promise(resolve => exists(normalizedFilePath, resolve));
            }
        }
        return false;
    }
    canLoadSync(pointer, options) {
        if (isValidPath(pointer)) {
            if (FILE_EXTENSIONS.find(extension => pointer.endsWith(extension))) {
                const normalizedFilePath = isAbsolute(pointer) ? pointer : resolve(options.cwd || cwd(), pointer);
                if (existsSync(normalizedFilePath)) {
                    return true;
                }
            }
        }
        return false;
    }
    async load(pointer, options) {
        const normalizedFilePath = ensureAbsolutePath(pointer, options);
        const errors = [];
        if (!options.noPluck) {
            try {
                const content = await readFile(normalizedFilePath, { encoding: 'utf-8' });
                const sdl = await gqlPluckFromCodeString(normalizedFilePath, content, options.pluckConfig);
                if (sdl) {
                    return parseSDL({ pointer, sdl, options });
                }
            }
            catch (e) {
                debugLog(`Failed to load schema from code file "${normalizedFilePath}": ${e.message}`);
                errors.push(e);
            }
        }
        if (!options.noRequire) {
            try {
                if (options && options.require) {
                    await Promise.all(asArray(options.require).map(m => import(m)));
                }
                const loaded = await tryToLoadFromExport(normalizedFilePath);
                const source = resolveSource(pointer, loaded, options);
                if (source) {
                    return source;
                }
            }
            catch (e) {
                errors.push(e);
            }
        }
        if (errors.length > 0) {
            throw errors[0];
        }
        return null;
    }
    loadSync(pointer, options) {
        const normalizedFilePath = ensureAbsolutePath(pointer, options);
        const errors = [];
        if (!options.noPluck) {
            try {
                const content = readFileSync(normalizedFilePath, { encoding: 'utf-8' });
                const sdl = gqlPluckFromCodeStringSync(normalizedFilePath, content, options.pluckConfig);
                if (sdl) {
                    return parseSDL({ pointer, sdl, options });
                }
            }
            catch (e) {
                debugLog(`Failed to load schema from code file "${normalizedFilePath}": ${e.message}`);
                errors.push(e);
            }
        }
        if (!options.noRequire) {
            try {
                if (options && options.require) {
                    asArray(options.require).forEach(m => require(m));
                }
                const loaded = tryToLoadFromExportSync(normalizedFilePath);
                const source = resolveSource(pointer, loaded, options);
                if (source) {
                    return source;
                }
            }
            catch (e) {
                errors.push(e);
            }
        }
        if (errors.length > 0) {
            throw errors[0];
        }
        return null;
    }
}
function parseSDL({ pointer, sdl, options }) {
    return parseGraphQLSDL(pointer, sdl, options);
}
function resolveSource(pointer, value, options) {
    if (isSchema(value)) {
        return {
            location: pointer,
            rawSDL: printSchemaWithDirectives(value, options),
            schema: value,
        };
    }
    else if ((value === null || value === void 0 ? void 0 : value.kind) === Kind.DOCUMENT) {
        return {
            location: pointer,
            rawSDL: print(value),
            document: value,
        };
    }
    else if (typeof value === 'string') {
        return parseGraphQLSDL(pointer, value, options);
    }
    return null;
}
function ensureAbsolutePath(pointer, options) {
    return isAbsolute(pointer) ? pointer : resolve(options.cwd || cwd(), pointer);
}
//# sourceMappingURL=index.js.map