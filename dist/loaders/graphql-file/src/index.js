import { isValidPath, parseGraphQLSDL, } from '@graphql-tools/utils';
import { isAbsolute, resolve } from 'path';
import { exists, existsSync, readFile, readFileSync } from 'fs-extra';
import { cwd as processCwd } from 'process';
import { processImport } from '@graphql-tools/import';
const FILE_EXTENSIONS = ['.gql', '.gqls', '.graphql', '.graphqls'];
function isGraphQLImportFile(rawSDL) {
    const trimmedRawSDL = rawSDL.trim();
    return trimmedRawSDL.startsWith('# import') || trimmedRawSDL.startsWith('#import');
}
export class GraphQLFileLoader {
    loaderId() {
        return 'graphql-file';
    }
    async canLoad(pointer, options) {
        if (isValidPath(pointer)) {
            if (FILE_EXTENSIONS.find(extension => pointer.endsWith(extension))) {
                const normalizedFilePath = isAbsolute(pointer) ? pointer : resolve(options.cwd, pointer);
                return new Promise(resolve => exists(normalizedFilePath, resolve));
            }
        }
        return false;
    }
    canLoadSync(pointer, options) {
        if (isValidPath(pointer)) {
            if (FILE_EXTENSIONS.find(extension => pointer.endsWith(extension))) {
                const normalizedFilePath = isAbsolute(pointer) ? pointer : resolve(options.cwd, pointer);
                return existsSync(normalizedFilePath);
            }
        }
        return false;
    }
    async load(pointer, options) {
        const normalizedFilePath = isAbsolute(pointer) ? pointer : resolve(options.cwd, pointer);
        const rawSDL = await readFile(normalizedFilePath, { encoding: 'utf8' });
        if (isGraphQLImportFile(rawSDL)) {
            return {
                location: pointer,
                document: processImport(pointer, options.cwd),
            };
        }
        return parseGraphQLSDL(pointer, rawSDL.trim(), options);
    }
    loadSync(pointer, options) {
        const cwd = options.cwd || processCwd();
        const normalizedFilePath = isAbsolute(pointer) ? pointer : resolve(cwd, pointer);
        const rawSDL = readFileSync(normalizedFilePath, { encoding: 'utf8' });
        if (isGraphQLImportFile(rawSDL)) {
            return {
                location: pointer,
                document: processImport(pointer, options.cwd),
            };
        }
        return parseGraphQLSDL(pointer, rawSDL.trim(), options);
    }
}
//# sourceMappingURL=index.js.map